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
  salesTunai: number;
  salesQris: number;
  salesTransfer: number;
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

export type PeriodFilterMode = 'today' | '7days' | 'month' | 'custom_month' | 'custom_date';

export interface FinancialPeriodQuery {
  mode?: PeriodFilterMode;
  targetMonth?: string;
  customDate?: string;
}

export function getDateNDaysAgo(bizDate: string, days: number): string {
  const [y, m, d] = bizDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

export function getNextMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const nextDate = new Date(y, m, 1);
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
}

export function getPreviousDay(dateStr: string): string {
  return getDateNDaysAgo(dateStr, 1);
}

export function getNextDay(dateStr: string): string {
  return getDateNDaysAgo(dateStr, -1);
}

export function buildPeriodSqlCondition(
  periodMode: PeriodFilterMode,
  todayBizDate: string,
  customVal?: string,
  columnName: string = 'business_date'
): { whereSql: string; params: string[]; label: string } {
  switch (periodMode) {
    case 'today':
      return {
        whereSql: `${columnName} = ?`,
        params: [todayBizDate],
        label: `Hari Ini (${todayBizDate})`,
      };
    case '7days': {
      const start = getDateNDaysAgo(todayBizDate, 6);
      return {
        whereSql: `${columnName} >= ? AND ${columnName} <= ?`,
        params: [start, todayBizDate],
        label: `7 Hari (${start} s/d ${todayBizDate})`,
      };
    }
    case 'month': {
      const currMonth = todayBizDate.substring(0, 7);
      return {
        whereSql: `${columnName} LIKE ?`,
        params: [`${currMonth}%`],
        label: `Bulan Ini (${currMonth})`,
      };
    }
    case 'custom_month': {
      const target = customVal || todayBizDate.substring(0, 7);
      return {
        whereSql: `${columnName} LIKE ?`,
        params: [`${target}%`],
        label: `Bulan ${target}`,
      };
    }
    case 'custom_date': {
      const target = customVal || todayBizDate;
      return {
        whereSql: `${columnName} = ?`,
        params: [target],
        label: `Tanggal ${target}`,
      };
    }
  }
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
  loadFinancialData: (
    db: SQLiteDatabase,
    periodArg?: string | FinancialPeriodQuery
  ) => Promise<void>;
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
      salesTunai: 0,
      salesQris: 0,
      salesTransfer: 0,
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

    loadFinancialData: async (
      db: SQLiteDatabase,
      periodArg?: string | FinancialPeriodQuery
    ) => {
      const today = getBusinessDate();
      let mode: PeriodFilterMode = 'custom_month';
      let customVal: string | undefined = undefined;

      if (!periodArg) {
        customVal = get().selectedMonth;
        mode = 'custom_month';
      } else if (typeof periodArg === 'string') {
        if (periodArg.length === 7) {
          mode = 'custom_month';
          customVal = periodArg;
        } else if (periodArg.length === 10) {
          mode = 'custom_date';
          customVal = periodArg;
        } else {
          mode = 'custom_month';
          customVal = periodArg;
        }
      } else {
        mode = periodArg.mode || 'custom_month';
        customVal = mode === 'custom_date' ? periodArg.customDate : (periodArg.targetMonth || get().selectedMonth);
      }

      const { whereSql, params, label } = buildPeriodSqlCondition(
        mode,
        today,
        customVal,
        'business_date'
      );
      const targetMonthKey = customVal && customVal.length >= 7 ? customVal.substring(0, 7) : today.substring(0, 7);

      set({ isLoading: true });

      try {
        // 1. Ambil Penjualan Transaksi & Breakdown Metode Bayar pada Periode Terpilih
        const salesRow = await withSqliteRetry(() =>
          db.getFirstAsync<{
            total_sales: number;
            tx_count: number;
            sales_tunai: number;
            sales_qris: number;
            sales_transfer: number;
          }>(
            `SELECT 
               COALESCE(SUM(total), 0) as total_sales,
               COUNT(id) as tx_count,
               COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'tunai' THEN total ELSE 0 END), 0) as sales_tunai,
               COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'qris' THEN total ELSE 0 END), 0) as sales_qris,
               COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'transfer' THEN total ELSE 0 END), 0) as sales_transfer
             FROM transactions
             WHERE status = 'completed' AND ${whereSql}`,
            params
          )
        );
        const grossSales = salesRow?.total_sales || 0;
        const txCount = salesRow?.tx_count || 0;
        const salesTunai = salesRow?.sales_tunai || 0;
        const salesQris = salesRow?.sales_qris || 0;
        const salesTransfer = salesRow?.sales_transfer || 0;

        // 2. Ambil Seluruh Buku Kas pada Periode Terpilih
        const cashRows = await withSqliteRetry(() =>
          db.getAllAsync<CashEntry>(
            `SELECT * FROM cash_ledger
             WHERE ${whereSql}
             ORDER BY id DESC`,
            params
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
            if (e.category === 'penjualan_tunai') {
              // Sudah tercakup dalam grossSales dari tabel transactions; jangan dihitung ganda di operIncome
            } else if (e.affects_pnl === 1) {
              operIncome += e.amount;
            } else {
              nonPnlIncome += e.amount;
            }
          }
        });

        const expenseByCategory = Object.entries(catMap)
          .map(([category, total]) => ({ category, total }))
          .sort((a, b) => b.total - a.total);

        // 3. Ambil HPP Global Pemilik (Opsi A) untuk Bulan Terkait
        const cogsRow = await withSqliteRetry(() =>
          db.getFirstAsync<MonthlyCogsRecord>(
            'SELECT * FROM monthly_cogs WHERE period_month = ?',
            [targetMonthKey]
          )
        );
        const monthlyCogs = cogsRow?.total_cogs_amount || 0;
        const monthlyCogsNotes = cogsRow?.notes || '';

        // 4. Kalkulasi Laba
        const grossProfit = grossSales - monthlyCogs;
        const netOperatingProfit = grossSales + operIncome - operExpenses - monthlyCogs;

        set({
          cashEntries: entries,
          selectedMonth: targetMonthKey,
          isLoading: false,
          summary: {
            periodMonth: label,
            totalGrossSales: grossSales,
            totalTxCount: txCount,
            salesTunai,
            salesQris,
            salesTransfer,
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

