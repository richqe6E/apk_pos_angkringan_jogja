import { create } from 'zustand';
import { SQLiteDatabase, withSqliteRetry } from '../services/database';
import { getBusinessDate, calculateAttendanceStatus, formatRealtimeClock } from '../utils/sessionHelper';
import { saveImageLocally, deleteMonthlyAttendancePhotos } from '../utils/imageStorage';

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  business_date: string;
  check_in_time: string;
  check_in_photo: string;
  is_late: number;
  late_minutes: number;
  check_out_time: string | null;
  created_at: string;
}

interface AttendanceState {
  todayAttendanceMap: Record<number, AttendanceRecord>; // employee_id -> AttendanceRecord
  attendanceHistory: AttendanceRecord[];
  isLoading: boolean;
  isSessionClosing: boolean;

  loadTodayAttendance: (db: SQLiteDatabase) => Promise<void>;
  recordCheckIn: (
    db: SQLiteDatabase,
    employeeId: number,
    employeeName: string,
    tempPhotoUri: string
  ) => Promise<AttendanceRecord>;
  closeOperatingSession: (
    db: SQLiteDatabase,
    closedBy?: string
  ) => Promise<{ sessionClosedAt: string; totalStaffClosed: number }>;
  loadAttendanceHistory: (db: SQLiteDatabase, monthPrefix?: string) => Promise<AttendanceRecord[]>;
  deleteAttendancePhotosForMonth: (db: SQLiteDatabase, monthPrefix: string) => Promise<number>;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  todayAttendanceMap: {},
  attendanceHistory: [],
  isLoading: false,
  isSessionClosing: false,

  loadTodayAttendance: async (db: SQLiteDatabase) => {
    set({ isLoading: true });
    try {
      const businessDate = getBusinessDate();
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<AttendanceRecord>(
          'SELECT * FROM attendance WHERE business_date = ? ORDER BY id ASC',
          [businessDate]
        )
      );

      const map: Record<number, AttendanceRecord> = {};
      (rows || []).forEach((rec) => {
        map[rec.employee_id] = rec;
      });

      set({ todayAttendanceMap: map, isLoading: false });
    } catch (err) {
      console.error('Error loading today attendance:', err);
      set({ isLoading: false });
    }
  },

  recordCheckIn: async (db: SQLiteDatabase, employeeId, employeeName, tempPhotoUri) => {
    const businessDate = getBusinessDate();
    const existing = get().todayAttendanceMap[employeeId];

    if (existing) {
      throw new Error(`Karyawan ${employeeName} sudah melakukan absensi masuk hari ini (${existing.check_in_time} WIB) dan tidak dapat absen ganda.`);
    }

    // Hitung status dan menit keterlambatan (Patokan 17.30 WIB)
    const { isLate, lateMinutes, timeString } = calculateAttendanceStatus();

    // Kompresi dan simpan foto secara lokal permanen
    const permanentPhotoPath = await saveImageLocally(tempPhotoUri, 'attendance');

    const res = await withSqliteRetry(() =>
      db.runAsync(
        `INSERT INTO attendance (
          employee_id, employee_name, business_date, check_in_time,
          check_in_photo, is_late, late_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          employeeId,
          employeeName,
          businessDate,
          timeString,
          permanentPhotoPath,
          isLate ? 1 : 0,
          lateMinutes,
        ]
      )
    );

    const newRecord: AttendanceRecord = {
      id: res.lastInsertRowId,
      employee_id: employeeId,
      employee_name: employeeName,
      business_date: businessDate,
      check_in_time: timeString,
      check_in_photo: permanentPhotoPath,
      is_late: isLate ? 1 : 0,
      late_minutes: lateMinutes,
      check_out_time: null,
      created_at: new Date().toISOString(),
    };

    set({
      todayAttendanceMap: {
        ...get().todayAttendanceMap,
        [employeeId]: newRecord,
      },
    });

    return newRecord;
  },

  closeOperatingSession: async (db: SQLiteDatabase, closedBy = 'Admin/Kasir') => {
    set({ isSessionClosing: true });
    try {
      const businessDate = getBusinessDate();
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const checkoutTimeString = `${currentHours}:${currentMinutes}`;

      // 1. Serentak update seluruh staf yang belum absen pulang pada sesi ini
      const updateRes = await withSqliteRetry(() =>
        db.runAsync(
          `UPDATE attendance
           SET check_out_time = ?
           WHERE business_date = ? AND (check_out_time IS NULL OR check_out_time = '')`,
          [checkoutTimeString, businessDate]
        )
      );

      // 2. Tandai operating session sebagai closed
      await withSqliteRetry(() =>
        db.runAsync(
          `INSERT INTO operating_sessions (business_date, opened_at, closed_at, opened_by, closed_by, status)
           VALUES (?, datetime('now','localtime'), datetime('now','localtime'), ?, ?, 'closed')
           ON CONFLICT(business_date) DO UPDATE SET
             closed_at = datetime('now','localtime'),
             closed_by = ?,
             status = 'closed'`,
          [businessDate, closedBy, closedBy, closedBy]
        )
      );

      await get().loadTodayAttendance(db);
      set({ isSessionClosing: false });

      return {
        sessionClosedAt: checkoutTimeString,
        totalStaffClosed: updateRes.changes,
      };
    } catch (err) {
      set({ isSessionClosing: false });
      throw err;
    }
  },

  loadAttendanceHistory: async (db: SQLiteDatabase, monthPrefix) => {
    try {
      let query = 'SELECT * FROM attendance ORDER BY id DESC';
      const params: any[] = [];

      if (monthPrefix) {
        query = 'SELECT * FROM attendance WHERE business_date LIKE ? ORDER BY id DESC';
        params.push(`${monthPrefix}%`);
      }

      const rows = await withSqliteRetry(() =>
        db.getAllAsync<AttendanceRecord>(query, params)
      );

      const list = rows || [];
      set({ attendanceHistory: list });
      return list;
    } catch (err) {
      console.error('Error loading attendance history:', err);
      return [];
    }
  },

  deleteAttendancePhotosForMonth: async (db: SQLiteDatabase, monthPrefix: string) => {
    try {
      const deletedFiles = await deleteMonthlyAttendancePhotos(monthPrefix);

      // Kosongkan path di database agar tidak mengarah ke file yang sudah dihapus
      await withSqliteRetry(() =>
        db.runAsync(
          `UPDATE attendance SET check_in_photo = '' WHERE business_date LIKE ?`,
          [`${monthPrefix}%`]
        )
      );

      await get().loadTodayAttendance(db);
      return deletedFiles;
    } catch (err) {
      console.error('Error deleting attendance photos for month:', err);
      return 0;
    }
  },
}));

