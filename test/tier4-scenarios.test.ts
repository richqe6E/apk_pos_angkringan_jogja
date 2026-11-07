import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import {
  createPendingOrder,
  addAdditionalItemsToPendingOrder,
  mergePendingTables,
  checkout,
} from './helpers/transactionEngine.js';
import { loadFinancialSummary, addCashEntry, saveMonthlyCogs } from './helpers/financialEngine.js';

describe('Tier 4: Real-World Cashier Shift Scenarios', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  test('T4.1 - Full Cashier Shift Scenario: open session, multiple orders, pending tables, merge, ledger entries, COGS, PnL, close session', async () => {
    const businessDate = '2026-11-07';
    const cashierName = 'Mas Danang';

    // =========================================================================
    // 1. Shift Initialization
    // =========================================================================
    await db.runAsync(
      `INSERT INTO operating_sessions (business_date, opened_at, opened_by, status)
       VALUES (?, '17:30:00', ?, 'open')`,
      [businessDate, cashierName]
    );

    // Initial float / modal awal kasir: Rp 300.000 (non-PnL income)
    await addCashEntry(db, {
      type: 'income',
      affects_pnl: false,
      category: 'modal_awal',
      amount: 300000,
      notes: 'Modal kembalian kasir shift sore',
      business_date: businessDate,
    });

    // Verify session opened
    const session = await db.getFirstAsync<{ status: string; opened_by: string }>(
      'SELECT status, opened_by FROM operating_sessions WHERE business_date = ?',
      [businessDate]
    );
    assert.strictEqual(session?.status, 'open');
    assert.strictEqual(session?.opened_by, cashierName);

    // =========================================================================
    // 2. Direct Walk-In Cash Sale (Tunai)
    // =========================================================================
    // Customer 1: 2x Nasi Kucing Sambal Teri (10k), 1x Wedang Jahe (6k) -> Subtotal 16k
    const directCashSale = await checkout(db, {
      businessDate,
      tableNumber: 'Bungkus 01',
      customerName: 'Customer GoShow',
      items: [
        { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2 },
        { menu_id: 11, name: 'Wedang Jahe Geprek', price: 6000, qty: 1 },
      ],
      paymentMethod: 'tunai',
      paymentAmount: 20000,
    });

    assert.strictEqual(directCashSale.total, 16000);
    assert.strictEqual(directCashSale.change, 4000);

    // Verify cash_ledger has entry for penjualan_tunai
    const cashEntries = await db.getAllAsync<{ category: string; amount: number; type: string }>(
      `SELECT category, amount, type FROM cash_ledger WHERE category = 'penjualan_tunai'`
    );
    assert.strictEqual(cashEntries.length, 1);
    assert.strictEqual(cashEntries[0].amount, 16000);
    assert.strictEqual(cashEntries[0].type, 'income');

    // =========================================================================
    // 3. Dine-In Pending Tables
    // =========================================================================
    // Table 01: 2x Nasi Kucing Oseng Tempe (10k), 4x Sate Usus (12k), 2x Teh Kampul (10k) = 32k
    const table01 = await createPendingOrder(db, {
      businessDate,
      tableNumber: 'Meja 01',
      customerName: 'Rombongan Pak Joko',
      items: [
        { menu_id: 2, name: 'Nasi Kucing Oseng Tempe', price: 5000, qty: 2 },
        { menu_id: 4, name: 'Sate Usus Bakar', price: 3000, qty: 4 },
        { menu_id: 13, name: 'Teh Kampul Solo', price: 5000, qty: 2 },
      ],
    });
    assert.strictEqual(table01.subtotal, 32000);

    // Table 02: 1x Nasi Kucing Bandeng (5k), 3x Sate Telur Puyuh (12k), 1x Kopi Jos (7k) = 24k
    const table02 = await createPendingOrder(db, {
      businessDate,
      tableNumber: 'Meja 02',
      customerName: 'Mas Agus',
      items: [
        { menu_id: 3, name: 'Nasi Kucing Bandeng', price: 5000, qty: 1 },
        { menu_id: 5, name: 'Sate Telur Puyuh', price: 4000, qty: 3 },
        { menu_id: 12, name: 'Kopi Jos Arang Membara', price: 7000, qty: 1 },
      ],
    });
    assert.strictEqual(table02.subtotal, 24000);

    // =========================================================================
    // 4. Additional Order on Table 01
    // =========================================================================
    // Table 01 adds 2x Jadah Bakar (8k)
    const deltaRes = await addAdditionalItemsToPendingOrder(db, table01.txId, [
      { menu_id: 16, name: 'Jadah Bakar Manis Gurih', price: 4000, qty: 2 },
    ]);
    assert.strictEqual(deltaRes.newTotal, 32000 + 8000, 'Table 01 total is now 40.000');

    // =========================================================================
    // 5. Table Merge
    // =========================================================================
    // Merge Table 01 (40k) and Table 02 (24k) into Table 01 (Gabungan)
    const mergeRes = await mergePendingTables(
      db,
      [table01.txId, table02.txId],
      'Meja 01 (Gabungan)'
    );
    assert.strictEqual(mergeRes.newSubtotal, 64000);

    // =========================================================================
    // 6. Non-Cash Checkout via Transfer
    // =========================================================================
    // Customer gives Rp 4.000 voucher discount -> Net total = 60.000
    // Pay via Transfer 60.000
    const settleRes = await checkout(db, {
      pendingTxId: table01.txId,
      businessDate,
      tableNumber: 'Meja 01 (Gabungan)',
      discountAmount: 4000,
      paymentMethod: 'transfer',
      paymentAmount: 60000,
    });

    assert.strictEqual(settleRes.subtotal, 64000);
    assert.strictEqual(settleRes.discountAmount, 4000);
    assert.strictEqual(settleRes.total, 60000);
    assert.strictEqual(settleRes.paymentMethod, 'transfer');
    assert.strictEqual(settleRes.change, 0);

    // Verify cash_ledger still only has 1 cash sale entry (the 16k cash sale)
    const cashSalesAfterTransfer = await db.getAllAsync(
      `SELECT * FROM cash_ledger WHERE category = 'penjualan_tunai'`
    );
    assert.strictEqual(cashSalesAfterTransfer.length, 1, 'Transfer payment must NOT add to cash_ledger penjualan_tunai');

    // =========================================================================
    // 7. Mid-Shift Operational Cash Ledger Transactions
    // =========================================================================
    // Operational Expense: Beli arang & es batu kristal (35k)
    await addCashEntry(db, {
      type: 'expense',
      affects_pnl: true,
      category: 'operasional_harian',
      amount: 35000,
      notes: 'Beli arang & es batu',
      business_date: businessDate,
    });

    // Operational Income: Komisi titip tahu bakso (20k)
    await addCashEntry(db, {
      type: 'income',
      affects_pnl: true,
      category: 'komisi_titip',
      amount: 20000,
      notes: 'Komisi laku 10 bungkus tahu bakso',
      business_date: businessDate,
    });

    // Non-PnL Expense: Prive pemilik ambil uang (100k)
    await addCashEntry(db, {
      type: 'expense',
      affects_pnl: false,
      category: 'prive_pemilik',
      amount: 100000,
      notes: 'Prive juragan',
      business_date: businessDate,
    });

    // =========================================================================
    // 8. Shift Close & Daily Financial Synthesis
    // =========================================================================
    // Input Monthly COGS: 30.000
    await saveMonthlyCogs(db, '2026-11', 30000, 'HPP Nasi Kucing & Wedang');

    const { summary } = await loadFinancialSummary(db, '2026-11');

    // Calculations:
    // Total Gross Sales = Order 1 (16k) + Order Merged (60k) = 76.000
    assert.strictEqual(summary.totalGrossSales, 76000, 'Gross sales must be exactly 76.000 (16k cash + 60k transfer)');
    assert.strictEqual(summary.totalTxCount, 2, 'Must have exactly 2 completed transactions');

    // Operational Income = 20.000 (komisi_titip only, cash sales 16.000 is NOT double counted!)
    assert.strictEqual(
      summary.totalOperationalIncome,
      20000,
      'operIncome must strictly equal 20.000 (NO double count of 16.000 cash sale!)'
    );

    // Operational Expenses = 35.000 (beli arang & es batu, prive 100k is non-pnl)
    assert.strictEqual(summary.totalOperationalExpenses, 35000);

    // Non-PnL Income = 300.000 (modal awal)
    assert.strictEqual(summary.totalNonPnlIncome, 300000);

    // Non-PnL Expenses = 100.000 (prive)
    assert.strictEqual(summary.totalNonPnlExpenses, 100000);

    // Monthly COGS = 30.000
    assert.strictEqual(summary.monthlyCogs, 30000);

    // Gross Profit = 76.000 - 30.000 = 46.000
    assert.strictEqual(summary.grossProfit, 46000);

    // Net Operating Profit = 76.000 + 20.000 - 35.000 - 30.000 = 31.000
    assert.strictEqual(summary.netOperatingProfit, 31000, 'Net operating profit must be exactly 31.000');

    // Physical Cash Drawer Calculation:
    // Modal Awal (300k) + Cash Sale (16k) + Cash Komisi (20k) - Cash Expense (35k) - Cash Prive (100k) = 201.000
    const allCashRows = await db.getAllAsync<{ type: string; amount: number }>(
      'SELECT type, amount FROM cash_ledger WHERE business_date = ?',
      [businessDate]
    );
    let cashDrawerBalance = 0;
    for (const row of allCashRows) {
      if (row.type === 'income') cashDrawerBalance += row.amount;
      else cashDrawerBalance -= row.amount;
    }
    assert.strictEqual(cashDrawerBalance, 201000, 'Physical cash drawer balance at shift close must be 201.000');

    // Close session in operating_sessions
    await db.runAsync(
      `UPDATE operating_sessions
       SET status = 'closed', closed_at = '01:00:00', closed_by = ?
       WHERE business_date = ?`,
      [cashierName, businessDate]
    );

    const closedSession = await db.getFirstAsync<{ status: string; closed_by: string; closed_at: string }>(
      'SELECT status, closed_by, closed_at FROM operating_sessions WHERE business_date = ?',
      [businessDate]
    );
    assert.strictEqual(closedSession?.status, 'closed');
    assert.strictEqual(closedSession?.closed_by, cashierName);
    assert.strictEqual(closedSession?.closed_at, '01:00:00');
  });
});
