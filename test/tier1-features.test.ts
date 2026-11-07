import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import { loadFinancialSummary, addCashEntry, saveMonthlyCogs } from './helpers/financialEngine.js';
import { formatCustomerReceiptLines, type PrintReceiptData } from './helpers/receiptFormatter.js';
import { createFileSystemSimulator, deleteMonthlyAttendancePhotos } from './helpers/photoCleanup.js';

describe('Tier 1: Feature Coverage Suites', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  test('T1.1 - Financial Store: grossSales and transaction count calculation for completed transactions', async () => {
    const month = '2026-11';

    // Seed transactions with various statuses
    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES (?, ?, ?, ?, ?, 'tunai', ?, 'completed')`,
      ['INV-01', '2026-11-01', 'Meja 01', 50000, 50000, 50000]
    );

    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES (?, ?, ?, ?, ?, 'qris', ?, 'completed')`,
      ['INV-02', '2026-11-02', 'Meja 02', 75000, 75000, 75000]
    );

    // Pending transaction should NOT count towards grossSales
    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES (?, ?, ?, ?, ?, 'tunai', ?, 'pending')`,
      ['INV-03', '2026-11-03', 'Meja 03', 100000, 100000, 0]
    );

    // Cancelled transaction should NOT count towards grossSales
    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES (?, ?, ?, ?, ?, 'tunai', ?, 'cancelled')`,
      ['INV-04', '2026-11-04', 'Meja 04', 30000, 30000, 0]
    );

    // Transaction from a different month should NOT count
    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES (?, ?, ?, ?, ?, 'tunai', ?, 'completed')`,
      ['INV-PREV', '2026-10-31', 'Meja 01', 60000, 60000, 60000]
    );

    const { summary } = await loadFinancialSummary(db, month);

    assert.strictEqual(summary.totalGrossSales, 125000, 'Gross sales must be exactly sum of completed transactions in Nov 2026 (50k + 75k)');
    assert.strictEqual(summary.totalTxCount, 2, 'Transaction count must only count completed transactions in Nov 2026');
  });

  test('T1.2 - Financial Store: Net profit calculation prevents double-counting cash sales', async () => {
    const month = '2026-11';

    // 1. Completed Cash Sale in transactions table: Rp 400.000
    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES ('INV-CASH-1', '2026-11-05', 'Meja 01', 400000, 400000, 'tunai', 400000, 'completed')`
    );

    // 2. Corresponding cash ledger entry inserted on checkout: category = 'penjualan_tunai', affects_pnl = 1
    await addCashEntry(db, {
      type: 'income',
      affects_pnl: true,
      category: 'penjualan_tunai',
      amount: 400000,
      notes: 'Penjualan Nota INV-CASH-1 (Meja 01)',
      business_date: '2026-11-05',
    });

    // 3. Other legitimate operational income: Rp 50.000 (e.g. sponsorship / titip produk)
    await addCashEntry(db, {
      type: 'income',
      affects_pnl: true,
      category: 'pendapatan_sponsor',
      amount: 50000,
      notes: 'Titip jual camilan',
      business_date: '2026-11-05',
    });

    // 4. Operational expense: Rp 80.000 (e.g. arang, es batu)
    await addCashEntry(db, {
      type: 'expense',
      affects_pnl: true,
      category: 'operasional_harian',
      amount: 80000,
      notes: 'Beli arang & es batu',
      business_date: '2026-11-05',
    });

    // 5. Monthly COGS / HPP: Rp 150.000
    await saveMonthlyCogs(db, month, 150000, 'HPP Bahan Baku Nasi Kucing & Sate');

    const { summary } = await loadFinancialSummary(db, month);

    // Verification of calculations:
    // grossSales = 400,000
    // operIncome = 50,000 (penjualan_tunai is NOT counted again!)
    // operExpenses = 80,000
    // monthlyCogs = 150,000
    // grossProfit = 400,000 - 150,000 = 250,000
    // netOperatingProfit = 400,000 + 50,000 - 80,000 - 150,000 = 220,000
    assert.strictEqual(summary.totalGrossSales, 400000, 'Gross sales must equal total completed sales');
    assert.strictEqual(
      summary.totalOperationalIncome,
      50000,
      'operIncome must EXCLUDE penjualan_tunai to prevent double-counting! Expected 50.000, got ' + summary.totalOperationalIncome
    );
    assert.strictEqual(summary.totalOperationalExpenses, 80000, 'Operational expenses must equal 80.000');
    assert.strictEqual(summary.monthlyCogs, 150000, 'Monthly COGS must equal 150.000');
    assert.strictEqual(summary.grossProfit, 250000, 'Gross profit must be grossSales - monthlyCogs = 250.000');
    assert.strictEqual(
      summary.netOperatingProfit,
      220000,
      'Net operating profit must be exactly 220.000 without double counting cash sales'
    );
  });

  test('T1.3 - Financial Store: Non-PnL entries do not affect net profit', async () => {
    const month = '2026-11';

    // Sales 100k, COGS 40k -> Net Profit = 60k
    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES ('INV-1', '2026-11-06', 'Meja 01', 100000, 100000, 'qris', 100000, 'completed')`
    );
    await saveMonthlyCogs(db, month, 40000);

    // Non-PnL entries: Initial float / capital injection (500k) & Owner withdrawal / prive (200k)
    await addCashEntry(db, {
      type: 'income',
      affects_pnl: false,
      category: 'modal_awal',
      amount: 500000,
      business_date: '2026-11-06',
    });
    await addCashEntry(db, {
      type: 'expense',
      affects_pnl: false,
      category: 'prive_pemilik',
      amount: 200000,
      business_date: '2026-11-06',
    });

    const { summary } = await loadFinancialSummary(db, month);

    assert.strictEqual(summary.totalNonPnlIncome, 500000, 'Non-PnL income must record 500.000');
    assert.strictEqual(summary.totalNonPnlExpenses, 200000, 'Non-PnL expense must record 200.000');
    assert.strictEqual(summary.totalOperationalExpenses, 0, 'Operational expense must remain 0');
    assert.strictEqual(summary.totalOperationalIncome, 0, 'Operational income must remain 0');
    assert.strictEqual(summary.netOperatingProfit, 60000, 'Net operating profit must remain strictly 60.000');
  });

  test('T1.4 - Cash Ledger: verify income/expense entries, filtering, and categories', async () => {
    const entryId1 = await addCashEntry(db, {
      type: 'income',
      affects_pnl: true,
      category: 'komisi_titip',
      amount: 45000,
      notes: 'Titip kerupuk kaleng',
      business_date: '2026-11-07',
    });

    const entryId2 = await addCashEntry(db, {
      type: 'expense',
      affects_pnl: true,
      category: 'kebersihan',
      amount: 15000,
      notes: 'Iuran sampah',
      business_date: '2026-11-07',
    });

    assert.ok(entryId1 > 0, 'Income entry ID must be positive integer');
    assert.ok(entryId2 > 0, 'Expense entry ID must be positive integer');

    const incomeRows = await db.getAllAsync<{ id: number; type: string; category: string }>(
      `SELECT * FROM cash_ledger WHERE type = 'income'`
    );
    assert.strictEqual(incomeRows.length, 1);
    assert.strictEqual(incomeRows[0].category, 'komisi_titip');

    const expenseRows = await db.getAllAsync<{ id: number; type: string; category: string }>(
      `SELECT * FROM cash_ledger WHERE type = 'expense'`
    );
    assert.strictEqual(expenseRows.length, 1);
    assert.strictEqual(expenseRows[0].category, 'kebersihan');
  });

  test('T1.5 - Receipt Formatting: Dynamic payment methods (Tunai, QRIS, Transfer)', () => {
    const baseData: PrintReceiptData = {
      storeName: 'Angkringan Jogja Mantap',
      storeAddress: 'Jl. Malioboro No. 45',
      storePhone: '0812-3456-7890',
      receiptFooter: 'Matur Nuwun Sampun Rawuh!',
      invoiceNumber: 'INV-071126-001',
      businessDate: '2026-11-07',
      dateTimeString: '07/11/2026 19:30:00',
      tableNumber: 'Meja 05',
      customerName: 'Budi Santoso',
      cashierName: 'Rian Kasir',
      items: [
        { name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2, subtotal: 10000 },
        { name: 'Wedang Jahe Geprek', price: 6000, qty: 1, subtotal: 6000 },
      ],
      subtotal: 16000,
      total: 16000,
      paymentMethod: 'tunai',
      paymentAmount: 20000,
      changeAmount: 4000,
    };

    // 1. Tunai Receipt
    const tunaiLines = formatCustomerReceiptLines(baseData);
    const tunaiText = tunaiLines.join('\n');
    assert.match(tunaiText, /Bayar \(TUNAI\)/, 'Must contain Bayar (TUNAI)');
    assert.match(tunaiText, /Kembalian/, 'Tunai receipt must contain Kembalian');
    assert.match(tunaiText, /4\.000/, 'Must show Rp 4.000 change');

    // 2. QRIS Receipt
    const qrisData: PrintReceiptData = {
      ...baseData,
      paymentMethod: 'qris',
      paymentAmount: 16000,
      changeAmount: 0,
    };
    const qrisLines = formatCustomerReceiptLines(qrisData);
    const qrisText = qrisLines.join('\n');
    assert.match(qrisText, /Bayar \(QRIS\)/, 'Must contain Bayar (QRIS)');
    assert.doesNotMatch(qrisText, /Kembalian/, 'QRIS receipt must NOT show Kembalian line');

    // 3. Transfer Receipt
    const transferData: PrintReceiptData = {
      ...baseData,
      paymentMethod: 'transfer',
      paymentAmount: 16000,
      changeAmount: 0,
    };
    const transferLines = formatCustomerReceiptLines(transferData);
    const transferText = transferLines.join('\n');
    assert.match(transferText, /Bayar \(TRANSFER\)/, 'Must contain Bayar (TRANSFER)');
    assert.doesNotMatch(transferText, /Kembalian/, 'Transfer receipt must NOT show Kembalian line');

    // 4. Store profile in receipt
    assert.match(transferText, /Angkringan Jogja Mantap/, 'Receipt must show dynamic storeName');
    assert.match(transferText, /Jl\. Malioboro No\. 45/, 'Receipt must show dynamic storeAddress');
    assert.match(transferText, /0812-3456-7890/, 'Receipt must show dynamic storePhone');
    assert.match(transferText, /Matur Nuwun Sampun Rawuh!/, 'Receipt must show dynamic receiptFooter');
  });

  test('T1.6 - Database Transaction Wrapper: Atomic commit and atomic rollback', async () => {
    // 1. Atomic Commit: Both writes succeed together
    await db.withTransactionAsync(async () => {
      await db.runAsync(`INSERT INTO categories (name, icon) VALUES ('Kategori Uji 1', 'icon1')`);
      await db.runAsync(`INSERT INTO categories (name, icon) VALUES ('Kategori Uji 2', 'icon2')`);
    });

    const cat1 = await db.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE name = ?', ['Kategori Uji 1']);
    const cat2 = await db.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE name = ?', ['Kategori Uji 2']);
    assert.ok(cat1 !== null, 'Kategori Uji 1 should be committed');
    assert.ok(cat2 !== null, 'Kategori Uji 2 should be committed');

    // 2. Atomic Rollback: Error during transaction rolls back all pending changes in the block
    let caughtError = false;
    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync(`INSERT INTO categories (name, icon) VALUES ('Kategori Yang Batal', 'icon-batal')`);
        // Intentionally throw error before completion
        throw new Error('Simulated failure during multi-write operation');
      });
    } catch (err: any) {
      caughtError = true;
      assert.strictEqual(err.message, 'Simulated failure during multi-write operation');
    }

    assert.ok(caughtError, 'Transaction must throw error on failure');

    const catBatal = await db.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE name = ?', ['Kategori Yang Batal']);
    assert.strictEqual(catBatal, null, 'Rolled-back category must NOT exist in database');
  });

  test('T1.7 - Photo Cleanup: Physical file deletion and database path clearing for expired month', async () => {
    const fs = createFileSystemSimulator();

    // Create physical files in simulator
    const photoOct1 = '/storage/attendance/att_20261001_001.jpg';
    const photoOct2 = '/storage/attendance/att_20261002_002.jpg';
    const photoNov1 = '/storage/attendance/att_20261107_001.jpg';

    fs.files.set(photoOct1, 'OCTOBER_PHOTO_BYTES_1');
    fs.files.set(photoOct2, 'OCTOBER_PHOTO_BYTES_2');
    fs.files.set(photoNov1, 'NOVEMBER_PHOTO_BYTES_1');

    // Seed attendance records
    await db.runAsync(
      `INSERT INTO employees (id, name, phone) VALUES (10, 'Karyawan Test', '08123')`
    );

    await db.runAsync(
      `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo)
       VALUES (10, 'Karyawan Test', '2026-10-01', '17:30', ?)`,
      [photoOct1]
    );

    await db.runAsync(
      `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo)
       VALUES (10, 'Karyawan Test', '2026-10-02', '17:31', ?)`,
      [photoOct2]
    );

    await db.runAsync(
      `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo)
       VALUES (10, 'Karyawan Test', '2026-11-07', '17:30', ?)`,
      [photoNov1]
    );

    // Perform monthly cleanup for October 2026
    const result = await deleteMonthlyAttendancePhotos(db, fs, '2026-10');

    assert.strictEqual(result.deletedFilesCount, 2, 'Must delete 2 physical files from October');
    assert.strictEqual(result.dbRowsUpdated, 2, 'Must update 2 DB rows from October');

    // Verify physical storage state
    assert.strictEqual(fs.files.has(photoOct1), false, 'October photo 1 must be deleted from storage');
    assert.strictEqual(fs.files.has(photoOct2), false, 'October photo 2 must be deleted from storage');
    assert.strictEqual(fs.files.has(photoNov1), true, 'November photo must remain untouched');

    // Verify database state
    const octRows = await db.getAllAsync<{ id: number; check_in_photo: string }>(
      `SELECT id, check_in_photo FROM attendance WHERE business_date LIKE '2026-10%'`
    );
    for (const r of octRows) {
      assert.strictEqual(r.check_in_photo, '', 'October records check_in_photo must be emptied');
    }

    const novRow = await db.getFirstAsync<{ check_in_photo: string }>(
      `SELECT check_in_photo FROM attendance WHERE business_date = '2026-11-07'`
    );
    assert.strictEqual(novRow?.check_in_photo, photoNov1, 'November photo path in DB must remain intact');
  });
});
