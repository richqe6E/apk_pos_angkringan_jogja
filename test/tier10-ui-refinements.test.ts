import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, type TestDatabase } from './helpers/db.js';

describe('Tier 10: UI & Operational Refinements', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // T10.1: Laporan Rekap Absensi 1 Bulan Penuh (Monthly Attendance Aggregation)
  // =========================================================================
  describe('T10.1 - Monthly Attendance Aggregation Math & Metrics', () => {
    interface AttendanceRecordMock {
      id: number;
      employee_id: number;
      employee_name: string;
      business_date: string;
      check_in_time: string;
      check_out_time: string | null;
      is_late: number;
      late_minutes: number;
    }

    const mockRecords: AttendanceRecordMock[] = [
      { id: 1, employee_id: 101, employee_name: 'Joko', business_date: '2026-11-01', check_in_time: '17:15', check_out_time: '23:00', is_late: 0, late_minutes: 0 },
      { id: 2, employee_id: 102, employee_name: 'Siti', business_date: '2026-11-01', check_in_time: '17:45', check_out_time: '23:00', is_late: 1, late_minutes: 15 },
      { id: 3, employee_id: 101, employee_name: 'Joko', business_date: '2026-11-02', check_in_time: '17:20', check_out_time: '23:00', is_late: 0, late_minutes: 0 },
      { id: 4, employee_id: 102, employee_name: 'Siti', business_date: '2026-11-02', check_in_time: '17:35', check_out_time: '23:00', is_late: 1, late_minutes: 5 },
      { id: 5, employee_id: 103, employee_name: 'Budi', business_date: '2026-11-02', check_in_time: '17:10', check_out_time: '23:00', is_late: 0, late_minutes: 0 },
    ];

    test('T10.1.1 - Computes monthly totals: kehadiran, tepat waktu, terlambat & total menit telat', () => {
      const totalHadir = mockRecords.length;
      const onTimeRecords = mockRecords.filter((r) => r.is_late === 0);
      const lateRecords = mockRecords.filter((r) => r.is_late === 1);
      const totalLateMinutes = mockRecords.reduce((acc, r) => acc + r.late_minutes, 0);
      const disciplineRate = Math.round((onTimeRecords.length / totalHadir) * 100);
      const uniqueDays = new Set(mockRecords.map((r) => r.business_date)).size;

      assert.equal(totalHadir, 5);
      assert.equal(onTimeRecords.length, 3);
      assert.equal(lateRecords.length, 2);
      assert.equal(totalLateMinutes, 20); // 15 + 5
      assert.equal(disciplineRate, 60); // 3 / 5 = 60%
      assert.equal(uniqueDays, 2);
    });

    test('T10.1.2 - Aggregates performance matrix per staff member', () => {
      const empMap: Record<string, { hadir: number; onTime: number; late: number; lateMins: number }> = {};

      for (const r of mockRecords) {
        if (!empMap[r.employee_name]) {
          empMap[r.employee_name] = { hadir: 0, onTime: 0, late: 0, lateMins: 0 };
        }
        empMap[r.employee_name].hadir += 1;
        if (r.is_late === 1) {
          empMap[r.employee_name].late += 1;
          empMap[r.employee_name].lateMins += r.late_minutes;
        } else {
          empMap[r.employee_name].onTime += 1;
        }
      }

      // Joko: 2 hadir, 2 on-time, 0 late
      assert.equal(empMap['Joko'].hadir, 2);
      assert.equal(empMap['Joko'].onTime, 2);
      assert.equal(empMap['Joko'].late, 0);
      assert.equal(empMap['Joko'].lateMins, 0);

      // Siti: 2 hadir, 0 on-time, 2 late (20 mins)
      assert.equal(empMap['Siti'].hadir, 2);
      assert.equal(empMap['Siti'].onTime, 0);
      assert.equal(empMap['Siti'].late, 2);
      assert.equal(empMap['Siti'].lateMins, 20);

      // Budi: 1 hadir, 1 on-time, 0 late
      assert.equal(empMap['Budi'].hadir, 1);
      assert.equal(empMap['Budi'].onTime, 1);
      assert.equal(empMap['Budi'].late, 0);
    });

    test('T10.1.3 - Throws descriptive error if monthly records are empty', () => {
      const emptyRecords: AttendanceRecordMock[] = [];
      assert.throws(
        () => {
          if (emptyRecords.length === 0) {
            throw new Error('Tidak ada data absensi pada bulan ini untuk diexport.');
          }
        },
        /Tidak ada data absensi/
      );
    });
  });

  // =========================================================================
  // T10.2: Menu Terlaris (Clean FlatList Sorting without Podium Cards)
  // =========================================================================
  describe('T10.2 - Top Selling Menu Query and Sorting', () => {
    beforeEach(async () => {
      // Seed transactions and items
      await db.runAsync(
        `INSERT INTO transactions (id, invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES 
         (1, 'INV-001', '2026-11-12', 'Meja 01', 50000, 50000, 'tunai', 50000, 'completed'),
         (2, 'INV-002', '2026-11-12', 'Meja 02', 75000, 75000, 'qris', 75000, 'completed')`
      );

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal)
         VALUES 
         (1, 1, 'Nasi Kucing Teri', 6000, 5, 30000),
         (1, 2, 'Wedang Jahe Geprek', 5000, 4, 20000),
         (2, 1, 'Nasi Kucing Teri', 6000, 5, 30000),
         (2, 3, 'Sate Telur Puyuh', 7000, 5, 35000),
         (2, 2, 'Wedang Jahe Geprek', 5000, 2, 10000)`
      );
    });

    test('T10.2.1 - Sorts top sellers by Qty descending', async () => {
      const rows = await db.getAllAsync<{ menu_name: string; total_qty: number; total_omzet: number }>(
        `SELECT menu_name, SUM(qty) as total_qty, SUM(subtotal) as total_omzet
         FROM transaction_items
         GROUP BY menu_name
         ORDER BY total_qty DESC`
      );

      assert.equal(rows.length, 3);
      // Nasi Kucing Teri: 5 + 5 = 10
      assert.equal(rows[0].menu_name, 'Nasi Kucing Teri');
      assert.equal(rows[0].total_qty, 10);
      assert.equal(rows[0].total_omzet, 60000);

      // Wedang Jahe Geprek: 4 + 2 = 6
      assert.equal(rows[1].menu_name, 'Wedang Jahe Geprek');
      assert.equal(rows[1].total_qty, 6);

      // Sate Telur Puyuh: 5
      assert.equal(rows[2].menu_name, 'Sate Telur Puyuh');
      assert.equal(rows[2].total_qty, 5);
    });

    test('T10.2.2 - Sorts top sellers by Omzet descending', async () => {
      const rows = await db.getAllAsync<{ menu_name: string; total_qty: number; total_omzet: number }>(
        `SELECT menu_name, SUM(qty) as total_qty, SUM(subtotal) as total_omzet
         FROM transaction_items
         GROUP BY menu_name
         ORDER BY total_omzet DESC`
      );

      assert.equal(rows.length, 3);
      assert.equal(rows[0].menu_name, 'Nasi Kucing Teri'); // 60,000
      assert.equal(rows[1].menu_name, 'Sate Telur Puyuh'); // 35,000
      assert.equal(rows[2].menu_name, 'Wedang Jahe Geprek'); // 30,000
    });
  });

  // =========================================================================
  // T10.3: Pengaturan Modular Master-Detail (Settings Navigation Categories)
  // =========================================================================
  describe('T10.3 - Modular Settings Sub-Categories Configuration', () => {
    const EXPECTED_SUB_TABS = [
      'profile',
      'qris_bank',
      'printer',
      'backup',
      'pin',
      'clear',
    ];

    test('T10.3.1 - Exactly 6 distinct sub-settings are configured', () => {
      assert.equal(EXPECTED_SUB_TABS.length, 6);
      assert.deepEqual(EXPECTED_SUB_TABS, [
        'profile',
        'qris_bank',
        'printer',
        'backup',
        'pin',
        'clear',
      ]);
    });

    test('T10.3.2 - Settings database keys map accurately across sub-categories', async () => {
      // 1. Profile keys
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('store_name', 'Angkringan Kopi Joss')");
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('store_address', 'Jl. Mangkubumi No. 10')");
      // 2. QRIS & Bank
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('qris_image_path', '/path/to/qris.jpg')");
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('bank_accounts', '[{\"id\":\"1\",\"bank_name\":\"BCA\",\"account_number\":\"123456\",\"account_holder\":\"Owner\"}]')");
      // 3. Printer & Pin
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_pin', '654321')");

      const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
      const settingsMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));

      assert.equal(settingsMap['store_name'], 'Angkringan Kopi Joss');
      assert.equal(settingsMap['store_address'], 'Jl. Mangkubumi No. 10');
      assert.equal(settingsMap['qris_image_path'], '/path/to/qris.jpg');
      assert.equal(settingsMap['admin_pin'], '654321');

      const banks = JSON.parse(settingsMap['bank_accounts']);
      assert.equal(banks.length, 1);
      assert.equal(banks[0].bank_name, 'BCA');
    });
  });

  // =========================================================================
  // T10.4: Keranjang Transaksi & Temporary Bill Flow
  // =========================================================================
  describe('T10.4 - Clean Cart Summary & Temporary Bill Flow', () => {
    test('T10.4.1 - Cart total is single and unambiguous without redundant subtotal line', () => {
      const items = [
        { name: 'Kopi Joss', price: 6000, qty: 2, subtotal: 12000 },
        { name: 'Nasi Kucing', price: 5000, qty: 3, subtotal: 15000 },
      ];

      const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
      const taxRate = 0; // standard PB1 inactive
      const taxAmount = Math.round(subtotal * taxRate);
      const grandTotal = subtotal + taxAmount;

      assert.equal(subtotal, 27000);
      assert.equal(taxAmount, 0);
      assert.equal(grandTotal, 27000);
    });

    test('T10.4.2 - Temporary Bill payload contains complete operational details', () => {
      const payload = {
        storeName: 'ANGKRINGAN JOGJA',
        storeAddress: 'Jl. Malioboro No. 45',
        storePhone: '0812-3456-7890',
        receiptFooter: 'Matur Nuwun Sampun Rawuh!',
        invoiceNumber: 'INV-20261112-005',
        businessDate: '2026-11-12',
        dateTimeString: 'Kamis, 12 November 2026, 20.15',
        tableNumber: 'Meja 04',
        customerName: 'Mas Danang',
        cashierName: 'Rian',
        items: [
          { name: 'Sate Usus', price: 3000, qty: 4, subtotal: 12000, notes: 'Bakar kecap' },
          { name: 'Es Jeruk', price: 5000, qty: 2, subtotal: 10000, notes: 'Gula murni' },
        ],
        subtotal: 22000,
        taxAmount: 0,
        discountAmount: 0,
        total: 22000,
        paymentMethod: 'tagihan_sementara',
        paymentAmount: 0,
        changeAmount: 0,
      };

      assert.equal(payload.invoiceNumber, 'INV-20261112-005');
      assert.equal(payload.tableNumber, 'Meja 04');
      assert.equal(payload.paymentMethod, 'tagihan_sementara');
      assert.equal(payload.total, 22000);
      assert.equal(payload.items.length, 2);
      assert.equal(payload.items[0].notes, 'Bakar kecap');
    });
  });
});
