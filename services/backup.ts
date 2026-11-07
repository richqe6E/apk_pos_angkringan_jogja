import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SQLiteDatabase, withSqliteRetry } from './database';
import type { FinancialSummary, CashEntry } from '../stores/financialStore';

export interface BackupData {
  version: string;
  timestamp: string;
  tables: {
    settings: any[];
    operating_sessions: any[];
    daily_counters: any[];
    categories: any[];
    menus: any[];
    transactions: any[];
    transaction_items: any[];
    employees: any[];
    attendance: any[];
    customers: any[];
    rewards: any[];
    suppliers: any[];
    purchases: any[];
    cash_ledger: any[];
    monthly_cogs: any[];
  };
}

/**
 * Cadangkan seluruh database lokal ke dalam 1 berkas JSON terstruktur
 */
export async function exportDatabaseToJson(db: SQLiteDatabase): Promise<string> {
  const tableNames = [
    'settings',
    'operating_sessions',
    'daily_counters',
    'categories',
    'menus',
    'transactions',
    'transaction_items',
    'employees',
    'attendance',
    'customers',
    'rewards',
    'suppliers',
    'purchases',
    'cash_ledger',
    'monthly_cogs',
  ];

  const backupObj: BackupData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    tables: {} as any,
  };

  for (const table of tableNames) {
    const rows = await withSqliteRetry(() =>
      db.getAllAsync<any>(`SELECT * FROM ${table}`)
    );
    (backupObj.tables as any)[table] = rows || [];
  }

  const jsonContent = JSON.stringify(backupObj, null, 2);
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
  const filename = `pos_angkringan_backup_${dateStr}.json`;
  const fileUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}/${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, jsonContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Simpan / Bagikan Berkas Cadangan (JSON)',
    });
  }

  return fileUri;
}

/**
 * Pulihkan seluruh database dari string JSON cadangan
 */
export async function restoreDatabaseFromJson(
  db: SQLiteDatabase,
  jsonString: string
): Promise<{ success: boolean; message: string }> {
  let parsed: BackupData;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Format berkas tidak valid. Harap pilih berkas JSON cadangan yang sah.');
  }

  if (!parsed.tables || !parsed.tables.menus) {
    throw new Error('Berkas cadangan tidak memiliki struktur tabel POS Angkringan yang sesuai.');
  }

  await db.withTransactionAsync(async () => {
    // 1. Bersihkan tabel transaksional dan master
    const tablesToClear = [
      'settings',
      'operating_sessions',
      'daily_counters',
      'transaction_items',
      'transactions',
      'attendance',
      'purchases',
      'cash_ledger',
      'monthly_cogs',
      'rewards',
      'menus',
      'categories',
      'employees',
      'suppliers',
      'customers',
    ];

    for (const table of tablesToClear) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    // 2. Pulihkan tabel per tabel
    for (const [table, rows] of Object.entries(parsed.tables)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const sample = rows[0];
      const cols = Object.keys(sample);
      const placeholders = cols.map(() => '?').join(', ');
      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = cols.map((col) => row[col]);
        await db.runAsync(sql, values);
      }
    }
  });

  return { success: true, message: 'Database berhasil dipulihkan secara menyeluruh.' };
}

/**
 * Hapus seluruh riwayat transaksi & absensi (Reset Bersih Sesi Operasional)
 * Tetap menjaga menu katalog, kategori, supplier, dan setting toko.
 */
export async function clearTransactionsAndAttendance(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transaction_items');
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM attendance');
    await db.runAsync('DELETE FROM cash_ledger');
    await db.runAsync('DELETE FROM operating_sessions');
    await db.runAsync('DELETE FROM daily_counters');
    await db.runAsync('UPDATE customers SET total_spent = 0, total_visits = 0');
  });
}

/**
 * Escapes a single CSV cell value
 */
export function formatCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface TransactionCsvRow {
  id: number;
  invoice_number: string;
  business_date: string;
  table_number: string;
  customer_name?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  payment_amount?: number;
  change_amount?: number;
  status: string;
  created_at: string;
  cashier_name?: string;
}

export interface CashLedgerCsvRow {
  id: number;
  business_date: string;
  type: string;
  affects_pnl: number;
  category: string;
  amount: number;
  notes?: string;
  created_at?: string;
}

/**
 * Ekspor Riwayat Transaksi ke CSV dengan filter periode dan rincian metode pembayaran
 */
export async function exportTransactionsCsv(
  transactions: TransactionCsvRow[],
  periodLabel: string
): Promise<string> {
  const headers = [
    'No',
    'No. Invoice',
    'Tanggal Operasional',
    'Waktu Transaksi',
    'Meja',
    'Pelanggan',
    'Status',
    'Metode Pembayaran',
    'Subtotal (Rp)',
    'Pajak PB1 (Rp)',
    'Diskon (Rp)',
    'Total (Rp)',
    'Bayar (Rp)',
    'Kembalian (Rp)',
    'Kasir',
  ];

  let totalCompletedOmset = 0;
  let totalTunai = 0;
  let totalQris = 0;
  let totalTransfer = 0;
  let completedCount = 0;
  let pendingCount = 0;
  let mergedCount = 0;
  let cancelledCount = 0;

  const dataRows = transactions.map((t, index) => {
    const isCompleted = t.status === 'completed';
    const method = (t.payment_method || '').toLowerCase();

    if (isCompleted) {
      completedCount++;
      totalCompletedOmset += t.total;
      if (method === 'tunai') totalTunai += t.total;
      else if (method === 'qris') totalQris += t.total;
      else if (method === 'transfer') totalTransfer += t.total;
    } else if (t.status === 'pending') {
      pendingCount++;
    } else if (t.status === 'merged') {
      mergedCount++;
    } else if (t.status === 'cancelled') {
      cancelledCount++;
    }

    return [
      index + 1,
      formatCsvCell(t.invoice_number),
      formatCsvCell(t.business_date),
      formatCsvCell(t.created_at),
      formatCsvCell(t.table_number),
      formatCsvCell(t.customer_name || 'Umum'),
      formatCsvCell(t.status.toUpperCase()),
      formatCsvCell(t.payment_method ? t.payment_method.toUpperCase() : '-'),
      t.subtotal || 0,
      t.tax_amount || 0,
      t.discount_amount || 0,
      t.total || 0,
      t.payment_amount || 0,
      t.change_amount || 0,
      formatCsvCell(t.cashier_name || 'Kasir'),
    ].join(',');
  });

  const summaryRows = [
    '',
    '=== RINGKASAN OMSET & METODE PEMBAYARAN ===',
    `Periode Laporan,${formatCsvCell(periodLabel)}`,
    `Total Seluruh Baris Transaksi,${transactions.length}`,
    `Jumlah Transaksi Selesai,${completedCount}`,
    `Jumlah Pesanan Pending,${pendingCount}`,
    `Jumlah Pesanan Digabung,${mergedCount}`,
    `Jumlah Pesanan Batal,${cancelledCount}`,
    `TOTAL OMSET PENJUALAN SELESAI,${totalCompletedOmset}`,
    `  - Pembayaran Tunai (Cash),${totalTunai}`,
    `  - Pembayaran QRIS,${totalQris}`,
    `  - Pembayaran Transfer Bank,${totalTransfer}`,
  ];

  const csvContent = [headers.join(','), ...dataRows, ...summaryRows].join('\r\n');

  const sanitizedPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `riwayat_transaksi_${sanitizedPeriod}_${Date.now()}.csv`;
  const fileUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}/${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Ekspor Riwayat Transaksi (${periodLabel})`,
    });
  }

  return fileUri;
}

/**
 * Ekspor Buku Mutasi Kas (Kas Masuk / Kas Keluar) ke CSV dengan periode filter
 */
export async function exportCashLedgerCsv(
  entries: CashLedgerCsvRow[],
  periodLabel: string,
  tabType: 'income' | 'expense' | 'all' = 'all'
): Promise<string> {
  const headers = [
    'No',
    'ID Entri',
    'Tanggal Operasional',
    'Waktu Catat',
    'Jenis Kas',
    'Klasifikasi Laba Rugi',
    'Kategori Mutasi',
    'Keterangan / Catatan',
    'Nominal Mutasi (Rp)',
  ];

  let totalMutasi = 0;
  let totalOperasionalPnl = 0;
  let totalNonPnl = 0;

  const dataRows = entries.map((e, index) => {
    totalMutasi += e.amount;
    const isPnl = e.affects_pnl === 1;
    if (isPnl) {
      totalOperasionalPnl += e.amount;
    } else {
      totalNonPnl += e.amount;
    }

    const typeLabel =
      e.type === 'income' || e.type === 'in' ? 'KAS MASUK' : 'KAS KELUAR';
    const pnlLabel = isPnl ? 'Operasional (PnL)' : 'Non-Operasional';

    return [
      index + 1,
      e.id,
      formatCsvCell(e.business_date),
      formatCsvCell(e.created_at || '-'),
      formatCsvCell(typeLabel),
      formatCsvCell(pnlLabel),
      formatCsvCell(e.category),
      formatCsvCell(e.notes || '-'),
      e.amount,
    ].join(',');
  });

  const tabTitle =
    tabType === 'income'
      ? 'BUKU KAS MASUK'
      : tabType === 'expense'
      ? 'BUKU KAS KELUAR'
      : 'BUKU MUTASI KAS';

  const summaryRows = [
    '',
    `=== RINGKASAN ${tabTitle} ===`,
    `Periode Laporan,${formatCsvCell(periodLabel)}`,
    `Total Entri Dicatat,${entries.length}`,
    `TOTAL NOMINAL MUTASI,${totalMutasi}`,
    `  - Bagian Operasional (PnL),${totalOperasionalPnl}`,
    `  - Bagian Non-Operasional,${totalNonPnl}`,
  ];

  const csvContent = [headers.join(','), ...dataRows, ...summaryRows].join('\r\n');

  const sanitizedPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `buku_kas_${tabType}_${sanitizedPeriod}_${Date.now()}.csv`;
  const fileUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}/${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Ekspor ${tabTitle} (${periodLabel})`,
    });
  }

  return fileUri;
}

/**
 * Ekspor Laporan Keuangan & Laba Rugi Komprehensif ke CSV
 */
export async function exportFinancialReportCsv(
  summary: FinancialSummary,
  entries: CashEntry[],
  periodLabel: string
): Promise<string> {
  const pnlHeaders = ['Komponen Laporan Keuangan', 'Nilai (Rp)', 'Keterangan'];
  const pnlRows = [
    ['(+) Penjualan Bruto Toko (Omset)', summary.totalGrossSales, `${summary.totalTxCount} transaksi selesai`],
    ['    - Penjualan Tunai (Cash)', summary.salesTunai || 0, 'Metode bayar Tunai'],
    ['    - Penjualan QRIS', summary.salesQris || 0, 'Metode bayar QRIS'],
    ['    - Penjualan Transfer Bank', summary.salesTransfer || 0, 'Metode bayar Transfer'],
    ['(+) Pendapatan Operasional Lain', summary.totalOperationalIncome, 'Pendapatan non-transaksi kasir (PnL)'],
    ['(-) HPP Global Bahan Baku (Owner)', summary.monthlyCogs, summary.monthlyCogsNotes || 'Input HPP global akhir bulan'],
    ['(=) Laba Kotor (Gross Profit)', summary.grossProfit, 'Omset - HPP Bahan'],
    ['(-) Total Beban Kas Operasional', summary.totalOperationalExpenses, 'Biaya operasional harian (PnL)'],
    ['(=) LABA OPERASIONAL BERSIH', summary.netOperatingProfit, 'Laba operasional sebelum transaksi modal/prive'],
    ['', '', ''],
    ['[Arus Kas Non-Operasional]', '', ''],
    ['(-) Total Setor Bank / Prive Owner', summary.totalNonPnlExpenses, 'Tidak mempengaruhi laba rugi operasional'],
    ['(+) Total Modal Masuk / Pinjaman', summary.totalNonPnlIncome, 'Tidak mempengaruhi laba rugi operasional'],
  ];

  const pnlCsv = [
    `=== LAPORAN LABA RUGI OPERASIONAL POS ANGKRINGAN JOGJA ===`,
    `Periode: ${formatCsvCell(periodLabel)}`,
    '',
    pnlHeaders.join(','),
    ...pnlRows.map((r) => r.map((c) => formatCsvCell(c)).join(',')),
    '',
    '=== RINCIAN BEBAN OPERASIONAL PER KATEGORI ===',
    'Kategori Beban,Total Beban (Rp),Persentase (%)',
    ...summary.expenseByCategory.map((cat) => {
      const pct = summary.totalOperationalExpenses > 0
        ? Math.round((cat.total / summary.totalOperationalExpenses) * 100)
        : 0;
      return `${formatCsvCell(cat.category)},${cat.total},${pct}%`;
    }),
    '',
    '=== BUKU MUTASI KAS DETAIL ===',
    'No,Tanggal,Jenis,PnL,Kategori,Nominal (Rp),Keterangan',
    ...entries.map((e, idx) =>
      [
        idx + 1,
        formatCsvCell(e.business_date),
        formatCsvCell(e.type === 'income' ? 'Masuk' : 'Keluar'),
        formatCsvCell(e.affects_pnl === 1 ? 'PnL' : 'Non-PnL'),
        formatCsvCell(e.category),
        e.amount,
        formatCsvCell(e.notes || '-'),
      ].join(',')
    ),
  ].join('\r\n');

  const sanitizedPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `laporan_keuangan_${sanitizedPeriod}_${Date.now()}.csv`;
  const fileUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}/${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, pnlCsv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Ekspor Laporan Keuangan (${periodLabel})`,
    });
  }

  return fileUri;
}


