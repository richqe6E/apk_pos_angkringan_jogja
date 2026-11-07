import { create } from 'zustand';
import { SQLiteDatabase, withSqliteRetry } from '../services/database';
import { getBusinessDate } from '../utils/sessionHelper';

export interface CashEntry {
  id: number;
  business_date: string;
  type: 'income' | 'expense';
  affects_pnl: number; // 1 = ya (mempengaruhi laba rugi), 0 = tidak (modal/prive/setor bank)
  category: string;
  amount: number;
  notes: string;
  created_at: string;
}

export interface MonthlyCogsRecord {
  id: number;
  period_month: string; // 'YYYY-MM'
  total_cogs_amount: number;
  notes: string;
  inputted_at: string;
}

export interface FinancialSummary {
  periodMonth: string;
  totalGrossSales: number;
  totalTxCount: number;
  totalOperationalExpenses: number;
  totalNonPnlExpenses: number;
  totalOperationalIncome: number;
  totalNonPnlIncome: number;
  monthlyCogs: number;
  monthlyCogsNotes: string;
  grossProfit: number; // Gross Sales - HPP
  netOperatingProfit: number; // Gross Sales + Oper Income - Oper Expenses - HPP
  expenseByCategory: { category: string; total: number }[];
}

export interface CreateCashInput {
  type: 'income' | 'expense';
  affects_pnl: boolean;
  category: string;
  amount: number;
  notes?: string;
  business_date?: string;
}

interface FinancialState {
  cashEntries: CashEntry[];
  summary: FinancialSummary;
  selectedMonth: string; // 'YYYY-MM'
  isLoading: boolean;

  setSelectedMonth: (month: string) => void;
  loadFinancialData: (db: SQLiteDatabase, month?: string) => Promise<void>;
  addCashEntry: (db: SQLiteDatabase, input: CreateCashInput) => Promise<number>;
  deleteCashEntry: (db: SQLiteDatabase, id: number) => Promise<void>;
  saveMonthlyCogs: (
    db: SQLiteDatabase,
    periodMonth: string,
    cogsAmount: number,
    notes?: string
  ) => Promise<void>;
}

export const useFinancialStore = create<FinancialState>((set, get) => {
  const currentMonth = getBusinessDate().substring(0, 7);

  return {
    cashEntries: [],
    selectedMonth: currentMonth,
    isLoading: false,
    summary: {
      periodMonth: currentMonth,
      totalGrossSales: 0,
      totalTxCount: 0,
      totalOperationalExpenses: 0,
      totalNonPnlExpenses: 0,
      totalOperationalIncome: 0,
      totalNonPnlIncome: 0,
      monthlyCogs: 0,
      monthlyCogsNotes: '',
      grossProfit: 0,
      netOperatingProfit: 0,
      expenseByCategory: [],
    },

    setSelectedMonth: (month: string) => {
      set({ selectedMonth: month });
    },

    loadFinancialData: async (db: SQLiteDatabase, month?: string) => {
      const targetMonth = month || get().selectedMonth;
      set({ isLoading: true });

      try {
        // 1. Ambil Penjualan Transaksi pada Bulan Terpilih
        const salesRow = await withSqliteRetry(() =>
          db.getFirstAsync<{ total_sales: number; tx_count: number }>(
            `SELECT COALESCE(SUM(total), 0) as total_sales, COUNT(id) as tx_count
             FROM transactions
             WHERE status = 'completed' AND business_date LIKE ?`,
            [`${targetMonth}%`]
          )
        );
        const grossSales = salesRow?.total_sales || 0;
        const txCount = salesRow?.tx_count || 0;

        // 2. Ambil Seluruh Buku Kas pada Bulan Terpilih
        const cashRows = await withSqliteRetry(() =>
          db.getAllAsync<CashEntry>(
            `SELECT * FROM cash_ledger
             WHERE business_date LIKE ?
             ORDER BY id DESC`,
            [`${targetMonth}%`]
          )
        );
        const entries = cashRows || [];

        // Hitung aggregasi beban dan kas
        let operExpenses = 0;
        let nonPnlExpenses = 0;
        let operIncome = 0;
        let nonPnlIncome = 0;
        const catMap: Record<string, number> = {};

        entries.forEach((e) => {
          if (e.type === 'expense') {
            if (e.affects_pnl === 1) {
              operExpenses += e.amount;
              catMap[e.category] = (catMap[e.category] || 0) + e.amount;
            } else {
              nonPnlExpenses += e.amount;
            }
          } else {
            if (e.affects_pnl === 1) {
              operIncome += e.amount;
            } else {
              nonPnlIncome += e.amount;
            }
          }
        });

        const expenseByCategory = Object.entries(catMap)
          .map(([category, total]) => ({ category, total }))
          .sort((a, b) => b.total - a.total);

        // 3. Ambil HPP Global Pemilik (Opsi A) untuk Bulan Terpilih
        const cogsRow = await withSqliteRetry(() =>
          db.getFirstAsync<MonthlyCogsRecord>(
            'SELECT * FROM monthly_cogs WHERE period_month = ?',
            [targetMonth]
          )
        );
        const monthlyCogs = cogsRow?.total_cogs_amount || 0;
        const monthlyCogsNotes = cogsRow?.notes || '';

        // 4. Kalkulasi Laba
        const grossProfit = grossSales - monthlyCogs;
        const netOperatingProfit = grossSales + operIncome - operExpenses - monthlyCogs;

        set({
          cashEntries: entries,
          selectedMonth: targetMonth,
          isLoading: false,
          summary: {
            periodMonth: targetMonth,
            totalGrossSales: grossSales,
            totalTxCount: txCount,
            totalOperationalExpenses: operExpenses,
            totalNonPnlExpenses: nonPnlExpenses,
            totalOperationalIncome: operIncome,
            totalNonPnlIncome: nonPnlIncome,
            monthlyCogs,
            monthlyCogsNotes,
            grossProfit,
            netOperatingProfit,
            expenseByCategory,
          },
        });
      } catch (err) {
        console.error('Error loading financial data:', err);
        set({ isLoading: false });
      }
    },

    addCashEntry: async (db, input) => {
      const bizDate = input.business_date || getBusinessDate();
      const res = await withSqliteRetry(() =>
        db.runAsync(
          `INSERT INTO cash_ledger (
            business_date, type, affects_pnl, category, amount, notes
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            bizDate,
            input.type,
            input.affects_pnl ? 1 : 0,
            input.category.trim(),
            input.amount,
            input.notes?.trim() || '',
          ]
        )
      );

      await get().loadFinancialData(db, get().selectedMonth);
      return res.lastInsertRowId;
    },

    deleteCashEntry: async (db, id) => {
      await withSqliteRetry(() =>
        db.runAsync('DELETE FROM cash_ledger WHERE id = ?', [id])
      );
      await get().loadFinancialData(db, get().selectedMonth);
    },

    saveMonthlyCogs: async (db, periodMonth, cogsAmount, notes = '') => {
      await withSqliteRetry(() =>
        db.runAsync(
          `INSERT INTO monthly_cogs (period_month, total_cogs_amount, notes)
           VALUES (?, ?, ?)
           ON CONFLICT(period_month) DO UPDATE SET
             total_cogs_amount = excluded.total_cogs_amount,
             notes = excluded.notes,
             inputted_at = datetime('now','localtime')`,
          [periodMonth, cogsAmount, notes.trim()]
        )
      );
      await get().loadFinancialData(db, periodMonth);
    },
  };
});

