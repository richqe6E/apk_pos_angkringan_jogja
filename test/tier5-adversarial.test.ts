import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import {
  createPendingOrder,
  addAdditionalItemsToPendingOrder,
  mergePendingTables,
  checkout,
} from './helpers/transactionEngine.js';
import {
  loadFinancialSummary,
  addCashEntry,
  saveMonthlyCogs,
} from './helpers/financialEngine.js';
import {
  formatCustomerReceiptLines,
  formatKitchenTicketLines,
  formatKitchenAdditionalTicketLines,
  formatTemporaryBillReceiptLines,
  type PrintReceiptData,
  type PrintOrderItem,
} from './helpers/receiptFormatter.js';
import {
  createFileSystemSimulator,
  deleteMonthlyAttendancePhotos,
} from './helpers/photoCleanup.js';

describe('Tier 5: Adversarial Hardening & Stress Testing Suites', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // 1. MULTI-TABLE MERGE STRESS TEST (3+ tables simultaneously, identical items, PB1 precision)
  // =========================================================================
  describe('T5.1 - Multi-Table Merge Stress Tests', () => {
    test('T5.1.1 - Merge 4 simultaneous tables with overlapping and distinct items, preserving discounts and PB1 tax', async () => {
      // Table 1 (Meja 01): 3x Nasi Kucing Teri (5k), 2x Sate Usus (3k). Discount: 1,500
      const order1 = await createPendingOrder(db, {
        tableNumber: 'Meja 01',
        customerName: 'Customer Meja 01',
        discountAmount: 1500,
        items: [
          { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 3 },
          { menu_id: 4, name: 'Sate Usus Bakar', price: 3000, qty: 2 },
        ],
      });

      // Table 2 (Meja 02): 5x Nasi Kucing Teri (5k), 4x Teh Kampul (4k). Discount: 2,500
      const order2 = await createPendingOrder(db, {
        tableNumber: 'Meja 02',
        customerName: 'Customer Meja 02',
        discountAmount: 2500,
        items: [
          { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 5 },
          { menu_id: 14, name: 'Es Teh Kampul Solo', price: 4000, qty: 4 },
        ],
      });

      // Table 3 (Meja 03): 2x Nasi Kucing Teri (5k), 3x Sate Usus (3k), 2x Wedang Ronde (7k). Discount: 3,000
      const order3 = await createPendingOrder(db, {
        tableNumber: 'Meja 03',
        customerName: 'Customer Meja 03',
        discountAmount: 3000,
        items: [
          { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2 },
          { menu_id: 4, name: 'Sate Usus Bakar', price: 3000, qty: 3 },
          { menu_id: 12, name: 'Wedang Ronde Komplit', price: 7000, qty: 2 },
        ],
      });

      // Table 4 (Meja 04): 1x Nasi Kucing Teri (5k), 1x Sate Telur Puyuh (3.5k). Discount: 1,000
      const order4 = await createPendingOrder(db, {
        tableNumber: 'Meja 04',
        customerName: 'Customer Meja 04',
        discountAmount: 1000,
        items: [
          { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 1 },
          { menu_id: 3, name: 'Sate Telur Puyuh Manis', price: 3500, qty: 1 },
        ],
      });

      // Merge all 4 tables into "Meja VIP / Gabungan 1-4" with 10% PB1 tax enabled
      const mergeResult = await mergePendingTables(
        db,
        [order1.txId, order2.txId, order3.txId, order4.txId],
        'Meja VIP / Gabungan 1-4',
        true,
        10
      );

      // 1. Primary ID is preserved as the first table (order1)
      assert.strictEqual(mergeResult.primaryId, order1.txId);

      // 2. All other source tables (order2, order3, order4) are marked as 'merged' pointing to primaryId
      for (const otherTxId of [order2.txId, order3.txId, order4.txId]) {
        const row = await db.getFirstAsync<{ status: string; merged_into_tx_id: number }>(
          'SELECT status, merged_into_tx_id FROM transactions WHERE id = ?',
          [otherTxId]
        );
        assert.strictEqual(row?.status, 'merged', `Table txId ${otherTxId} must have status = merged`);
        assert.strictEqual(row?.merged_into_tx_id, order1.txId, `Table txId ${otherTxId} must point to ${order1.txId}`);
      }

      // 3. Consolidated items in primary transaction: exactly 5 distinct items (menu_ids: 1, 3, 4, 12, 14)
      const mergedItems = await db.getAllAsync<{
        menu_id: number;
        menu_name: string;
        price: number;
        qty: number;
        subtotal: number;
      }>(
        'SELECT menu_id, menu_name, price, qty, subtotal FROM transaction_items WHERE transaction_id = ? ORDER BY menu_id ASC',
        [order1.txId]
      );

      assert.strictEqual(mergedItems.length, 5, 'Consolidated items must have exactly 5 rows (deduplicated across 4 tables)');

      // Check Nasi Kucing (id: 1): 3 + 5 + 2 + 1 = 11 qty, subtotal = 55.000
      const nasiKucing = mergedItems.find((i) => i.menu_id === 1);
      assert.ok(nasiKucing);
      assert.strictEqual(nasiKucing.qty, 11);
      assert.strictEqual(nasiKucing.subtotal, 55000);

      // Check Sate Usus (id: 4): 2 + 3 = 5 qty, subtotal = 15.000
      const sateUsus = mergedItems.find((i) => i.menu_id === 4);
      assert.ok(sateUsus);
      assert.strictEqual(sateUsus.qty, 5);
      assert.strictEqual(sateUsus.subtotal, 15000);

      // Check Teh Kampul (id: 14): 4 qty, subtotal = 16.000
      const tehKampul = mergedItems.find((i) => i.menu_id === 14);
      assert.ok(tehKampul);
      assert.strictEqual(tehKampul.qty, 4);
      assert.strictEqual(tehKampul.subtotal, 16000);

      // Check Wedang Ronde (id: 12): 2 qty, subtotal = 14.000
      const wedangRonde = mergedItems.find((i) => i.menu_id === 12);
      assert.ok(wedangRonde);
      assert.strictEqual(wedangRonde.qty, 2);
      assert.strictEqual(wedangRonde.subtotal, 14000);

      // Check Sate Telur (id: 3): 1 qty, subtotal = 3.500
      const sateTelur = mergedItems.find((i) => i.menu_id === 3);
      assert.ok(sateTelur);
      assert.strictEqual(sateTelur.qty, 1);
      assert.strictEqual(sateTelur.subtotal, 3500);

      // 4. Subtotal calculation: 55k + 15k + 16k + 14k + 3.5k = 103.500
      const expectedSubtotal = 103500;
      assert.strictEqual(mergeResult.newSubtotal, expectedSubtotal);

      // 5. Total discount preserved across all 4 tables: 1,500 + 2,500 + 3,000 + 1,000 = 8,000
      const expectedDiscount = 8000;
      assert.strictEqual(mergeResult.totalDiscount, expectedDiscount);

      // 6. PB1 Tax calculation: 10% of 103.500 = 10.350
      const expectedTax = Math.round((expectedSubtotal * 10) / 100);
      assert.strictEqual(mergeResult.newTaxAmount, expectedTax);

      // 7. Final total: 103.500 + 10.350 - 8.000 = 105.850
      const expectedTotal = expectedSubtotal + expectedTax - expectedDiscount;
      assert.strictEqual(mergeResult.newTotal, expectedTotal);
      assert.strictEqual(mergeResult.newTotal, 105850);

      // Verify the transaction row in DB reflects these exact values
      const primaryRow = await db.getFirstAsync<{
        table_number: string;
        subtotal: number;
        tax_amount: number;
        discount_amount: number;
        total: number;
        status: string;
      }>('SELECT table_number, subtotal, tax_amount, discount_amount, total, status FROM transactions WHERE id = ?', [order1.txId]);

      assert.strictEqual(primaryRow?.table_number, 'Meja VIP / Gabungan 1-4');
      assert.strictEqual(primaryRow?.subtotal, 103500);
      assert.strictEqual(primaryRow?.tax_amount, 10350);
      assert.strictEqual(primaryRow?.discount_amount, 8000);
      assert.strictEqual(primaryRow?.total, 105850);
      assert.strictEqual(primaryRow?.status, 'pending');
    });

    test('T5.1.2 - PB1 Tax precision with odd subtotals and custom rates (11% PPN)', async () => {
      // Create table with odd subtotal: 3x @ 3.333 = 9.999
      const orderA = await createPendingOrder(db, {
        tableNumber: 'Meja A',
        items: [{ menu_id: 1, name: 'Item Odd 1', price: 3333, qty: 3 }],
      });

      // Table B with: 1x @ 7.777 = 7.777
      const orderB = await createPendingOrder(db, {
        tableNumber: 'Meja B',
        items: [{ menu_id: 2, name: 'Item Odd 2', price: 7777, qty: 1 }],
      });

      // Subtotal = 9.999 + 7.777 = 17.776
      // 11% Tax = 17.776 * 0.11 = 1955.36 -> Math.round = 1955
      const merged = await mergePendingTables(db, [orderA.txId, orderB.txId], 'Meja Odd Gabungan', true, 11);

      assert.strictEqual(merged.newSubtotal, 17776);
      assert.strictEqual(merged.newTaxAmount, 1955, '11% of 17776 is 1955.36, rounded to 1955');
      assert.strictEqual(merged.newTotal, 17776 + 1955);
    });

    test('T5.1.3 - Merge rejection: attempting to merge fewer than 2 tables must throw', async () => {
      const order1 = await createPendingOrder(db, {
        tableNumber: 'Meja Solo',
        items: [{ menu_id: 1, name: 'Item 1', price: 5000, qty: 1 }],
      });

      await assert.rejects(
        async () => {
          await mergePendingTables(db, [order1.txId], 'Meja Solo Target');
        },
        /Pilih minimal 2 meja pending untuk digabung/
      );

      await assert.rejects(
        async () => {
          await mergePendingTables(db, [], 'Empty Tables');
        },
        /Pilih minimal 2 meja pending untuk digabung/
      );
    });
  });

  // =========================================================================
  // 2. ADVERSARIAL EDGE CASES (extreme discounts, 0 items, rapid successive orders)
  // =========================================================================
  describe('T5.2 - Adversarial Edge Cases', () => {
    test('T5.2.1 - Extreme discounts exceeding subtotal and PB1 tax clamp strictly to 0', async () => {
      // Subtotal: 20.000, Tax 10%: 2.000, Gross Due: 22.000. Extreme Discount: 100.000
      const checkoutRes = await checkout(db, {
        tableNumber: 'Meja VIP Voucher',
        items: [{ menu_id: 1, name: 'Nasi Kucing', price: 5000, qty: 4 }],
        taxEnabled: true,
        taxRate: 10,
        discountAmount: 100000, // Exceeds 22.000 by 78.000
        paymentMethod: 'tunai',
        paymentAmount: 50000,
      });

      // Total must clamp to 0 (never negative)
      assert.strictEqual(checkoutRes.subtotal, 20000);
      assert.strictEqual(checkoutRes.taxAmount, 2000);
      assert.strictEqual(checkoutRes.discountAmount, 100000);
      assert.strictEqual(checkoutRes.total, 0, 'Total bill must never be negative, clamped to 0');

      // Change must be the full paid amount since total is 0
      assert.strictEqual(checkoutRes.change, 50000);

      // Verify cash_ledger record: recorded amount must be 0, not negative
      const ledgerEntry = await db.getFirstAsync<{ amount: number; category: string }>(
        `SELECT amount, category FROM cash_ledger WHERE notes LIKE ?`,
        [`%${checkoutRes.invoiceNumber}%`]
      );
      assert.ok(ledgerEntry);
      assert.strictEqual(ledgerEntry.amount, 0, 'Cash ledger sale amount must be 0, never negative');
    });

    test('T5.2.2 - Direct checkout and pending table with zero items (empty cart)', async () => {
      // 1. Direct checkout with 0 items
      const directZero = await checkout(db, {
        tableNumber: 'Meja Zero Direct',
        items: [],
        paymentMethod: 'tunai',
        paymentAmount: 0,
      });

      assert.strictEqual(directZero.subtotal, 0);
      assert.strictEqual(directZero.taxAmount, 0);
      assert.strictEqual(directZero.total, 0);
      assert.strictEqual(directZero.change, 0);

      // 2. Pending table with 0 items
      const pendingZero = await createPendingOrder(db, {
        tableNumber: 'Meja Zero Pending',
        items: [],
      });

      assert.strictEqual(pendingZero.subtotal, 0);
      assert.strictEqual(pendingZero.total, 0);

      // Check items table has 0 rows for this tx
      const count = await db.getFirstAsync<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM transaction_items WHERE transaction_id = ?',
        [pendingZero.txId]
      );
      assert.strictEqual(count?.cnt, 0);
    });

    test('T5.2.3 - Rapid successive additional orders (is_additional = 1) across 3 distinct rounds', async () => {
      // Round 0: Initial order (is_additional = 0)
      const pending = await createPendingOrder(db, {
        tableNumber: 'Meja 09',
        customerName: 'Mas Bambang',
        items: [
          { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2 },
          { menu_id: 10, name: 'Es Teh Manis', price: 3000, qty: 2 },
        ],
      });
      // Initial subtotal = (2 * 5k) + (2 * 3k) = 16.000
      assert.strictEqual(pending.subtotal, 16000);

      // Round 1: Additional order batch 1 (2 items)
      const batch1 = await addAdditionalItemsToPendingOrder(db, pending.txId, [
        { menu_id: 4, name: 'Sate Usus Bakar', price: 3000, qty: 3 },
        { menu_id: 8, name: 'Gorengan Tempe Mendoan', price: 1500, qty: 4 },
      ]);
      // + (3 * 3k) + (4 * 1.5k) = +9k + 6k = +15k -> 16k + 15k = 31.000
      assert.strictEqual(batch1.addedCount, 2);
      assert.strictEqual(batch1.newTotal, 31000);

      // Round 2: Additional order batch 2 (1 item)
      const batch2 = await addAdditionalItemsToPendingOrder(db, pending.txId, [
        { menu_id: 11, name: 'Wedang Jahe Geprek', price: 6000, qty: 2 },
      ]);
      // + (2 * 6k) = +12k -> 31k + 12k = 43.000
      assert.strictEqual(batch2.addedCount, 1);
      assert.strictEqual(batch2.newTotal, 43000);

      // Round 3: Additional order batch 3 (2 items)
      const batch3 = await addAdditionalItemsToPendingOrder(db, pending.txId, [
        { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 1 },
        { menu_id: 3, name: 'Sate Telur Puyuh Manis', price: 3500, qty: 2 },
      ]);
      // + 5k + (2 * 3.5k) = +5k + 7k = +12k -> 43k + 12k = 55.000
      assert.strictEqual(batch3.addedCount, 2);
      assert.strictEqual(batch3.newTotal, 55000);

      // Verify transaction_items breakdown in DB:
      const allItems = await db.getAllAsync<{
        menu_name: string;
        is_additional: number;
        qty: number;
        subtotal: number;
      }>(
        'SELECT menu_name, is_additional, qty, subtotal FROM transaction_items WHERE transaction_id = ? ORDER BY id ASC',
        [pending.txId]
      );

      // Exactly 7 records: 2 initial + 2 batch1 + 1 batch2 + 2 batch3
      assert.strictEqual(allItems.length, 7);

      const initialItems = allItems.filter((i) => i.is_additional === 0);
      assert.strictEqual(initialItems.length, 2, 'Initial round items must have is_additional = 0');

      const additionalItems = allItems.filter((i) => i.is_additional === 1);
      assert.strictEqual(additionalItems.length, 5, 'All subsequent rounds must have is_additional = 1');

      // Check sum of subtotals in DB matches exactly 55.000
      const totalItemSubtotal = allItems.reduce((acc, curr) => acc + curr.subtotal, 0);
      assert.strictEqual(totalItemSubtotal, 55000);

      // Verify that kitchen additional ticket formatter only receives the newest delta items
      const deltaLines = formatKitchenAdditionalTicketLines({
        invoiceNumber: pending.invoiceNumber,
        tableNumber: 'Meja 09',
        dateTimeString: '07/11/2026 19:45',
        additionalItems: [
          { name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 1, subtotal: 5000, is_additional: 1 },
          { name: 'Sate Telur Puyuh Manis', price: 3500, qty: 2, subtotal: 7000, is_additional: 1 },
        ],
      });

      assert.ok(deltaLines.some((l) => l.includes('*** PESANAN TAMBAHAN ***')));
      assert.ok(deltaLines.some((l) => l.includes('[ +1 ] Nasi Kucing Sambal Teri (BARU)')));
      assert.ok(deltaLines.some((l) => l.includes('[ +2 ] Sate Telur Puyuh Manis (BARU)')));
      // Make sure initial items (e.g. Es Teh Manis) are NOT printed in delta ticket
      assert.ok(!deltaLines.some((l) => l.includes('Es Teh Manis')));
    });
  });

  // =========================================================================
  // 3. CASH LEDGER VS NET PROFIT RECONCILIATION UNDER HIGH VOLUME
  // =========================================================================
  describe('T5.3 - Financial Reconciliation & Net Profit Mathematical Truth', () => {
    test('T5.3.1 - High-volume mixed payment methods, operational expenses, non-PnL capital, and COGS reconciliation', async () => {
      const targetMonth = '2026-11';

      // 1. Generate 120 completed transactions with mixed payment methods
      //    - 50 Cash (Tunai) -> automatically enters cash_ledger as 'penjualan_tunai'
      //    - 40 QRIS -> bank settled
      //    - 30 Transfer -> bank settled
      let expectedCashSales = 0;
      let expectedQrisSales = 0;
      let expectedTransferSales = 0;

      // Seed 50 Cash transactions (amounts between 10k and 100k)
      for (let i = 1; i <= 50; i++) {
        const amount = 10000 + (i * 1500); // 11.5k, 13k, 14.5k, ...
        expectedCashSales += amount;
        await checkout(db, {
          businessDate: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
          tableNumber: `Meja C-${i}`,
          items: [{ menu_id: 1, name: 'Paket Angkringan', price: amount, qty: 1 }],
          paymentMethod: 'tunai',
          paymentAmount: amount + 10000, // overpaid to verify change computation
        });
      }

      // Seed 40 QRIS transactions
      for (let i = 1; i <= 40; i++) {
        const amount = 20000 + (i * 2000);
        expectedQrisSales += amount;
        await checkout(db, {
          businessDate: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
          tableNumber: `Meja Q-${i}`,
          items: [{ menu_id: 2, name: 'Paket Wedangan QRIS', price: amount, qty: 1 }],
          paymentMethod: 'qris',
          paymentAmount: amount,
        });
      }

      // Seed 30 Transfer transactions
      for (let i = 1; i <= 30; i++) {
        const amount = 30000 + (i * 3000);
        expectedTransferSales += amount;
        await checkout(db, {
          businessDate: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
          tableNumber: `Meja T-${i}`,
          items: [{ menu_id: 3, name: 'Paket Prasmanan Transfer', price: amount, qty: 1 }],
          paymentMethod: 'transfer',
          paymentAmount: amount,
        });
      }

      // Also seed 5 transactions in previous month (2026-10) to verify strict period isolation
      for (let i = 1; i <= 5; i++) {
        await checkout(db, {
          businessDate: '2026-10-15',
          tableNumber: `Meja Oct-${i}`,
          items: [{ menu_id: 1, name: 'October Sale', price: 25000, qty: 1 }],
          paymentMethod: 'tunai',
          paymentAmount: 25000,
        });
      }

      const expectedGrossSales = expectedCashSales + expectedQrisSales + expectedTransferSales;

      // 2. Add multiple diverse cash entries
      // 6 Operational Expenses (affects_pnl = 1)
      const opExpenses = [
        { cat: 'Bahan Baku & Bumbu', amt: 450000 },
        { cat: 'Arang & Kayu Bakar', amt: 120000 },
        { cat: 'Es Batu Kristal', amt: 85000 },
        { cat: 'Listrik & Air Galon', amt: 210000 },
        { cat: 'Daun Pisang & Kertas Bungkus', amt: 75000 },
        { cat: 'Kebersihan & Kantong Sampah', amt: 40000 },
      ];
      let expectedOperExpenses = 0;
      for (const exp of opExpenses) {
        expectedOperExpenses += exp.amt;
        await addCashEntry(db, {
          business_date: '2026-11-10',
          type: 'expense',
          affects_pnl: true,
          category: exp.cat,
          amount: exp.amt,
          notes: `Beli ${exp.cat}`,
        });
      }

      // 4 Non-PnL Expenses (affects_pnl = 0: Prive & Bayar Tempo)
      const nonPnlExpenses = [
        { cat: 'Prive Pemilik', amt: 500000 },
        { cat: 'Bayar Hutang Supplier', amt: 350000 },
        { cat: 'Prive Pemilik 2', amt: 250000 },
        { cat: 'Pinjaman Karyawan', amt: 150000 },
      ];
      let expectedNonPnlExpenses = 0;
      for (const exp of nonPnlExpenses) {
        expectedNonPnlExpenses += exp.amt;
        await addCashEntry(db, {
          business_date: '2026-11-12',
          type: 'expense',
          affects_pnl: false,
          category: exp.cat,
          amount: exp.amt,
          notes: exp.cat,
        });
      }

      // 4 Operational Incomes (affects_pnl = 1: non-sales)
      const opIncomes = [
        { cat: 'Komisi Titip Kerupuk', amt: 45000 },
        { cat: 'Penjualan Minyak Jelantah', amt: 60000 },
        { cat: 'Komisi Titip Kacang Bawang', amt: 30000 },
        { cat: 'Sponsorship Banner Angkringan', amt: 150000 },
      ];
      let expectedOperIncome = 0;
      for (const inc of opIncomes) {
        expectedOperIncome += inc.amt;
        await addCashEntry(db, {
          business_date: '2026-11-15',
          type: 'income',
          affects_pnl: true,
          category: inc.cat,
          amount: inc.amt,
          notes: inc.cat,
        });
      }

      // 3 Non-PnL Incomes (affects_pnl = 0: Modal Awal Kasir)
      const initialCashFloat = 500000;
      let expectedNonPnlIncome = initialCashFloat + 200000;
      await addCashEntry(db, {
        business_date: '2026-11-01',
        type: 'income',
        affects_pnl: false,
        category: 'Modal Awal Kasir',
        amount: initialCashFloat,
        notes: 'Cash Float Awal Bulan',
      });
      await addCashEntry(db, {
        business_date: '2026-11-20',
        type: 'income',
        affects_pnl: false,
        category: 'Injeksi Modal',
        amount: 200000,
        notes: 'Injeksi modal darurat',
      });

      // 3. Set Monthly COGS (HPP Bahan Baku)
      const monthlyCogs = 1250000;
      await saveMonthlyCogs(db, targetMonth, monthlyCogs, 'HPP Dapur Bulan November 2026');

      // 4. Load financial summary via Financial Engine
      const { summary, entries } = await loadFinancialSummary(db, targetMonth);

      // VERIFICATION 1: Gross Sales and Transaction Count
      assert.strictEqual(summary.totalTxCount, 120, 'Total completed transactions must be 120 (October excluded)');
      assert.strictEqual(summary.totalGrossSales, expectedGrossSales, 'Gross sales must match sum of 120 transactions');

      // VERIFICATION 2: Anti-Double-Count Rule
      // operIncome must ONLY contain non-penjualan_tunai operational incomes (45k + 60k + 30k + 150k = 285.000)
      // It must NEVER include any of the 50 cash transactions!
      assert.strictEqual(
        summary.totalOperationalIncome,
        expectedOperIncome,
        'Operational income must NOT include cash sales (penjualan_tunai); zero double-counting permitted!'
      );

      // VERIFICATION 3: Operational Expenses
      assert.strictEqual(summary.totalOperationalExpenses, expectedOperExpenses);

      // VERIFICATION 4: Non-PnL Incomes and Expenses
      assert.strictEqual(summary.totalNonPnlExpenses, expectedNonPnlExpenses);
      assert.strictEqual(summary.totalNonPnlIncome, expectedNonPnlIncome);

      // VERIFICATION 5: Gross Profit: Gross Sales - COGS
      const expectedGrossProfit = expectedGrossSales - monthlyCogs;
      assert.strictEqual(summary.grossProfit, expectedGrossProfit);

      // VERIFICATION 6: Net Operating Profit:
      // Formula: Gross Sales + Oper Income - Oper Expenses - COGS
      const expectedNetOperatingProfit =
        expectedGrossSales + expectedOperIncome - expectedOperExpenses - monthlyCogs;
      assert.strictEqual(
        summary.netOperatingProfit,
        expectedNetOperatingProfit,
        'Net operating profit must match exact mathematical truth'
      );

      // VERIFICATION 7: Cash Drawer (Fisik Laci Kasir) Mathematical Reconciliation
      // In physical cash drawer, only actual physical cash flows apply:
      // Cash In: Modal Awal Kasir + Injeksi Modal + All Cash Sales (penjualan_tunai) + Other Cash In
      // Cash Out: All Operational Expenses paid from cash + Non-PnL Expenses paid from cash
      // QRIS and Transfer sales DO NOT go to physical cash drawer.
      const totalCashIn = expectedNonPnlIncome + expectedCashSales + expectedOperIncome;
      const totalCashOut = expectedOperExpenses + expectedNonPnlExpenses;
      const expectedPhysicalDrawerCash = totalCashIn - totalCashOut;

      // Compute physical cash directly by summing ALL cash_ledger entries
      const actualDrawerCash = entries.reduce((acc, e) => {
        return e.type === 'income' ? acc + e.amount : acc - e.amount;
      }, 0);

      assert.strictEqual(
        actualDrawerCash,
        expectedPhysicalDrawerCash,
        'Physical cash drawer must match exact sum of cash_ledger'
      );

      // Ensure that QRIS and Transfer are strictly excluded from cash_ledger
      const nonCashInLedger = await db.getAllAsync(
        `SELECT * FROM cash_ledger WHERE notes LIKE '%QRIS%' OR notes LIKE '%Transfer%'`
      );
      assert.strictEqual(nonCashInLedger.length, 0, 'No QRIS or Transfer sales should ever be written to cash_ledger');
    });
  });

  // =========================================================================
  // 4. ATTENDANCE PHOTO CLEANUP ADVERSARIAL RESILIENCE
  // =========================================================================
  describe('T5.4 - Attendance Photo Cleanup Edge Cases', () => {
    test('T5.4.1 - Non-existent directories and already missing physical files do not throw (Idempotent)', async () => {
      const fsSim = createFileSystemSimulator();

      await db.runAsync(
        `INSERT OR IGNORE INTO employees (id, name, phone) VALUES (1, 'Karyawan Hantu', '08123')`
      );

      // Attendance record pointing to a non-existent file
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo)
         VALUES (1, 'Karyawan Hantu', '2026-10-05', '17:00', 'file:///app/attendance/ghost_file.jpg')`
      );

      // Call cleanup on empty simulator
      const result = await deleteMonthlyAttendancePhotos(db, fsSim, '2026-10');

      // 0 physical files deleted (since file was already missing), but 1 DB row updated to empty string
      assert.strictEqual(result.deletedFilesCount, 0);
      assert.strictEqual(result.dbRowsUpdated, 1);

      // Verify DB record is now empty string
      const row = await db.getFirstAsync<{ check_in_photo: string }>(
        'SELECT check_in_photo FROM attendance WHERE employee_id = 1'
      );
      assert.strictEqual(row?.check_in_photo, '', 'Path in DB must be cleared to avoid dangling pointers');
    });

    test('T5.4.2 - Multi-month isolation: only target month photos are deleted, prior and active months preserved', async () => {
      const fsSim = createFileSystemSimulator();

      for (let i = 1; i <= 3; i++) {
        await db.runAsync(
          `INSERT OR IGNORE INTO employees (id, name, phone) VALUES (?, ?, '08123')`,
          [i, `Staff ${i}`]
        );
      }

      // Seed 4 distinct months
      const months = ['2026-08', '2026-09', '2026-10', '2026-11'];
      for (const m of months) {
        for (let i = 1; i <= 3; i++) {
          const filePath = `file:///app/attendance/att_${m}_emp_${i}.jpg`;
          fsSim.files.set(filePath, `fake-image-content-for-${m}-${i}`);
          await db.runAsync(
            `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo)
             VALUES (?, ?, ?, '17:15', ?)`,
            [i, `Staff ${i}`, `${m}-10`, filePath]
          );
        }
      }

      // Total files in simulator = 12
      assert.strictEqual(fsSim.files.size, 12);

      // Execute cleanup strictly for target month '2026-09'
      const cleanupRes = await deleteMonthlyAttendancePhotos(db, fsSim, '2026-09');

      assert.strictEqual(cleanupRes.deletedFilesCount, 3, 'Exactly 3 files from 2026-09 must be deleted');
      assert.strictEqual(cleanupRes.dbRowsUpdated, 3, 'Exactly 3 DB rows for 2026-09 must be updated');

      // Remaining files in simulator must be exactly 9 (3 for August, 3 for October, 3 for November)
      assert.strictEqual(fsSim.files.size, 9);
      for (const m of ['2026-08', '2026-10', '2026-11']) {
        for (let i = 1; i <= 3; i++) {
          const expectedPath = `file:///app/attendance/att_${m}_emp_${i}.jpg`;
          assert.ok(fsSim.files.has(expectedPath), `File ${expectedPath} must remain intact in filesystem`);

          const dbRow = await db.getFirstAsync<{ check_in_photo: string }>(
            `SELECT check_in_photo FROM attendance WHERE business_date = ? AND employee_id = ?`,
            [`${m}-10`, i]
          );
          assert.strictEqual(dbRow?.check_in_photo, expectedPath, `DB photo path for ${m} must remain intact`);
        }
      }
    });

    test('T5.4.3 - Edge-case date strings: invalid dates or non-matching prefixes delete 0 files', async () => {
      const fsSim = createFileSystemSimulator();

      await db.runAsync(
        `INSERT OR IGNORE INTO employees (id, name, phone) VALUES (1, 'Staff Nov', '08123')`
      );

      const validPath = 'file:///app/attendance/att_2026-11_1.jpg';
      fsSim.files.set(validPath, 'content');
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo)
         VALUES (1, 'Staff Nov', '2026-11-01', '17:00', ?)`,
        [validPath]
      );

      // Run cleanup with non-matching prefixes
      const res1 = await deleteMonthlyAttendancePhotos(db, fsSim, '1999-01');
      assert.strictEqual(res1.deletedFilesCount, 0);
      assert.strictEqual(res1.dbRowsUpdated, 0);

      const res2 = await deleteMonthlyAttendancePhotos(db, fsSim, 'INVALID_DATE');
      assert.strictEqual(res2.deletedFilesCount, 0);
      assert.strictEqual(res2.dbRowsUpdated, 0);

      // File and DB must still exist
      assert.strictEqual(fsSim.files.size, 1);
      const row = await db.getFirstAsync<{ check_in_photo: string }>('SELECT check_in_photo FROM attendance WHERE employee_id = 1');
      assert.strictEqual(row?.check_in_photo, validPath);
    });
  });

  // =========================================================================
  // 5. RECEIPT FORMATTING ADVERSARIAL INPUTS
  // =========================================================================
  describe('T5.5 - Thermal Receipt Formatting Adversarial Inputs', () => {
    test('T5.5.1 - Special characters, unicode emoji, and punctuation in item names and customer notes', () => {
      const receiptData: PrintReceiptData = {
        storeName: 'ANGKRINGAN JOGJA',
        storeAddress: 'Jl. Malioboro No. 15, DIY',
        storePhone: '081234567890',
        receiptFooter: 'Matur Nuwun Sampun Rawuh! 🙏',
        invoiceNumber: 'INV-071126-999',
        businessDate: '2026-11-07',
        dateTimeString: '07/11/2026 21:30',
        tableNumber: 'Meja #03 (Depan)',
        customerName: 'Bpk. Joko & Kel. (VIP*)',
        cashierName: 'Kasir Srikandi',
        items: [
          {
            name: 'Nasi Kucing 🐱 Pedas Mampus 🌶️🔥',
            price: 6000,
            qty: 3,
            subtotal: 18000,
          },
          {
            name: 'Sate Usus (Extra Bumbu @#$%)',
            price: 3500,
            qty: 4,
            subtotal: 14000,
          },
          {
            name: 'Wedang Uwuh "Spesial" <Hangat>',
            price: 8000,
            qty: 2,
            subtotal: 16000,
          },
        ],
        subtotal: 48000,
        discountAmount: 3000,
        taxAmount: 4500,
        total: 49500,
        paymentMethod: 'qris',
        paymentAmount: 49500,
        changeAmount: 0,
      };

      const lines = formatCustomerReceiptLines(receiptData);

      // Verify all special items rendered without crash or corruption
      assert.ok(lines.some((l) => l.includes('Nasi Kucing 🐱 Pedas Mampus 🌶️🔥')));
      assert.ok(lines.some((l) => l.includes('Sate Usus (Extra Bumbu @#$%)')));
      assert.ok(lines.some((l) => l.includes('Wedang Uwuh "Spesial" <Hangat>')));
      assert.ok(lines.some((l) => l.includes('Bayar (QRIS)')));
      assert.ok(lines.some((l) => l.includes('Matur Nuwun Sampun Rawuh! 🙏')));

      // QRIS must NOT show Kembalian line
      assert.ok(!lines.some((l) => l.includes('Kembalian')));
    });

    test('T5.5.2 - Empty store profile fallback and extremely long names', () => {
      const veryLongItemName = 'Nasi Kucing Super Jumbo Spesial Sambal Bawang Teri Teri Crispy Daun Pisang Wangi Asli Yogya Porsi Kenyang Kasir Juara';
      const veryLongCustomer = 'Raden Mas Haryo Danang Joyokusumo Purbaya Diningrat Kesumo IV';

      const minimalData: PrintReceiptData = {
        storeName: undefined,
        storeAddress: undefined,
        storePhone: undefined,
        receiptFooter: undefined,
        invoiceNumber: 'INV-FALLBACK-001',
        businessDate: '2026-11-07',
        dateTimeString: '07/11/2026 22:00',
        tableNumber: 'Meja 99',
        customerName: veryLongCustomer,
        cashierName: undefined,
        items: [
          {
            name: veryLongItemName,
            price: 15000,
            qty: 1,
            subtotal: 15000,
          },
        ],
        subtotal: 15000,
        total: 15000,
        paymentMethod: 'tunai',
        paymentAmount: 20000,
        changeAmount: 5000,
      };

      const lines = formatCustomerReceiptLines(minimalData);

      // Must fall back to default store name 'ANGKRINGAN JOGJA'
      assert.strictEqual(lines[0], 'ANGKRINGAN JOGJA');

      // Cashier fallback to 'Kasir'
      assert.ok(lines.some((l) => l === 'Kasir    : Kasir'));

      // Footer fallback to 'Matur Nuwun Sampun Rawuh!'
      assert.ok(lines.some((l) => l === 'Matur Nuwun Sampun Rawuh!'));

      // Long item and customer rendered without throw
      assert.ok(lines.some((l) => l === veryLongItemName));
      assert.ok(lines.some((l) => l.includes(veryLongCustomer)));

      // No undefined or null text anywhere in output lines
      for (const line of lines) {
        assert.ok(!line.includes('undefined'), `Receipt line must not contain 'undefined': "${line}"`);
        assert.ok(!line.includes('null'), `Receipt line must not contain 'null': "${line}"`);
      }
    });

    test('T5.5.3 - Temporary bill watermark and kitchen ticket security check', () => {
      const testData: PrintReceiptData = {
        storeName: 'ANGKRINGAN JOGJA',
        invoiceNumber: 'INV-TEMP-888',
        businessDate: '2026-11-07',
        dateTimeString: '07/11/2026 18:00',
        tableNumber: 'Meja 05',
        customerName: 'Mas Danu',
        items: [
          { name: 'Nasi Kucing Teri', price: 5000, qty: 2, subtotal: 10000 },
          { name: 'Es Teh Manis', price: 3000, qty: 2, subtotal: 6000 },
        ],
        subtotal: 16000,
        total: 16000,
        paymentMethod: 'tunai',
        paymentAmount: 0,
        changeAmount: 0,
      };

      // 1. Temporary Bill Lines
      const tempBillLines = formatTemporaryBillReceiptLines(testData);
      assert.ok(tempBillLines.some((l) => l.includes('*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***')));
      assert.ok(tempBillLines.some((l) => l.includes('BUKAN BUKTI PEMBAYARAN SAH')));
      assert.ok(tempBillLines.some((l) => l.includes('Status   : BELUM LUNAS (SEMENTARA)')));

      // 2. Kitchen Ticket Lines (Security: MUST NOT DISPLAY PRICES OR TOTALS)
      const kitchenLines = formatKitchenTicketLines({
        invoiceNumber: testData.invoiceNumber,
        tableNumber: testData.tableNumber,
        dateTimeString: testData.dateTimeString,
        items: testData.items,
      });

      assert.ok(kitchenLines.some((l) => l.includes('*** TIKET DAPUR ***')));
      assert.ok(kitchenLines.some((l) => l.includes('MEJA: Meja 05')));
      assert.ok(kitchenLines.some((l) => l.includes('[ x2 ] Nasi Kucing Teri')));
      assert.ok(kitchenLines.some((l) => l.includes('[ x2 ] Es Teh Manis')));

      // Security check: Kitchen staff must NOT see prices, Rp, Subtotal, or Total
      assert.ok(!kitchenLines.some((l) => l.includes('Rp')));
      assert.ok(!kitchenLines.some((l) => l.includes('Subtotal')));
      assert.ok(!kitchenLines.some((l) => l.includes('TOTAL')));
    });
  });
});
