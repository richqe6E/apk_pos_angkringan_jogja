import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { RealtimeClockBadge } from '../../components/realtime-clock-badge';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Employee, useEmployeeStore } from '../../stores/employeeStore';
import { AttendanceRecord, useAttendanceStore } from '../../stores/attendanceStore';
import { AttendanceCameraModal } from '../../components/attendance-camera-modal';
import { EmployeeModal } from '../../components/employee-modal';
import { AdminPinModal } from '../../components/admin-pin-modal';
import { getBusinessDate, formatFullIndonesianDate } from '../../utils/sessionHelper';
import { exportAttendanceToPdf, exportAttendanceToCsv } from '../../services/export';

type ActiveTab = 'today' | 'history' | 'employees';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const WEEKDAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function AttendanceScreen() {
  const db = useSQLiteContext();
  const { employees, loadEmployees, toggleEmployeeActive, deleteEmployee } = useEmployeeStore();
  const {
    todayAttendanceMap,
    attendanceHistory,
    isLoading,
    loadTodayAttendance,
    recordCheckIn,
    closeOperatingSession,
    loadAttendanceHistory,
    deleteAttendancePhotosForMonth,
  } = useAttendanceStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [selectedEmployeeForCheckIn, setSelectedEmployeeForCheckIn] = useState<Employee | null>(null);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [adminPinVisible, setAdminPinVisible] = useState(false);
  const [adminAction, setAdminAction] = useState<'clean_photos' | 'close_session' | null>(null);
  const [viewPhotoUri, setViewPhotoUri] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const businessDate = getBusinessDate();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const bd = getBusinessDate();
    return bd.slice(0, 7);
  });
  const [selectedDate, setSelectedDate] = useState(() => getBusinessDate());

  useEffect(() => {
    loadEmployees(db);
    loadTodayAttendance(db);
  }, [db]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadAttendanceHistory(db, currentMonth);
    }
  }, [activeTab, currentMonth, db]);

  const activeEmployees = employees.filter((e) => e.is_active === 1);
  const totalActive = activeEmployees.length;
  const presentCount = Object.keys(todayAttendanceMap).length;
  const absentCount = Math.max(0, totalActive - presentCount);
  const lateCount = Object.values(todayAttendanceMap).filter((a) => a.is_late === 1).length;

  const changeMonth = (newMonth: string) => {
    setCurrentMonth(newMonth);
    const todayBiz = getBusinessDate();
    if (newMonth === todayBiz.slice(0, 7)) {
      setSelectedDate(todayBiz);
    } else {
      setSelectedDate(`${newMonth}-01`);
    }
  };

  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    changeMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    changeMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleThisMonth = () => {
    const todayBiz = getBusinessDate();
    setCurrentMonth(todayBiz.slice(0, 7));
    setSelectedDate(todayBiz);
  };

  const [yearNum, monthNum] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayOfWeek = new Date(yearNum, monthNum - 1, 1).getDay(); // 0 = Min, 6 = Sab

  const attendanceByDate: Record<string, AttendanceRecord[]> = {};
  for (const rec of attendanceHistory) {
    if (!attendanceByDate[rec.business_date]) {
      attendanceByDate[rec.business_date] = [];
    }
    attendanceByDate[rec.business_date].push(rec);
  }

  const selectedDateRecords = attendanceByDate[selectedDate] || [];
  const selectedTotalPresent = selectedDateRecords.length;
  const selectedOnTime = selectedDateRecords.filter((r) => r.is_late === 0).length;
  const selectedLate = selectedDateRecords.filter((r) => r.is_late === 1).length;

  const handleStartCheckIn = (emp: Employee) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedEmployeeForCheckIn(emp);
    setCameraModalVisible(true);
  };

  const handleCaptureComplete = async (photoUri: string) => {
    if (!selectedEmployeeForCheckIn) return;
    try {
      await recordCheckIn(
        db,
        selectedEmployeeForCheckIn.id,
        selectedEmployeeForCheckIn.name,
        photoUri
      );
      setCameraModalVisible(false);
      setSelectedEmployeeForCheckIn(null);
      Alert.alert('Sukses', `Absensi masuk ${selectedEmployeeForCheckIn.name} berhasil dicatat.`);
    } catch (err: any) {
      Alert.alert('Gagal Absensi', err.message || 'Terjadi kesalahan sistem.');
    }
  };

  const handleCloseSessionPress = () => {
    Alert.alert(
      'Tutup Sesi Operasional Toko?',
      `Seluruh karyawan aktif yang hadir hari ini (${presentCount} orang) akan otomatis dicatat jam pulangnya serentak berdasarkan waktu sekarang.\n\nTindakan ini menandai berakhirnya operasional malam ini.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Tutup Sesi Sekarang',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await closeOperatingSession(db, 'Kasir / Admin');
              Alert.alert(
                'Sesi Operasional Ditutup',
                `Sesi berhasil ditutup pada ${res.sessionClosedAt} WIB.\nTotal ${res.totalStaffClosed} karyawan ditandai pulang.`
              );
            } catch (err: any) {
              Alert.alert('Gagal Menutup Sesi', err.message || 'Terjadi kesalahan.');
            }
          },
        },
      ]
    );
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const records =
        selectedDateRecords.length > 0
          ? selectedDateRecords
          : attendanceHistory.length > 0
            ? attendanceHistory
            : Object.values(todayAttendanceMap);
      await exportAttendanceToPdf(records, `Periode: ${selectedDate || businessDate}`);
    } catch (err: any) {
      Alert.alert('Export Gagal', err.message || 'Terjadi kesalahan saat membuat PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const records =
        selectedDateRecords.length > 0
          ? selectedDateRecords
          : attendanceHistory.length > 0
            ? attendanceHistory
            : Object.values(todayAttendanceMap);
      await exportAttendanceToCsv(records, `rekap_absensi_${selectedDate || businessDate}`);
    } catch (err: any) {
      Alert.alert('Export Gagal', err.message || 'Terjadi kesalahan saat membuat CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCleanPhotosRequest = () => {
    setAdminAction('clean_photos');
    setAdminPinVisible(true);
  };

  const handleAdminPinSuccess = async () => {
    setAdminPinVisible(false);
    if (adminAction === 'clean_photos') {
      try {
        const currentMonth = businessDate.substring(0, 7); // 'YYYY-MM'
        const count = await deleteAttendancePhotosForMonth(db, currentMonth);
        Alert.alert(
          'Pembersihan Selesai',
          `Berhasil menghapus ${count} file foto absensi bulan ini untuk menghemat ruang memori lokal tablet.`
        );
      } catch (err: any) {
        Alert.alert('Gagal Membersihkan Foto', err.message);
      }
    }
    setAdminAction(null);
  };

  const renderTodayTab = () => (
    <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
      {/* Operating Status & Summary Card */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>TANGGAL OPERASIONAL ANGKRIKAN</Text>
            <Text style={styles.summaryDate}>{formatFullIndonesianDate(businessDate)}</Text>
            <Text style={styles.summaryNote}>Patokan Jam Masuk: 17.30 WIB (Melebihi = Terlambat otomatis)</Text>
          </View>
          <Button
            title="Tutup Sesi Operasional"
            variant="danger"
            onPress={handleCloseSessionPress}
            style={styles.closeSessionBtn}
          />
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalActive}</Text>
            <Text style={styles.statTitle}>Total Karyawan</Text>
          </View>
          <View style={[styles.statBox, { borderColor: Colors.primary }]}>
            <Text style={[styles.statNumber, { color: Colors.primary }]}>{presentCount}</Text>
            <Text style={styles.statTitle}>Hadir Hari Ini</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#d97706' }]}>
            <Text style={[styles.statNumber, { color: '#d97706' }]}>{absentCount}</Text>
            <Text style={styles.statTitle}>Belum Hadir</Text>
          </View>
          <View style={[styles.statBox, { borderColor: Colors.danger }]}>
            <Text style={[styles.statNumber, { color: Colors.danger }]}>{lateCount}</Text>
            <Text style={styles.statTitle}>Terlambat</Text>
          </View>
        </View>
      </Card>

      {/* Staff Check-in Cards */}
      <Text style={styles.sectionHeaderTitle}>Daftar Karyawan Hari Ini</Text>
      <View style={styles.employeeGrid}>
        {activeEmployees.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada data karyawan aktif.</Text>
            <Button
              title="+ Tambah Karyawan Baru"
              variant="outline"
              onPress={() => {
                setEditingEmployee(null);
                setEmployeeModalVisible(true);
              }}
              style={{ marginTop: 10 }}
            />
          </View>
        ) : (
          activeEmployees.map((emp) => {
            const att = todayAttendanceMap[emp.id];
            const isCheckedIn = !!att;

            return (
              <Card
                key={emp.id}
                style={[
                  styles.staffCard,
                  isCheckedIn ? styles.staffCardCheckedIn : styles.staffCardPending,
                ]}
              >
                <View style={styles.staffCardHeader}>
                  <View style={styles.staffInfo}>
                    <Text style={styles.staffName}>{emp.name}</Text>
                    <Text style={styles.staffPhone}>{emp.phone || 'Tanpa No. HP'}</Text>
                  </View>
                  {isCheckedIn ? (
                    <Badge
                      label={
                        att.is_late === 1
                          ? `Terlambat (${att.late_minutes} mnt)`
                          : 'Tepat Waktu'
                      }
                      variant={att.is_late === 1 ? 'danger' : 'success'}
                    />
                  ) : (
                    <Badge label="Belum Absen" variant="warning" />
                  )}
                </View>

                {isCheckedIn ? (
                  <View style={styles.attDetailsRow}>
                    {att.check_in_photo ? (
                      <TouchableOpacity
                        onPress={() => setViewPhotoUri(att.check_in_photo)}
                        style={styles.photoThumbContainer}
                      >
                        <Image source={{ uri: att.check_in_photo }} style={styles.photoThumb} />
                        <Text style={styles.photoThumbText}>Lihat Foto</Text>
                      </TouchableOpacity>
                    ) : null}

                    <View style={styles.attTimeInfo}>
                      <Text style={styles.timeLabel}>
                        Masuk:{' '}
                        <Text style={styles.timeValueBold}>{att.check_in_time} WIB</Text>
                      </Text>
                      <Text style={styles.timeLabel}>
                        Pulang:{' '}
                        {att.check_out_time ? (
                          <Text style={styles.timeValueBold}>{att.check_out_time} WIB</Text>
                        ) : (
                          <Text style={{ color: '#059669', fontWeight: '700' }}>
                            Sedang Bertugas
                          </Text>
                        )}
                      </Text>
                    </View>

                    <View style={styles.lockedNotice}>
                      <Text style={styles.lockedNoticeText}>Terkunci (1x Absen/Hari)</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <Button
                      title="Ambil Foto & Absen Masuk"
                      variant="primary"
                      onPress={() => handleStartCheckIn(emp)}
                      style={styles.checkInBtn}
                    />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </View>
    </ScrollView>
  );

  const renderHistoryTab = () => {
    const currentMonthLabel = `${MONTH_NAMES[monthNum - 1]} ${yearNum}`;

    return (
      <ScrollView style={styles.historyContainer} contentContainerStyle={styles.historyScrollContent}>
        {/* Action Header */}
        <View style={styles.historyActionBar}>
          <View>
            <Text style={styles.historyTitle}>Rekap & Riwayat Absensi Karyawan</Text>
            <Text style={styles.historySubtitle}>
              Kalender bulanan interaktif & rincian absensi harian staf
            </Text>
          </View>

          <View style={styles.historyButtons}>
            <Button
              title="Unduh PDF (Hari Ini)"
              variant="outline"
              onPress={handleExportPdf}
              loading={isExporting}
              style={styles.exportBtn}
            />
            <Button
              title="Unduh CSV"
              variant="outline"
              onPress={handleExportCsv}
              loading={isExporting}
              style={styles.exportBtn}
            />
            <Button
              title="Bersihkan Foto Bulanan"
              variant="danger"
              onPress={handleCleanPhotosRequest}
              style={styles.exportBtn}
            />
          </View>
        </View>

        {/* Interactive Calendar Card */}
        <Card style={styles.calendarCard}>
          {/* Month Navigation Bar */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn}>
              <Text style={styles.monthNavArrow}>◀</Text>
            </TouchableOpacity>

            <View style={styles.monthLabelContainer}>
              <Text style={styles.monthLabelText}>{currentMonthLabel}</Text>
            </View>

            <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn}>
              <Text style={styles.monthNavArrow}>▶</Text>
            </TouchableOpacity>

            <Button
              title="Bulan Ini"
              size="sm"
              variant="outline"
              onPress={handleThisMonth}
              style={styles.thisMonthBtn}
            />
          </View>

          {/* Weekday Columns (Min, Sen, Sel, Rab, Kam, Jum, Sab) */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_NAMES.map((w, idx) => (
              <View key={w} style={styles.weekdayCol}>
                <Text style={[styles.weekdayText, (idx === 0 || idx === 6) && styles.weekendText]}>
                  {w}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid (Days 1..daysInMonth) */}
          <View style={styles.calendarGrid}>
            {/* Empty slots for start-of-month weekday offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCellEmpty} />
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayStr = String(day).padStart(2, '0');
              const cellDate = `${currentMonth}-${dayStr}`;
              const isSelected = cellDate === selectedDate;
              const isToday = cellDate === businessDate;
              const records = attendanceByDate[cellDate] || [];
              const hasRecords = records.length > 0;
              const hasLate = records.some((r) => r.is_late === 1);

              return (
                <TouchableOpacity
                  key={cellDate}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => setSelectedDate(cellDate)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayCellTopRow}>
                    <Text
                      style={[
                        styles.dayNumber,
                        isSelected && styles.dayNumberSelected,
                        isToday && !isSelected && styles.dayNumberToday,
                      ]}
                    >
                      {day}
                    </Text>
                    {isToday && !isSelected && (
                      <View style={styles.todayIndicatorDot} />
                    )}
                  </View>

                  {/* Presence indicator badge or dot */}
                  <View style={styles.cellBadgeContainer}>
                    {hasRecords ? (
                      <View
                        style={[
                          styles.cellPresenceBadge,
                          hasLate ? styles.cellBadgeLate : styles.cellBadgeOnTime,
                          isSelected && styles.cellPresenceBadgeSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.cellPresenceBadgeText,
                            isSelected && styles.cellPresenceBadgeTextSelected,
                          ]}
                        >
                          {hasLate ? `! ${records.length}` : `✓ ${records.length}`}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.cellEmptyPlaceholder} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Calendar Legend Footer */}
          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>Hadir Tepat Waktu</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Ada Terlambat</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Tanggal Terpilih</Text>
            </View>
          </View>
        </Card>

        {/* Date Breakdown View (selectedDate) */}
        <Card style={styles.breakdownCard}>
          {/* Breakdown Header */}
          <View style={styles.breakdownHeader}>
            <View>
              <Text style={styles.breakdownTitle}>
                📅 Rincian Absensi: {formatFullIndonesianDate(selectedDate)}
              </Text>
              <Text style={styles.breakdownSubtitle}>
                Daftar presensi seluruh karyawan yang bertugas pada tanggal operasional ini
              </Text>
            </View>
          </View>

          {/* Summary Metric Chips */}
          <View style={styles.metricChipsRow}>
            <View style={[styles.metricChip, styles.metricChipPrimary]}>
              <Text style={styles.metricChipLabel}>Total Hadir</Text>
              <Text style={styles.metricChipValue}>{selectedTotalPresent} Orang</Text>
            </View>

            <View style={[styles.metricChip, styles.metricChipSuccess]}>
              <Text style={styles.metricChipLabel}>Tepat Waktu</Text>
              <Text style={styles.metricChipValue}>{selectedOnTime} Orang</Text>
            </View>

            <View style={[styles.metricChip, styles.metricChipWarning]}>
              <Text style={styles.metricChipLabel}>Terlambat</Text>
              <Text style={styles.metricChipValue}>{selectedLate} Orang</Text>
            </View>
          </View>

          {/* List of Employee Cards on that Date */}
          {selectedDateRecords.length === 0 ? (
            <View style={styles.emptyBreakdown}>
              <Text style={styles.emptyBreakdownEmoji}>🍃</Text>
              <Text style={styles.emptyBreakdownTitle}>Tidak Ada Data Absensi</Text>
              <Text style={styles.emptyBreakdownSub}>
                Tidak ada catatan kehadiran staf untuk tanggal {formatFullIndonesianDate(selectedDate)}.
                Silakan pilih tanggal lain pada kalender di atas.
              </Text>
            </View>
          ) : (
            <View style={styles.empCardsList}>
              {selectedDateRecords.map((item, idx) => (
                <View key={item.id} style={styles.empBreakdownCard}>
                  <View style={styles.empBreakdownLeft}>
                    <Text style={styles.empBreakdownIndex}>#{idx + 1}</Text>
                    {item.check_in_photo ? (
                      <TouchableOpacity onPress={() => setViewPhotoUri(item.check_in_photo)}>
                        <Image source={{ uri: item.check_in_photo }} style={styles.empBreakdownThumb} />
                        <Text style={styles.thumbZoomHint}>Perbesar</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.empBreakdownNoThumb}>
                        <Text style={styles.noThumbText}>Tanpa Foto</Text>
                      </View>
                    )}
                    <View style={styles.empBreakdownMeta}>
                      <Text style={styles.empBreakdownName}>{item.employee_name}</Text>
                      <Text style={styles.empBreakdownTimes}>
                        Masuk: <Text style={styles.timeHighlight}>{item.check_in_time} WIB</Text> | Pulang:{' '}
                        <Text style={styles.timeHighlight}>
                          {item.check_out_time ? `${item.check_out_time} WIB` : 'Aktif'}
                        </Text>
                      </Text>
                    </View>
                  </View>

                  <Badge
                    label={
                      item.is_late === 1
                        ? `Terlambat ${item.late_minutes} Menit`
                        : 'Tepat Waktu'
                    }
                    variant={item.is_late === 1 ? 'danger' : 'success'}
                  />
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    );
  };

  const renderEmployeesTab = () => (
    <View style={styles.historyContainer}>
      <View style={styles.historyActionBar}>
        <View>
          <Text style={styles.historyTitle}>Daftar Master Karyawan</Text>
          <Text style={styles.historySubtitle}>Kelola nama, nomor telepon, dan status aktif staf</Text>
        </View>

        <Button
          title="+ Tambah Karyawan Baru"
          variant="primary"
          onPress={() => {
            setEditingEmployee(null);
            setEmployeeModalVisible(true);
          }}
        />
      </View>

      <FlatList
        data={employees}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada daftar karyawan.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.employeeRowCard}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.historyEmpName}>{item.name}</Text>
                <Badge
                  label={item.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                  variant={item.is_active === 1 ? 'success' : 'neutral'}
                />
              </View>
              <Text style={styles.staffPhone}>{item.phone || 'Tanpa No. HP'}</Text>
            </View>

            <View style={styles.empRowActions}>
              <Button
                title={item.is_active === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                variant="outline"
                size="sm"
                onPress={() => toggleEmployeeActive(db, item.id, item.is_active)}
              />
              <Button
                title="Edit"
                variant="outline"
                size="sm"
                onPress={() => {
                  setEditingEmployee(item);
                  setEmployeeModalVisible(true);
                }}
              />
              <Button
                title="Hapus"
                variant="danger"
                size="sm"
                onPress={() => {
                  Alert.alert(
                    'Hapus Karyawan',
                    `Apakah Anda yakin ingin menghapus data ${item.name}?`,
                    [
                      { text: 'Batal', style: 'cancel' },
                      {
                        text: 'Hapus',
                        style: 'destructive',
                        onPress: () => deleteEmployee(db, item.id),
                      },
                    ]
                  );
                }}
              />
            </View>
          </Card>
        )}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Absensi & Manajemen Karyawan</Text>
          <Text style={styles.headerSubtitle}>
            Kamera Masuk (17.30 WIB) & Tutup Sesi Pulang Otomatis
          </Text>
        </View>

        <View style={styles.headerRight}>
          <RealtimeClockBadge showDate={false} />
          <Button
            title="Tambah Karyawan"
            size="sm"
            variant="outline"
            onPress={() => {
              setEditingEmployee(null);
              setEmployeeModalVisible(true);
            }}
            style={styles.addEmpBtnHeader}
          />
        </View>
      </View>

      {/* Tabs Header */}
      <View style={styles.tabNav}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'today' && styles.tabButtonActive]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'today' && styles.tabButtonTextActive]}>
            Absensi Hari Ini
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>
            Rekap & Riwayat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'employees' && styles.tabButtonActive]}
          onPress={() => setActiveTab('employees')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'employees' && styles.tabButtonTextActive]}>
            Master Karyawan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Tab Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Memuat data...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'today' && renderTodayTab()}
            {activeTab === 'history' && renderHistoryTab()}
            {activeTab === 'employees' && renderEmployeesTab()}
          </>
        )}
      </View>

      {/* Attendance Camera Modal */}
      {selectedEmployeeForCheckIn && (
        <AttendanceCameraModal
          visible={cameraModalVisible}
          employeeId={selectedEmployeeForCheckIn.id}
          employeeName={selectedEmployeeForCheckIn.name}
          onClose={() => {
            setCameraModalVisible(false);
            setSelectedEmployeeForCheckIn(null);
          }}
          onCaptured={handleCaptureComplete}
        />
      )}

      {/* Employee Modal */}
      <EmployeeModal
        visible={employeeModalVisible}
        employee={editingEmployee}
        onClose={() => setEmployeeModalVisible(false)}
      />

      {/* Admin PIN Modal */}
      <AdminPinModal
        visible={adminPinVisible}
        title="Otorisasi PIN Pemilik"
        description="Masukkan PIN Admin untuk menghapus cache foto absensi bulanan"
        onClose={() => {
          setAdminPinVisible(false);
          setAdminAction(null);
        }}
        onSuccess={handleAdminPinSuccess}
      />

      {/* Full Photo Modal */}
      <Modal visible={!!viewPhotoUri} transparent animationType="fade">
        <View style={styles.photoViewModal}>
          <TouchableOpacity
            style={styles.photoCloseBtn}
            onPress={() => setViewPhotoUri(null)}
          >
            <Text style={styles.photoCloseText}>✕ Tutup</Text>
          </TouchableOpacity>
          {viewPhotoUri ? (
            <Image
              source={{ uri: viewPhotoUri }}
              style={styles.fullPhoto}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addEmpBtnHeader: {
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
  },
  tabNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabButtonTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    marginBottom: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 14,
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  summaryDate: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
  summaryNote: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeSessionBtn: {
    minWidth: 180,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  employeeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  staffCard: {
    width: '48.8%',
    padding: 14,
  },
  staffCardCheckedIn: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  staffCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
  },
  staffCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  staffInfo: {
    flex: 1,
    marginRight: 8,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  staffPhone: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  attDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  photoThumbContainer: {
    alignItems: 'center',
  },
  photoThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  photoThumbText: {
    fontSize: 9,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  attTimeInfo: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  timeValueBold: {
    fontWeight: '700',
    color: Colors.text,
  },
  lockedNotice: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  lockedNoticeText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  actionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  checkInBtn: {
    width: '100%',
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  historyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  historyScrollContent: {
    paddingBottom: 40,
  },
  historyActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  historySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    paddingHorizontal: 12,
  },
  calendarCard: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavArrow: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '700',
  },
  monthLabelContainer: {
    flex: 1,
    alignItems: 'center',
  },
  monthLabelText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  thisMonthBtn: {
    marginLeft: 12,
  },
  weekdayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  weekdayCol: {
    width: '14.28%',
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  weekendText: {
    color: '#ef4444',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 56,
  },
  dayCell: {
    width: '14.28%',
    height: 56,
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  dayCellToday: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  dayCellTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  dayNumberSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  dayNumberToday: {
    color: '#0284c7',
    fontWeight: '800',
  },
  todayIndicatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0284c7',
  },
  cellBadgeContainer: {
    alignItems: 'center',
    marginTop: 2,
  },
  cellPresenceBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    minWidth: 26,
    alignItems: 'center',
  },
  cellPresenceBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  cellBadgeOnTime: {
    backgroundColor: '#d1fae5',
  },
  cellBadgeLate: {
    backgroundColor: '#fef3c7',
  },
  cellPresenceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
  },
  cellPresenceBadgeTextSelected: {
    color: '#ffffff',
  },
  cellEmptyPlaceholder: {
    height: 14,
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  breakdownCard: {
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  breakdownHeader: {
    marginBottom: 14,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  breakdownSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  metricChipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricChip: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  metricChipPrimary: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  metricChipSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  metricChipWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  metricChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  metricChipValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 4,
  },
  emptyBreakdown: {
    alignItems: 'center',
    padding: 24,
  },
  emptyBreakdownEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyBreakdownTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  emptyBreakdownSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 360,
  },
  empCardsList: {
    gap: 8,
  },
  empBreakdownCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#fafafa',
  },
  empBreakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  empBreakdownIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    width: 24,
  },
  empBreakdownThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  thumbZoomHint: {
    fontSize: 9,
    color: Colors.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  empBreakdownNoThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noThumbText: {
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  empBreakdownMeta: {
    flex: 1,
  },
  empBreakdownName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  empBreakdownTimes: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  timeHighlight: {
    color: Colors.text,
    fontWeight: '700',
  },
  employeeRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
  },
  empRowActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textMuted,
  },
  photoViewModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullPhoto: {
    width: '90%',
    height: '75%',
    borderRadius: 8,
  },
  photoCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  photoCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
});
