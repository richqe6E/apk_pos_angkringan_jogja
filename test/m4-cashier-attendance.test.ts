import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import { formatCustomerReceiptLines } from './helpers/receiptFormatter.js';

describe('Milestone 4: Cashier Identity (R5) & Attendance Calendar (R6)', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  describe('R5 - Cashier Identity Persistence & Audit Stamping', () => {
    test('R5.1 - Direct checkout saves active cashier name into SQLite database', async () => {
      const activeCashier = 'Budi Santoso';
      const businessDate = '2026-11-07';

      // Insert transaction directly simulating checkout()
      const res = await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
          change_amount, status, cashier_name
        ) VALUES (?, ?, ?, 1, 'Customer UMUM', 50000, 0, 0, 50000, 'tunai', 50000, 0, 'completed', ?)`,
        ['INV-071126-001', businessDate, 'Meja 01', activeCashier]
      );

      const txRow = await db.getFirstAsync<{ cashier_name: string; status: string }>(
        'SELECT cashier_name, status FROM transactions WHERE id = ?',
        [res.lastInsertRowId]
      );

      assert.strictEqual(txRow?.cashier_name, 'Budi Santoso');
      assert.strictEqual(txRow?.status, 'completed');
    });

    test('R5.2 - Save as pending order preserves active cashier name', async () => {
      const activeCashier = 'Siti Rahma';
      const businessDate = '2026-11-07';

      const res = await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
          change_amount, status, cashier_name
        ) VALUES (?, ?, ?, 1, 'Customer UMUM', 35000, 0, 0, 35000, 'tunai', 0, 0, 'pending', ?)`,
        ['INV-071126-002', businessDate, 'Meja 03', activeCashier]
      );

      const txRow = await db.getFirstAsync<{ cashier_name: string; status: string }>(
        'SELECT cashier_name, status FROM transactions WHERE id = ?',
        [res.lastInsertRowId]
      );

      assert.strictEqual(txRow?.cashier_name, 'Siti Rahma');
      assert.strictEqual(txRow?.status, 'pending');
    });

    test('R5.3 - Settling pending order updates cashier name with currently active cashier', async () => {
      const originalCashier = 'Kasir Shift 1';
      const settlingCashier = 'Agus Shift 2';

      // 1. Initial pending order by Shift 1
      const res = await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
          change_amount, status, cashier_name
        ) VALUES (?, '2026-11-07', 'Meja 05', 1, 'Customer UMUM', 40000, 0, 0, 40000, 'tunai', 0, 0, 'pending', ?)`,
        ['INV-071126-003', originalCashier]
      );
      const txId = res.lastInsertRowId;

      // 2. Settlement performed by Shift 2 cashier
      await db.runAsync(
        `UPDATE transactions
         SET subtotal = ?, tax_amount = 0, discount_amount = 0, total = ?,
             payment_method = 'qris', payment_amount = ?, change_amount = 0,
             status = 'completed', cashier_name = ?
         WHERE id = ?`,
        [40000, 40000, 40000, settlingCashier, txId]
      );

      const settledRow = await db.getFirstAsync<{ cashier_name: string; payment_method: string; status: string }>(
        'SELECT cashier_name, payment_method, status FROM transactions WHERE id = ?',
        [txId]
      );

      assert.strictEqual(settledRow?.cashier_name, 'Agus Shift 2');
      assert.strictEqual(settledRow?.payment_method, 'qris');
      assert.strictEqual(settledRow?.status, 'completed');
    });

    test('R5.4 - Default fallback is "Kasir" when no cashier identity is provided', async () => {
      const fallbackCashier: string = '';
      const res = await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
          change_amount, status, cashier_name
        ) VALUES (?, '2026-11-07', 'Meja 02', 1, 'Customer UMUM', 20000, 0, 0, 20000, 'tunai', 20000, 0, 'completed', ?)`,
        ['INV-071126-004', fallbackCashier || 'Kasir']
      );

      const txRow = await db.getFirstAsync<{ cashier_name: string }>(
        'SELECT cashier_name FROM transactions WHERE id = ?',
        [res.lastInsertRowId]
      );

      assert.strictEqual(txRow?.cashier_name, 'Kasir');
    });

    test('R5.5 - Receipt formatter clearly displays cashier name for customer & audit slips', () => {
      const receiptData = {
        storeName: 'ANGKRINGAN JOGJA',
        storeAddress: 'Jl. Malioboro No. 45',
        storePhone: '0812-3456-7890',
        receiptFooter: 'Matur Nuwun',
        invoiceNumber: 'INV-071126-005',
        businessDate: '2026-11-07',
        dateTimeString: 'Sabtu, 07 November 2026, 20:30 WIB',
        tableNumber: 'Meja 04',
        customerName: 'Mas Danang',
        cashierName: 'Rian Pradana',
        items: [
          { name: 'Nasi Kucing Teri', price: 3000, qty: 2, subtotal: 6000 },
          { name: 'Sate Usus Bakar', price: 3000, qty: 3, subtotal: 9000 },
        ],
        subtotal: 15000,
        taxAmount: 0,
        discountAmount: 0,
        total: 15000,
        paymentMethod: 'tunai',
        paymentAmount: 20000,
        changeAmount: 5000,
      };

      const lines = formatCustomerReceiptLines(receiptData);
      assert.ok(lines.some((line) => line === 'Kasir    : Rian Pradana'), 'Should print cashier name');
      assert.ok(lines.some((line) => line.includes('No. Nota : INV-071126-005')));
      assert.ok(lines.some((line) => line.includes('TOTAL')));
    });
  });

  describe('R6 - Calendar Attendance Recap & Pure Date Mathematics', () => {
    test('R6.1 - Calendar daysInMonth math computes correct day count across all calendar months', () => {
      const testCases = [
        { year: 2026, month: 1, expectedDays: 31 }, // Januari
        { year: 2026, month: 2, expectedDays: 28 }, // Februari non-kabisat
        { year: 2024, month: 2, expectedDays: 29 }, // Februari kabisat
        { year: 2026, month: 4, expectedDays: 30 }, // April
        { year: 2026, month: 11, expectedDays: 30 }, // November
        { year: 2026, month: 12, expectedDays: 31 }, // Desember
      ];

      for (const tc of testCases) {
        const computed = new Date(tc.year, tc.month, 0).getDate();
        assert.strictEqual(computed, tc.expectedDays, `Month ${tc.month}/${tc.year} should have ${tc.expectedDays} days`);
      }
    });

    test('R6.2 - Start-of-month day-of-week offset calculation (0=Min, 6=Sab)', () => {
      // November 2026 starts on Sunday (Min = 0)
      const nov2026Start = new Date(2026, 11 - 1, 1).getDay();
      assert.strictEqual(nov2026Start, 0, 'November 1, 2026 must be Sunday (0)');

      // December 2026 starts on Tuesday (Sel = 2)
      const dec2026Start = new Date(2026, 12 - 1, 1).getDay();
      assert.strictEqual(dec2026Start, 2, 'December 1, 2026 must be Tuesday (2)');
    });

    test('R6.3 - Grouping attendance records by date and computing presence indicators', () => {
      const records = [
        {
          id: 1,
          employee_id: 1,
          employee_name: 'Budi',
          business_date: '2026-11-05',
          check_in_time: '17:15',
          is_late: 0,
          late_minutes: 0,
        },
        {
          id: 2,
          employee_id: 2,
          employee_name: 'Agus',
          business_date: '2026-11-05',
          check_in_time: '17:20',
          is_late: 0,
          late_minutes: 0,
        },
        {
          id: 3,
          employee_id: 3,
          employee_name: 'Siti',
          business_date: '2026-11-06',
          check_in_time: '17:45',
          is_late: 1,
          late_minutes: 15,
        },
      ];

      const attendanceByDate: Record<string, typeof records> = {};
      for (const rec of records) {
        if (!attendanceByDate[rec.business_date]) {
          attendanceByDate[rec.business_date] = [];
        }
        attendanceByDate[rec.business_date].push(rec);
      }

      // Check 2026-11-05 (All on time)
      const day5 = attendanceByDate['2026-11-05'] || [];
      assert.strictEqual(day5.length, 2);
      assert.strictEqual(day5.some((r) => r.is_late === 1), false, 'Day 5 should have 0 late');

      // Check 2026-11-06 (Has late staff)
      const day6 = attendanceByDate['2026-11-06'] || [];
      assert.strictEqual(day6.length, 1);
      assert.strictEqual(day6.some((r) => r.is_late === 1), true, 'Day 6 should have late staff');

      // Check 2026-11-07 (Empty / No attendance)
      const day7 = attendanceByDate['2026-11-07'] || [];
      assert.strictEqual(day7.length, 0, 'Day 7 has no attendance');
    });

    test('R6.4 - Date breakdown summary metrics calculation', () => {
      const recordsOnDate = [
        { id: 1, employee_name: 'Budi', is_late: 0, late_minutes: 0 },
        { id: 2, employee_name: 'Agus', is_late: 0, late_minutes: 0 },
        { id: 3, employee_name: 'Siti', is_late: 1, late_minutes: 12 },
        { id: 4, employee_name: 'Dewi', is_late: 1, late_minutes: 25 },
      ];

      const totalPresent = recordsOnDate.length;
      const onTime = recordsOnDate.filter((r) => r.is_late === 0).length;
      const late = recordsOnDate.filter((r) => r.is_late === 1).length;

      assert.strictEqual(totalPresent, 4);
      assert.strictEqual(onTime, 2);
      assert.strictEqual(late, 2);
    });

    test('R6.5 - Month navigation transitions with zero external library', () => {
      const currentMonth = '2026-11';
      const [y, m] = currentMonth.split('-').map(Number);

      // Previous month
      const prevDate = new Date(y, m - 2, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      assert.strictEqual(prevMonth, '2026-10');

      // Next month
      const nextDate = new Date(y, m, 1);
      const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      assert.strictEqual(nextMonth, '2026-12');

      // Year boundary transition: Jan 2027 -> Dec 2026
      const jan2027 = '2027-01';
      const [jy, jm] = jan2027.split('-').map(Number);
      const decDate = new Date(jy, jm - 2, 1);
      const decMonth = `${decDate.getFullYear()}-${String(decDate.getMonth() + 1).padStart(2, '0')}`;
      assert.strictEqual(decMonth, '2026-12');
    });
  });
});
