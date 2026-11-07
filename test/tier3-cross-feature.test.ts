import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import {
  createPendingOrder,
  addAdditionalItemsToPendingOrder,
  mergePendingTables,
  checkout,
} from './helpers/transactionEngine.js';
import { loadFinancialSummary } from './helpers/financialEngine.js';
import {
  formatKitchenTicketLines,
  formatKitchenAdditionalTicketLines,
  formatTemporaryBillReceiptLines,
  type PrintOrderItem,
} from './helpers/receiptFormatter.js';

describe('Tier 3: Cross-Feature Combinations Suites', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  test('T3.1 - Cross-Feature: Table merge + additional order + payment with QRIS/Transfer', async () => {
    const businessDate = '2026-11-07';

    // 1. Table 10 opened with pending order
    const order10 = await createPendingOrder(db, {
      businessDate,
      tableNumber: 'Meja 10',
      customerName: 'Grup Mahasiswa A',
      items: [
        { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 3 },
        { menu_id: 5, name: 'Sate Telur Puyuh', price: 4000, qty: 2 },
      ], // subtotal = 15.000 + 8.000 = 23.000
    });

    // 2. Table 11 opened with pending order
    const order11 = await createPendingOrder(db, {
      businessDate,
      tableNumber: 'Meja 11',
      customerName: 'Grup Mahasiswa B',
      items: [
        { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2 },
        { menu_id: 13, name: 'Teh Kampul Solo', price: 5000, qty: 3 },
      ], // subtotal = 10.000 + 15.000 = 25.000
    });

    // 3. Merge Table 10 and Table 11 into Table 10 (Gabungan)
    const mergeRes = await mergePendingTables(
      db,
      [order10.txId, order11.txId],
      'Meja 10 (Gabungan)'
    );
    // Merged subtotal = 23.000 + 25.000 = 48.000
    assert.strictEqual(mergeRes.newSubtotal, 48000);

    // 4. Add additional order to merged Table 10: 2x Kopi Jos Arang Membara (id: 12, 7k)
    const addRes = await addAdditionalItemsToPendingOrder(db, order10.txId, [
      { menu_id: 12, name: 'Kopi Jos Arang Membara', price: 7000, qty: 2 },
    ]);
    // New total = 48.000 + 14.000 = 62.000
    assert.strictEqual(addRes.newTotal, 62000);

    // 5. Checkout merged Table 10 with QRIS
    const checkoutRes = await checkout(db, {
      pendingTxId: order10.txId,
      businessDate,
      tableNumber: 'Meja 10 (Gabungan)',
      paymentMethod: 'qris',
      paymentAmount: 62000,
    });

    assert.strictEqual(checkoutRes.total, 62000);
    assert.strictEqual(checkoutRes.paymentMethod, 'qris');
    assert.strictEqual(checkoutRes.change, 0);

    // 6. Verification: Transaction status is completed in database
    const completedTx = await db.getFirstAsync<{ status: string; payment_method: string; total: number }>(
      'SELECT status, payment_method, total FROM transactions WHERE id = ?',
      [order10.txId]
    );
    assert.strictEqual(completedTx?.status, 'completed');
    assert.strictEqual(completedTx?.payment_method, 'qris');
    assert.strictEqual(completedTx?.total, 62000);

    // 7. Verification: Since payment was QRIS, cash_ledger must NOT have a cash sale entry
    const cashLedgerSales = await db.getAllAsync(
      `SELECT * FROM cash_ledger WHERE category = 'penjualan_tunai'`
    );
    assert.strictEqual(cashLedgerSales.length, 0, 'Non-cash checkout must NOT insert into cash_ledger');

    // 8. Verification: Financial summary registers grossSales of 62.000 accurately
    const { summary } = await loadFinancialSummary(db, '2026-11');
    assert.strictEqual(summary.totalGrossSales, 62000, 'Gross sales must reflect the 62.000 QRIS transaction');
    assert.strictEqual(summary.totalTxCount, 1, 'Only completed order 10 counts as completed transaction');
  });

  test('T3.2 - Cross-Feature: Hold order -> kitchen ticket -> additional order -> delta kitchen ticket', async () => {
    // Step A: Hold initial order for Table 07
    const initialItems: PrintOrderItem[] = [
      { name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2, subtotal: 10000, is_additional: 0 },
      { name: 'Wedang Uwuh Rempah', price: 7000, qty: 2, subtotal: 14000, is_additional: 0 },
      { name: 'Sate Kulit Ayam', price: 3500, qty: 4, subtotal: 14000, is_additional: 0 },
    ];

    const kitchenTicketLines = formatKitchenTicketLines({
      invoiceNumber: 'INV-071126-007',
      tableNumber: 'Meja 07',
      dateTimeString: '07/11/2026 18:45:00',
      items: initialItems,
    });
    const kitchenTicketText = kitchenTicketLines.join('\n');

    // Verify initial kitchen ticket contents
    assert.match(kitchenTicketText, /\*\*\* TIKET DAPUR \*\*\*/);
    assert.match(kitchenTicketText, /MEJA: Meja 07/);
    assert.match(kitchenTicketText, /\[ x2 \] Nasi Kucing Sambal Teri/);
    assert.match(kitchenTicketText, /\[ x2 \] Wedang Uwuh Rempah/);
    assert.match(kitchenTicketText, /\[ x4 \] Sate Kulit Ayam/);
    assert.match(kitchenTicketText, /Segera siapkan & sajikan ke meja!/);
    // Must NOT contain price or rupiah symbols
    assert.doesNotMatch(kitchenTicketText, /Rp/, 'Kitchen ticket must NEVER contain price/Rupiah symbol');
    assert.doesNotMatch(kitchenTicketText, /14\.000/, 'Kitchen ticket must NEVER contain subtotal');

    // Step B: Additional items ordered on Table 07
    const additionalItems: PrintOrderItem[] = [
      { name: 'Jadah Bakar Manis Gurih', price: 4000, qty: 2, subtotal: 8000, is_additional: 1 },
    ];

    const deltaTicketLines = formatKitchenAdditionalTicketLines({
      invoiceNumber: 'INV-071126-007',
      tableNumber: 'Meja 07',
      dateTimeString: '07/11/2026 19:15:00',
      additionalItems,
    });
    const deltaTicketText = deltaTicketLines.join('\n');

    // Verify delta ticket contents
    assert.match(deltaTicketText, /\*\*\* PESANAN TAMBAHAN \*\*\*/);
    assert.match(deltaTicketText, /MEJA: Meja 07 \(SAMBUNGAN\)/);
    assert.match(deltaTicketText, /\[ \+2 \] Jadah Bakar Manis Gurih \(BARU\)/);
    assert.match(deltaTicketText, /Pesanan tambahan meja yang sedang makan!/);

    // Delta ticket MUST NOT repeat initial items
    assert.doesNotMatch(deltaTicketText, /Nasi Kucing/, 'Delta ticket must NOT repeat initial items');
    assert.doesNotMatch(deltaTicketText, /Wedang Uwuh/, 'Delta ticket must NOT repeat initial items');

    // Step C: Customer requests bill -> Format Temporary Bill (Tagihan Sementara)
    const tempBillLines = formatTemporaryBillReceiptLines({
      invoiceNumber: 'INV-071126-007',
      businessDate: '2026-11-07',
      dateTimeString: '07/11/2026 19:30:00',
      tableNumber: 'Meja 07',
      customerName: 'Customer UMUM',
      items: [
        ...initialItems,
        ...additionalItems,
      ],
      subtotal: 46000,
      total: 46000,
      paymentMethod: 'tagihan_sementara',
      paymentAmount: 0,
      changeAmount: 0,
    });
    const tempBillText = tempBillLines.join('\n');

    assert.match(tempBillText, /\*\*\* TAGIHAN SEMENTARA \(BUKAN BUKTI BAYAR\) \*\*\*/);
    assert.match(tempBillText, /Meja 07/);
    assert.match(tempBillText, /BELUM LUNAS/);
    assert.match(tempBillText, /TOTAL TAGIHAN/);
    assert.match(tempBillText, /BUKAN BUKTI PEMBAYARAN SAH/);
    assert.match(tempBillText, /46\.000/);
  });

  test('T3.3 - Cross-Feature: Stock tracking decrement across table merge and checkout', async () => {
    // 1. Enable stock tracking on Wedang Jahe (id: 11) with stock = 20
    await db.runAsync(`UPDATE menus SET track_stock = 1, stock = 20 WHERE id = 11`);

    // 2. Table A orders 4x Wedang Jahe
    const orderA = await createPendingOrder(db, {
      tableNumber: 'Meja A',
      items: [{ menu_id: 11, name: 'Wedang Jahe Geprek', price: 6000, qty: 4 }],
    });

    // 3. Table B orders 6x Wedang Jahe
    const orderB = await createPendingOrder(db, {
      tableNumber: 'Meja B',
      items: [{ menu_id: 11, name: 'Wedang Jahe Geprek', price: 6000, qty: 6 }],
    });

    // Stock should NOT be deducted while still pending
    const stockPending = await db.getFirstAsync<{ stock: number }>('SELECT stock FROM menus WHERE id = 11');
    assert.strictEqual(stockPending?.stock, 20, 'Stock must not be deducted while orders are pending');

    // 4. Merge Table A and Table B (total Wedang Jahe = 10x)
    await mergePendingTables(db, [orderA.txId, orderB.txId], 'Meja AB');

    // 5. Checkout merged order
    await checkout(db, {
      pendingTxId: orderA.txId,
      tableNumber: 'Meja AB',
      paymentMethod: 'tunai',
      paymentAmount: 60000,
    });

    // 6. Stock must be decremented by exactly 10 (20 - 10 = 10)
    const stockAfter = await db.getFirstAsync<{ stock: number }>('SELECT stock FROM menus WHERE id = 11');
    assert.strictEqual(stockAfter?.stock, 10, 'Stock must be decremented by exactly 10 upon checkout');
  });
});
