import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import { loadFinancialSummary } from './helpers/financialEngine.js';
import {
  formatCustomerReceiptLines,
  formatTemporaryBillReceiptLines,
  formatKitchenTicketLines,
  type PrintReceiptData,
} from './helpers/receiptFormatter.js';

describe('Adversarial Challenger Test Suite (Milestone 6)', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // Scope 1: Menu Deletion Integrity & Historical Preservation
  // =========================================================================
  describe('Scope 1: Menu Deletion Integrity', () => {
    test('1.1 - Default menu item id=1 soft-delete maintains query isolation and active catalog filtering', async () => {
      // 1. Verify default menu id=1 exists and is active
      const menu1 = await db.getFirstAsync<{ id: number; name: string; price: number; is_active: number }>(
        'SELECT id, name, price, is_active FROM menus WHERE id = 1'
      );
      assert.ok(menu1, 'Menu ID 1 must exist by default');
      assert.equal(menu1.name, 'Nasi Kucing Sambal Teri');
      assert.equal(menu1.is_active, 1);

      // 2. Create completed and pending orders referencing menu id=1
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-COMPLETED-M1', '2026-11-07', 'Meja 01', 15000, 15000, 'tunai', 15000, 'completed')`
      );
      const completedTx = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM transactions WHERE invoice_number = 'INV-COMPLETED-M1'"
      );
      assert.ok(completedTx);

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
         VALUES (?, 1, 'Nasi Kucing Sambal Teri', 5000, 3, 15000, 0)`,
        [completedTx.id]
      );

      // 3. Execute soft delete (production standard flow)
      await db.runAsync('UPDATE menus SET is_active = 0 WHERE id = 1');

      // 4. Verify menu id=1 is excluded from active menus query
      const activeCatalog = await db.getAllAsync<{ id: number; name: string }>(
        'SELECT id, name FROM menus WHERE is_active = 1 ORDER BY name ASC'
      );
      assert.ok(!activeCatalog.some((m) => m.id === 1), 'Soft-deleted menu must not appear in active catalog');

      // 5. Verify transaction_items records are completely preserved
      const itemRow = await db.getFirstAsync<{ menu_id: number; menu_name: string; price: number; qty: number; subtotal: number }>(
        'SELECT menu_id, menu_name, price, qty, subtotal FROM transaction_items WHERE transaction_id = ?',
        [completedTx.id]
      );
      assert.ok(itemRow);
      assert.equal(itemRow.menu_id, 1);
      assert.equal(itemRow.menu_name, 'Nasi Kucing Sambal Teri');
      assert.equal(itemRow.price, 5000);
      assert.equal(itemRow.qty, 3);
      assert.equal(itemRow.subtotal, 15000);
    });

    test('1.2 - Hard delete with PRAGMA foreign_keys = ON triggers ON DELETE SET NULL without throwing FK violation', async () => {
      // 1. Create a transaction referencing menu item 1
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-HARD-DELETE-TEST', '2026-11-07', 'Meja 02', 10000, 10000, 'tunai', 10000, 'completed')`
      );
      const tx = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM transactions WHERE invoice_number = 'INV-HARD-DELETE-TEST'"
      );
      assert.ok(tx);

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
         VALUES (?, 1, 'Nasi Kucing Sambal Teri', 5000, 2, 10000, 0)`,
        [tx.id]
      );

      // 2. Perform raw hard delete on menu id=1 under active foreign keys
      // Because transaction_items defines: menu_id INTEGER REFERENCES menus(id) ON DELETE SET NULL
      // this MUST succeed and set transaction_items.menu_id = NULL without error.
      assert.doesNotThrow(async () => {
        await db.runAsync('DELETE FROM menus WHERE id = 1');
      });

      // 3. Verify menu id=1 is truly deleted from menus table
      const deletedMenu = await db.getFirstAsync('SELECT * FROM menus WHERE id = 1');
      assert.equal(deletedMenu, null, 'Menu id 1 should be gone from menus table');

      // 4. Verify transaction_items retains all financial data with menu_id set to NULL
      const itemAfterHardDelete = await db.getFirstAsync<{
        menu_id: number | null;
        menu_name: string;
        price: number;
        qty: number;
        subtotal: number;
      }>('SELECT menu_id, menu_name, price, qty, subtotal FROM transaction_items WHERE transaction_id = ?', [tx.id]);

      assert.ok(itemAfterHardDelete);
      assert.equal(itemAfterHardDelete.menu_id, null, 'menu_id must be NULL following ON DELETE SET NULL');
      assert.equal(itemAfterHardDelete.menu_name, 'Nasi Kucing Sambal Teri', 'Historical menu name must be intact');
      assert.equal(itemAfterHardDelete.price, 5000, 'Historical price must be intact');
      assert.equal(itemAfterHardDelete.qty, 2);
      assert.equal(itemAfterHardDelete.subtotal, 10000, 'Historical subtotal must be intact');
    });

    test('1.3 - App reload & migration simulation: seed_menus_applied = 1 prevents reappearance of deleted menu', async () => {
      // 1. Soft-delete menu id=1
      await db.runAsync('UPDATE menus SET is_active = 0 WHERE id = 1');

      // 2. Verify setting seed_menus_applied is '1'
      const flag = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'seed_menus_applied'"
      );
      assert.equal(flag?.value, '1', 'seed_menus_applied must be 1');

      // 3. Simulate migrateDbIfNeeded() re-execution on app startup
      // The production migration logic:
      const seedMenusAppliedRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'seed_menus_applied'"
      );
      if (seedMenusAppliedRow?.value !== '1') {
        const countRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM menus');
        if ((countRow?.count ?? 0) === 0) {
          await db.runAsync(
            "INSERT OR IGNORE INTO menus (id, name, price, category_id, track_stock, stock, is_active) VALUES (1, 'Nasi Kucing Sambal Teri', 5000, 1, 0, 0, 1)"
          );
        }
      }

      // 4. Assert menu id=1 is STILL inactive and was NOT re-seeded or overwritten
      const checkMenu = await db.getFirstAsync<{ id: number; is_active: number }>(
        'SELECT id, is_active FROM menus WHERE id = 1'
      );
      assert.ok(checkMenu);
      assert.equal(checkMenu.is_active, 0, 'Menu id=1 must stay soft-deleted (is_active = 0)');

      // 5. Test empty menus table condition when seed_menus_applied = 1
      // If user deliberately emptied the menu list, startup must NOT re-seed menus
      await db.runAsync('DELETE FROM menus');
      const emptyCheck = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM menus');
      assert.equal(emptyCheck?.count, 0);

      // Re-run migration logic
      const secondCheckFlag = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'seed_menus_applied'"
      );
      if (secondCheckFlag?.value !== '1') {
        await db.runAsync(
          "INSERT OR IGNORE INTO menus (id, name, price, category_id, track_stock, stock, is_active) VALUES (1, 'Nasi Kucing Sambal Teri', 5000, 1, 0, 0, 1)"
        );
      }

      const postReloadCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM menus');
      assert.equal(postReloadCount?.count, 0, 'Menus must NOT be re-seeded if seed_menus_applied === 1');
    });
  });

  // =========================================================================
  // Scope 2: Dynamic Table Stress & Concurrency
  // =========================================================================
  describe('Scope 2: Dynamic Table Stress & Concurrency', () => {
    test('2.1 - Custom table creation and pending order association', async () => {
      // 1. Setup custom tables in settings
      const customTables = [
        { id: 'tbl_1', name: 'Meja 01', type: 'meja' },
        { id: 'tbl_vip99', name: 'Lesehan VIP 99', type: 'lesehan' },
      ];
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_tables', ?)",
        [JSON.stringify(customTables)]
      );

      // 2. Open a pending order on "Lesehan VIP 99"
      await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, total, payment_method, payment_amount, status
        ) VALUES ('INV-VIP-001', '2026-11-07', 'Lesehan VIP 99', 1, 'Customer UMUM', 75000, 75000, 'tunai', 0, 'pending')`
      );

      const pendingTx = await db.getFirstAsync<{ id: number; table_number: string; status: string }>(
        "SELECT id, table_number, status FROM transactions WHERE invoice_number = 'INV-VIP-001'"
      );
      assert.ok(pendingTx);
      assert.equal(pendingTx.table_number, 'Lesehan VIP 99');
      assert.equal(pendingTx.status, 'pending');
    });

    test('2.2 - Deletion prevention guard blocks deletion of table with active orders', async () => {
      const targetTable = 'Lesehan VIP 99';

      // 1. Pending order exists
      await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, total, payment_method, payment_amount, status
        ) VALUES ('INV-ACTIVE-01', '2026-11-07', ?, 1, 'Customer UMUM', 30000, 30000, 'tunai', 0, 'pending')`,
        [targetTable]
      );

      // 2. Deletion guard check
      const activeTxRow = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM transactions WHERE table_number = ? AND status IN ('pending', 'billing')",
        [targetTable]
      );
      const isDeletable = (activeTxRow?.count ?? 0) === 0;

      assert.equal(isDeletable, false, 'Table with active pending order must be prohibited from deletion');

      // 3. Move order to 'billing' status (temporary bill printed)
      await db.runAsync(
        "UPDATE transactions SET status = 'billing' WHERE invoice_number = 'INV-ACTIVE-01'"
      );

      const billingTxRow = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM transactions WHERE table_number = ? AND status IN ('pending', 'billing')",
        [targetTable]
      );
      const isDeletableInBilling = (billingTxRow?.count ?? 0) === 0;
      assert.equal(isDeletableInBilling, false, 'Table with billing order must also be prohibited from deletion');
    });

    test('2.3 - Table rename atomic propagation updates pending/billing transactions while keeping completed history unchanged', async () => {
      const oldName = 'Lesehan VIP 99';
      const newName = 'Gazebo Bintang';

      // 1. Create a historical completed order on "Lesehan VIP 99"
      await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, total, payment_method, payment_amount, status
        ) VALUES ('INV-HIST-PAST', '2026-11-06', ?, 1, 'Customer UMUM', 50000, 50000, 'tunai', 50000, 'completed')`,
        [oldName]
      );

      // 2. Create an active pending order on "Lesehan VIP 99"
      await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, total, payment_method, payment_amount, status
        ) VALUES ('INV-PENDING-ACTIVE', '2026-11-07', ?, 1, 'Customer UMUM', 85000, 85000, 'tunai', 0, 'pending')`,
        [oldName]
      );

      // 3. Create an active billing order on "Lesehan VIP 99"
      await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, total, payment_method, payment_amount, status
        ) VALUES ('INV-BILLING-ACTIVE', '2026-11-07', ?, 1, 'Customer UMUM', 45000, 45000, 'tunai', 0, 'billing')`,
        [oldName]
      );

      // 4. Execute atomic propagation rename query as defined in table-selector-modal:
      await db.runAsync(
        "UPDATE transactions SET table_number = ? WHERE table_number = ? AND status IN ('pending', 'billing')",
        [newName, oldName]
      );

      // 5. Verify pending order table_number updated to "Gazebo Bintang"
      const pendingRow = await db.getFirstAsync<{ table_number: string }>(
        "SELECT table_number FROM transactions WHERE invoice_number = 'INV-PENDING-ACTIVE'"
      );
      assert.equal(pendingRow?.table_number, newName, 'Active pending order table_number must be renamed');

      // 6. Verify billing order table_number updated to "Gazebo Bintang"
      const billingRow = await db.getFirstAsync<{ table_number: string }>(
        "SELECT table_number FROM transactions WHERE invoice_number = 'INV-BILLING-ACTIVE'"
      );
      assert.equal(billingRow?.table_number, newName, 'Active billing order table_number must be renamed');

      // 7. Verify historical completed order was NOT modified (financial audit integrity)
      const historicalRow = await db.getFirstAsync<{ table_number: string }>(
        "SELECT table_number FROM transactions WHERE invoice_number = 'INV-HIST-PAST'"
      );
      assert.equal(historicalRow?.table_number, oldName, 'Completed historical transaction table must remain unchanged');
    });

    test('2.4 - Table deletion successfully allowed once orders are settled', async () => {
      const tableName = 'Gazebo Bintang';

      // 1. Initial custom_tables setup
      const initialTables = [
        { id: 'tbl_1', name: 'Meja 01', type: 'meja' },
        { id: 'tbl_vip99', name: 'Gazebo Bintang', type: 'lesehan' },
      ];
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_tables', ?)",
        [JSON.stringify(initialTables)]
      );

      // 2. Settle pending orders on Gazebo Bintang
      await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, total, payment_method, payment_amount, status
        ) VALUES ('INV-SETTLED-01', '2026-11-07', ?, 1, 'Customer UMUM', 50000, 50000, 'tunai', 50000, 'completed')`,
        [tableName]
      );

      // 3. Check deletion guard
      const activeCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM transactions WHERE table_number = ? AND status IN ('pending', 'billing')",
        [tableName]
      );
      assert.equal(activeCount?.count ?? 0, 0, 'No active orders should exist');

      // 4. Deletion is now permitted: update custom_tables settings
      const filteredTables = initialTables.filter((t) => t.name !== tableName);
      await db.runAsync(
        "UPDATE settings SET value = ? WHERE key = 'custom_tables'",
        [JSON.stringify(filteredTables)]
      );

      const settingsRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'custom_tables'"
      );
      assert.ok(settingsRow, 'Settings custom_tables row must exist');
      const remainingTables = JSON.parse(settingsRow.value);
      assert.equal(remainingTables.length, 1);
      assert.equal(remainingTables[0].name, 'Meja 01');
    });
  });

  // =========================================================================
  // Scope 3: Cash Purchase & Tempo Debt Settlement Flow
  // =========================================================================
  describe('Scope 3: Cash Purchase & Tempo Debt Settlement Flow', () => {
    beforeEach(async () => {
      // Seed required suppliers for foreign key integrity
      await db.runAsync("INSERT OR IGNORE INTO suppliers (id, name, phone) VALUES (1, 'Toko Bumbu Barokah', '0812-1111-2222')");
      await db.runAsync("INSERT OR IGNORE INTO suppliers (id, name, phone) VALUES (2, 'Distributor Telur Mas', '0813-3333-4444')");
      await db.runAsync("INSERT OR IGNORE INTO suppliers (id, name, phone) VALUES (3, 'Arang Kayu Pak Joko', '0815-5555-6666')");
      await db.runAsync("INSERT OR IGNORE INTO suppliers (id, name, phone) VALUES (4, 'Supplier Gula & Teh', '0817-7777-8888')");
    });
    test('3.1 - Cash purchase atomically writes operational expense into cash_ledger (affects_pnl = 1)', async () => {
      const purchaseAmount = 250000;
      const bizDate = '2026-11-07';

      // Atomic purchase transaction simulation (mirroring purchaseStore.recordPurchase)
      let purchaseId = 0;
      await db.withTransactionAsync(async () => {
        const pRes = await db.runAsync(
          `INSERT INTO purchases (
            supplier_id, supplier_name, business_date, total_amount, payment_type, payment_status, notes
          ) VALUES (1, 'Toko Bumbu Barokah', ?, ?, 'cash', 'paid', 'Bumbu dapur mingguan')`,
          [bizDate, purchaseAmount]
        );
        purchaseId = pRes.lastInsertRowId;

        await db.runAsync(
          `INSERT INTO cash_ledger (
            business_date, type, affects_pnl, category, amount, notes
          ) VALUES (?, 'expense', 1, 'Pembelian Bahan/Kulakan', ?, ?)`,
          [bizDate, purchaseAmount, `Kulakan tunai dari Toko Bumbu Barokah (ID Pembelian: #${purchaseId})`]
        );
      });

      // Assert purchase record
      const purchase = await db.getFirstAsync<{ payment_status: string; total_amount: number }>(
        'SELECT payment_status, total_amount FROM purchases WHERE id = ?',
        [purchaseId]
      );
      assert.equal(purchase?.payment_status, 'paid');
      assert.equal(purchase?.total_amount, purchaseAmount);

      // Assert cash_ledger record
      const ledger = await db.getFirstAsync<{ type: string; affects_pnl: number; amount: number; category: string }>(
        'SELECT type, affects_pnl, amount, category FROM cash_ledger WHERE notes LIKE ?',
        [`%(ID Pembelian: #${purchaseId})%`]
      );
      assert.ok(ledger);
      assert.equal(ledger.type, 'expense');
      assert.equal(ledger.affects_pnl, 1, 'Must affect PnL calculation');
      assert.equal(ledger.amount, purchaseAmount);
      assert.equal(ledger.category, 'Pembelian Bahan/Kulakan');
    });

    test('3.2 - Tempo purchase creates zero cash_ledger entries while unpaid, properly isolating accounts payable', async () => {
      const tempoAmount = 500000;
      const bizDate = '2026-11-07';

      let tempoPurchaseId = 0;
      await db.withTransactionAsync(async () => {
        const pRes = await db.runAsync(
          `INSERT INTO purchases (
            supplier_id, supplier_name, business_date, total_amount, payment_type, due_date, payment_status, notes
          ) VALUES (2, 'Distributor Telur Mas', ?, ?, 'tempo', '2026-11-21', 'unpaid', '10 peti telur ayam')`,
          [bizDate, tempoAmount]
        );
        tempoPurchaseId = pRes.lastInsertRowId;
        // Tempo: NO cash_ledger entry recorded
      });

      // Verify zero ledger entries linked to this purchase
      const ledgerRows = await db.getAllAsync(
        'SELECT * FROM cash_ledger WHERE notes LIKE ?',
        [`%#${tempoPurchaseId}%`]
      );
      assert.equal(ledgerRows.length, 0, 'Unpaid tempo purchase must NEVER appear in cash_ledger');

      // Verify accounts payable debt accumulation
      const debtRow = await db.getFirstAsync<{ totalDebt: number }>(
        "SELECT SUM(total_amount) as totalDebt FROM purchases WHERE payment_type = 'tempo' AND payment_status = 'unpaid'"
      );
      assert.equal(debtRow?.totalDebt, tempoAmount);
    });

    test('3.3 - Tempo debt settlement creates cash_ledger expense and clears accounts payable debt', async () => {
      const tempoAmount = 500000;
      const bizDate = '2026-11-07';

      // 1. Create tempo purchase
      const pRes = await db.runAsync(
        `INSERT INTO purchases (
          supplier_id, supplier_name, business_date, total_amount, payment_type, due_date, payment_status, notes
        ) VALUES (2, 'Distributor Telur Mas', ?, ?, 'tempo', '2026-11-21', 'unpaid', '10 peti telur ayam')`,
        [bizDate, tempoAmount]
      );
      const purchaseId = pRes.lastInsertRowId;

      // 2. Execute settlement (mirroring purchaseStore.settleTempoDebt)
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          "UPDATE purchases SET payment_status = 'paid', paid_at = datetime('now','localtime') WHERE id = ?",
          [purchaseId]
        );
        await db.runAsync(
          `INSERT INTO cash_ledger (
            business_date, type, affects_pnl, category, amount, notes
          ) VALUES (?, 'expense', 1, 'Pelunasan Hutang Supplier', ?, ?)`,
          [bizDate, tempoAmount, `Pelunasan hutang nota #${purchaseId} kepada Distributor Telur Mas`]
        );
      });

      // 3. Verify accounts payable debt is cleared
      const remainingDebt = await db.getFirstAsync<{ totalDebt: number | null }>(
        "SELECT SUM(total_amount) as totalDebt FROM purchases WHERE payment_type = 'tempo' AND payment_status = 'unpaid'"
      );
      assert.equal(remainingDebt?.totalDebt ?? 0, 0, 'Unpaid debt must be 0 after settlement');

      // 4. Verify settlement expense in cash_ledger
      const settleLedger = await db.getFirstAsync<{ type: string; affects_pnl: number; amount: number; category: string }>(
        'SELECT type, affects_pnl, amount, category FROM cash_ledger WHERE notes LIKE ?',
        [`%Pelunasan hutang nota #${purchaseId}%`]
      );
      assert.ok(settleLedger);
      assert.equal(settleLedger.type, 'expense');
      assert.equal(settleLedger.affects_pnl, 1);
      assert.equal(settleLedger.amount, tempoAmount);
      assert.equal(settleLedger.category, 'Pelunasan Hutang Supplier');
    });

    test('3.4 - Atomic deletion of cash purchase purges associated cash_ledger entry cleanly', async () => {
      const amount = 120000;
      const bizDate = '2026-11-07';

      let cashPurchaseId = 0;
      await db.withTransactionAsync(async () => {
        const res = await db.runAsync(
          `INSERT INTO purchases (
            supplier_id, supplier_name, business_date, total_amount, payment_type, payment_status, notes
          ) VALUES (3, 'Arang Kayu Pak Joko', ?, ?, 'cash', 'paid', 'Beli arang 10 karung')`,
          [bizDate, amount]
        );
        cashPurchaseId = res.lastInsertRowId;
        await db.runAsync(
          `INSERT INTO cash_ledger (
            business_date, type, affects_pnl, category, amount, notes
          ) VALUES (?, 'expense', 1, 'Pembelian Bahan/Kulakan', ?, ?)`,
          [bizDate, amount, `Kulakan tunai dari Arang Kayu Pak Joko (ID Pembelian: #${cashPurchaseId})`]
        );
      });

      // Confirm ledger entry exists
      const beforeDelete = await db.getFirstAsync(
        'SELECT * FROM cash_ledger WHERE notes LIKE ?',
        [`%(ID Pembelian: #${cashPurchaseId})%`]
      );
      assert.ok(beforeDelete);

      // Execute deletePurchase logic
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'DELETE FROM cash_ledger WHERE notes LIKE ? OR notes LIKE ?',
          [`%(ID Pembelian: #${cashPurchaseId})%`, `%Pelunasan hutang nota #${cashPurchaseId}%`]
        );
        await db.runAsync('DELETE FROM purchases WHERE id = ?', [cashPurchaseId]);
      });

      // Verify purchase deleted
      const purchaseAfter = await db.getFirstAsync('SELECT * FROM purchases WHERE id = ?', [cashPurchaseId]);
      assert.equal(purchaseAfter, null);

      // Verify cash_ledger purged
      const ledgerAfter = await db.getFirstAsync(
        'SELECT * FROM cash_ledger WHERE notes LIKE ?',
        [`%(ID Pembelian: #${cashPurchaseId})%`]
      );
      assert.equal(ledgerAfter, null, 'Cash ledger entry must be removed atomically upon purchase deletion');
    });

    test('3.5 - Atomic deletion of settled tempo purchase purges settlement ledger entry', async () => {
      const amount = 300000;
      const bizDate = '2026-11-07';

      const res = await db.runAsync(
        `INSERT INTO purchases (
          supplier_id, supplier_name, business_date, total_amount, payment_type, payment_status, notes
        ) VALUES (4, 'Supplier Gula & Teh', ?, ?, 'tempo', 'paid', 'Teh dandang & gula pasir')`,
        [bizDate, amount]
      );
      const tempoId = res.lastInsertRowId;

      await db.runAsync(
        `INSERT INTO cash_ledger (
          business_date, type, affects_pnl, category, amount, notes
        ) VALUES (?, 'expense', 1, 'Pelunasan Hutang Supplier', ?, ?)`,
        [bizDate, amount, `Pelunasan hutang nota #${tempoId} kepada Supplier Gula & Teh`]
      );

      // Delete settled tempo purchase
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'DELETE FROM cash_ledger WHERE notes LIKE ? OR notes LIKE ?',
          [`%(ID Pembelian: #${tempoId})%`, `%Pelunasan hutang nota #${tempoId}%`]
        );
        await db.runAsync('DELETE FROM purchases WHERE id = ?', [tempoId]);
      });

      const ledgerCheck = await db.getFirstAsync(
        'SELECT * FROM cash_ledger WHERE notes LIKE ?',
        [`%Pelunasan hutang nota #${tempoId}%`]
      );
      assert.equal(ledgerCheck, null, 'Settlement cash ledger entry must be purged when settled tempo purchase is deleted');
    });

    test('3.6 - PnL reconciliation: cash purchase vs unpaid tempo vs settlement reflected in financial engine', async () => {
      const targetMonth = '2026-11';

      // 1. Record completed cash sales of Rp 1,000,000
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-SALES-01', '2026-11-07', 'Meja 01', 1000000, 1000000, 'tunai', 1000000, 'completed')`
      );
      await db.runAsync(
        `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
         VALUES ('2026-11-07', 'income', 1, 'penjualan_tunai', 1000000, 'Penjualan Nota INV-SALES-01')`
      );

      // 2. Record cash purchase of Rp 200,000
      await db.runAsync(
        `INSERT INTO purchases (id, supplier_id, supplier_name, business_date, total_amount, payment_type, payment_status)
         VALUES (301, 1, 'Toko Bumbu Barokah', '2026-11-07', 200000, 'cash', 'paid')`
      );
      await db.runAsync(
        `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
         VALUES ('2026-11-07', 'expense', 1, 'Pembelian Bahan/Kulakan', 200000, 'Kulakan tunai (ID Pembelian: #301)')`
      );

      // 3. Record unpaid tempo purchase of Rp 350,000 (must NOT hit cash_ledger)
      await db.runAsync(
        `INSERT INTO purchases (id, supplier_id, supplier_name, business_date, total_amount, payment_type, payment_status)
         VALUES (302, 2, 'Distributor Telur Mas', '2026-11-07', 350000, 'tempo', 'unpaid')`
      );

      // Check financial summary: Gross Sales = 1,000,000; Operational Expenses = 200,000; Net Profit = 800,000
      const summary1 = await loadFinancialSummary(db, targetMonth);
      assert.equal(summary1.summary.totalGrossSales, 1000000);
      assert.equal(summary1.summary.totalOperationalExpenses, 200000);
      assert.equal(summary1.summary.netOperatingProfit, 800000, 'Unpaid tempo purchase must NOT diminish net profit');

      // 4. Settle tempo debt of Rp 350,000
      await db.runAsync("UPDATE purchases SET payment_status = 'paid' WHERE id = 302");
      await db.runAsync(
        `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
         VALUES ('2026-11-07', 'expense', 1, 'Pelunasan Hutang Supplier', 350000, 'Pelunasan hutang nota #302')`
      );

      // Re-check financial summary: Operational Expenses = 200,000 + 350,000 = 550,000; Net Profit = 450,000
      const summary2 = await loadFinancialSummary(db, targetMonth);
      assert.equal(summary2.summary.totalOperationalExpenses, 550000);
      assert.equal(summary2.summary.netOperatingProfit, 450000, 'Settled tempo debt must now reduce net profit');
    });

    test('3.7 - Supplier deletion retains historical purchase integrity (ON DELETE SET NULL)', async () => {
      // 1. Create supplier
      await db.runAsync("INSERT INTO suppliers (id, name, phone) VALUES (99, 'Supplier Sementara', '0899-9999')");

      // 2. Create purchase referencing supplier 99
      await db.runAsync(
        `INSERT INTO purchases (id, supplier_id, supplier_name, business_date, total_amount, payment_type, payment_status)
         VALUES (901, 99, 'Supplier Sementara', '2026-11-07', 150000, 'cash', 'paid')`
      );

      // 3. Delete supplier 99 under foreign keys ON
      await db.runAsync('DELETE FROM suppliers WHERE id = 99');

      // 4. Purchase must still exist with supplier_id = NULL and supplier_name preserved
      const p = await db.getFirstAsync<{ supplier_id: number | null; supplier_name: string; total_amount: number }>(
        'SELECT supplier_id, supplier_name, total_amount FROM purchases WHERE id = 901'
      );
      assert.ok(p);
      assert.equal(p.supplier_id, null, 'supplier_id must be set to NULL after supplier deletion');
      assert.equal(p.supplier_name, 'Supplier Sementara', 'Supplier name must be preserved in historical purchase record');
      assert.equal(p.total_amount, 150000);
    });
  });

  // =========================================================================
  // Scope 4: Cashier Identity Association
  // =========================================================================
  describe('Scope 4: Cashier Identity Association', () => {
    test('4.1 - Rapid successive checkouts under distinct cashiers store exact cashier names in SQLite', async () => {
      const cashiers = ['Rian Saputra', 'Siti Rahmawati', 'Dewi Anggraini'];
      const invoices: string[] = [];

      for (let i = 0; i < cashiers.length; i++) {
        const inv = `INV-RAPID-00${i + 1}`;
        invoices.push(inv);

        await db.runAsync(
          `INSERT INTO transactions (
            invoice_number, business_date, table_number, customer_id, customer_name,
            subtotal, total, payment_method, payment_amount, status, cashier_name
          ) VALUES (?, '2026-11-07', ?, 1, 'Customer UMUM', 25000, 25000, 'tunai', 25000, 'completed', ?)`,
          [inv, `Meja 0${i + 1}`, cashiers[i]]
        );
      }

      // Verify each transaction stored the exact cashier
      for (let i = 0; i < cashiers.length; i++) {
        const row = await db.getFirstAsync<{ cashier_name: string }>(
          'SELECT cashier_name FROM transactions WHERE invoice_number = ?',
          [invoices[i]]
        );
        assert.equal(row?.cashier_name, cashiers[i], `Transaction ${invoices[i]} must have cashier ${cashiers[i]}`);
      }
    });

    test('4.2 - Pending order handover: created by Rian, settled by Siti updates to settling cashier identity', async () => {
      const creator = 'Rian Saputra';
      const settler = 'Siti Rahmawati';

      // 1. Order opened by Rian
      const openRes = await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, total, payment_method, payment_amount, status, cashier_name
        ) VALUES ('INV-HANDOVER-01', '2026-11-07', 'Meja 05', 1, 'Customer UMUM', 45000, 45000, 'tunai', 0, 'pending', ?)`,
        [creator]
      );
      const txId = openRes.lastInsertRowId;

      const initialRow = await db.getFirstAsync<{ cashier_name: string; status: string }>(
        'SELECT cashier_name, status FROM transactions WHERE id = ?',
        [txId]
      );
      assert.equal(initialRow?.cashier_name, creator);
      assert.equal(initialRow?.status, 'pending');

      // 2. Siti takes over shift and settles the bill
      await db.runAsync(
        `UPDATE transactions
         SET subtotal = 45000, total = 45000, payment_method = 'qris', payment_amount = 45000,
             status = 'completed', cashier_name = ?
         WHERE id = ?`,
        [settler, txId]
      );

      const finalRow = await db.getFirstAsync<{ cashier_name: string; status: string; payment_method: string }>(
        'SELECT cashier_name, status, payment_method FROM transactions WHERE id = ?',
        [txId]
      );
      assert.equal(finalRow?.cashier_name, settler, 'Settled transaction must reflect the settling cashier');
      assert.equal(finalRow?.status, 'completed');
      assert.equal(finalRow?.payment_method, 'qris');
    });

    test('4.3 - Unassigned cashier fallback strictly defaults to "Kasir" in SQLite schema and receipt formatters', async () => {
      // 1. Insert transaction omitting cashier_name to test SQLite DEFAULT 'Kasir'
      const res = await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, total, payment_method, payment_amount, status
        ) VALUES ('INV-DEFAULT-CASHIER', '2026-11-07', 'Meja 06', 1, 'Customer UMUM', 20000, 20000, 'tunai', 20000, 'completed')`
      );

      const txRow = await db.getFirstAsync<{ cashier_name: string }>(
        'SELECT cashier_name FROM transactions WHERE id = ?',
        [res.lastInsertRowId]
      );
      assert.equal(txRow?.cashier_name, 'Kasir', 'Database default value must be "Kasir"');

      // 2. Receipt formatter with empty or undefined cashierName
      const receiptData: PrintReceiptData = {
        storeName: 'Angkringan Jogja',
        invoiceNumber: 'INV-DEFAULT-CASHIER',
        businessDate: '2026-11-07',
        dateTimeString: '07 Nov 2026, 20:00',
        tableNumber: 'Meja 06',
        customerName: 'Customer UMUM',
        items: [{ name: 'Wedang Jahe', price: 6000, qty: 2, subtotal: 12000 }],
        subtotal: 12000,
        total: 12000,
        paymentMethod: 'tunai',
        paymentAmount: 12000,
        changeAmount: 0,
      };

      const lines = formatCustomerReceiptLines(receiptData);
      assert.ok(lines.some((l) => l.includes('Kasir    : Kasir')), 'Receipt must display fallback "Kasir"');

      const tempLines = formatTemporaryBillReceiptLines(receiptData);
      assert.ok(tempLines.some((l) => l.includes('Kasir    : Kasir')), 'Temporary bill must display fallback "Kasir"');
    });

    test('4.4 - Thermal receipt formatters render exact cashier names and withstand special characters', async () => {
      const specialCashierName = 'Bambang S. (Kasir #1 & Leader)';
      const receiptData: PrintReceiptData = {
        storeName: 'ANGKRINGAN JOGJA',
        invoiceNumber: 'INV-SPECIAL-CASHIER',
        businessDate: '2026-11-07',
        dateTimeString: '07 Nov 2026, 21:15',
        tableNumber: 'Lesehan VIP 01',
        customerName: 'Pak Joko Wi',
        cashierName: specialCashierName,
        items: [
          { name: 'Kopi Jos Arang', price: 7000, qty: 1, subtotal: 7000 },
          { name: 'Jadah Bakar', price: 4000, qty: 2, subtotal: 8000 },
        ],
        subtotal: 15000,
        total: 15000,
        paymentMethod: 'tunai',
        paymentAmount: 20000,
        changeAmount: 5000,
      };

      // Customer receipt check
      const customerReceipt = formatCustomerReceiptLines(receiptData);
      assert.ok(
        customerReceipt.some((l) => l.includes(`Kasir    : ${specialCashierName}`)),
        'Customer receipt must render full special character cashier name'
      );

      // Temporary bill check
      const tempBill = formatTemporaryBillReceiptLines(receiptData);
      assert.ok(
        tempBill.some((l) => l.includes(`Kasir    : ${specialCashierName}`)),
        'Temporary bill must render full special character cashier name'
      );
    });
  });
});
