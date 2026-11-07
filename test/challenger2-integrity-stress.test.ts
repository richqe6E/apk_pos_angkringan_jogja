import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, type TestDatabase } from './helpers/db.js';

describe('Challenger 2: Data Integrity, Seed Protection & Deletion Stress Suite', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // Challenge 1: Menu Deletion Integrity & Foreign Key Safety
  // =========================================================================
  describe('Challenge 1: Menu Deletion Integrity & Foreign Key Safety', () => {
    test('1.1 - Default menu ID 1 soft delete preserves transaction history and isolates catalog', async () => {
      // 1. Verify default menu ID 1 exists and is active
      const menu1 = await db.getFirstAsync<{ id: number; name: string; price: number; is_active: number }>(
        'SELECT id, name, price, is_active FROM menus WHERE id = 1'
      );
      assert.ok(menu1, 'Menu ID 1 must exist by default in seed');
      assert.equal(menu1.name, 'Nasi Kucing Sambal Teri');
      assert.equal(menu1.price, 5000);
      assert.equal(menu1.is_active, 1);

      // 2. Create completed transaction referencing Menu ID 1
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, customer_name, subtotal, total, payment_method, payment_amount, status, cashier_name)
         VALUES ('INV-CH2-001', '2026-11-07', 'Meja 01', 'Budi Santoso', 10000, 10000, 'tunai', 10000, 'completed', 'Rian')`
      );
      const tx1 = await db.getFirstAsync<{ id: number }>('SELECT id FROM transactions WHERE invoice_number = ?', [
        'INV-CH2-001',
      ]);
      assert.ok(tx1);

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
         VALUES (?, 1, 'Nasi Kucing Sambal Teri', 5000, 2, 10000, 0)`,
        [tx1.id]
      );

      // 3. Create pending transaction referencing Menu ID 1
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, customer_name, subtotal, total, payment_method, payment_amount, status, cashier_name)
         VALUES ('INV-CH2-PENDING', '2026-11-07', 'Meja 03', 'Customer UMUM', 5000, 5000, 'tunai', 0, 'pending', 'Rian')`
      );
      const txPending = await db.getFirstAsync<{ id: number }>('SELECT id FROM transactions WHERE invoice_number = ?', [
        'INV-CH2-PENDING',
      ]);
      assert.ok(txPending);

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
         VALUES (?, 1, 'Nasi Kucing Sambal Teri', 5000, 1, 5000, 0)`,
        [txPending.id]
      );

      // 4. Execute soft delete on menu ID 1
      await db.runAsync('UPDATE menus SET is_active = 0 WHERE id = 1');

      // 5. Verify is_active becomes 0 in database
      const menuAfterDelete = await db.getFirstAsync<{ id: number; is_active: number }>(
        'SELECT id, is_active FROM menus WHERE id = 1'
      );
      assert.ok(menuAfterDelete);
      assert.equal(menuAfterDelete.is_active, 0, 'Soft deleted menu must have is_active = 0');

      // 6. Verify deleted menu does not appear in active menu queries
      const activeCatalog = await db.getAllAsync<{ id: number; name: string }>(
        'SELECT id, name FROM menus WHERE is_active = 1 ORDER BY name ASC'
      );
      assert.equal(
        activeCatalog.some((m) => m.id === 1),
        false,
        'Menu ID 1 must be excluded from active menus catalog'
      );

      // 7. Verify existing sales history in transaction_items remains 100% intact without foreign key errors
      const itemsTx1 = await db.getAllAsync<{ menu_id: number; menu_name: string; price: number; qty: number; subtotal: number }>(
        'SELECT menu_id, menu_name, price, qty, subtotal FROM transaction_items WHERE transaction_id = ?',
        [tx1.id]
      );
      assert.equal(itemsTx1.length, 1);
      assert.equal(itemsTx1[0].menu_id, 1);
      assert.equal(itemsTx1[0].menu_name, 'Nasi Kucing Sambal Teri');
      assert.equal(itemsTx1[0].subtotal, 10000);

      const itemsPending = await db.getAllAsync<{ menu_id: number; menu_name: string; qty: number }>(
        'SELECT menu_id, menu_name, qty FROM transaction_items WHERE transaction_id = ?',
        [txPending.id]
      );
      assert.equal(itemsPending.length, 1);
      assert.equal(itemsPending[0].menu_id, 1);
      assert.equal(itemsPending[0].qty, 1);

      // 8. Verify aggregated sales report remains accurate
      const salesAgg = await db.getFirstAsync<{ total_qty: number; total_revenue: number }>(
        `SELECT SUM(ti.qty) as total_qty, SUM(ti.subtotal) as total_revenue
         FROM transaction_items ti
         JOIN transactions t ON ti.transaction_id = t.id
         WHERE ti.menu_id = 1 AND t.status = 'completed'`
      );
      assert.equal(salesAgg?.total_qty, 2);
      assert.equal(salesAgg?.total_revenue, 10000);
    });

    test('1.2 - Bulk soft-deletion of all 16 default menus leaves database clean and allows new menu additions', async () => {
      // Soft-delete all 16 default menus
      const updateResult = await db.runAsync('UPDATE menus SET is_active = 0 WHERE id BETWEEN 1 AND 16');
      assert.equal(updateResult.changes, 16);

      // Active menu count must be zero
      const activeCount = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM menus WHERE is_active = 1'
      );
      assert.equal(activeCount?.count, 0, 'No active menus should remain');

      // Total records in menus table is still 16 (preserved for referential integrity)
      const totalCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM menus');
      assert.equal(totalCount?.count, 16);

      // Owner creates brand new custom menus
      await db.runAsync(
        `INSERT INTO menus (name, price, category_id, track_stock, stock, is_active)
         VALUES ('Nasi Liwet Solo Komplit', 12000, 1, 1, 20, 1)`
      );
      await db.runAsync(
        `INSERT INTO menus (name, price, category_id, track_stock, stock, is_active)
         VALUES ('Es Doger Istimewa', 8000, 4, 0, 0, 1)`
      );

      const newActive = await db.getAllAsync<{ id: number; name: string; price: number }>(
        'SELECT id, name, price FROM menus WHERE is_active = 1 ORDER BY id ASC'
      );
      assert.equal(newActive.length, 2);
      assert.equal(newActive[0].name, 'Nasi Liwet Solo Komplit');
      assert.equal(newActive[1].name, 'Es Doger Istimewa');
    });

    test('1.3 - Hard delete on menu with active foreign keys cascades SET NULL without constraint crash', async () => {
      // Create transaction referencing menu 3 (Nasi Kucing Bandeng)
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-HARD-FK', '2026-11-07', 'Meja 02', 5000, 5000, 'tunai', 5000, 'completed')`
      );
      const tx = await db.getFirstAsync<{ id: number }>('SELECT id FROM transactions WHERE invoice_number = ?', [
        'INV-HARD-FK',
      ]);
      assert.ok(tx);

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
         VALUES (?, 3, 'Nasi Kucing Bandeng', 5000, 1, 5000, 0)`,
        [tx.id]
      );

      // Execute raw HARD DELETE on menu 3 under PRAGMA foreign_keys = ON
      await assert.doesNotReject(async () => {
        await db.runAsync('DELETE FROM menus WHERE id = 3');
      });

      // Verify menu 3 is gone from menus table
      const menu3 = await db.getFirstAsync('SELECT * FROM menus WHERE id = 3');
      assert.equal(menu3, null);

      // Verify transaction_items record had its menu_id set to NULL by ON DELETE SET NULL, keeping name & subtotal
      const itemRow = await db.getFirstAsync<{ menu_id: number | null; menu_name: string; subtotal: number }>(
        'SELECT menu_id, menu_name, subtotal FROM transaction_items WHERE transaction_id = ?',
        [tx.id]
      );
      assert.ok(itemRow);
      assert.equal(itemRow.menu_id, null, 'Foreign key ON DELETE SET NULL must set menu_id to NULL');
      assert.equal(itemRow.menu_name, 'Nasi Kucing Bandeng', 'Historical menu name must remain intact');
      assert.equal(itemRow.subtotal, 5000);
    });
  });

  // =========================================================================
  // Challenge 2: Seed Persistence & Reboot Simulation (Zero Resurrection)
  // =========================================================================
  describe('Challenge 2: Seed Persistence & Reboot Simulation', () => {
    // Helper function that simulates the exact migrateDbIfNeeded startup logic from services/database.ts
    async function simulateStartupMigration(testDb: TestDatabase, forceVersionReset = false) {
      if (forceVersionReset) {
        await testDb.runAsync('PRAGMA user_version = 0');
      }

      const versionRow = await testDb.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const currentVersion = versionRow?.user_version ?? 0;
      if (currentVersion >= 1) {
        return; // Early exit as in services/database.ts
      }

      // Check seed_menus_applied setting
      const seedMenusAppliedRow = await testDb.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'seed_menus_applied'"
      );

      if (seedMenusAppliedRow?.value !== '1') {
        const menuCountRow = await testDb.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM menus'
        );
        if ((menuCountRow?.count ?? 0) === 0) {
          // Re-insert 16 menus
          for (let i = 1; i <= 16; i++) {
            await testDb.runAsync(
              `INSERT OR IGNORE INTO menus (id, name, price, category_id, track_stock, stock, is_active)
               VALUES (?, ?, 5000, 1, 0, 0, 1)`,
              [i, `Default Menu #${i}`]
            );
          }
        }
        await testDb.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('seed_menus_applied', '1')");
      }

      await testDb.runAsync('PRAGMA user_version = 1');
    }

    test('2.1 - App reboot with soft-deleted default menus: IDs 1..16 are NOT resurrected', async () => {
      // 1. Soft-delete default menus 1, 2, 4, 12, 16
      const targets = [1, 2, 4, 12, 16];
      for (const id of targets) {
        await db.runAsync('UPDATE menus SET is_active = 0 WHERE id = ?', [id]);
      }

      // 2. Simulate standard app reboot (user_version = 1)
      await simulateStartupMigration(db, false);

      // Verify targeted menus remain is_active = 0
      for (const id of targets) {
        const row = await db.getFirstAsync<{ is_active: number }>('SELECT is_active FROM menus WHERE id = ?', [id]);
        assert.equal(row?.is_active, 0, `Menu #${id} must remain soft-deleted (is_active = 0) after normal reboot`);
      }

      // 3. Simulate forced schema migration verification (user_version = 0)
      await simulateStartupMigration(db, true);

      // Verify seed_menus_applied = '1' blocked duplicate seeding
      for (const id of targets) {
        const row = await db.getFirstAsync<{ is_active: number }>('SELECT is_active FROM menus WHERE id = ?', [id]);
        assert.equal(row?.is_active, 0, `Menu #${id} must NOT be resurrected even when user_version is 0`);
      }
    });

    test('2.2 - App reboot with ALL menus hard-deleted: seed_menus_applied = 1 blocks re-creation', async () => {
      // User deletes every single menu from the system
      await db.runAsync('DELETE FROM menus');

      const countBefore = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM menus');
      assert.equal(countBefore?.count, 0);

      // Verify seed_menus_applied is '1' in settings
      const seedSetting = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'seed_menus_applied'"
      );
      assert.equal(seedSetting?.value, '1');

      // Simulate app reboot with migration execution (user_version = 0)
      await simulateStartupMigration(db, true);

      // Verify menus table remains completely empty (0 rows)
      const countAfter = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM menus');
      assert.equal(countAfter?.count, 0, 'Menus table must remain empty; default menus must not be recreated');
    });

    test('2.3 - Custom categories and settings survive migration re-runs without data loss', async () => {
      // User modifies store name and adds custom category
      await db.runAsync("UPDATE settings SET value = 'Angkringan Khas Malioboro Reborn' WHERE key = 'store_name'");
      await db.runAsync("INSERT INTO categories (id, name, icon) VALUES (99, 'Menu Khas Solo', 'star')");

      // Simulate migration rerun
      await simulateStartupMigration(db, true);

      const storeName = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'store_name'");
      assert.equal(storeName?.value, 'Angkringan Khas Malioboro Reborn');

      const customCat = await db.getFirstAsync<{ name: string }>('SELECT name FROM categories WHERE id = 99');
      assert.equal(customCat?.name, 'Menu Khas Solo');
    });
  });

  // =========================================================================
  // Challenge 3: Supplier Purchases Cash Ledger vs Tempo Debt Precision
  // =========================================================================
  describe('Challenge 3: Supplier Purchases Cash Ledger vs Tempo Debt Precision', () => {
    test('3.1 - Cash purchase immediately posts PnL expense into cash_ledger; tempo defers until settlement', async () => {
      const bizDate = '2026-11-07';

      // 1. Setup supplier
      await db.runAsync("INSERT INTO suppliers (id, name, phone) VALUES (1, 'Grosir Beras & Minyak', '0812345678')");
      await db.runAsync("INSERT INTO suppliers (id, name, phone) VALUES (2, 'Distributor Ayam Potong', '0898765432')");

      // 2. Record initial cash sales to establish starting operational cash: Rp 1.000.000
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-INIT-CASH', ?, 'Meja 01', 1000000, 1000000, 'tunai', 1000000, 'completed')`,
        [bizDate]
      );

      // 3. Purchase A: CASH Rp 300.000 from Supplier 1
      // Simulate usePurchaseStore.recordPurchase flow
      const cashRes = await db.runAsync(
        `INSERT INTO purchases (supplier_id, supplier_name, business_date, total_amount, payment_type, due_date, payment_status, notes)
         VALUES (1, 'Grosir Beras & Minyak', ?, 300000, 'cash', NULL, 'paid', 'Beli beras 2 karung')`,
        [bizDate]
      );
      const purchaseCashId = cashRes.lastInsertRowId;

      // Cash purchase immediately creates cash_ledger entry with affects_pnl = 1
      await db.runAsync(
        `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
         VALUES (?, 'expense', 1, 'Pembelian Bahan/Kulakan', 300000, ?)`,
        [bizDate, `Kulakan tunai dari Grosir Beras & Minyak (ID Pembelian: #${purchaseCashId})`]
      );

      // 4. Purchase B: TEMPO Rp 500.000 from Supplier 2, due date 2026-11-20
      const tempoRes = await db.runAsync(
        `INSERT INTO purchases (supplier_id, supplier_name, business_date, total_amount, payment_type, due_date, payment_status, notes)
         VALUES (2, 'Distributor Ayam Potong', ?, 500000, 'tempo', '2026-11-20', 'unpaid', 'Ayam 50 ekor jatuh tempo 2 minggu')`,
        [bizDate]
      );
      const purchaseTempoId = tempoRes.lastInsertRowId;

      // 5. Verify Ledger Isolation: Cash ledger must ONLY contain the Rp 300.000 expense
      const ledgerEntries = await db.getAllAsync<{ type: string; affects_pnl: number; amount: number; category: string }>(
        'SELECT type, affects_pnl, amount, category FROM cash_ledger WHERE business_date = ?',
        [bizDate]
      );
      assert.equal(ledgerEntries.length, 1, 'Only cash purchase should be in cash_ledger');
      assert.equal(ledgerEntries[0].amount, 300000);
      assert.equal(ledgerEntries[0].type, 'expense');
      assert.equal(ledgerEntries[0].affects_pnl, 1);

      // 6. Verify Accounts Payable (Hutang Tempo Belum Lunas)
      const unpaidDebts = await db.getAllAsync<{ supplier_id: number; debt: number }>(
        `SELECT supplier_id, SUM(total_amount) as debt
         FROM purchases
         WHERE payment_type = 'tempo' AND payment_status = 'unpaid'
         GROUP BY supplier_id`
      );
      assert.equal(unpaidDebts.length, 1);
      assert.equal(unpaidDebts[0].supplier_id, 2);
      assert.equal(unpaidDebts[0].debt, 500000);

      // 7. Settle Tempo Debt (Pelunasan Hutang Supplier)
      // Simulate usePurchaseStore.settleTempoDebt
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          "UPDATE purchases SET payment_status = 'paid', paid_at = datetime('now','localtime') WHERE id = ?",
          [purchaseTempoId]
        );
        await db.runAsync(
          `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
           VALUES (?, 'expense', 1, 'Pelunasan Hutang Supplier', 500000, ?)`,
          [bizDate, `Pelunasan hutang nota #${purchaseTempoId} kepada Distributor Ayam Potong`]
        );
      });

      // 8. Verify post-settlement financial status
      // Unpaid debt must now be 0
      const unpaidDebtsAfter = await db.getAllAsync<{ debt: number }>(
        `SELECT SUM(total_amount) as debt FROM purchases WHERE payment_type = 'tempo' AND payment_status = 'unpaid'`
      );
      assert.equal(unpaidDebtsAfter[0]?.debt, null);

      // Cash ledger now has exactly 2 entries totalling Rp 800.000
      const totalExpenseRow = await db.getFirstAsync<{ total_expense: number }>(
        "SELECT SUM(amount) as total_expense FROM cash_ledger WHERE type = 'expense' AND affects_pnl = 1 AND business_date = ?",
        [bizDate]
      );
      assert.equal(totalExpenseRow?.total_expense, 800000);

      // Net operating profit calculation:
      // Gross sales: 1.000.000 - Total operational expenses: 800.000 = Rp 200.000
      const netProfit = 1000000 - totalExpenseRow!.total_expense;
      assert.equal(netProfit, 200000);
    });

    test('3.2 - Atomic deletion of purchases purges matching cash ledger entries cleanly', async () => {
      const bizDate = '2026-11-07';

      // Insert supplier first to respect foreign key constraint
      await db.runAsync("INSERT INTO suppliers (id, name, phone) VALUES (1, 'Supplier X', '08123')");

      // Create purchase and associated ledger entry
      const res = await db.runAsync(
        `INSERT INTO purchases (supplier_id, supplier_name, business_date, total_amount, payment_type, payment_status, notes)
         VALUES (1, 'Supplier X', ?, 125000, 'cash', 'paid', 'Bahan basah')`,
        [bizDate]
      );
      const pid = res.lastInsertRowId;

      await db.runAsync(
        `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
         VALUES (?, 'expense', 1, 'Pembelian Bahan/Kulakan', 125000, ?)`,
        [bizDate, `Kulakan tunai dari Supplier X (ID Pembelian: #${pid})`]
      );

      // Simulate deletePurchase
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'DELETE FROM cash_ledger WHERE notes LIKE ? OR notes LIKE ?',
          [`%(ID Pembelian: #${pid})%`, `%Pelunasan hutang nota #${pid}%`]
        );
        await db.runAsync('DELETE FROM purchases WHERE id = ?', [pid]);
      });

      // Verify both purchases and cash_ledger records are purged
      const purchaseCheck = await db.getFirstAsync('SELECT * FROM purchases WHERE id = ?', [pid]);
      assert.equal(purchaseCheck, null);

      const ledgerCheck = await db.getFirstAsync('SELECT * FROM cash_ledger WHERE notes LIKE ?', [
        `%(ID Pembelian: #${pid})%`,
      ]);
      assert.equal(ledgerCheck, null);
    });

    test('3.3 - Supplier deletion triggers ON DELETE SET NULL on purchases table', async () => {
      const bizDate = '2026-11-07';
      await db.runAsync("INSERT INTO suppliers (id, name, phone) VALUES (10, 'Supplier Sayur Segar', '08555')");

      await db.runAsync(
        `INSERT INTO purchases (supplier_id, supplier_name, business_date, total_amount, payment_type, payment_status)
         VALUES (10, 'Supplier Sayur Segar', ?, 75000, 'cash', 'paid')`,
        [bizDate]
      );

      // Delete supplier
      await db.runAsync('DELETE FROM suppliers WHERE id = 10');

      // Verify purchase remains, supplier_id became NULL, supplier_name string preserved
      const p = await db.getFirstAsync<{ supplier_id: number | null; supplier_name: string; total_amount: number }>(
        'SELECT supplier_id, supplier_name, total_amount FROM purchases WHERE supplier_name = ?',
        ['Supplier Sayur Segar']
      );
      assert.ok(p);
      assert.equal(p.supplier_id, null, 'supplier_id must become NULL via ON DELETE SET NULL');
      assert.equal(p.supplier_name, 'Supplier Sayur Segar');
      assert.equal(p.total_amount, 75000);
    });
  });

  // =========================================================================
  // Challenge 4: Attendance Data, Date Format & Multiple Entries Stress
  // =========================================================================
  describe('Challenge 4: Attendance Data, Date Format & Multiple Entries Stress', () => {
    test('4.1 - Format YYYY-MM-DD and unique constraint enforcement per employee per day', async () => {
      // 1. Create employees
      await db.runAsync("INSERT INTO employees (id, name, phone, is_active) VALUES (1, 'Budi Santoso', '0811', 1)");
      await db.runAsync("INSERT INTO employees (id, name, phone, is_active) VALUES (2, 'Siti Rahma', '0812', 1)");

      const bizDate = '2026-11-07';

      // 2. Employee 1 checks in successfully
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes)
         VALUES (1, 'Budi Santoso', ?, '16:45', 'file:///photos/budi_nov7.jpg', 0, 0)`,
        [bizDate]
      );

      // 3. Employee 1 attempts duplicate check-in on the SAME business_date -> MUST throw UNIQUE constraint error
      await assert.rejects(
        async () => {
          await db.runAsync(
            `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes)
             VALUES (1, 'Budi Santoso', ?, '17:15', 'file:///photos/budi_nov7_dup.jpg', 0, 0)`,
            [bizDate]
          );
        },
        /UNIQUE constraint failed: attendance\.employee_id, attendance\.business_date/,
        'Duplicate check-in on same date must be blocked by database unique constraint'
      );

      // 4. Employee 2 checks in on the SAME business_date -> MUST succeed
      await assert.doesNotReject(async () => {
        await db.runAsync(
          `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes)
           VALUES (2, 'Siti Rahma', ?, '17:05', 'file:///photos/siti_nov7.jpg', 0, 0)`,
          [bizDate]
        );
      });

      // 5. Verify both employees are recorded for 2026-11-07
      const dateRecords = await db.getAllAsync<{ employee_name: string; check_in_time: string }>(
        'SELECT employee_name, check_in_time FROM attendance WHERE business_date = ? ORDER BY id ASC',
        [bizDate]
      );
      assert.equal(dateRecords.length, 2);
      assert.equal(dateRecords[0].employee_name, 'Budi Santoso');
      assert.equal(dateRecords[1].employee_name, 'Siti Rahma');
    });

    test('4.2 - Multi-employee multi-date matrix correctly filters daily details and monthly rekap', async () => {
      // Create 3 employees
      await db.runAsync("INSERT INTO employees (id, name, phone, is_active) VALUES (1, 'Budi', '0811', 1)");
      await db.runAsync("INSERT INTO employees (id, name, phone, is_active) VALUES (2, 'Siti', '0812', 1)");
      await db.runAsync("INSERT INTO employees (id, name, phone, is_active) VALUES (3, 'Agus', '0813', 1)");

      // Populate attendance across multiple dates in November 2026
      const entries = [
        { empId: 1, name: 'Budi', date: '2026-11-01', time: '16:50', isLate: 0, lateMin: 0 },
        { empId: 2, name: 'Siti', date: '2026-11-01', time: '17:40', isLate: 1, lateMin: 10 },
        { empId: 1, name: 'Budi', date: '2026-11-02', time: '16:55', isLate: 0, lateMin: 0 },
        { empId: 3, name: 'Agus', date: '2026-11-02', time: '17:00', isLate: 0, lateMin: 0 },
        { empId: 1, name: 'Budi', date: '2026-11-07', time: '16:45', isLate: 0, lateMin: 0 },
        { empId: 2, name: 'Siti', date: '2026-11-07', time: '17:00', isLate: 0, lateMin: 0 },
        { empId: 3, name: 'Agus', date: '2026-11-07', time: '17:45', isLate: 1, lateMin: 15 },
        // Also an entry in December to test month isolation
        { empId: 1, name: 'Budi', date: '2026-12-01', time: '16:50', isLate: 0, lateMin: 0 },
      ];

      for (const e of entries) {
        await db.runAsync(
          `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes)
           VALUES (?, ?, ?, ?, 'mock.jpg', ?, ?)`,
          [e.empId, e.name, e.date, e.time, e.isLate, e.lateMin]
        );
      }

      // Test A: Monthly Rekap query for November 2026 (business_date LIKE '2026-11%')
      const novRecords = await db.getAllAsync<{ id: number; business_date: string }>(
        "SELECT id, business_date FROM attendance WHERE business_date LIKE '2026-11%' ORDER BY business_date ASC"
      );
      assert.equal(novRecords.length, 7, 'November must contain exactly 7 attendance records');

      // Test B: Daily Detail query for specific date '2026-11-07'
      const targetDateRecords = await db.getAllAsync<{ employee_name: string; is_late: number; late_minutes: number }>(
        'SELECT employee_name, is_late, late_minutes FROM attendance WHERE business_date = ? ORDER BY employee_name ASC',
        ['2026-11-07']
      );
      assert.equal(targetDateRecords.length, 3, '2026-11-07 must have 3 employees present');
      assert.deepEqual(
        targetDateRecords.map((r) => r.employee_name),
        ['Agus', 'Budi', 'Siti']
      );

      // Check late statistics on 2026-11-07: Agus is late 15 minutes
      const agusRecord = targetDateRecords.find((r) => r.employee_name === 'Agus');
      assert.equal(agusRecord?.is_late, 1);
      assert.equal(agusRecord?.late_minutes, 15);

      // Test C: Daily Detail query for a date with NO attendance ('2026-11-04')
      const emptyDateRecords = await db.getAllAsync(
        'SELECT * FROM attendance WHERE business_date = ?',
        ['2026-11-04']
      );
      assert.equal(emptyDateRecords.length, 0);
    });

    test('4.3 - Session closing batch updates all open checkouts for active date only', async () => {
      // Setup attendance across 2 dates
      await db.runAsync("INSERT INTO employees (id, name, is_active) VALUES (1, 'Staff A', 1)");
      await db.runAsync("INSERT INTO employees (id, name, is_active) VALUES (2, 'Staff B', 1)");

      // Past date (already closed)
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, check_out_time)
         VALUES (1, 'Staff A', '2026-11-06', '16:00', 'photo1.jpg', '23:00')`
      );

      // Current date: Staff A and Staff B checked in, neither has checked out
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, check_out_time)
         VALUES (1, 'Staff A', '2026-11-07', '16:30', 'photo2.jpg', NULL)`
      );
      await db.runAsync(
        `INSERT INTO attendance (employee_id, employee_name, business_date, check_in_time, check_in_photo, check_out_time)
         VALUES (2, 'Staff B', '2026-11-07', '17:00', 'photo3.jpg', '')`
      );

      // Execute session close on '2026-11-07' at 23:45
      const checkoutTime = '23:45';
      const updateResult = await db.runAsync(
        `UPDATE attendance
         SET check_out_time = ?
         WHERE business_date = ? AND (check_out_time IS NULL OR check_out_time = '')`,
        [checkoutTime, '2026-11-07']
      );
      assert.equal(updateResult.changes, 2, 'Exactly 2 open staff checkouts should be updated');

      // Verify records on 2026-11-07
      const staff7 = await db.getAllAsync<{ employee_name: string; check_out_time: string }>(
        'SELECT employee_name, check_out_time FROM attendance WHERE business_date = ?',
        ['2026-11-07']
      );
      assert.equal(staff7[0].check_out_time, checkoutTime);
      assert.equal(staff7[1].check_out_time, checkoutTime);

      // Verify past date was NOT overwritten
      const pastStaff = await db.getFirstAsync<{ check_out_time: string }>(
        'SELECT check_out_time FROM attendance WHERE business_date = ?',
        ['2026-11-06']
      );
      assert.equal(pastStaff?.check_out_time, '23:00', 'Past check_out_time must remain untouched');
    });
  });
});
