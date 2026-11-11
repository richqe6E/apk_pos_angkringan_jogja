import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import { formatCustomerReceiptLines, formatKitchenTicketLines, formatKitchenAdditionalTicketLines } from './helpers/receiptFormatter.js';

describe('Tier 8: Item Notes, Split Payment (QRIS+Tunai) & Top Selling Menu Report', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // T8.1: Item Notes (Keterangan Produk per Item)
  // =========================================================================
  test('T8.1.1 - Transaction items preserve custom notes across persistence and queries', async () => {
    // 1. Insert transaction with items containing custom notes
    await db.runAsync(
      `INSERT INTO transactions (id, invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES (1, 'INV-20261111-001', '2026-11-11', 'Meja 01', 35000, 35000, 'tunai', 50000, 'completed')`
    );

    await db.runAsync(
      `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, notes)
       VALUES 
       (1, 1, 'Es Teh Manis', 5000, 2, 10000, 'Es sedikit, manis sedang'),
       (1, 2, 'Nasi Kucing Teri', 6000, 3, 18000, 'Bungkus / Takeaway'),
       (1, 3, 'Sate Telur Puyuh', 7000, 1, 7000, '')`
    );

    // 2. Query items
    const items = await db.getAllAsync<{ menu_name: string; notes: string; qty: number }>(
      'SELECT menu_name, notes, qty FROM transaction_items WHERE transaction_id = 1 ORDER BY id ASC'
    );

    assert.equal(items.length, 3);
    assert.equal(items[0].notes, 'Es sedikit, manis sedang');
    assert.equal(items[1].notes, 'Bungkus / Takeaway');
    assert.equal(items[2].notes, '');
  });

  test('T8.1.2 - Thermal receipt & kitchen ticket formatting renders item notes accurately', () => {
    const mockReceipt = {
      storeName: 'ANGKRINGAN JOGJA',
      invoiceNumber: 'INV-20261111-002',
      businessDate: '2026-11-11',
      dateTimeString: '11/11/2026 19:30',
      tableNumber: 'Meja 05',
      customerName: 'Mas Budi',
      cashierName: 'Rian',
      items: [
        { name: 'Kopi Jahe Susu', price: 10000, qty: 1, subtotal: 10000, notes: 'Panas, jahe lebih terasa' },
        { name: 'Sate Kulit Bakar', price: 4000, qty: 3, subtotal: 12000, notes: 'Bakar kering pedas manis' },
      ],
      subtotal: 22000,
      total: 22000,
      paymentMethod: 'tunai',
      paymentAmount: 50000,
      changeAmount: 28000,
    };

    // 1. Customer Receipt includes item notes
    const receiptLines = formatCustomerReceiptLines(mockReceipt);
    const receiptText = receiptLines.join('\n');
    assert.ok(receiptText.includes('(Panas, jahe lebih terasa)'));
    assert.ok(receiptText.includes('(Bakar kering pedas manis)'));

    // 2. Kitchen Ticket formats * Ket: <notes>
    const kitchenLines = formatKitchenTicketLines(mockReceipt);
    const kitchenText = kitchenLines.join('\n');
    assert.ok(kitchenText.includes('* Ket: Panas, jahe lebih terasa'));
    assert.ok(kitchenText.includes('* Ket: Bakar kering pedas manis'));

    // 3. Kitchen Additional Ticket formats * Ket: <notes>
    const additionalTicketLines = formatKitchenAdditionalTicketLines({
      invoiceNumber: 'INV-20261111-002',
      tableNumber: 'Meja 05',
      dateTimeString: '11/11/2026 19:45',
      additionalItems: [
        { name: 'Jahe Rempah', price: 10000, qty: 2, subtotal: 20000, notes: 'Tanpa gula' },
      ],
    });
    const addText = additionalTicketLines.join('\n');
    assert.ok(addText.includes('[ +2 ] Jahe Rempah (BARU)'));
    assert.ok(addText.includes('* Ket: Tanpa gula'));
  });

  // =========================================================================
  // T8.2: Split Payment (Campur Kas Fisik / QRIS + Tunai)
  // =========================================================================
  test('T8.2.1 - Split payment saves cash_received and qris_received and reconciles cash ledger', async () => {
    const totalBill = 75000;
    const splitCash = 35000;
    const splitQris = 40000;

    // 1. Insert transaction with split payment
    await db.runAsync(
      `INSERT INTO transactions (
         id, invoice_number, business_date, table_number, subtotal, total, 
         payment_method, payment_amount, change_amount, status, cash_received, qris_received
       ) VALUES (
         2, 'INV-20261111-SPLIT', '2026-11-11', 'Meja 08', 75000, 75000,
         'split', 75000, 0, 'completed', ?, ?
       )`,
      [splitCash, splitQris]
    );

    // 2. Only the CASH portion must be inserted into cash_ledger for physical drawer balance
    await db.runAsync(
      `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
       VALUES ('2026-11-11', 'income', 1, 'penjualan_tunai', ?, 'Split Payment Tunai (INV-20261111-SPLIT)')`,
      [splitCash]
    );

    // 3. Verify transactions record
    const tx = await db.getFirstAsync<{ payment_method: string; cash_received: number; qris_received: number; total: number }>(
      'SELECT payment_method, cash_received, qris_received, total FROM transactions WHERE id = 2'
    );
    assert.ok(tx);
    assert.equal(tx.payment_method, 'split');
    assert.equal(tx.cash_received, 35000);
    assert.equal(tx.qris_received, 40000);
    assert.equal(tx.cash_received + tx.qris_received, tx.total);

    // 4. Verify physical cash ledger: ONLY 35.000 recorded in cash drawer
    const ledger = await db.getFirstAsync<{ total_cash_in: number }>(
      "SELECT SUM(amount) as total_cash_in FROM cash_ledger WHERE business_date = '2026-11-11' AND category = 'penjualan_tunai'"
    );
    assert.equal(ledger?.total_cash_in, 35000);
  });

  test('T8.2.2 - Receipt formatter correctly prints split payment breakdown', () => {
    const splitReceipt = {
      storeName: 'ANGKRINGAN JOGJA',
      invoiceNumber: 'INV-SPLIT-99',
      businessDate: '2026-11-11',
      dateTimeString: '11/11/2026 20:15',
      tableNumber: 'Meja 02',
      customerName: 'Rian Kurnia',
      cashierName: 'Siti',
      items: [
        { name: 'Nasi Bakar Ayam', price: 15000, qty: 2, subtotal: 30000 },
        { name: 'Wedang Ronde', price: 10000, qty: 2, subtotal: 20000 },
      ],
      subtotal: 50000,
      total: 50000,
      paymentMethod: 'split',
      paymentAmount: 50000,
      changeAmount: 0,
      cashReceived: 20000,
      qrisReceived: 30000,
    };

    const lines = formatCustomerReceiptLines(splitReceipt);
    const receiptText = lines.join('\n');

    assert.ok(receiptText.includes('Bayar (TUNAI)'));
    assert.ok(receiptText.includes('20.000'));
    assert.ok(receiptText.includes('Bayar (QRIS)'));
    assert.ok(receiptText.includes('30.000'));
  });

  // =========================================================================
  // T8.3: Top Selling Menu Report (Laporan Menu Terlaris)
  // =========================================================================
  test('T8.3.1 - Top selling query aggregates quantity and omzet accurately across categories', async () => {
    // 1. Seed multiple completed transactions across different days
    await db.runAsync(
      `INSERT INTO transactions (id, invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
       VALUES 
       (101, 'INV-101', '2026-11-10', 'Meja 01', 50000, 50000, 'tunai', 50000, 'completed'),
       (102, 'INV-102', '2026-11-11', 'Meja 02', 65000, 65000, 'qris', 65000, 'completed'),
       (103, 'INV-103', '2026-11-11', 'Meja 03', 25000, 25000, 'tunai', 25000, 'completed'),
       -- Pending transaction: MUST BE EXCLUDED
       (104, 'INV-104', '2026-11-11', 'Meja 04', 100000, 100000, 'tunai', 0, 'pending')`
    );

    // 2. Seed transaction items using seeded menus (menu 13 = Teh Kampul Solo, 1 = Nasi Kucing Sambal Teri, 5 = Sate Telur Puyuh, 11 = Wedang Jahe Geprek)
    await db.runAsync(
      `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal)
       VALUES 
       -- TX 101 (2026-11-10)
       (101, 13, 'Teh Kampul Solo', 5000, 4, 20000),
       (101, 1, 'Nasi Kucing Sambal Teri', 5000, 5, 25000),

       -- TX 102 (2026-11-11)
       (102, 13, 'Teh Kampul Solo', 5000, 6, 30000),
       (102, 5, 'Sate Telur Puyuh', 4000, 5, 20000),

       -- TX 103 (2026-11-11)
       (103, 11, 'Wedang Jahe Geprek', 6000, 2, 12000),
       (103, 13, 'Teh Kampul Solo', 5000, 1, 5000),
       (103, 1, 'Nasi Kucing Sambal Teri', 5000, 1, 5000),

       -- TX 104 (Pending - should be ignored)
       (104, 5, 'Sate Telur Puyuh', 4000, 10, 40000)`
    );

    // 3. Query for date 2026-11-11 sorted by total_qty DESC
    const rowsToday = await db.getAllAsync<{
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
       WHERE t.status = 'completed' AND t.business_date = '2026-11-11'
       GROUP BY ti.menu_name
       ORDER BY total_qty DESC, total_omzet DESC`
    );

    // TX 102 (6 Teh Kampul, 5 Sate Telur) + TX 103 (1 Teh Kampul, 1 Nasi Kucing, 2 Wedang Jahe)
    // Teh Kampul = 7 qty, Rp 35.000 (Category: Wedangan / Minuman)
    // Sate Telur = 5 qty, Rp 20.000 (Category: Sate & Bakaran, pending 10 is excluded!)
    // Wedang Jahe = 2 qty, Rp 12.000
    // Nasi Kucing = 1 qty, Rp 5.000
    assert.equal(rowsToday.length, 4);
    assert.equal(rowsToday[0].menu_name, 'Teh Kampul Solo');
    assert.equal(rowsToday[0].total_qty, 7);
    assert.equal(rowsToday[0].total_omzet, 35000);
    assert.equal(rowsToday[0].category_name, 'Wedangan / Minuman');

    assert.equal(rowsToday[1].menu_name, 'Sate Telur Puyuh');
    assert.equal(rowsToday[1].total_qty, 5);
    assert.equal(rowsToday[1].total_omzet, 20000);
    assert.equal(rowsToday[1].category_name, 'Sate & Bakaran');

    assert.equal(rowsToday[2].menu_name, 'Wedang Jahe Geprek');
    assert.equal(rowsToday[2].total_qty, 2);
    assert.equal(rowsToday[2].total_omzet, 12000);

    assert.equal(rowsToday[3].menu_name, 'Nasi Kucing Sambal Teri');
    assert.equal(rowsToday[3].total_qty, 1);
    assert.equal(rowsToday[3].total_omzet, 5000);

    // 4. Query all dates sorted by total_omzet DESC
    const rowsAllByOmzet = await db.getAllAsync<{
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
       ORDER BY total_omzet DESC, total_qty DESC`
    );

    // All dates:
    // Teh Kampul: 4 + 6 + 1 = 11 qty, Omzet: 20k + 30k + 5k = 55.000
    // Nasi Kucing: 5 + 1 = 6 qty, Omzet: 25k + 5k = 30.000
    // Sate Telur: 5 qty, Omzet: 20.000
    // Wedang Jahe: 2 qty, Omzet: 12.000
    assert.equal(rowsAllByOmzet[0].menu_name, 'Teh Kampul Solo');
    assert.equal(rowsAllByOmzet[0].total_omzet, 55000);

    assert.equal(rowsAllByOmzet[1].menu_name, 'Nasi Kucing Sambal Teri');
    assert.equal(rowsAllByOmzet[1].total_omzet, 30000);

    assert.equal(rowsAllByOmzet[2].menu_name, 'Sate Telur Puyuh');
    assert.equal(rowsAllByOmzet[2].total_omzet, 20000);

    assert.equal(rowsAllByOmzet[3].menu_name, 'Wedang Jahe Geprek');
    assert.equal(rowsAllByOmzet[3].total_omzet, 12000);
  });
});
