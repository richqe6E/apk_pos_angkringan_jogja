import { TestDatabase } from './db.js';

export interface CashEntry {
  id: number;
  business_date: string;
  type: 'income' | 'expense';
  affects_pnl: number;
  category: string;
  amount: number;
  notes: string;
  created_at: string;
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
  grossProfit: number;
  netOperatingProfit: number;
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

export function loadFinancialSummary(db: TestDatabase, targetMonth: string): Promise<{
  summary: FinancialSummary;
  entries: CashEntry[];
}>;

export function addCashEntry(db: TestDatabase, input: CreateCashInput): Promise<number>;
export function saveMonthlyCogs(db: TestDatabase, month: string, amount: number, notes?: string): Promise<void>;
