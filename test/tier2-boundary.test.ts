import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import {
  createPendingOrder,
  addAdditionalItemsToPendingOrder,
  mergePendingTables,
  checkout,
} from './helpers/transactionEngine.js';

describe('Tier 2: Boundary & Corner Cases Suites', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  test('T2.1 - Table Merge: Deduplication of identical menu items and discount preservation', async () => {
    // Table 1 has: 2x Nasi Kucing Sambal Teri (id: 1, 5k), 3x Sate Usus Bakar (id: 4, 3k). Discount: 2000
    const order1 = await createPendingOrder(db, {
      tableNumber: 'Meja 01',
      customerName: 'Meja 1 Customer',
      discountAmount: 2000,
      items: [
        { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2 },
        { menu_id: 4, name: 'Sate Usus Bakar', price: 3000, qty: 3 },
      ],
    });

    // Table 2 has: 4x Nasi Kucing Sambal Teri (id: 1, 5k), 2x Wedang Jahe Geprek (id: 11, 6k). Discount: 3000
    const order2 = await createPendingOrder(db, {
      tableNumber: 'Meja 02',
      customerName: 'Meja 2 Customer',
      discountAmount: 3000,
      items: [
        { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 4 },
        { menu_id: 11, name: 'Wedang Jahe Geprek', price: 6000, qty: 2 },
      ],
    });

    // Merge Meja 01 and Meja 02 into target table "Meja 01 (Gabungan)"
    const mergeResult = await mergePendingTables(
      db,
      [order1.txId, order2.txId],
      'Meja 01 (Gabungan)'
    );

    // Verification 1: Primary ID is order1.txId
    assert.strictEqual(mergeResult.primaryId, order1.txId);

    // Verification 2: Deduplication: Nasi Kucing (id: 1) should be consolidated into 1 row with qty = 6 (2 + 4)
    const mergedItems = await db.getAllAsync<{
      menu_id: number;
      menu_name: string;
      price: number;
      qty: number;
      subtotal: number;
    }>(
      `SELECT menu_id, menu_name, price, qty, subtotal FROM transaction_items WHERE transaction_id = ? ORDER BY menu_id ASC`,
      [order1.txId]
    );

    assert.strictEqual(mergedItems.length, 3, 'Should have exactly 3 consolidated items (Nasi Kucing, Sate Usus, Wedang Jahe), not 4 duplicate rows');

    const nasiKucing = mergedItems.find((i) => i.menu_id === 1);
    assert.ok(nasiKucing);
    assert.strictEqual(nasiKucing.qty, 6, 'Nasi Kucing quantity must be summed: 2 + 4 = 6');
    assert.strictEqual(nasiKucing.subtotal, 30000, 'Nasi Kucing subtotal must be 6 * 5000 = 30.000');

    const sateUsus = mergedItems.find((i) => i.menu_id === 4);
    assert.ok(sateUsus);
    assert.strictEqual(sateUsus.qty, 3, 'Sate Usus quantity must be preserved: 3');
    assert.strictEqual(sateUsus.subtotal, 9000, 'Sate Usus subtotal must be 3 * 3000 = 9.000');

    const wedangJahe = mergedItems.find((i) => i.menu_id === 11);
    assert.ok(wedangJahe);
    assert.strictEqual(wedangJahe.qty, 2, 'Wedang Jahe quantity must be preserved: 2');
    assert.strictEqual(wedangJahe.subtotal, 12000, 'Wedang Jahe subtotal must be 2 * 6000 = 12.000');

    // Verification 3: Total Subtotal = 30k + 9k + 12k = 51.000
    assert.strictEqual(mergeResult.newSubtotal, 51000);

    // Verification 4: Total Discount preserved = 2000 + 3000 = 5000
    assert.strictEqual(mergeResult.totalDiscount, 5000, 'Discounts from all source tables must be summed and preserved');

    // Verification 5: New Total = 51000 - 5000 = 46000
    assert.strictEqual(mergeResult.newTotal, 46000);

    // Verification 6: Order 2 marked as 'merged' with merged_into_tx_id
    const order2Row = await db.getFirstAsync<{ status: string; merged_into_tx_id: number }>(
      'SELECT status, merged_into_tx_id FROM transactions WHERE id = ?',
      [order2.txId]
    );
    assert.strictEqual(order2Row?.status, 'merged', 'Source order 2 must have status = merged');
    assert.strictEqual(order2Row?.merged_into_tx_id, order1.txId, 'merged_into_tx_id must point to primary txId');
  });

  test('T2.2 - Table Merge: PB1 tax recalculation and preservation on merged orders', async () => {
    // Table A: subtotal 40.000, 10% tax = 4.000, total = 44.000
    const orderA = await createPendingOrder(db, {
      tableNumber: 'Meja A',
      taxEnabled: true,
      taxRate: 10,
      items: [{ menu_id: 11, name: 'Wedang Jahe Geprek', price: 6000, qty: 5 }, { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2 }],
    });

    // Table B: subtotal 60.000, 10% tax = 6.000, total = 66.000
    const orderB = await createPendingOrder(db, {
      tableNumber: 'Meja B',
      taxEnabled: true,
      taxRate: 10,
      items: [{ menu_id: 12, name: 'Kopi Jos Arang Membara', price: 7000, qty: 6 }, { menu_id: 4, name: 'Sate Usus Bakar', price: 3000, qty: 6 }],
    });

    // Merge Table A and B with PB1 tax enabled (10%)
    const mergeRes = await mergePendingTables(db, [orderA.txId, orderB.txId], 'Meja AB', true, 10);

    // Total subtotal: 40000 + 60000 = 100.000
    assert.strictEqual(mergeRes.newSubtotal, 100000);

    // Tax should be accurately recalculated on merged subtotal: 10% * 100.000 = 10.000
    assert.strictEqual(mergeRes.newTaxAmount, 10000, 'Tax must be recalculated accurately on new subtotal');

    // Total: 100.000 + 10.000 = 110.000
    assert.strictEqual(mergeRes.newTotal, 110000, 'Total must include recalculated tax amount');

    // Verify stored transaction in database
    const savedTx = await db.getFirstAsync<{ subtotal: number; tax_amount: number; total: number }>(
      'SELECT subtotal, tax_amount, total FROM transactions WHERE id = ?',
      [orderA.txId]
    );
    assert.strictEqual(savedTx?.subtotal, 100000);
    assert.strictEqual(savedTx?.tax_amount, 10000);
    assert.strictEqual(savedTx?.total, 110000);
  });

  test('T2.3 - Boundary: 0 items, extreme discount clamp, tax calculations', async () => {
    // 1. Boundary: Max discount exceeding subtotal + tax must clamp total to 0 (no negative totals)
    const resultMaxDiscount = await checkout(db, {
      tableNumber: 'Meja 09',
      items: [{ menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2 }], // subtotal = 10.000
      discountAmount: 25000, // discount exceeds subtotal
      paymentMethod: 'tunai',
      paymentAmount: 0,
    });

    assert.strictEqual(resultMaxDiscount.subtotal, 10000);
    assert.strictEqual(resultMaxDiscount.discountAmount, 25000);
    assert.strictEqual(resultMaxDiscount.total, 0, 'Total must clamp to 0 and NEVER be negative');
    assert.strictEqual(resultMaxDiscount.change, 0);

    // 2. Boundary: Tax rounding precision
    const resultTaxRounding = await checkout(db, {
      tableNumber: 'Meja 10',
      items: [
        { menu_id: 12, name: 'Kopi Jos Arang Membara', price: 7000, qty: 1 },
        { menu_id: 6, name: 'Sate Kulit Ayam', price: 3500, qty: 1 },
      ], // subtotal = 10.500
      taxEnabled: true,
      taxRate: 10, // 10% of 10.500 = 1050
      paymentMethod: 'qris',
      paymentAmount: 11550,
    });

    assert.strictEqual(resultTaxRounding.subtotal, 10500);
    assert.strictEqual(resultTaxRounding.taxAmount, 1050, 'Tax must be Math.round((10500 * 10) / 100) = 1050');
    assert.strictEqual(resultTaxRounding.total, 11550, 'Total must be 10500 + 1050 = 11550');
  });

  test('T2.4 - Boundary: Delta additional orders (is_additional = 1) on pending table', async () => {
    // 1. Initial pending order: Table 03 with 2 items (is_additional = 0)
    const initialOrder = await createPendingOrder(db, {
      tableNumber: 'Meja 03',
      items: [
        { menu_id: 1, name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2, is_additional: 0 },
        { menu_id: 13, name: 'Teh Kampul Solo', price: 5000, qty: 2, is_additional: 0 },
      ],
    });

    // 2. Customer adds additional order (sambungan): 2x Sate Usus Bakar
    const addResult = await addAdditionalItemsToPendingOrder(db, initialOrder.txId, [
      { menu_id: 4, name: 'Sate Usus Bakar', price: 3000, qty: 2 },
    ]);

    assert.strictEqual(addResult.addedCount, 1);
    assert.strictEqual(addResult.newTotal, 20000 + 6000, 'New total must be 26.000');

    // 3. Inspect items in DB: baseline items must have is_additional = 0, delta items must have is_additional = 1
    const allItems = await db.getAllAsync<{
      menu_id: number;
      menu_name: string;
      qty: number;
      is_additional: number;
    }>(
      `SELECT menu_id, menu_name, qty, is_additional FROM transaction_items WHERE transaction_id = ? ORDER BY id ASC`,
      [initialOrder.txId]
    );

    assert.strictEqual(allItems.length, 3);
    assert.strictEqual(allItems[0].is_additional, 0, 'Initial Nasi Kucing must have is_additional = 0');
    assert.strictEqual(allItems[1].is_additional, 0, 'Initial Teh Kampul must have is_additional = 0');
    assert.strictEqual(allItems[2].is_additional, 1, 'Delta Sate Usus must have is_additional = 1');

    // Delta items can be isolated for kitchen additional ticket
    const deltaItems = allItems.filter((i) => i.is_additional === 1);
    assert.strictEqual(deltaItems.length, 1);
    assert.strictEqual(deltaItems[0].menu_name, 'Sate Usus Bakar');
  });
});
