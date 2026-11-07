import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SQLiteDatabase, withSqliteRetry } from './database';

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

