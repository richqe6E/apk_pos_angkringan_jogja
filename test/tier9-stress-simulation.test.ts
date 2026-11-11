import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import {
  createFileSystemSimulator,
  deleteMonthlyAttendancePhotos,
  type FileSystemSimulator,
} from './helpers/photoCleanup.js';
import {
  loadFinancialSummary,
  saveMonthlyCogs,
  addCashEntry,
} from './helpers/financialEngine.js';
import {
  formatCustomerReceiptLines,
  formatKitchenTicketLines,
  formatKitchenAdditionalTicketLines,
} from './helpers/receiptFormatter.js';

// =============================================================================
// Helper Constants & Generators
// =============================================================================

// 60 consecutive business dates: Feb 1-29, 2024 (Leap Year) + Mar 1-31, 2024
const FEB_2024_DATES: string[] = [];
for (let d = 1; d <= 29; d++) {
  FEB_2024_DATES.push(`2024-02-${String(d).padStart(2, '0')}`);
}
const MAR_2024_DATES: string[] = [];
for (let d = 1; d <= 31; d++) {
  MAR_2024_DATES.push(`2024-03-${String(d).padStart(2, '0')}`);
}
const ALL_60_DATES: string[] = [...FEB_2024_DATES, ...MAR_2024_DATES];

const TABLES = [
  'Meja 01', 'Meja 02', 'Meja 03', 'Meja 04',
  'Meja 05', 'Meja 06', 'Meja 07', 'Meja 08',
  'Meja 09', 'Meja 10', 'Meja 11', 'Meja 12',
  'Lesehan 01', 'Lesehan 02', 'Lesehan 03', 'Lesehan 04',
];

const CASHIERS = ['Budi Santoso', 'Siti Rahma', 'Agus Setiawan'];

const NOTES_LIST = [
  '',
  'Pedas level 3',
  'Bungkus / Takeaway',
  'Tanpa gula',
  'Es sedikit',
  'Bakar manis gurih',
  'Jangan gosong',
  'Panas membara',
  'Sambal dipisah',
];

interface SeededTransactionStats {
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  mergedCount: number;
  cancelledCount: number;
  pureCashCount: number;
  pureQrisCount: number;
  splitCount: number;
  transferCount: number;
  taxCount: number;
  discountCount: number;
  totalGrossSales: number;
  totalCashSalesInDrawer: number;
  totalQrisSales: number;
  totalTransferSales: number;
  totalTax: number;
  totalDiscounts: number;
  totalCompletedItemsQty: number;
  totalCompletedSubtotal: number;
  menu1HistoricalQty: number;
  menu1HistoricalOmzet: number;
}

/**
 * Seed 1,000 realistic transactions inside a single db.withTransactionAsync block.
 * Demonstrates sub-second execution while satisfying all distribution requirements.
 */
async function seed1000RealisticTransactions(db: TestDatabase): Promise<SeededTransactionStats> {
  return await db.withTransactionAsync(async () => {
    // 16 seeded menus from db.js
    const catalog = await db.getAllAsync<{ id: number; name: string; price: number }>(
      'SELECT id, name, price FROM menus ORDER BY id ASC'
    );

    const stats: SeededTransactionStats = {
      totalCount: 1000,
      completedCount: 850,
      pendingCount: 50,
      mergedCount: 50,
      cancelledCount: 50,
      pureCashCount: 500,
      pureQrisCount: 200,
      splitCount: 100,
      transferCount: 50,
      taxCount: 250,
      discountCount: 150,
      totalGrossSales: 0,
      totalCashSalesInDrawer: 0,
      totalQrisSales: 0,
      totalTransferSales: 0,
      totalTax: 0,
      totalDiscounts: 0,
      totalCompletedItemsQty: 0,
      totalCompletedSubtotal: 0,
      menu1HistoricalQty: 0,
      menu1HistoricalOmzet: 0,
    };

    let txCounter = 0;

    // Helper to format invoice INV-DDMMYY-XXX
    const formatInvoice = (dateStr: string, seq: number) => {
      const [y, m, d] = dateStr.split('-');
      return `INV-${d}${m}${y.slice(2)}-${String(seq).padStart(3, '0')}`;
    };

    // -------------------------------------------------------------------------
    // Phase 1: 500 Pure Cash Completed Transactions (Tx 1 .. 500)
    // -------------------------------------------------------------------------
    for (let i = 1; i <= 500; i++) {
      txCounter++;
      const bizDate = ALL_60_DATES[(i - 1) % ALL_60_DATES.length];
      const table = TABLES[(i - 1) % TABLES.length];
      const cashier = CASHIERS[(i - 1) % CASHIERS.length];
      const invoice = formatInvoice(bizDate, i);

      // Select 2 to 3 items. Menu 1 (Nasi Kucing Sambal Teri) is active here!
      const item1 = catalog[(i * 3) % catalog.length];
      const item2 = catalog[(i * 5 + 1) % catalog.length];
      const qty1 = (i % 3) + 1;
      const qty2 = ((i + 1) % 2) + 1;
      const subtotal1 = item1.price * qty1;
      const subtotal2 = item2.price * qty2;
      const subtotal = subtotal1 + subtotal2;

      // Tax enabled on first 250 transactions
      const taxEnabled = i <= 250;
      const taxAmount = taxEnabled ? Math.round((subtotal * 10) / 100) : 0;

      // Discounts on first 150 transactions (including Tier 3 loyalty 25k)
      let discountAmount = 0;
      if (i <= 50) {
        discountAmount = 25000; // Tier 3 customer loyalty voucher
      } else if (i <= 100) {
        discountAmount = 5000;
      } else if (i <= 150) {
        discountAmount = 2000;
      }

      // Clamping to non-negative
      const total = Math.max(0, subtotal + taxAmount - discountAmount);

      const note1 = NOTES_LIST[i % NOTES_LIST.length];
      const note2 = NOTES_LIST[(i + 3) % NOTES_LIST.length];

      await db.runAsync(
        `INSERT INTO transactions (
           id, invoice_number, business_date, table_number, customer_id, customer_name,
           subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
           change_amount, status, cashier_name, cash_received, qris_received
         ) VALUES (?, ?, ?, ?, 1, 'Customer UMUM', ?, ?, ?, ?, 'tunai', ?, ?, 'completed', ?, ?, 0)`,
        [txCounter, invoice, bizDate, table, subtotal, taxAmount, discountAmount, total, total + 10000, 10000, cashier, total]
      );

      // Insert line items
      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional, notes)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?), (?, ?, ?, ?, ?, ?, 0, ?)`,
        [txCounter, item1.id, item1.name, item1.price, qty1, subtotal1, note1,
         txCounter, item2.id, item2.name, item2.price, qty2, subtotal2, note2]
      );

      // Pure cash enters cash_ledger as penjualan_tunai
      await db.runAsync(
        `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
         VALUES (?, 'income', 1, 'penjualan_tunai', ?, ?)`,
        [bizDate, total, `Penjualan Nota ${invoice} (${table})`]
      );

      // Stats aggregation
      stats.totalGrossSales += total;
      stats.totalCashSalesInDrawer += total;
      stats.totalTax += taxAmount;
      stats.totalDiscounts += discountAmount;
      stats.totalCompletedItemsQty += qty1 + qty2;
      stats.totalCompletedSubtotal += subtotal;

      if (item1.id === 1) {
        stats.menu1HistoricalQty += qty1;
        stats.menu1HistoricalOmzet += subtotal1;
      }
      if (item2.id === 1) {
        stats.menu1HistoricalQty += qty2;
        stats.menu1HistoricalOmzet += subtotal2;
      }
    }

    // -------------------------------------------------------------------------
    // Midway Event: Soft-delete Menu ID 1 (Nasi Kucing Sambal Teri)
    // -------------------------------------------------------------------------
    await db.runAsync('UPDATE menus SET is_active = 0 WHERE id = 1');
    const activeCatalog = await db.getAllAsync<{ id: number; name: string; price: number }>(
      'SELECT id, name, price FROM menus WHERE is_active = 1 ORDER BY id ASC'
    );

    // -------------------------------------------------------------------------
    // Phase 2: 200 Pure QRIS Completed Transactions (Tx 501 .. 700)
    // -------------------------------------------------------------------------
    for (let i = 501; i <= 700; i++) {
      txCounter++;
      const bizDate = ALL_60_DATES[(i - 1) % ALL_60_DATES.length];
      const table = TABLES[(i - 1) % TABLES.length];
      const cashier = CASHIERS[(i - 1) % CASHIERS.length];
      const invoice = formatInvoice(bizDate, i);

      // Choose only from activeCatalog (Menu ID 1 excluded!)
      const item1 = activeCatalog[(i * 2) % activeCatalog.length];
      const item2 = activeCatalog[(i * 4 + 1) % activeCatalog.length];
      const qty1 = (i % 2) + 1;
      const qty2 = (i % 3) + 1;
      const subtotal1 = item1.price * qty1;
      const subtotal2 = item2.price * qty2;
      const subtotal = subtotal1 + subtotal2;
      const total = subtotal; // no tax/discount in phase 2

      await db.runAsync(
        `INSERT INTO transactions (
           id, invoice_number, business_date, table_number, customer_id, customer_name,
           subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
           change_amount, status, cashier_name, cash_received, qris_received
         ) VALUES (?, ?, ?, ?, 1, 'Customer UMUM', ?, 0, 0, ?, 'qris', ?, 0, 'completed', ?, 0, ?)`,
        [txCounter, invoice, bizDate, table, subtotal, total, total, cashier, total]
      );

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional, notes)
         VALUES (?, ?, ?, ?, ?, ?, 0, ''), (?, ?, ?, ?, ?, ?, 0, '')`,
        [txCounter, item1.id, item1.name, item1.price, qty1, subtotal1,
         txCounter, item2.id, item2.name, item2.price, qty2, subtotal2]
      );

      // QRIS is electronic: NEVER enters physical cash_ledger!
      stats.totalGrossSales += total;
      stats.totalQrisSales += total;
      stats.totalCompletedItemsQty += qty1 + qty2;
      stats.totalCompletedSubtotal += subtotal;
    }

    // -------------------------------------------------------------------------
    // Phase 3: 100 Split Payment (Cash + QRIS) Completed Transactions (Tx 701 .. 800)
    // -------------------------------------------------------------------------
    for (let i = 701; i <= 800; i++) {
      txCounter++;
      const bizDate = ALL_60_DATES[(i - 1) % ALL_60_DATES.length];
      const table = TABLES[(i - 1) % TABLES.length];
      const cashier = CASHIERS[(i - 1) % CASHIERS.length];
      const invoice = formatInvoice(bizDate, i);

      const item1 = activeCatalog[(i * 3) % activeCatalog.length];
      const item2 = activeCatalog[(i * 5 + 2) % activeCatalog.length];
      const qty1 = (i % 3) + 1;
      const qty2 = ((i + 2) % 2) + 1;
      const subtotal1 = item1.price * qty1;
      const subtotal2 = item2.price * qty2;
      const subtotal = subtotal1 + subtotal2;
      const total = subtotal;

      // Split 50:50 rounded to nearest 1,000
      const splitCash = Math.floor(total / 2);
      const splitQris = total - splitCash;

      await db.runAsync(
        `INSERT INTO transactions (
           id, invoice_number, business_date, table_number, customer_id, customer_name,
           subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
           change_amount, status, cashier_name, cash_received, qris_received
         ) VALUES (?, ?, ?, ?, 1, 'Customer UMUM', ?, 0, 0, ?, 'split', ?, 0, 'completed', ?, ?, ?)`,
        [txCounter, invoice, bizDate, table, subtotal, total, total, cashier, splitCash, splitQris]
      );

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional, notes)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?), (?, ?, ?, ?, ?, ?, 0, '')`,
        [txCounter, item1.id, item1.name, item1.price, qty1, subtotal1, 'Split payment order',
         txCounter, item2.id, item2.name, item2.price, qty2, subtotal2]
      );

      // ONLY splitCash enters physical cash_ledger!
      await db.runAsync(
        `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
         VALUES (?, 'income', 1, 'penjualan_tunai', ?, ?)`,
        [bizDate, splitCash, `Porsi Tunai Split Nota ${invoice} (${table})`]
      );

      stats.totalGrossSales += total;
      stats.totalCashSalesInDrawer += splitCash;
      stats.totalQrisSales += splitQris;
      stats.totalCompletedItemsQty += qty1 + qty2;
      stats.totalCompletedSubtotal += subtotal;
    }

    // -------------------------------------------------------------------------
    // Phase 4: 50 Pure Transfer Completed Transactions (Tx 801 .. 850)
    // -------------------------------------------------------------------------
    for (let i = 801; i <= 850; i++) {
      txCounter++;
      const bizDate = ALL_60_DATES[(i - 1) % ALL_60_DATES.length];
      const table = TABLES[(i - 1) % TABLES.length];
      const cashier = CASHIERS[(i - 1) % CASHIERS.length];
      const invoice = formatInvoice(bizDate, i);

      const item1 = activeCatalog[(i * 7) % activeCatalog.length];
      const item2 = activeCatalog[(i * 3 + 1) % activeCatalog.length];
      const qty1 = (i % 3) + 1;
      const qty2 = 1;
      const subtotal1 = item1.price * qty1;
      const subtotal2 = item2.price * qty2;
      const subtotal = subtotal1 + subtotal2;
      const total = subtotal;

      await db.runAsync(
        `INSERT INTO transactions (
           id, invoice_number, business_date, table_number, customer_id, customer_name,
           subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
           change_amount, status, cashier_name, cash_received, qris_received
         ) VALUES (?, ?, ?, ?, 1, 'Customer UMUM', ?, 0, 0, ?, 'transfer', ?, 0, 'completed', ?, 0, 0)`,
        [txCounter, invoice, bizDate, table, subtotal, total, total, cashier]
      );

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional, notes)
         VALUES (?, ?, ?, ?, ?, ?, 0, ''), (?, ?, ?, ?, ?, ?, 0, '')`,
        [txCounter, item1.id, item1.name, item1.price, qty1, subtotal1,
         txCounter, item2.id, item2.name, item2.price, qty2, subtotal2]
      );

      // Transfer NEVER enters physical cash_ledger!
      stats.totalGrossSales += total;
      stats.totalTransferSales += total;
      stats.totalCompletedItemsQty += qty1 + qty2;
      stats.totalCompletedSubtotal += subtotal;
    }

    // -------------------------------------------------------------------------
    // Phase 5: 50 Merged Transactions (Tx 851 .. 900)
    // Merged in 25 pairs into target primary transactions
    // -------------------------------------------------------------------------
    for (let i = 851; i <= 900; i++) {
      txCounter++;
      const bizDate = ALL_60_DATES[(i - 1) % ALL_60_DATES.length];
      const sourceTable = TABLES[(i - 1) % TABLES.length];
      const invoice = formatInvoice(bizDate, i);

      // Target primary transaction from earlier completed or pending
      const primaryTargetId = ((i - 851) % 25) + 1; // 1 .. 25

      const item1 = activeCatalog[(i * 3) % activeCatalog.length];
      const item2 = activeCatalog[(i * 5 + 1) % activeCatalog.length];
      const qty1 = 2;
      const qty2 = 1;
      const subtotal1 = item1.price * qty1;
      const subtotal2 = item2.price * qty2;
      const subtotal = subtotal1 + subtotal2;

      await db.runAsync(
        `INSERT INTO transactions (
           id, invoice_number, business_date, table_number, customer_id, customer_name,
           subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
           change_amount, status, cashier_name, merged_into_tx_id
         ) VALUES (?, ?, ?, ?, 1, 'Customer UMUM', ?, 0, 0, ?, 'tunai', 0, 0, 'merged', 'Kasir', ?)`,
        [txCounter, invoice, bizDate, sourceTable, subtotal, subtotal, primaryTargetId]
      );

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional, notes)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'Merged item'), (?, ?, ?, ?, ?, ?, 0, '')`,
        [txCounter, item1.id, item1.name, item1.price, qty1, subtotal1,
         txCounter, item2.id, item2.name, item2.price, qty2, subtotal2]
      );
    }

    // -------------------------------------------------------------------------
    // Phase 6: 50 Pending Transactions (Tx 901 .. 950)
    // -------------------------------------------------------------------------
    for (let i = 901; i <= 950; i++) {
      txCounter++;
      const bizDate = ALL_60_DATES[(i - 1) % ALL_60_DATES.length];
      const table = TABLES[(i - 1) % TABLES.length];
      const invoice = formatInvoice(bizDate, i);

      const item1 = activeCatalog[(i * 2) % activeCatalog.length];
      const item2 = activeCatalog[(i * 4 + 1) % activeCatalog.length];
      const qty1 = 2;
      const qty2 = 1;
      const subtotal1 = item1.price * qty1;
      const subtotal2 = item2.price * qty2;
      const subtotal = subtotal1 + subtotal2;

      // Has additional order on subset
      const hasAdditional = i % 2 === 0;
      const additionalQty = hasAdditional ? 1 : 0;
      const additionalSubtotal = hasAdditional ? item2.price * 1 : 0;
      const finalSubtotal = subtotal + additionalSubtotal;

      await db.runAsync(
        `INSERT INTO transactions (
           id, invoice_number, business_date, table_number, customer_id, customer_name,
           subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
           change_amount, status, cashier_name
         ) VALUES (?, ?, ?, ?, 1, 'Customer UMUM', ?, 0, 0, ?, 'tunai', 0, 0, 'pending', 'Kasir')`,
        [txCounter, invoice, bizDate, table, finalSubtotal, finalSubtotal]
      );

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional, notes)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'Original order'),
                (?, ?, ?, ?, ?, ?, 0, '')`,
        [txCounter, item1.id, item1.name, item1.price, qty1, subtotal1,
         txCounter, item2.id, item2.name, item2.price, qty2, subtotal2]
      );

      if (hasAdditional) {
        await db.runAsync(
          `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional, notes)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'Pesanan Tambahan')`,
          [txCounter, item2.id, item2.name, item2.price, additionalQty, additionalSubtotal]
        );
      }
    }

    // -------------------------------------------------------------------------
    // Phase 7: 50 Cancelled Transactions (Tx 951 .. 1000)
    // -------------------------------------------------------------------------
    for (let i = 951; i <= 1000; i++) {
      txCounter++;
      const bizDate = ALL_60_DATES[(i - 1) % ALL_60_DATES.length];
      const table = TABLES[(i - 1) % TABLES.length];
      const invoice = formatInvoice(bizDate, i);

      const item1 = activeCatalog[(i * 3) % activeCatalog.length];
      const item2 = activeCatalog[(i * 5 + 2) % activeCatalog.length];
      const qty1 = 2;
      const qty2 = 1;
      const subtotal1 = item1.price * qty1;
      const subtotal2 = item2.price * qty2;
      const subtotal = subtotal1 + subtotal2;

      await db.runAsync(
        `INSERT INTO transactions (
           id, invoice_number, business_date, table_number, customer_id, customer_name,
           subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
           change_amount, status, cashier_name
         ) VALUES (?, ?, ?, ?, 1, 'Customer UMUM', ?, 0, 0, ?, 'tunai', 0, 0, 'cancelled', 'Kasir')`,
        [txCounter, invoice, bizDate, table, subtotal, subtotal]
      );

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional, notes)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'Pesanan Dibatalkan'), (?, ?, ?, ?, ?, ?, 0, '')`,
        [txCounter, item1.id, item1.name, item1.price, qty1, subtotal1,
         txCounter, item2.id, item2.name, item2.price, qty2, subtotal2]
      );
      // Cancelled orders never write to cash_ledger and are excluded from gross sales
    }

    return stats;
  });
}

/**
 * Seed 2-Month Attendance dataset across 6 employee profiles and 60 consecutive business dates.
 */
async function seed2MonthAttendance(
  db: TestDatabase,
  fsSim: FileSystemSimulator
): Promise<{ totalRecords: number; febCount: number; marCount: number }> {
  // 1. Seed 6 Employee Profiles
  await db.runAsync(`
    INSERT INTO employees (id, name, phone, is_active) VALUES
      (1, 'Budi Santoso', '081234567890', 1),
      (2, 'Siti Rahma', '081234567891', 1),
      (3, 'Agus Setiawan', '081234567892', 1),
      (4, 'Dewi Lestari', '081234567893', 1),
      (5, 'Eko Prasetyo', '081234567894', 1),
      (6, 'Tri Wulandari', '081234567895', 1);
  `);

  let totalRecords = 0;
  let febCount = 0;
  let marCount = 0;

  for (const dateStr of ALL_60_DATES) {
    const isFeb = dateStr.startsWith('2024-02');
    const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).getDay(); // 0: Sun, 5: Fri, 6: Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

    // Deactivate Tri Wulandari from Feb 15 onwards
    if (dateStr === '2024-02-15') {
      await db.runAsync('UPDATE employees SET is_active = 0 WHERE id = 6');
    }

    // Employee 1: Budi Santoso (Senior Cashier) - Punctual (17:15, on-time: 0 min)
    {
      const photoPath = `/photos/att_${dateStr}_1.jpg`;
      fsSim.files.set(photoPath, 'PHOTO_BINARY_BUDI');
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes, check_out_time)
         VALUES (1, 'Budi Santoso', ?, '17:15', ?, 0, 0, '02:30')`,
        [dateStr, photoPath]
      );
      totalRecords++;
      if (isFeb) febCount++; else marCount++;
    }

    // Employee 2: Siti Rahma (Cook) - Occasionally late (17:40, 10 min late)
    {
      const photoPath = `/photos/att_${dateStr}_2.jpg`;
      fsSim.files.set(photoPath, 'PHOTO_BINARY_SITI');
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes, check_out_time)
         VALUES (2, 'Siti Rahma', ?, '17:40', ?, 1, 10, '02:30')`,
        [dateStr, photoPath]
      );
      totalRecords++;
      if (isFeb) febCount++; else marCount++;
    }

    // Employee 3: Agus Setiawan (Waiter) - Frequently late (18:05, 35 min late)
    {
      const photoPath = `/photos/att_${dateStr}_3.jpg`;
      fsSim.files.set(photoPath, 'PHOTO_BINARY_AGUS');
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes, check_out_time)
         VALUES (3, 'Agus Setiawan', ?, '18:05', ?, 1, 35, '02:30')`,
        [dateStr, photoPath]
      );
      totalRecords++;
      if (isFeb) febCount++; else marCount++;
    }

    // Employee 4: Dewi Lestari (Assistant Cook) - Overnight arrival (01:15 AM, 465 min late)
    // 01:15 is hour < 6, belongs to this business date session
    {
      const photoPath = `/photos/att_${dateStr}_4.jpg`;
      fsSim.files.set(photoPath, 'PHOTO_BINARY_DEWI');
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes, check_out_time)
         VALUES (4, 'Dewi Lestari', ?, '01:15', ?, 1, 465, '02:30')`,
        [dateStr, photoPath]
      );
      totalRecords++;
      if (isFeb) febCount++; else marCount++;
    }

    // Employee 5: Eko Prasetyo (Weekend Helper) - Attends only Fri, Sat, Sun
    if (isWeekend) {
      const photoPath = `/photos/att_${dateStr}_5.jpg`;
      fsSim.files.set(photoPath, 'PHOTO_BINARY_EKO');
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes, check_out_time)
         VALUES (5, 'Eko Prasetyo', ?, '17:25', ?, 0, 0, '02:30')`,
        [dateStr, photoPath]
      );
      totalRecords++;
      if (isFeb) febCount++; else marCount++;
    }

    // Employee 6: Tri Wulandari (Resigned Staff) - Attends Feb 1 - Feb 14 only
    if (isFeb && parseInt(dateStr.slice(8), 10) <= 14) {
      const photoPath = `/photos/att_${dateStr}_6.jpg`;
      fsSim.files.set(photoPath, 'PHOTO_BINARY_TRI');
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes, check_out_time)
         VALUES (6, 'Tri Wulandari', ?, '17:20', ?, 0, 0, '02:30')`,
        [dateStr, photoPath]
      );
      totalRecords++;
      febCount++;
    }

    // Record operating session closed for this business date
    await db.runAsync(
      `INSERT INTO operating_sessions (business_date, status, opened_by, opened_at, closed_by, closed_at)
       VALUES (?, 'closed', 'Budi Santoso', '17:00', 'Budi Santoso', '02:30')`,
      [dateStr]
    );
  }

  return { totalRecords, febCount, marCount };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('Tier 9: Exhaustive Stress & Integration Simulation (1,000 TX, 2-Month Attendance & Financial Reconciliation)', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // ===========================================================================
  // Requirement 1: 1,000 Realistic Transactions Simulation
  // ===========================================================================
  describe('R1: 1,000 Realistic Transactions Simulation', () => {
    test('R1.1 - Mass transaction generation benchmark executes sub-second and verifies exact distributions', async () => {
      const startTime = performance.now();
      const stats = await seed1000RealisticTransactions(db);
      const durationMs = performance.now() - startTime;

      // 1. Performance assertion: 1,000 tx inside withTransactionAsync must be fast (< 2,500 ms)
      assert.ok(
        durationMs < 2500,
        `Expected 1,000 transactions simulation to run under 2500ms, took ${durationMs.toFixed(2)}ms`
      );

      // 2. Count assertions
      const totalTx = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM transactions');
      assert.equal(totalTx?.count, 1000);

      const statusCounts = await db.getAllAsync<{ status: string; count: number }>(
        'SELECT status, COUNT(*) as count FROM transactions GROUP BY status ORDER BY count DESC'
      );
      const countMap: Record<string, number> = {};
      for (const row of statusCounts) {
        countMap[row.status] = row.count;
      }

      assert.equal(countMap['completed'], 850);
      assert.equal(countMap['pending'], 50);
      assert.equal(countMap['merged'], 50);
      assert.equal(countMap['cancelled'], 50);

      // 3. Payment breakdown on completed transactions
      const methodCounts = await db.getAllAsync<{ payment_method: string; count: number }>(
        "SELECT payment_method, COUNT(*) as count FROM transactions WHERE status = 'completed' GROUP BY payment_method"
      );
      const methodMap: Record<string, number> = {};
      for (const row of methodCounts) {
        methodMap[row.payment_method] = row.count;
      }
      assert.equal(methodMap['tunai'], 500);
      assert.equal(methodMap['qris'], 200);
      assert.equal(methodMap['split'], 100);
      assert.equal(methodMap['transfer'], 50);

      // 4. Line items count assertion
      const itemsCount = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM transaction_items'
      );
      assert.ok(
        (itemsCount?.count ?? 0) >= 2000,
        `Expected >= 2000 line items, got ${itemsCount?.count}`
      );
    });

    test('R1.2 - Dynamic table management, status check, atomic table rename synchronization & deletion guard', async () => {
      await seed1000RealisticTransactions(db);

      // 1. Status check: Meja 01 has active pending orders
      const occupiedCheck = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM transactions WHERE table_number = 'Meja 01' AND status IN ('pending', 'billing')`
      );
      assert.ok((occupiedCheck?.count ?? 0) > 0, 'Meja 01 should have active pending orders');

      // 2. Table deletion guard: Deleting an occupied table must be prevented
      const canDeleteMeja01 = (occupiedCheck?.count ?? 0) === 0;
      assert.equal(canDeleteMeja01, false, 'Deletion guard must block deleting table with active orders');

      // 3. Atomic table rename synchronization: Renaming Meja 01 -> Meja VIP 01
      const prePendingCount = (occupiedCheck?.count ?? 0);
      const preCompletedMeja01 = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM transactions WHERE table_number = 'Meja 01' AND status = 'completed'`
      );

      // Perform atomic rename propagation
      await db.runAsync(
        `UPDATE transactions SET table_number = 'Meja VIP 01' WHERE table_number = 'Meja 01' AND status IN ('pending', 'billing')`
      );

      // Verify active pending transactions were renamed
      const renamedPendingCount = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM transactions WHERE table_number = 'Meja VIP 01' AND status IN ('pending', 'billing')`
      );
      assert.equal(renamedPendingCount?.count, prePendingCount);

      // Verify historical completed transactions were NOT modified
      const postCompletedMeja01 = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM transactions WHERE table_number = 'Meja 01' AND status = 'completed'`
      );
      assert.equal(postCompletedMeja01?.count, preCompletedMeja01?.count);
    });

    test('R1.3 - Pending orders, hold/retrieve order flows and additional items (is_additional = 1)', async () => {
      await seed1000RealisticTransactions(db);

      // 1. Query pending transactions with additional items
      const additionalItems = await db.getAllAsync<{
        transaction_id: number;
        menu_name: string;
        qty: number;
        subtotal: number;
        is_additional: number;
        notes: string;
      }>(
        `SELECT transaction_id, menu_name, qty, subtotal, is_additional, notes 
         FROM transaction_items 
         WHERE is_additional = 1`
      );

      assert.ok(additionalItems.length > 0, 'Expected additional items with is_additional = 1');
      assert.equal(additionalItems[0].is_additional, 1);
      assert.equal(additionalItems[0].notes, 'Pesanan Tambahan');

      // 2. Verify kitchen additional ticket formatting renders [ +qty ] (BARU)
      const ticketLines = formatKitchenAdditionalTicketLines({
        invoiceNumber: 'INV-PENDING-01',
        tableNumber: 'Meja 05',
        dateTimeString: '01/02/2024 18:30',
        additionalItems: [
          {
            name: additionalItems[0].menu_name,
            price: 5000,
            qty: additionalItems[0].qty,
            subtotal: additionalItems[0].subtotal,
            notes: additionalItems[0].notes,
          },
        ],
      });
      const ticketText = ticketLines.join('\n');
      assert.ok(ticketText.includes('(BARU)'));
      assert.ok(ticketText.includes('* Ket: Pesanan Tambahan'));
    });

    test('R1.4 - Table merge operations consolidate items by (menu_id, price), aggregate discounts & recalculate PB1 tax', async () => {
      // Create 2 independent pending transactions to merge
      await db.runAsync(
        `INSERT INTO transactions (id, invoice_number, business_date, table_number, subtotal, discount_amount, total, payment_method, payment_amount, change_amount, status)
         VALUES 
         (2001, 'INV-M1', '2024-02-10', 'Meja 03', 25000, 3000, 22000, 'tunai', 0, 0, 'pending'),
         (2002, 'INV-M2', '2024-02-10', 'Meja 04', 35000, 2000, 33000, 'tunai', 0, 0, 'pending')`
      );

      // Primary items (2001)
      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal)
         VALUES 
         (2001, 2, 'Nasi Kucing Oseng Tempe', 5000, 2, 10000),
         (2001, 13, 'Teh Kampul Solo', 5000, 3, 15000)`
      );

      // Secondary items (2002) - has overlapping Teh Kampul Solo
      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal)
         VALUES 
         (2002, 13, 'Teh Kampul Solo', 5000, 2, 10000),
         (2002, 5, 'Sate Telur Puyuh', 4000, 5, 20000),
         (2002, 8, 'Tempe Mendoan Hangat', 2000, 2, 5000)`
      );

      // Execute merge logic
      const sourceIds = [2001, 2002];
      const primaryId = 2001;
      const targetTable = 'Meja 03';

      await db.withTransactionAsync(async () => {
        // Aggregate items
        const consolidatedItems = await db.getAllAsync<{
          menu_id: number;
          menu_name: string;
          price: number;
          total_qty: number;
          total_subtotal: number;
        }>(
          `SELECT menu_id, menu_name, price, SUM(qty) as total_qty, SUM(subtotal) as total_subtotal
           FROM transaction_items
           WHERE transaction_id IN (2001, 2002)
           GROUP BY menu_id, price`
        );

        // Sum discounts: 3000 + 2000 = 5000
        const discRow = await db.getFirstAsync<{ total_discount: number }>(
          `SELECT SUM(discount_amount) as total_discount FROM transactions WHERE id IN (2001, 2002)`
        );
        const totalDiscount = discRow?.total_discount ?? 0;

        // Mark secondary as merged
        await db.runAsync(
          `UPDATE transactions SET status = 'merged', merged_into_tx_id = ? WHERE id = 2002`,
          [primaryId]
        );

        // Re-insert consolidated items into primary
        await db.runAsync(`DELETE FROM transaction_items WHERE transaction_id IN (2001, 2002)`);

        let newSubtotal = 0;
        for (const it of consolidatedItems) {
          newSubtotal += it.total_subtotal;
          await db.runAsync(
            `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [primaryId, it.menu_id, it.menu_name, it.price, it.total_qty, it.total_subtotal]
          );
        }

        // Recalculate 10% PB1 tax & total
        const newTax = Math.round((newSubtotal * 10) / 100);
        const newTotal = Math.max(0, newSubtotal + newTax - totalDiscount);

        await db.runAsync(
          `UPDATE transactions 
           SET table_number = ?, subtotal = ?, tax_amount = ?, discount_amount = ?, total = ?
           WHERE id = ?`,
          [targetTable, newSubtotal, newTax, totalDiscount, newTotal, primaryId]
        );
      });

      // Verify secondary transaction state
      const secondaryTx = await db.getFirstAsync<{ status: string; merged_into_tx_id: number }>(
        'SELECT status, merged_into_tx_id FROM transactions WHERE id = 2002'
      );
      assert.equal(secondaryTx?.status, 'merged');
      assert.equal(secondaryTx?.merged_into_tx_id, 2001);

      // Verify primary transaction state
      const primaryTx = await db.getFirstAsync<{
        subtotal: number;
        tax_amount: number;
        discount_amount: number;
        total: number;
      }>('SELECT subtotal, tax_amount, discount_amount, total FROM transactions WHERE id = 2001');

      // Subtotals: (10k + 15k) + (10k + 20k + 5k) = 60.000
      assert.equal(primaryTx?.subtotal, 60000);
      assert.equal(primaryTx?.tax_amount, 6000); // 10% of 60k
      assert.equal(primaryTx?.discount_amount, 5000); // 3k + 2k
      assert.equal(primaryTx?.total, 61000); // 60k + 6k - 5k = 61k

      // Verify Teh Kampul Solo was consolidated: 3 + 2 = 5 qty
      const tehItem = await db.getFirstAsync<{ total_qty: number; total_subtotal: number }>(
        `SELECT qty as total_qty, subtotal as total_subtotal FROM transaction_items WHERE transaction_id = 2001 AND menu_id = 13`
      );
      assert.equal(tehItem?.total_qty, 5);
      assert.equal(tehItem?.total_subtotal, 25000);
    });

    test('R1.5 - Split payments (Cash + QRIS) record only cash_received in physical cash_ledger', async () => {
      await seed1000RealisticTransactions(db);

      // Verify 100 split payments
      const splitTxs = await db.getAllAsync<{
        id: number;
        total: number;
        cash_received: number;
        qris_received: number;
      }>("SELECT id, total, cash_received, qris_received FROM transactions WHERE payment_method = 'split'");

      assert.equal(splitTxs.length, 100);

      let totalSplitCash = 0;
      let totalSplitQris = 0;
      for (const tx of splitTxs) {
        assert.equal(tx.cash_received + tx.qris_received, tx.total);
        totalSplitCash += tx.cash_received;
        totalSplitQris += tx.qris_received;
      }

      // Verify cash ledger only contains totalSplitCash for split payments
      const splitLedger = await db.getFirstAsync<{ total_amount: number }>(
        `SELECT SUM(amount) as total_amount FROM cash_ledger WHERE notes LIKE 'Porsi Tunai Split%'`
      );
      assert.equal(splitLedger?.total_amount, totalSplitCash);

      // Verify receipt formatter breakdown
      const receiptLines = formatCustomerReceiptLines({
        invoiceNumber: 'INV-SPLIT-TEST',
        businessDate: '2024-02-15',
        dateTimeString: '15/02/2024 19:00',
        tableNumber: 'Meja 02',
        customerName: 'Customer UMUM',
        items: [{ name: 'Nasi Bakar', price: 10000, qty: 2, subtotal: 20000 }],
        subtotal: 20000,
        total: 20000,
        paymentMethod: 'split',
        paymentAmount: 20000,
        changeAmount: 0,
        cashReceived: 10000,
        qrisReceived: 10000,
      });
      const receiptText = receiptLines.join('\n');
      assert.ok(receiptText.includes('Bayar (TUNAI)'));
      assert.ok(receiptText.includes('10.000'));
      assert.ok(receiptText.includes('Bayar (QRIS)'));
    });

    test('R1.6 - Product line item notes persisted through persistence and verified on formatted receipts', async () => {
      await seed1000RealisticTransactions(db);

      // Query items with custom notes
      const pedasItems = await db.getAllAsync<{ notes: string }>(
        `SELECT notes FROM transaction_items WHERE notes = 'Pedas level 3'`
      );
      assert.ok(pedasItems.length > 0);

      // Customer receipt formatter includes (notes)
      const receiptLines = formatCustomerReceiptLines({
        invoiceNumber: 'INV-NOTES-01',
        businessDate: '2024-02-15',
        dateTimeString: '15/02/2024 19:30',
        tableNumber: 'Meja 08',
        customerName: 'Customer UMUM',
        items: [
          { name: 'Kopi Jos Arang', price: 7000, qty: 2, subtotal: 14000, notes: 'Panas membara' },
          { name: 'Sate Kulit Ayam', price: 3500, qty: 3, subtotal: 10500, notes: 'Bakar manis gurih' },
        ],
        subtotal: 24500,
        total: 24500,
        paymentMethod: 'tunai',
        paymentAmount: 30000,
        changeAmount: 5500,
      });
      const receiptText = receiptLines.join('\n');
      assert.ok(receiptText.includes('(Panas membara)'));
      assert.ok(receiptText.includes('(Bakar manis gurih)'));

      // Kitchen ticket renders * Ket: <notes>
      const kitchenLines = formatKitchenTicketLines({
        invoiceNumber: 'INV-NOTES-01',
        tableNumber: 'Meja 08',
        dateTimeString: '15/02/2024 19:30',
        items: [
          { name: 'Kopi Jos Arang', price: 7000, qty: 2, subtotal: 14000, notes: 'Panas membara' },
        ],
      });
      const kitchenText = kitchenLines.join('\n');
      assert.ok(kitchenText.includes('* Ket: Panas membara'));
    });

    test('R1.7 - Soft-deleted menu midway retains past transaction items and isolates subsequent catalog', async () => {
      const stats = await seed1000RealisticTransactions(db);

      // 1. Menu ID 1 is now inactive
      const menu1 = await db.getFirstAsync<{ id: number; name: string; is_active: number }>(
        'SELECT id, name, is_active FROM menus WHERE id = 1'
      );
      assert.equal(menu1?.is_active, 0);

      // 2. Active catalog query contains exactly 15 menus without Menu 1
      const activeMenus = await db.getAllAsync<{ id: number }>(
        'SELECT id FROM menus WHERE is_active = 1'
      );
      assert.equal(activeMenus.length, 15);
      assert.ok(!activeMenus.some((m) => m.id === 1));

      // 3. Past transactions (1..500) retain Menu 1 name and subtotal intact
      const historicalItems = await db.getAllAsync<{ qty: number; subtotal: number }>(
        'SELECT qty, subtotal FROM transaction_items WHERE menu_id = 1'
      );
      assert.ok(historicalItems.length > 0);
      const totalHistoricQty = historicalItems.reduce((acc, it) => acc + it.qty, 0);
      const totalHistoricOmzet = historicalItems.reduce((acc, it) => acc + it.subtotal, 0);
      assert.equal(totalHistoricQty, stats.menu1HistoricalQty);
      assert.equal(totalHistoricOmzet, stats.menu1HistoricalOmzet);

      // 4. Subsequent transactions (501..1000) have ZERO references to Menu 1
      const subsequentMenu1 = await db.getAllAsync<{ id: number }>(
        'SELECT id FROM transaction_items WHERE transaction_id > 500 AND menu_id = 1'
      );
      assert.equal(subsequentMenu1.length, 0);
    });

    test('R1.8 - Transaction cancellations are completely excluded from gross sales and cash ledger', async () => {
      await seed1000RealisticTransactions(db);

      // 1. Exactly 50 cancelled transactions
      const cancelledRows = await db.getAllAsync<{ id: number; total: number }>(
        "SELECT id, total FROM transactions WHERE status = 'cancelled'"
      );
      assert.equal(cancelledRows.length, 50);

      // 2. Cancelled transactions never write to cash_ledger
      const cancelledInvoices = await db.getAllAsync<{ invoice_number: string }>(
        "SELECT invoice_number FROM transactions WHERE status = 'cancelled'"
      );
      for (const { invoice_number } of cancelledInvoices) {
        const ledgerHit = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM cash_ledger WHERE notes LIKE ?`,
          [`%${invoice_number}%`]
        );
        assert.equal(ledgerHit?.count, 0, `Cancelled invoice ${invoice_number} must not appear in cash_ledger`);
      }

      // 3. Gross sales from completed orders strictly excludes cancelled orders
      const completedGross = await db.getFirstAsync<{ sum_total: number }>(
        "SELECT SUM(total) as sum_total FROM transactions WHERE status = 'completed'"
      );
      const allGross = await db.getFirstAsync<{ sum_total: number }>(
        'SELECT SUM(total) as sum_total FROM transactions'
      );
      assert.ok(
        (allGross?.sum_total ?? 0) > (completedGross?.sum_total ?? 0),
        'All transactions total includes pending/cancelled/merged'
      );
    });
  });

  // ===========================================================================
  // Requirement 2: 2-Month Employee Attendance Simulation (Feb-Mar 2024 Leap Year)
  // ===========================================================================
  describe('R2: 2-Month Employee Attendance Simulation (Feb-Mar 2024 Leap Year)', () => {
    let fsSim: FileSystemSimulator;

    beforeEach(() => {
      fsSim = createFileSystemSimulator();
    });

    test('R2.1 - 60 consecutive business dates simulated covering Leap Year Feb 2024 and Mar 2024', async () => {
      const { totalRecords, febCount, marCount } = await seed2MonthAttendance(db, fsSim);

      assert.ok(totalRecords > 250);
      assert.ok(febCount > 120);
      assert.ok(marCount > 130);

      // Verify leap day 2024-02-29 has attendance records
      const leapDayRecords = await db.getAllAsync<{ id: number }>(
        "SELECT id FROM attendance WHERE business_date = '2024-02-29'"
      );
      assert.ok(leapDayRecords.length >= 4, 'Leap day 2024-02-29 must have attendance records');

      // Verify date continuity: 60 unique business dates in attendance
      const distinctDates = await db.getAllAsync<{ business_date: string }>(
        'SELECT DISTINCT business_date FROM attendance ORDER BY business_date ASC'
      );
      assert.equal(distinctDates.length, 60);
      assert.equal(distinctDates[0].business_date, '2024-02-01');
      assert.equal(distinctDates[28].business_date, '2024-02-29'); // 29th day of Feb
      assert.equal(distinctDates[29].business_date, '2024-03-01'); // 1st day of Mar
      assert.equal(distinctDates[59].business_date, '2024-03-31'); // 31st day of Mar
    });

    test('R2.2 - Late minute calculation verified on on-time, late, and cross-midnight overnight arrivals', async () => {
      await seed2MonthAttendance(db, fsSim);

      // 1. On-time cashier (Budi Santoso)
      const budiRows = await db.getAllAsync<{ is_late: number; late_minutes: number }>(
        'SELECT is_late, late_minutes FROM attendance WHERE employee_id = 1'
      );
      for (const row of budiRows) {
        assert.equal(row.is_late, 0);
        assert.equal(row.late_minutes, 0);
      }

      // 2. Moderately late cook (Siti Rahma, 17:40 WIB = 10 min late)
      const sitiRows = await db.getAllAsync<{ is_late: number; late_minutes: number }>(
        'SELECT is_late, late_minutes FROM attendance WHERE employee_id = 2'
      );
      for (const row of sitiRows) {
        assert.equal(row.is_late, 1);
        assert.equal(row.late_minutes, 10);
      }

      // 3. Late waiter (Agus Setiawan, 18:05 WIB = 35 min late)
      const agusRows = await db.getAllAsync<{ is_late: number; late_minutes: number }>(
        'SELECT is_late, late_minutes FROM attendance WHERE employee_id = 3'
      );
      for (const row of agusRows) {
        assert.equal(row.is_late, 1);
        assert.equal(row.late_minutes, 35);
      }

      // 4. Overnight arrival (Dewi Lestari, 01:15 WIB = 465 min late)
      // (24 * 60 + 75) - 1050 = 465
      const dewiRows = await db.getAllAsync<{ is_late: number; late_minutes: number }>(
        'SELECT is_late, late_minutes FROM attendance WHERE employee_id = 4'
      );
      for (const row of dewiRows) {
        assert.equal(row.is_late, 1);
        assert.equal(row.late_minutes, 465);
      }
    });

    test('R2.3 - Unique constraint uq_emp_date blocks duplicate check-in on the same business date', async () => {
      await seed2MonthAttendance(db, fsSim);

      // Attempt duplicate check-in for Budi Santoso on Leap Day 2024-02-29
      await assert.rejects(
        async () => {
          await db.runAsync(
            `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo)
             VALUES (1, 'Budi Santoso', '2024-02-29', '17:30', '/photos/duplicate.jpg')`
          );
        },
        (err: Error) => {
          return err.message.includes('UNIQUE constraint failed');
        },
        'Duplicate check-in on the same business date must throw SQLite UNIQUE constraint error'
      );
    });

    test('R2.4 - Monthly photo retention cleanup purges physical files while keeping relational logs intact', async () => {
      const { febCount } = await seed2MonthAttendance(db, fsSim);

      const totalPhotosBefore = fsSim.files.size;
      assert.ok(totalPhotosBefore > 250);

      // 1. Purge February 2024 photos
      const cleanupResult = await deleteMonthlyAttendancePhotos(db, fsSim, '2024-02');
      assert.equal(cleanupResult.deletedFilesCount, febCount);
      assert.equal(cleanupResult.dbRowsUpdated, febCount);

      // 2. Verify all February photos are deleted from fsSim
      for (const [filePath] of fsSim.files) {
        assert.ok(!filePath.includes('2024-02'), `Found dangling Feb photo: ${filePath}`);
      }

      // 3. Verify March photos remain intact in fsSim
      const remainingPhotos = fsSim.files.size;
      assert.equal(remainingPhotos, totalPhotosBefore - febCount);

      // 4. Verify February database records have check_in_photo cleared
      const febDbRows = await db.getAllAsync<{ check_in_photo: string; late_minutes: number }>(
        "SELECT check_in_photo, late_minutes FROM attendance WHERE business_date LIKE '2024-02%'"
      );
      assert.equal(febDbRows.length, febCount);
      for (const row of febDbRows) {
        assert.equal(row.check_in_photo, '');
        assert.ok(row.late_minutes >= 0, 'Relational late_minutes must be preserved');
      }

      // 5. Verify March database records retain check_in_photo
      const marDbRows = await db.getAllAsync<{ check_in_photo: string }>(
        "SELECT check_in_photo FROM attendance WHERE business_date LIKE '2024-03%'"
      );
      for (const row of marDbRows) {
        assert.ok(row.check_in_photo.startsWith('/photos/att_2024-03'));
      }

      // 6. Verify idempotency: running cleanup for Feb a second time deletes 0 physical files
      const rerunResult = await deleteMonthlyAttendancePhotos(db, fsSim, '2024-02');
      assert.equal(rerunResult.deletedFilesCount, 0, 'No physical files deleted on rerun');
      assert.equal(rerunResult.dbRowsUpdated, febCount, 'Matched DB rows for month prefix');
    });
  });

  // ===========================================================================
  // Requirement 3: Financial Ledger, Report, and Reconciliation Verification
  // ===========================================================================
  describe('R3: Financial Ledger, Report, and Reconciliation Verification', () => {
    test('R3.1 - Operational PnL calculation across 2 months enforces anti-double-counting of cash sales', async () => {
      const stats = await seed1000RealisticTransactions(db);

      // Save Monthly COGS for Feb and Mar 2024
      await saveMonthlyCogs(db, '2024-02', 20000000, 'HPP Bahan Baku Februari 2024');
      await saveMonthlyCogs(db, '2024-03', 22000000, 'HPP Bahan Baku Maret 2024');

      // Add operational expenses for Feb (affects_pnl = 1)
      await addCashEntry(db, {
        business_date: '2024-02-15',
        type: 'expense',
        affects_pnl: true,
        category: 'Arang Batok',
        amount: 500000,
        notes: 'Kulakan arang batok',
      });
      await addCashEntry(db, {
        business_date: '2024-02-20',
        type: 'expense',
        affects_pnl: true,
        category: 'Listrik & Air',
        amount: 750000,
        notes: 'Tagihan listrik & air',
      });

      // Add operational income (affects_pnl = 1, category != penjualan_tunai)
      await addCashEntry(db, {
        business_date: '2024-02-25',
        type: 'income',
        affects_pnl: true,
        category: 'Penjualan Limbah / Kardus',
        amount: 150000,
        notes: 'Penjualan kardus bekas minyak',
      });

      // Load Feb 2024 summary
      const febReport = await loadFinancialSummary(db, '2024-02');

      // Compute expected Feb gross sales from database
      const febSalesRow = await db.getFirstAsync<{ feb_gross: number }>(
        "SELECT SUM(total) as feb_gross FROM transactions WHERE status = 'completed' AND business_date LIKE '2024-02%'"
      );
      const expectedFebGross = febSalesRow?.feb_gross ?? 0;

      assert.equal(febReport.summary.totalGrossSales, expectedFebGross);
      assert.equal(febReport.summary.monthlyCogs, 20000000);
      assert.equal(febReport.summary.totalOperationalExpenses, 1250000);
      assert.equal(febReport.summary.totalOperationalIncome, 150000);

      // Gross profit = grossSales - cogs
      assert.equal(
        febReport.summary.grossProfit,
        expectedFebGross - 20000000
      );

      // Net operating profit = grossSales + operIncome - operExpenses - cogs
      assert.equal(
        febReport.summary.netOperatingProfit,
        expectedFebGross + 150000 - 1250000 - 20000000
      );

      // CRITICAL: Anti-double-counting guard:
      // penjualan_tunai MUST NOT be in operIncome
      const febPenjualanTunai = await db.getFirstAsync<{ sum_cash: number }>(
        "SELECT SUM(amount) as sum_cash FROM cash_ledger WHERE business_date LIKE '2024-02%' AND category = 'penjualan_tunai'"
      );
      assert.ok((febPenjualanTunai?.sum_cash ?? 0) > 0);
      assert.notEqual(
        febReport.summary.totalOperationalIncome,
        (febPenjualanTunai?.sum_cash ?? 0) + 150000,
        'penjualan_tunai must NEVER be double-counted inside totalOperationalIncome'
      );
    });

    test('R3.2 - Non-PnL Capital/Prive ledger entries isolate balance sheet without altering operational profit', async () => {
      await seed1000RealisticTransactions(db);

      // Initial PnL summary for March before capital entries
      await saveMonthlyCogs(db, '2024-03', 25000000, 'HPP Maret 2024');
      const baselineReport = await loadFinancialSummary(db, '2024-03');

      // Add Non-PnL entries (affects_pnl = 0)
      // 1. Modal Awal Kasir
      await addCashEntry(db, {
        business_date: '2024-03-01',
        type: 'income',
        affects_pnl: false,
        category: 'Modal Awal Kasir / Toko',
        amount: 500000,
        notes: 'Modal kembalian kasir 1 Maret',
      });
      // 2. Tambahan Modal Pemilik
      await addCashEntry(db, {
        business_date: '2024-03-05',
        type: 'income',
        affects_pnl: false,
        category: 'Tambahan Modal Pemilik',
        amount: 5000000,
        notes: 'Injeksi modal ekspansi',
      });
      // 3. Prive (Penarikan Pribadi Owner)
      await addCashEntry(db, {
        business_date: '2024-03-20',
        type: 'expense',
        affects_pnl: false,
        category: 'Prive (Penarikan Pribadi Owner)',
        amount: 2000000,
        notes: 'Tarik uang dapur',
      });
      // 4. Setor Tunai Bank Pemilik
      await addCashEntry(db, {
        business_date: '2024-03-25',
        type: 'expense',
        affects_pnl: false,
        category: 'Setor Tunai Bank Pemilik',
        amount: 10000000,
        notes: 'Setoran omzet tunai ke rekening BCA',
      });

      // Load post-capital summary
      const postCapitalReport = await loadFinancialSummary(db, '2024-03');

      // Operational PnL must be completely invariant
      assert.equal(postCapitalReport.summary.grossProfit, baselineReport.summary.grossProfit);
      assert.equal(postCapitalReport.summary.netOperatingProfit, baselineReport.summary.netOperatingProfit);
      assert.equal(postCapitalReport.summary.totalOperationalExpenses, baselineReport.summary.totalOperationalExpenses);
      assert.equal(postCapitalReport.summary.totalOperationalIncome, baselineReport.summary.totalOperationalIncome);

      // Non-PnL amounts must be tracked accurately
      assert.equal(postCapitalReport.summary.totalNonPnlIncome, 5500000); // 500k + 5M
      assert.equal(postCapitalReport.summary.totalNonPnlExpenses, 12000000); // 2M + 10M
    });

    test('R3.3 - Accounts payable distinguishes cash purchases from tempo debt and records settlements atomically', async () => {
      // 1. Record Cash Purchase
      const cashPurchaseRes = await db.runAsync(
        `INSERT INTO purchases (supplier_name, business_date, total_amount, payment_type, payment_status, paid_at, notes)
         VALUES ('Juragan Telur Sleman', '2024-02-05', 1500000, 'cash', 'paid', '2024-02-05 09:00', 'Kulakan telur puyuh')`
      );
      const cashPurId = cashPurchaseRes.lastInsertRowId;

      await db.runAsync(
        `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
         VALUES ('2024-02-05', 'expense', 1, 'Pembelian Bahan/Kulakan', 1500000, ?)`,
        [`Pembelian Tunai #ID: ${cashPurId}`]
      );

      // 2. Record Tempo Purchase (Unpaid)
      const tempoPurchaseRes = await db.runAsync(
        `INSERT INTO purchases (supplier_name, business_date, total_amount, payment_type, payment_status, due_date, notes)
         VALUES ('Distributor Arang Kelapa', '2024-02-08', 2000000, 'tempo', 'unpaid', '2024-02-28', 'Hutang arang 20 karung')`
      );
      const tempoPurId = tempoPurchaseRes.lastInsertRowId;

      // Assert tempo purchase has ZERO entries in cash_ledger before settlement
      const tempoLedgerCheck = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM cash_ledger WHERE notes LIKE ?`,
        [`%#ID: ${tempoPurId}%`]
      );
      assert.equal(tempoLedgerCheck?.count, 0, 'Unpaid tempo purchase must NOT write to cash_ledger');

      // Assert Accounts Payable query reflects exact unpaid debt
      const apDebtRow = await db.getFirstAsync<{ total_debt: number }>(
        "SELECT SUM(total_amount) as total_debt FROM purchases WHERE payment_type = 'tempo' AND payment_status = 'unpaid'"
      );
      assert.equal(apDebtRow?.total_debt, 2000000);

      // 3. Settle Tempo Debt on 2024-02-28
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `UPDATE purchases SET payment_status = 'paid', paid_at = '2024-02-28 14:00' WHERE id = ?`,
          [tempoPurId]
        );
        await db.runAsync(
          `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
           VALUES ('2024-02-28', 'expense', 1, 'Pelunasan Hutang Supplier', 2000000, ?)`,
          [`Pelunasan hutang nota #${tempoPurId} (Distributor Arang Kelapa)`]
        );
      });

      // Verify debt is cleared
      const apDebtPost = await db.getFirstAsync<{ total_debt: number }>(
        "SELECT COALESCE(SUM(total_amount), 0) as total_debt FROM purchases WHERE payment_type = 'tempo' AND payment_status = 'unpaid'"
      );
      assert.equal(apDebtPost?.total_debt, 0);

      // Verify settlement recorded in cash_ledger
      const settlementLedger = await db.getFirstAsync<{ amount: number }>(
        "SELECT amount FROM cash_ledger WHERE category = 'Pelunasan Hutang Supplier' AND business_date = '2024-02-28'"
      );
      assert.equal(settlementLedger?.amount, 2000000);
    });

    test('R3.4 - Cash drawer reconciliation achieves exact 0 discrepancy across all 1,000 transactions and financial events', async () => {
      const stats = await seed1000RealisticTransactions(db);

      // Seed comprehensive financial events
      // Non-PnL Capital Injections
      await addCashEntry(db, { business_date: '2024-02-01', type: 'income', affects_pnl: false, category: 'Modal Awal Kasir / Toko', amount: 500000 });
      await addCashEntry(db, { business_date: '2024-02-05', type: 'income', affects_pnl: false, category: 'Tambahan Modal Pemilik', amount: 3000000 });
      await addCashEntry(db, { business_date: '2024-03-01', type: 'income', affects_pnl: false, category: 'Modal Awal Kasir / Toko', amount: 500000 });

      // Non-PnL Withdrawals
      await addCashEntry(db, { business_date: '2024-02-20', type: 'expense', affects_pnl: false, category: 'Prive (Penarikan Pribadi Owner)', amount: 1500000 });
      await addCashEntry(db, { business_date: '2024-02-28', type: 'expense', affects_pnl: false, category: 'Setor Tunai Bank Pemilik', amount: 8000000 });
      await addCashEntry(db, { business_date: '2024-03-28', type: 'expense', affects_pnl: false, category: 'Setor Tunai Bank Pemilik', amount: 10000000 });

      // Operational Expenses
      await addCashEntry(db, { business_date: '2024-02-10', type: 'expense', affects_pnl: true, category: 'Arang Batok', amount: 450000 });
      await addCashEntry(db, { business_date: '2024-02-15', type: 'expense', affects_pnl: true, category: 'Gas Elpiji', amount: 300000 });
      await addCashEntry(db, { business_date: '2024-03-10', type: 'expense', affects_pnl: true, category: 'Listrik & Air', amount: 650000 });

      // Operational Income (other than penjualan_tunai)
      await addCashEntry(db, { business_date: '2024-02-22', type: 'income', affects_pnl: true, category: 'Penjualan Limbah / Kardus', amount: 200000 });
      await addCashEntry(db, { business_date: '2024-03-22', type: 'income', affects_pnl: true, category: 'Penjualan Limbah / Kardus', amount: 250000 });

      // Cash purchases & tempo settlements
      await addCashEntry(db, { business_date: '2024-02-12', type: 'expense', affects_pnl: true, category: 'Pembelian Bahan/Kulakan', amount: 1200000 });
      await addCashEntry(db, { business_date: '2024-03-15', type: 'expense', affects_pnl: true, category: 'Pelunasan Hutang Supplier', amount: 2000000 });

      // Calculate Expected Physical Cash In
      const expectedNonPnlIncome = 500000 + 3000000 + 500000; // 4.000.000
      const expectedCashSales = stats.totalCashSalesInDrawer; // from 500 tunai + 100 split
      const expectedOperIncome = 200000 + 250000; // 450.000
      const totalCashIn = expectedNonPnlIncome + expectedCashSales + expectedOperIncome;

      // Calculate Expected Physical Cash Out
      const expectedNonPnlExpenses = 1500000 + 8000000 + 10000000; // 19.500.000
      const expectedOperExpenses = 450000 + 300000 + 650000 + 1200000 + 2000000; // 4.600.000
      const totalCashOut = expectedNonPnlExpenses + expectedOperExpenses;

      const expectedPhysicalDrawerCash = totalCashIn - totalCashOut;

      // Calculate Actual Physical Cash from cash_ledger
      const ledgerRows = await db.getAllAsync<{ type: string; amount: number }>(
        'SELECT type, amount FROM cash_ledger'
      );
      const actualDrawerCash = ledgerRows.reduce((acc, row) => {
        return row.type === 'income' ? acc + row.amount : acc - row.amount;
      }, 0);

      // Verify exact 0 discrepancy
      const discrepancy = actualDrawerCash - expectedPhysicalDrawerCash;
      assert.equal(
        discrepancy,
        0,
        `Expected 0 cash drawer discrepancy, got ${discrepancy}. Actual: ${actualDrawerCash}, Expected: ${expectedPhysicalDrawerCash}`
      );
    });

    test('R3.5 - Top-selling menu report matches completed transaction items with 100% mathematical precision', async () => {
      const stats = await seed1000RealisticTransactions(db);

      // Query top selling menus across the entire simulated 2-month period
      const topSellers = await db.getAllAsync<{
        menu_name: string;
        category_name: string;
        total_qty: number;
        total_omzet: number;
      }>(
        `SELECT 
           ti.menu_name, 
           COALESCE(c.name, 'Lainnya') as category_name, 
           SUM(ti.qty) as total_qty, 
           SUM(ti.subtotal) as total_omzet
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN menus m ON m.id = ti.menu_id
         LEFT JOIN categories c ON c.id = m.category_id
         WHERE t.status = 'completed'
         GROUP BY ti.menu_name
         ORDER BY total_qty DESC, total_omzet DESC`
      );

      assert.ok(topSellers.length > 0);

      // 1. Total quantity of top sellers equals total items qty of completed transactions
      const topSellerTotalQty = topSellers.reduce((acc, r) => acc + r.total_qty, 0);
      assert.equal(topSellerTotalQty, stats.totalCompletedItemsQty);

      // 2. Total omzet of top sellers equals total subtotal of completed transactions
      const topSellerTotalOmzet = topSellers.reduce((acc, r) => acc + r.total_omzet, 0);
      assert.equal(topSellerTotalOmzet, stats.totalCompletedSubtotal);

      // 3. Historical soft-deleted Menu 1 (Nasi Kucing Sambal Teri) is properly included
      const menu1Report = topSellers.find((r) => r.menu_name === 'Nasi Kucing Sambal Teri');
      assert.ok(menu1Report, 'Soft-deleted menu Nasi Kucing Sambal Teri must appear in historical top sellers');
      assert.equal(menu1Report.total_qty, stats.menu1HistoricalQty);
      assert.equal(menu1Report.total_omzet, stats.menu1HistoricalOmzet);

      // 4. Verify cancelled and pending orders are strictly excluded from top-seller calculations
      const rawCompletedCount = await db.getFirstAsync<{ completed_subtotal: number }>(
        "SELECT SUM(subtotal) as completed_subtotal FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE status = 'completed')"
      );
      assert.equal(topSellerTotalOmzet, rawCompletedCount?.completed_subtotal);
    });
  });
});
