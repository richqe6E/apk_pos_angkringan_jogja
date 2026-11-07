import { create } from 'zustand';
import { SQLiteDatabase, withSqliteRetry } from '../services/database';

export interface Employee {
  id: number;
  name: string;
  phone: string;
  is_active: number; // 1 = aktif, 0 = nonaktif
  created_at: string;
}

interface EmployeeState {
  employees: Employee[];
  isLoading: boolean;

  loadEmployees: (db: SQLiteDatabase) => Promise<void>;
  addEmployee: (db: SQLiteDatabase, name: string, phone?: string) => Promise<number>;
  updateEmployee: (db: SQLiteDatabase, id: number, name: string, phone?: string) => Promise<void>;
  toggleEmployeeActive: (db: SQLiteDatabase, id: number, currentStatus: number) => Promise<void>;
  deleteEmployee: (db: SQLiteDatabase, id: number) => Promise<void>;
}

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employees: [],
  isLoading: false,

  loadEmployees: async (db: SQLiteDatabase) => {
    set({ isLoading: true });
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<Employee>(
          'SELECT * FROM employees ORDER BY is_active DESC, name ASC'
        )
      );
      set({ employees: rows || [], isLoading: false });
    } catch (err) {
      console.error('Error loading employees:', err);
      set({ isLoading: false });
    }
  },

  addEmployee: async (db: SQLiteDatabase, name: string, phone = '') => {
    const res = await withSqliteRetry(() =>
      db.runAsync(
        'INSERT INTO employees (name, phone, is_active) VALUES (?, ?, 1)',
        [name.trim(), phone.trim()]
      )
    );
    await get().loadEmployees(db);
    return res.lastInsertRowId;
  },

  updateEmployee: async (db: SQLiteDatabase, id: number, name: string, phone = '') => {
    await withSqliteRetry(() =>
      db.runAsync(
        'UPDATE employees SET name = ?, phone = ? WHERE id = ?',
        [name.trim(), phone.trim(), id]
      )
    );
    await get().loadEmployees(db);
  },

  toggleEmployeeActive: async (db: SQLiteDatabase, id: number, currentStatus: number) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;
    await withSqliteRetry(() =>
      db.runAsync('UPDATE employees SET is_active = ? WHERE id = ?', [nextStatus, id])
    );
    await get().loadEmployees(db);
  },

  deleteEmployee: async (db: SQLiteDatabase, id: number) => {
    await withSqliteRetry(() =>
      db.runAsync('DELETE FROM employees WHERE id = ?', [id])
    );
    await get().loadEmployees(db);
  },
}));

