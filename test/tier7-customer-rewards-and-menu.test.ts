import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import { DEFAULT_CATEGORIES_MD, DEFAULT_MENUS_MD } from './helpers/defaultMenuData.js';

describe('Tier 7: Customer Reward Claims, Favorite Foods & Menu.md Seeding', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // T7.1: Menu.md Dataset Integrity & Database Seeding
  // =========================================================================
  test('T7.1 - Menu.md dataset completeness and database insertion integrity', async () => {
    // 1. Verifikasi dataset memuat seluruh 8 kategori dari menu.md
    assert.equal(DEFAULT_CATEGORIES_MD.length, 8, 'Harus ada 8 kategori dari menu.md');
    const categoryNames = DEFAULT_CATEGORIES_MD.map((c) => c.name);
    assert.ok(categoryNames.includes('Minuman Saset'));
    assert.ok(categoryNames.includes('Jahe-Jahe'));
    assert.ok(categoryNames.includes('Coffee, Tea & Susu'));
    assert.ok(categoryNames.includes('Mocktail'));
    assert.ok(categoryNames.includes('Shisa'));
    assert.ok(categoryNames.includes('Makanan Berat'));
    assert.ok(categoryNames.includes('Tusukan'));
    assert.ok(categoryNames.includes('Snack'));

    // 2. Verifikasi dataset memuat 106 item menu
    assert.equal(DEFAULT_MENUS_MD.length, 106, 'Total item menu bawaan menu.md harus 106');

    // 3. Verifikasi harga spesifik sesuai menu.md
    const popMie = DEFAULT_MENUS_MD.find((m) => m.name === 'Pop Mie');
    assert.ok(popMie && popMie.price === 8000);

    const bebekKremes = DEFAULT_MENUS_MD.find((m) => m.name === 'Bebek Kremes');
    assert.ok(bebekKremes && bebekKremes.price === 35000);

    const bongBesar = DEFAULT_MENUS_MD.find((m) => m.name === 'Bong Besar');
    assert.ok(bongBesar && bongBesar.price === 40000);

    const jaheOri = DEFAULT_MENUS_MD.find((m) => m.name === 'Jahe Original');
    assert.ok(jaheOri && jaheOri.price === 10000);

    const esTeh = DEFAULT_MENUS_MD.find((m) => m.name === 'Es Teh');
    assert.ok(esTeh && esTeh.price === 5000);

    // 4. Masukkan seluruh kategori & menu ke database uji
    for (const cat of DEFAULT_CATEGORIES_MD) {
      await db.runAsync('INSERT OR IGNORE INTO categories (name, icon) VALUES (?, ?)', [
        cat.name,
        cat.icon,
      ]);
    }

    const catRows = await db.getAllAsync<{ id: number; name: string }>('SELECT id, name FROM categories');
    const catMap = new Map<string, number>();
    (catRows || []).forEach((c) => catMap.set(c.name, c.id));

    for (const m of DEFAULT_MENUS_MD) {
      const catId = catMap.get(m.category) || null;
      await db.runAsync(
        `INSERT INTO menus (name, price, category_id, track_stock, stock, is_active)
         SELECT ?, ?, ?, 0, 0, 1
         WHERE NOT EXISTS (SELECT 1 FROM menus WHERE name = ?)`,
        [m.name, m.price, catId, m.name]
      );
    }

    // 5. Pastikan menu telah tersimpan di SQLite
    const insertedPopMie = await db.getFirstAsync<{ id: number; price: number }>(
      "SELECT id, price FROM menus WHERE name = 'Pop Mie'"
    );
    assert.ok(insertedPopMie, 'Pop Mie harus tersimpan dalam tabel menus');
    assert.equal(insertedPopMie.price, 8000);

    const insertedBebek = await db.getFirstAsync<{ id: number; price: number }>(
      "SELECT id, price FROM menus WHERE name = 'Bebek Kremes'"
    );
    assert.ok(insertedBebek);
    assert.equal(insertedBebek.price, 35000);
  });

  // =========================================================================
  // T7.2: Customer Top Favorite Item Calculation
  // =========================================================================
  test('T7.2 - Identifikasi makanan paling sering dibeli per customer', async () => {
    // 1. Buat customer baru
    await db.runAsync("INSERT INTO customers (name, phone, total_spent, total_visits) VALUES ('Budi Santoso', '0812345678', 150000, 3)");
    const cust = await db.getFirstAsync<{ id: number }>("SELECT id FROM customers WHERE name = 'Budi Santoso'");
    assert.ok(cust);

    // 2. Buat transaksi selesai dengan item detail
    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, customer_id, customer_name, subtotal, total, payment_method, payment_amount, status)
       VALUES ('INV-FAV-01', '2026-11-08', 'Meja 01', ?, 'Budi Santoso', 50000, 50000, 'tunai', 50000, 'completed')`,
      [cust.id]
    );
    const tx1 = await db.getFirstAsync<{ id: number }>("SELECT id FROM transactions WHERE invoice_number = 'INV-FAV-01'");
    assert.ok(tx1);

    // Budi beli 4x Nasi Kucing Sambal Teri dan 1x Es Teh
    await db.runAsync(
      `INSERT INTO transaction_items (transaction_id, menu_name, price, qty, subtotal, is_additional)
       VALUES (?, 'Nasi Kucing Sambal Teri', 5000, 4, 20000, 0)`,
      [tx1.id]
    );
    await db.runAsync(
      `INSERT INTO transaction_items (transaction_id, menu_name, price, qty, subtotal, is_additional)
       VALUES (?, 'Es Teh', 5000, 1, 5000, 0)`,
      [tx1.id]
    );

    // Transaksi kedua: Budi beli lagi 3x Nasi Kucing Sambal Teri dan 2x Sate Usus Bakar
    await db.runAsync(
      `INSERT INTO transactions (invoice_number, business_date, table_number, customer_id, customer_name, subtotal, total, payment_method, payment_amount, status)
       VALUES ('INV-FAV-02', '2026-11-08', 'Meja 02', ?, 'Budi Santoso', 21000, 21000, 'tunai', 21000, 'completed')`,
      [cust.id]
    );
    const tx2 = await db.getFirstAsync<{ id: number }>("SELECT id FROM transactions WHERE invoice_number = 'INV-FAV-02'");
    assert.ok(tx2);

    await db.runAsync(
      `INSERT INTO transaction_items (transaction_id, menu_name, price, qty, subtotal, is_additional)
       VALUES (?, 'Nasi Kucing Sambal Teri', 5000, 3, 15000, 0)`,
      [tx2.id]
    );
    await db.runAsync(
      `INSERT INTO transaction_items (transaction_id, menu_name, price, qty, subtotal, is_additional)
       VALUES (?, 'Sate Usus Bakar', 3000, 2, 6000, 0)`,
      [tx2.id]
    );

    // 3. Query top favorite item menggunakan window function
    const topFavRows = await db.getAllAsync<{ customer_id: number; menu_name: string; total_qty: number }>(
      `SELECT customer_id, menu_name, total_qty
       FROM (
         SELECT t.customer_id, ti.menu_name, SUM(ti.qty) AS total_qty,
                ROW_NUMBER() OVER (PARTITION BY t.customer_id ORDER BY SUM(ti.qty) DESC, ti.menu_name ASC) as rn
         FROM transaction_items ti
         JOIN transactions t ON ti.transaction_id = t.id
         WHERE t.status = 'completed' AND t.customer_id = ?
         GROUP BY t.customer_id, ti.menu_name
       )
       WHERE rn = 1`,
      [cust.id]
    );

    assert.equal(topFavRows.length, 1);
    assert.equal(topFavRows[0].menu_name, 'Nasi Kucing Sambal Teri');
    assert.equal(topFavRows[0].total_qty, 7, 'Total kuantiti pesanan favorit Budi harus 4 + 3 = 7 porsi');
  });

  // =========================================================================
  // T7.3: Customer Reward Claim Persistence & Cascade Safety
  // =========================================================================
  test('T7.3 - Klaim reward, pencatatan timestamp, status klaim dan cascade deletion', async () => {
    // 1. Buat customer dengan total belanja memenuhi Tier 1 (min_spend 300.000)
    await db.runAsync("INSERT INTO customers (name, phone, total_spent, total_visits) VALUES ('Siti Rahma', '0898765432', 350000, 5)");
    const cust = await db.getFirstAsync<{ id: number }>("SELECT id FROM customers WHERE name = 'Siti Rahma'");
    assert.ok(cust);

    // 2. Ambil Tier 1
    const tier1 = await db.getFirstAsync<{ id: number; tier_name: string; reward_description: string }>(
      'SELECT id, tier_name, reward_description FROM rewards WHERE id = 1'
    );
    assert.ok(tier1);

    // 3. Klaim Reward
    const claimResult = await db.runAsync(
      `INSERT INTO customer_reward_claims (customer_id, reward_id, tier_name, reward_description, claimed_by, notes)
       VALUES (?, ?, ?, ?, 'Kasir Shift Sore', 'Klaim wedang jahe gratis')`,
      [cust.id, tier1.id, tier1.tier_name, tier1.reward_description]
    );
    assert.ok(claimResult.lastInsertRowId > 0);

    // 4. Verifikasi klaim tersimpan di customer_reward_claims
    const claim = await db.getFirstAsync<{ id: number; customer_id: number; tier_name: string; claimed_by: string; claimed_at: string }>(
      'SELECT id, customer_id, tier_name, claimed_by, claimed_at FROM customer_reward_claims WHERE customer_id = ?',
      [cust.id]
    );
    assert.ok(claim);
    assert.equal(claim.customer_id, cust.id);
    assert.equal(claim.tier_name, tier1.tier_name);
    assert.equal(claim.claimed_by, 'Kasir Shift Sore');
    assert.ok(claim.claimed_at, 'Waktu klaim harus tercatat otomatis');

    // 5. Cek status klaim dari query
    const claims = await db.getAllAsync<{ reward_id: number; tier_name: string }>(
      'SELECT reward_id, tier_name FROM customer_reward_claims WHERE customer_id = ?',
      [cust.id]
    );
    const isClaimed = claims.some((cl) => cl.reward_id === tier1.id || cl.tier_name === tier1.tier_name);
    assert.equal(isClaimed, true, 'Status reward tier 1 harus bernilai sudah diklaim');

    // 6. Uji Cascade Deletion: Saat pelanggan dihapus, riwayat klaim harus terhapus bersih
    await db.runAsync('DELETE FROM customers WHERE id = ?', [cust.id]);
    const remainingClaims = await db.getAllAsync(
      'SELECT id FROM customer_reward_claims WHERE customer_id = ?',
      [cust.id]
    );
    assert.equal(remainingClaims.length, 0, 'Riwayat klaim harus terhapus otomatis saat pelanggan dihapus (ON DELETE CASCADE)');
  });
});
