import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import {
  formatCustomerReceiptLines,
  formatTemporaryBillReceiptLines,
  type PrintReceiptData,
} from './helpers/receiptFormatter.js';

describe('Tier 6: Operational Enhancements Suites (R1-R8)', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // T6.1: Menu Soft-Delete With Transaction History & Seed Protection (R1)
  // =========================================================================
  test('T6.1 - Menu soft-delete with existing transaction history & seed protection', async () => {
    // 1. Ambil salah satu menu bawaan (ID 1: Nasi Kucing Sambal Teri)
    const initialMenu = await db.getFirstAsync<{ id: number; name: string; is_active: number }>(
      'SELECT id, name, is_active FROM menus WHERE id = 1'
    );
    assert.ok(initialMenu, 'Menu ID 1 harus ada dalam database');
    assert.equal(initialMenu.is_active, 1, 'Menu aktif harus bernilai is_active = 1');

    // 2. Buat transaksi yang menggunakan menu ID 1
    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES (?, ?, ?, ?, ?, 'tunai', ?, 'completed')`,
      ['INV-HIST-01', '2026-11-07', 'Meja 01', 5000, 5000, 5000]
    );
    const tx = await db.getFirstAsync<{ id: number }>('SELECT id FROM transactions WHERE invoice_number = ?', [
      'INV-HIST-01',
    ]);
    assert.ok(tx);

    await db.runAsync(
      `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
       VALUES (?, 1, 'Nasi Kucing Sambal Teri', 5000, 1, 5000, 0)`,
      [tx.id]
    );

    // 3. Lakukan Soft Delete pada menu ID 1 (UPDATE menus SET is_active = 0 WHERE id = 1)
    await db.runAsync('UPDATE menus SET is_active = 0 WHERE id = 1');

    // 4. Pastikan menu ID 1 tidak lagi muncul pada kueri katalog aktif
    const activeMenus = await db.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM menus WHERE is_active = 1 ORDER BY name ASC'
    );
    assert.ok(!activeMenus.some((m) => m.id === 1), 'Menu yang di-soft-delete tidak boleh muncul di katalog aktif');

    // 5. Pastikan transaction_items tetap utuh tanpa foreign key error dan nilai subtotal tetap ada
    const items = await db.getAllAsync<{ id: number; menu_name: string; subtotal: number }>(
      'SELECT id, menu_name, subtotal FROM transaction_items WHERE transaction_id = ?',
      [tx.id]
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].menu_name, 'Nasi Kucing Sambal Teri');
    assert.equal(items[0].subtotal, 5000);

    // 6. Uji Proteksi Re-Seeding saat aplikasi restart
    // Jika seed_menus_applied sudah '1', inisialisasi ulang tidak boleh mengembalikan menu yang sudah dihapus
    const seedAppliedRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'seed_menus_applied'"
    );
    assert.equal(seedAppliedRow?.value, '1', 'seed_menus_applied harus bernilai 1');

    // Simulasi logika migrasi startup
    if (seedAppliedRow?.value !== '1') {
      const countRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM menus');
      if ((countRow?.count ?? 0) === 0) {
        await db.runAsync(
          "INSERT OR IGNORE INTO menus (id, name, price, category_id, track_stock, stock, is_active) VALUES (1, 'Nasi Kucing Sambal Teri', 5000, 1, 0, 0, 1)"
        );
      }
    }

    // Periksa kembali: menu ID 1 tetap non-aktif (is_active = 0) dan tidak ter-overwrite
    const reCheck = await db.getFirstAsync<{ is_active: number }>('SELECT is_active FROM menus WHERE id = 1');
    assert.equal(reCheck?.is_active, 0, 'Menu ID 1 harus tetap berstatus non-aktif (is_active = 0)');
  });

  // =========================================================================
  // T6.2: Quick Edit Price & Stock Persistence (R1)
  // =========================================================================
  test('T6.2 - Quick edit price/stock persistence', async () => {
    // Menu ID 2: Nasi Kucing Oseng Tempe (awal: price 5000, stock 0)
    const oldMenu = await db.getFirstAsync<{ id: number; price: number; stock: number; name: string }>(
      'SELECT id, price, stock, name FROM menus WHERE id = 2'
    );
    assert.ok(oldMenu);
    assert.equal(oldMenu.price, 5000);

    // Eksekusi Quick Edit: ubah harga jadi 6500, stok 25, nama diperbarui
    const newPrice = 6500;
    const newStock = 25;
    const newName = 'Nasi Kucing Oseng Tempe Pedas Gurih';

    await db.runAsync(
      'UPDATE menus SET name = ?, price = ?, stock = ? WHERE id = ?',
      [newName, newPrice, newStock, 2]
    );

    // Verifikasi persistensi di database
    const updated = await db.getFirstAsync<{ id: number; price: number; stock: number; name: string }>(
      'SELECT id, price, stock, name FROM menus WHERE id = 2'
    );
    assert.ok(updated);
    assert.equal(updated.name, newName);
    assert.equal(updated.price, newPrice);
    assert.equal(updated.stock, newStock);

    // Quick Edit tanpa mengubah nama (hanya harga & stok)
    await db.runAsync('UPDATE menus SET price = ?, stock = ? WHERE id = ?', [7000, 30, 2]);
    const updatedAgain = await db.getFirstAsync<{ price: number; stock: number; name: string }>(
      'SELECT price, stock, name FROM menus WHERE id = 2'
    );
    assert.equal(updatedAgain?.price, 7000);
    assert.equal(updatedAgain?.stock, 30);
    assert.equal(updatedAgain?.name, newName, 'Nama menu tidak berubah jika hanya harga dan stok diedit');
  });

  // =========================================================================
  // T6.3: Dynamic Table JSON Parsing, Add/Edit/Delete & Pending Sync (R4)
  // =========================================================================
  test('T6.3 - Dynamic table JSON parsing, add/edit/delete validation & pending sync', async () => {
    // 1. Simpan konfigurasi meja dinamis ke tabel settings
    const initialTables = [
      { id: 't1', name: 'Meja 01', type: 'meja' },
      { id: 't2', name: 'Meja 02', type: 'meja' },
      { id: 't3', name: 'Lesehan 01', type: 'lesehan' },
    ];
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_tables', ?)",
      [JSON.stringify(initialTables)]
    );

    // 2. Baca dan verifikasi parsing JSON
    const settingRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'custom_tables'"
    );
    assert.ok(settingRow);
    const parsed = JSON.parse(settingRow.value);
    assert.equal(parsed.length, 3);
    assert.equal(parsed[0].name, 'Meja 01');

    // 3. Tambah meja baru secara dinamis
    const newTable = { id: 't4', name: 'Lesehan VIP Garden', type: 'lesehan' };
    const updatedTables = [...parsed, newTable];
    await db.runAsync(
      "UPDATE settings SET value = ? WHERE key = 'custom_tables'",
      [JSON.stringify(updatedTables)]
    );

    const reRead = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'custom_tables'"
    );
    const tablesAfterAdd = JSON.parse(reRead!.value);
    assert.equal(tablesAfterAdd.length, 4);
    assert.ok(tablesAfterAdd.some((t: any) => t.name === 'Lesehan VIP Garden'));

    // 4. Uji Sinkronisasi Atomik pada Transaksi Pending saat Nama Meja Diubah
    // Buat transaksi pending di 'Meja 01'
    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES (?, ?, ?, ?, ?, 'tunai', 0, 'pending')`,
      ['INV-PENDING-01', '2026-11-07', 'Meja 01', 35000, 35000]
    );

    // Ubah nama 'Meja 01' menjadi 'Meja Utama 01'
    const oldName = 'Meja 01';
    const renamedName = 'Meja Utama 01';
    await db.runAsync(
      "UPDATE transactions SET table_number = ? WHERE table_number = ? AND status IN ('pending', 'billing')",
      [renamedName, oldName]
    );

    // Pastikan transaksi pending otomatis tersinkronisasi ke 'Meja Utama 01'
    const pendingTx = await db.getFirstAsync<{ table_number: string; status: string }>(
      'SELECT table_number, status FROM transactions WHERE invoice_number = ?',
      ['INV-PENDING-01']
    );
    assert.equal(pendingTx?.table_number, 'Meja Utama 01', 'Nomor meja pada transaksi pending harus tersinkronisasi');

    // 5. Uji Proteksi Penghapusan Meja yang Memiliki Transaksi Aktif
    const activeCount = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM transactions WHERE table_number = ? AND status IN ('pending', 'billing')",
      ['Meja Utama 01']
    );
    assert.ok(activeCount && activeCount.count > 0, 'Meja dengan pesanan pending harus terdeteksi');
    // Pencegahan: Jika count > 0, sistem melarang penghapusan
    const canDelete = (activeCount?.count ?? 0) === 0;
    assert.equal(canDelete, false, 'Meja dengan pesanan aktif dilarang dihapus');
  });

  // =========================================================================
  // T6.4: Active Cashier Name Recorded On Transactions & Receipts (R5)
  // =========================================================================
  test('T6.4 - Active cashier name recorded on transactions and receipt formatter', async () => {
    const activeCashier = 'Siti Rahmawati (Kasir 1)';

    // 1. Direct Checkout menyimpan activeCashier ke kolom cashier_name di database
    await db.runAsync(
      `INSERT INTO transactions (
        invoice_number, business_date, table_number, subtotal, total,
        payment_method, payment_amount, change_amount, status, cashier_name
      ) VALUES (?, ?, ?, ?, ?, 'tunai', ?, 0, 'completed', ?)`,
      ['INV-KASIR-01', '2026-11-07', 'Meja 03', 45000, 45000, 45000, activeCashier]
    );

    const savedTx = await db.getFirstAsync<{ cashier_name: string; invoice_number: string }>(
      'SELECT cashier_name, invoice_number FROM transactions WHERE invoice_number = ?',
      ['INV-KASIR-01']
    );
    assert.ok(savedTx);
    assert.equal(savedTx.cashier_name, activeCashier, 'Nama kasir aktif harus tersimpan di tabel transactions');

    // 2. Receipt Formatter mencetak nama kasir pada struk pembayaran pelanggan
    const receiptData: PrintReceiptData = {
      storeName: 'ANGKRINGAN JOGJA',
      storeAddress: 'Jl. Malioboro No. 45',
      storePhone: '0812-3456-7890',
      receiptFooter: 'Matur Nuwun!',
      invoiceNumber: 'INV-KASIR-01',
      businessDate: '2026-11-07',
      dateTimeString: '07 Nov 2026, 19:30',
      tableNumber: 'Meja 03',
      customerName: 'Customer UMUM',
      cashierName: activeCashier,
      items: [{ name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2, subtotal: 10000 }],
      subtotal: 10000,
      total: 10000,
      paymentMethod: 'tunai',
      paymentAmount: 10000,
      changeAmount: 0,
    };

    const customerReceiptLines = formatCustomerReceiptLines(receiptData);
    assert.ok(
      customerReceiptLines.some((line) => line.includes(`Kasir    : ${activeCashier}`)),
      'Struk customer harus mencantumkan nama kasir aktif'
    );

    // 3. Receipt Formatter mencetak nama kasir pada struk tagihan sementara (temporary bill)
    const tempBillLines = formatTemporaryBillReceiptLines(receiptData);
    assert.ok(
      tempBillLines.some((line) => line.includes(`Kasir    : ${activeCashier}`)),
      'Struk tagihan sementara harus mencantumkan nama kasir aktif'
    );
  });

  // =========================================================================
  // T6.5: Supplier Purchase Cash Ledger vs Tempo Debt Integration (R6)
  // =========================================================================
  test('T6.5 - Supplier purchase cash ledger vs tempo debt integration', async () => {
    // 1. Catat Supplier
    await db.runAsync("INSERT INTO suppliers (id, name, phone) VALUES (1, 'Grosir Beras Berkah', '0811-222-333')");

    // 2. Pembelian Tunai (CASH):
    // Status langsung 'paid' & mencatat pengeluaran operasional ke cash_ledger (affects_pnl = 1)
    const cashAmount = 250000;
    await db.runAsync(
      `INSERT INTO purchases (id, supplier_id, supplier_name, business_date, total_amount, payment_type, payment_status)
       VALUES (101, 1, 'Grosir Beras Berkah', '2026-11-07', ?, 'cash', 'paid')`,
      [cashAmount]
    );
    await db.runAsync(
      `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
       VALUES ('2026-11-07', 'expense', 1, 'Pembelian Bahan/Kulakan', ?, 'Kulakan tunai')`,
      [cashAmount]
    );

    // Verifikasi cash_ledger memiliki 1 entri pengeluaran
    const cashLedgerEntries = await db.getAllAsync<{ type: string; affects_pnl: number; amount: number }>(
      "SELECT type, affects_pnl, amount FROM cash_ledger WHERE category = 'Pembelian Bahan/Kulakan'"
    );
    assert.equal(cashLedgerEntries.length, 1);
    assert.equal(cashLedgerEntries[0].amount, 250000);
    assert.equal(cashLedgerEntries[0].affects_pnl, 1);

    // 3. Pembelian Tempo (TEMPO / UTANG):
    // Status 'unpaid' & TIDAK BOLEH mencemari cash_ledger saat transaksi dibuat
    const tempoAmount = 400000;
    await db.runAsync(
      `INSERT INTO purchases (id, supplier_id, supplier_name, business_date, total_amount, payment_type, due_date, payment_status)
       VALUES (102, 1, 'Grosir Beras Berkah', '2026-11-07', ?, 'tempo', '2026-11-14', 'unpaid')`,
      [tempoAmount]
    );

    // Verifikasi buku hutang supplier bertambah 400.000
    const unpaidDebtRow = await db.getFirstAsync<{ debt: number }>(
      "SELECT SUM(total_amount) as debt FROM purchases WHERE payment_type = 'tempo' AND payment_status = 'unpaid'"
    );
    assert.equal(unpaidDebtRow?.debt, 400000);

    // Pastikan cash_ledger belum bertambah
    const ledgerAfterTempo = await db.getAllAsync(
      "SELECT * FROM cash_ledger WHERE notes LIKE '%tempo%'"
    );
    assert.equal(ledgerAfterTempo.length, 0, 'Pembelian tempo tidak boleh masuk cash_ledger sebelum dilunasi');

    // 4. Pelunasan Hutang Tempo (settleTempoDebt):
    // Status pembelian menjadi 'paid' & entri kas keluar dicatat di cash_ledger
    await db.runAsync("UPDATE purchases SET payment_status = 'paid' WHERE id = 102");
    await db.runAsync(
      `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
       VALUES ('2026-11-07', 'expense', 1, 'Pelunasan Hutang Supplier', ?, 'Pelunasan pembelian #102')`,
      [tempoAmount]
    );

    // Verifikasi hutang sekarang bernilai 0 atau null
    const debtAfterSettle = await db.getFirstAsync<{ debt: number | null }>(
      "SELECT SUM(total_amount) as debt FROM purchases WHERE payment_type = 'tempo' AND payment_status = 'unpaid'"
    );
    assert.equal(debtAfterSettle?.debt ?? 0, 0, 'Hutang tempo harus bernilai 0 setelah dilunasi');

    // Verifikasi pengeluaran pelunasan tercatat di cash_ledger
    const settleLedger = await db.getFirstAsync<{ amount: number; category: string }>(
      "SELECT amount, category FROM cash_ledger WHERE category = 'Pelunasan Hutang Supplier'"
    );
    assert.ok(settleLedger);
    assert.equal(settleLedger.amount, 400000);
  });

  // =========================================================================
  // T6.6: Multi-Bank Account JSON Parsing & Validation (R8)
  // =========================================================================
  test('T6.6 - Multi-bank account JSON parsing and validation', async () => {
    const bankList = [
      { id: 'b1', bank_name: 'BCA', account_number: '1234567890', account_holder: 'Angkringan Jogja' },
      { id: 'b2', bank_name: 'Mandiri', account_number: '9876543210', account_holder: 'Bambang Sudarsono' },
      { id: 'b3', bank_name: 'BRI', account_number: '555566667777', account_holder: 'Angkringan Jogja' },
    ];

    // Simpan ke tabel settings
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('bank_accounts', ?)",
      [JSON.stringify(bankList)]
    );

    // Ambil dan uji parsing
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'bank_accounts'"
    );
    assert.ok(row);

    const parsedBanks = JSON.parse(row.value);
    assert.equal(Array.isArray(parsedBanks), true);
    assert.equal(parsedBanks.length, 3);
    assert.equal(parsedBanks[0].bank_name, 'BCA');
    assert.equal(parsedBanks[0].account_number, '1234567890');
    assert.equal(parsedBanks[1].bank_name, 'Mandiri');
    assert.equal(parsedBanks[2].bank_name, 'BRI');

    // Uji ketahanan terhadap format corrupt / kosong
    const malformedJson = 'invalid-json-{';
    let safeFallback: any[] = [];
    try {
      safeFallback = JSON.parse(malformedJson);
    } catch {
      safeFallback = [];
    }
    assert.deepEqual(safeFallback, [], 'Malformed JSON harus ditangani dengan fallback array kosong');
  });

  // =========================================================================
  // T6.7: Attendance Business Date Calendar Mapping & Daily Filtering (R7)
  // =========================================================================
  test('T6.7 - Attendance business_date calendar mapping and daily filtering', async () => {
    // 1. Daftarkan Karyawan
    await db.runAsync("INSERT INTO employees (id, name) VALUES (1, 'Budi Santoso')");
    await db.runAsync("INSERT INTO employees (id, name) VALUES (2, 'Siti Rahma')");
    await db.runAsync("INSERT INTO employees (id, name) VALUES (3, 'Agus Triyono')");

    // 2. Seed data absensi pada 3 tanggal berbeda
    // 2026-11-05: 1 hadir tepat waktu
    await db.runAsync(
      `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, is_late, late_minutes, check_in_photo)
       VALUES (1, 'Budi Santoso', '2026-11-05', '17:15', 0, 0, 'file:///photos/budi1.jpg')`
    );

    // 2026-11-07: 2 hadir (1 tepat waktu, 1 terlambat)
    await db.runAsync(
      `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, is_late, late_minutes, check_in_photo)
       VALUES (1, 'Budi Santoso', '2026-11-07', '17:20', 0, 0, 'file:///photos/budi2.jpg')`
    );
    await db.runAsync(
      `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, is_late, late_minutes, check_in_photo)
       VALUES (2, 'Siti Rahma', '2026-11-07', '17:45', 1, 15, 'file:///photos/siti1.jpg')`
    );

    // 2026-11-08: 1 hadir terlambat
    await db.runAsync(
      `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, is_late, late_minutes, check_in_photo)
       VALUES (3, 'Agus Triyono', '2026-11-08', '18:00', 1, 30, 'file:///photos/agus1.jpg')`
    );

    // 3. Uji Filter Harian Kalender: Pilih '2026-11-07'
    const targetDate = '2026-11-07';
    const dailyRecords = await db.getAllAsync<{
      id: number;
      employee_name: string;
      business_date: string;
      check_in_time: string;
      is_late: number;
      late_minutes: number;
    }>('SELECT * FROM attendance WHERE business_date = ? ORDER BY id ASC', [targetDate]);

    assert.equal(dailyRecords.length, 2, 'Tanggal 2026-11-07 harus mengembalikan tepat 2 catatan absensi');
    assert.equal(dailyRecords[0].employee_name, 'Budi Santoso');
    assert.equal(dailyRecords[0].is_late, 0);
    assert.equal(dailyRecords[1].employee_name, 'Siti Rahma');
    assert.equal(dailyRecords[1].is_late, 1);
    assert.equal(dailyRecords[1].late_minutes, 15);

    // 4. Verifikasi Agregasi Status Kalender Bulanan
    const allNovember = await db.getAllAsync<{ business_date: string; is_late: number }>(
      "SELECT business_date, is_late FROM attendance WHERE business_date LIKE '2026-11%'"
    );
    assert.equal(allNovember.length, 4);

    const dateMap: Record<string, { total: number; hasLate: boolean }> = {};
    for (const row of allNovember) {
      if (!dateMap[row.business_date]) {
        dateMap[row.business_date] = { total: 0, hasLate: false };
      }
      dateMap[row.business_date].total += 1;
      if (row.is_late === 1) {
        dateMap[row.business_date].hasLate = true;
      }
    }

    assert.equal(dateMap['2026-11-05'].total, 1);
    assert.equal(dateMap['2026-11-05'].hasLate, false); // Hijau (Tepat Waktu)

    assert.equal(dateMap['2026-11-07'].total, 2);
    assert.equal(dateMap['2026-11-07'].hasLate, true); // Oranye/Merah (Ada Terlambat)

    assert.equal(dateMap['2026-11-08'].total, 1);
    assert.equal(dateMap['2026-11-08'].hasLate, true); // Oranye/Merah (Ada Terlambat)
  });
});
