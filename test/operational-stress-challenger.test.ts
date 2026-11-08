import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, type TestDatabase } from './helpers/db.js';
import {
  formatCustomerReceiptLines,
  formatTemporaryBillReceiptLines,
  type PrintReceiptData,
} from './helpers/receiptFormatter.js';

// Model helper types mirroring app contracts
interface CustomTable {
  id: string;
  name: string;
  type: 'meja' | 'lesehan' | 'other';
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

// Logic mirror of table-selector-modal.tsx pure algorithms
function detectTableType(name: string): 'meja' | 'lesehan' | 'other' {
  const lower = name.toLowerCase();
  if (lower.includes('lesehan')) return 'lesehan';
  if (lower.includes('meja')) return 'meja';
  return 'other';
}

function parseCustomTables(jsonString: string | null | undefined): CustomTable[] {
  const DEFAULT_PRESET_TABLES: CustomTable[] = [
    { id: 't1', name: 'Meja 01', type: 'meja' },
    { id: 't2', name: 'Meja 02', type: 'meja' },
    { id: 't3', name: 'Meja 03', type: 'meja' },
    { id: 't4', name: 'Meja 04', type: 'meja' },
    { id: 't5', name: 'Meja 05', type: 'meja' },
    { id: 't6', name: 'Meja 06', type: 'meja' },
    { id: 't7', name: 'Meja 07', type: 'meja' },
    { id: 't8', name: 'Meja 08', type: 'meja' },
    { id: 't9', name: 'Meja 09', type: 'meja' },
    { id: 't10', name: 'Meja 10', type: 'meja' },
    { id: 't11', name: 'Lesehan 01', type: 'lesehan' },
    { id: 't12', name: 'Lesehan 02', type: 'lesehan' },
    { id: 't13', name: 'Lesehan 03', type: 'lesehan' },
    { id: 't14', name: 'Lesehan 04', type: 'lesehan' },
    { id: 't15', name: 'Lesehan 05', type: 'lesehan' },
    { id: 't16', name: 'Bungkus / Take-away', type: 'other' },
  ];

  if (!jsonString) return DEFAULT_PRESET_TABLES;
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_PRESET_TABLES;
    }
    return parsed.map((item, idx) => {
      if (typeof item === 'string') {
        return {
          id: `t_${idx + 1}`,
          name: item.trim(),
          type: detectTableType(item),
        };
      }
      const rawName = String(item.name || `Meja ${idx + 1}`).trim();
      const type: 'meja' | 'lesehan' | 'other' =
        item.type === 'meja' || item.type === 'lesehan' || item.type === 'other'
          ? item.type
          : detectTableType(rawName);
      return {
        id: String(item.id || `t_${idx + 1}`),
        name: rawName,
        type,
      };
    });
  } catch {
    return DEFAULT_PRESET_TABLES;
  }
}

function validateTableName(
  name: string,
  existingTables: CustomTable[],
  excludeId?: string
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Nama meja wajib diisi.' };
  }
  const isDuplicate = existingTables.some(
    (t) => t.id !== excludeId && t.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (isDuplicate) {
    return { valid: false, error: `Meja dengan nama "${trimmed}" sudah terdaftar.` };
  }
  return { valid: true };
}

describe('Challenger 1: Operational Stress & Edge Case Test Suite', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // Challenge 1: Dynamic Table Management Operational Stress
  // =========================================================================
  describe('Challenge 1: Table Management Operational Stress & Edge Cases', () => {
    test('1.1 - Table renaming atomic synchronization: updates pending & billing orders while isolating completed history', async () => {
      const oldTable = 'Meja 05';
      const newTable = 'Gazebo VIP Melati';
      const bizDate = '2026-11-07';

      // 1. Setup multiple transactions on 'Meja 05':
      // a. Pending order
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-P-01', ?, ?, 25000, 25000, 'tunai', 0, 'pending')`,
        [bizDate, oldTable]
      );

      // b. Billing order
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-B-01', ?, ?, 40000, 40000, 'tunai', 0, 'billing')`,
        [bizDate, oldTable]
      );

      // c. Past Completed order (historical audit)
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-C-01', ?, ?, 65000, 65000, 'tunai', 65000, 'completed')`,
        [bizDate, oldTable]
      );

      // 2. Perform atomic table rename synchronization as executed by table-selector-modal
      await db.runAsync(
        "UPDATE transactions SET table_number = ? WHERE table_number = ? AND status IN ('pending', 'billing')",
        [newTable, oldTable]
      );

      // 3. Verify pending and billing orders now reference the new table name
      const pendingTx = await db.getFirstAsync<{ table_number: string }>(
        'SELECT table_number FROM transactions WHERE invoice_number = ?',
        ['INV-P-01']
      );
      assert.equal(pendingTx?.table_number, newTable, 'Pending order must sync to new table name');

      const billingTx = await db.getFirstAsync<{ table_number: string }>(
        'SELECT table_number FROM transactions WHERE invoice_number = ?',
        ['INV-B-01']
      );
      assert.equal(billingTx?.table_number, newTable, 'Billing order must sync to new table name');

      // 4. Verify completed order historical audit trail remains untouched
      const completedTx = await db.getFirstAsync<{ table_number: string }>(
        'SELECT table_number FROM transactions WHERE invoice_number = ?',
        ['INV-C-01']
      );
      assert.equal(completedTx?.table_number, oldTable, 'Historical completed transactions must retain original table name');
    });

    test('1.2 - Table deletion guard: blocks deletion if active pending/billing orders exist, permits deletion once settled', async () => {
      const tableName = 'Meja 09';
      const bizDate = '2026-11-07';

      // Seed custom_tables setting
      const initialTables: CustomTable[] = [
        { id: 't1', name: 'Meja 01', type: 'meja' },
        { id: 't9', name: tableName, type: 'meja' },
      ];
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_tables', ?)", [
        JSON.stringify(initialTables),
      ]);

      // 1. Create active pending order on Meja 09
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-DEL-01', ?, ?, 15000, 15000, 'tunai', 0, 'pending')`,
        [bizDate, tableName]
      );

      // 2. Execute deletion guard query
      const guardCheckPending = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM transactions WHERE table_number = ? AND status IN ('pending', 'billing')",
        [tableName]
      );
      const canDeleteWhilePending = ((guardCheckPending?.count as any) === 0);
      assert.equal(canDeleteWhilePending, false, 'Deletion must be strictly blocked when active pending order exists');
      assert.equal(guardCheckPending?.count, 1);

      // 3. Change status to billing
      await db.runAsync("UPDATE transactions SET status = 'billing' WHERE invoice_number = 'INV-DEL-01'");
      const guardCheckBilling = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM transactions WHERE table_number = ? AND status IN ('pending', 'billing')",
        [tableName]
      );
      const canDeleteWhileBilling = ((guardCheckBilling?.count as any) === 0);
      assert.equal(canDeleteWhileBilling, false, 'Deletion must be strictly blocked when order is in billing status');
      assert.equal(guardCheckBilling?.count, 1);

      // 4. Settle / Complete the order
      await db.runAsync("UPDATE transactions SET status = 'completed', payment_amount = 15000 WHERE invoice_number = 'INV-DEL-01'");
      const guardCheckSettled = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM transactions WHERE table_number = ? AND status IN ('pending', 'billing')",
        [tableName]
      );
      assert.equal(guardCheckSettled?.count, 0);
      const canDeleteAfterSettled = (guardCheckSettled?.count ?? 0) === 0;
      assert.equal(canDeleteAfterSettled, true, 'Deletion must be allowed once order is completed');

      // 5. Perform deletion from custom_tables
      const remainingTables = initialTables.filter((t) => t.name !== tableName);
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_tables', ?)", [
        JSON.stringify(remainingTables),
      ]);

      const storedRow = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'custom_tables'");
      const parsedStored = JSON.parse(storedRow!.value);
      assert.equal(parsedStored.length, 1);
      assert.equal(parsedStored[0].name, 'Meja 01');

      // 6. Ensure historical completed transaction row is still intact in SQLite
      const checkTx = await db.getFirstAsync<{ invoice_number: string }>(
        'SELECT invoice_number FROM transactions WHERE invoice_number = ?',
        ['INV-DEL-01']
      );
      assert.ok(checkTx, 'Completed transaction data must not be purged when custom table is deleted');
    });

    test('1.3 - Table name validation: duplicate detection, case-insensitivity, whitespace, self-edit exception', () => {
      const currentTables: CustomTable[] = [
        { id: 't1', name: 'Meja 01', type: 'meja' },
        { id: 't2', name: 'Lesehan Bambu', type: 'lesehan' },
        { id: 't3', name: 'Bungkus / Take-away', type: 'other' },
      ];

      // Exact duplicate
      const r1 = validateTableName('Meja 01', currentTables);
      assert.equal(r1.valid, false);
      assert.match(r1.error!, /sudah terdaftar/i);

      // Case-insensitive duplicate
      const r2 = validateTableName('meja 01', currentTables);
      assert.equal(r2.valid, false);

      const r3 = validateTableName('LESEHAN BAMBU', currentTables);
      assert.equal(r3.valid, false);

      // Leading/trailing whitespace duplicate
      const r4 = validateTableName('   Meja 01   ', currentTables);
      assert.equal(r4.valid, false);

      // Empty and whitespace-only name
      const r5 = validateTableName('', currentTables);
      assert.equal(r5.valid, false);
      assert.match(r5.error!, /wajib diisi/i);

      const r6 = validateTableName('     ', currentTables);
      assert.equal(r6.valid, false);

      // Self-edit exception (editing t1 keeping its name)
      const r7 = validateTableName('Meja 01', currentTables, 't1');
      assert.equal(r7.valid, true, 'Editing own table without name change must be allowed');

      // Valid new distinct name
      const r8 = validateTableName('Meja 02 VIP', currentTables);
      assert.equal(r8.valid, true);
    });

    test('1.4 - Special characters and symbols in table names', async () => {
      const specialName = `Lesehan #04 & 'Gazebo' <VIP> 🌟 "Pojok"`;

      const specialTables: CustomTable[] = [
        { id: 's1', name: specialName, type: 'lesehan' },
      ];

      // Save into settings JSON
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_tables', ?)", [
        JSON.stringify(specialTables),
      ]);

      const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'custom_tables'");
      const loaded = parseCustomTables(row?.value);
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].name, specialName);
      assert.equal(loaded[0].type, 'lesehan');

      // Store in transactions table with parameter binding (verifying SQL injection safety)
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-SPEC-01', '2026-11-07', ?, 12000, 12000, 'tunai', 0, 'pending')`,
        [specialName]
      );

      const savedTx = await db.getFirstAsync<{ table_number: string }>(
        'SELECT table_number FROM transactions WHERE invoice_number = ?',
        ['INV-SPEC-01']
      );
      assert.equal(savedTx?.table_number, specialName);
    });
  });

  // =========================================================================
  // Challenge 2: Cashier Identity Operational Stress & Boundaries
  // =========================================================================
  describe('Challenge 2: Cashier Identity Operational Stress & Boundaries', () => {
    test('2.1 - Diverse cashier names persistence in transactions', async () => {
      const cashiers = [
        'Budi Santoso',
        'Siti Aminah',
        "Ahmad 'Ompong' ☕",
        'Dr. H. Bambang S., S.E.',
        'A'.repeat(120), // Extreme length cashier name
      ];

      for (let i = 0; i < cashiers.length; i++) {
        const inv = `INV-CSH-${i + 1}`;
        const name = cashiers[i];
        await db.runAsync(
          `INSERT INTO transactions (
            invoice_number, business_date, table_number, subtotal, total,
            payment_method, payment_amount, change_amount, status, cashier_name
          ) VALUES (?, '2026-11-07', 'Meja 01', 10000, 10000, 'tunai', 10000, 0, 'completed', ?)`,
          [inv, name]
        );

        const row = await db.getFirstAsync<{ cashier_name: string }>(
          'SELECT cashier_name FROM transactions WHERE invoice_number = ?',
          [inv]
        );
        assert.equal(row?.cashier_name, name, `Cashier name "${name.slice(0, 20)}" must match exactly in SQLite`);
      }
    });

    test('2.2 - Empty/whitespace cashier name fallback strictly defaults to "Kasir"', async () => {
      // Logic simulation from transactionStore: (activeCashier || activeCashierName || 'Kasir')
      const resolveCashier = (activeCashier: any, activeCashierName: any): string => {
        const trimmed1 = typeof activeCashier === 'string' ? activeCashier.trim() : '';
        const trimmed2 = typeof activeCashierName === 'string' ? activeCashierName.trim() : '';
        return trimmed1 || trimmed2 || 'Kasir';
      };

      assert.equal(resolveCashier('', ''), 'Kasir');
      assert.equal(resolveCashier('   ', '   '), 'Kasir');
      assert.equal(resolveCashier(null, undefined), 'Kasir');
      assert.equal(resolveCashier(undefined, '   '), 'Kasir');
      assert.equal(resolveCashier('Siti', ''), 'Siti');

      // Database fallback default check
      await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, subtotal, total,
          payment_method, payment_amount, change_amount, status, cashier_name
        ) VALUES ('INV-FB-01', '2026-11-07', 'Meja 01', 5000, 5000, 'tunai', 5000, 0, 'completed', ?)`,
        [resolveCashier('', '')]
      );

      const row = await db.getFirstAsync<{ cashier_name: string }>(
        'SELECT cashier_name FROM transactions WHERE invoice_number = ?',
        ['INV-FB-01']
      );
      assert.equal(row?.cashier_name, 'Kasir');
    });

    test('2.3 - Switching cashiers midway: pending created by Cashier A, settled by Cashier B', async () => {
      const cashierA = 'Rian Hidayat';
      const cashierB = 'Dewi Sartika';
      const inv = 'INV-SHIFT-01';

      // 1. Cashier A creates a pending order
      await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, subtotal, total,
          payment_method, payment_amount, change_amount, status, cashier_name
        ) VALUES (?, '2026-11-07', 'Meja 03', 30000, 30000, 'tunai', 0, 0, 'pending', ?)`,
        [inv, cashierA]
      );

      const pendingRow = await db.getFirstAsync<{ cashier_name: string; status: string }>(
        'SELECT cashier_name, status FROM transactions WHERE invoice_number = ?',
        [inv]
      );
      assert.equal(pendingRow?.cashier_name, cashierA);
      assert.equal(pendingRow?.status, 'pending');

      // 2. Shift change occurs -> Cashier B is active. Cashier B settles the pending order
      await db.runAsync(
        `UPDATE transactions
         SET subtotal = 45000, total = 45000, payment_method = 'tunai',
             payment_amount = 50000, change_amount = 5000, status = 'completed',
             cashier_name = ?
         WHERE invoice_number = ?`,
        [cashierB, inv]
      );

      // 3. Verify final record attributes the settled transaction to Cashier B for cash drawer accountability
      const settledRow = await db.getFirstAsync<{ cashier_name: string; status: string; payment_amount: number }>(
        'SELECT cashier_name, status, payment_amount FROM transactions WHERE invoice_number = ?',
        [inv]
      );
      assert.equal(settledRow?.cashier_name, cashierB, 'Settled transaction must reflect the cashier who completed checkout');
      assert.equal(settledRow?.status, 'completed');
      assert.equal(settledRow?.payment_amount, 50000);
    });

    test('2.4 - Thermal receipt formatting with long and special cashier names', () => {
      const longName = 'Raden Mas Danang Joyodiningrat, S.Kom., M.T.';
      const receiptData: PrintReceiptData = {
        storeName: 'ANGKRINGAN JOGJA',
        storeAddress: 'Jl. Kaliurang KM 5',
        storePhone: '0811-2233-4455',
        receiptFooter: 'Matur Nuwun!',
        invoiceNumber: 'INV-RCP-01',
        businessDate: '2026-11-07',
        dateTimeString: '07 Nov 2026, 20:00',
        tableNumber: 'Meja VIP 01',
        customerName: 'Mas Danang',
        cashierName: longName,
        items: [{ name: 'Sate Usus Bakar', price: 3000, qty: 5, subtotal: 15000 }],
        subtotal: 15000,
        total: 15000,
        paymentMethod: 'tunai',
        paymentAmount: 20000,
        changeAmount: 5000,
      };

      // 1. Customer receipt contains cashier name
      const custReceipt = formatCustomerReceiptLines(receiptData);
      assert.ok(custReceipt.some((l) => l.includes(`Kasir    : ${longName}`)));

      // 2. Temporary bill receipt contains cashier name
      const tempBill = formatTemporaryBillReceiptLines(receiptData);
      assert.ok(tempBill.some((l) => l.includes(`Kasir    : ${longName}`)));

      // 3. Fallback when cashierName is empty string
      const fallbackData = { ...receiptData, cashierName: '' };
      const fallbackReceipt = formatCustomerReceiptLines(fallbackData);
      assert.ok(fallbackReceipt.some((l) => l.includes('Kasir    : Kasir')));
    });
  });

  // =========================================================================
  // Challenge 3: Quick Edit Operational Stress & Edge Cases
  // =========================================================================
  describe('Challenge 3: Quick Edit Price & Stock Stress Testing', () => {
    test('3.1 - Price extremes: Rp 0 complimentary item, high values, and negative input blocking', async () => {
      // Menu item ID 1: Nasi Kucing Sambal Teri
      const menuId = 1;

      // 1. Quick edit to Rp 0 (e.g. promo or complimentary item)
      await db.runAsync('UPDATE menus SET price = ?, stock = ? WHERE id = ?', [0, 50, menuId]);
      const freeMenu = await db.getFirstAsync<{ price: number; stock: number }>('SELECT price, stock FROM menus WHERE id = ?', [menuId]);
      assert.equal(freeMenu?.price, 0);

      // Verify transaction cart calculation with Rp 0 item
      const qty = 3;
      const subtotal = freeMenu!.price * qty;
      assert.equal(subtotal, 0);
      assert.equal(Number.isNaN(subtotal), false);

      // 2. Quick edit to extreme value (Rp 75,000,000)
      const extremePrice = 75000000;
      await db.runAsync('UPDATE menus SET price = ?, stock = ? WHERE id = ?', [extremePrice, 10, menuId]);
      const highMenu = await db.getFirstAsync<{ price: number }>('SELECT price FROM menus WHERE id = ?', [menuId]);
      assert.equal(highMenu?.price, extremePrice);

      const highSubtotal = highMenu!.price * 2;
      assert.equal(highSubtotal, 150000000);

      // 3. Negative price check (QuickEditModal validation logic)
      const validatePrice = (p: number) => p >= 0;
      assert.equal(validatePrice(-500), false);
      assert.equal(validatePrice(0), true);
      assert.equal(validatePrice(1000), true);
    });

    test('3.2 - Negative stock prevention and stepper clamp behavior', () => {
      // adjustStock simulation: setStock((prev) => Math.max(0, prev + delta))
      const adjustStock = (current: number, delta: number): number => Math.max(0, current + delta);

      assert.equal(adjustStock(2, -1), 1);
      assert.equal(adjustStock(2, -2), 0);
      assert.equal(adjustStock(2, -5), 0, 'Subtracting more than current stock must clamp strictly to 0');
      assert.equal(adjustStock(0, -1), 0, 'Subtracting from zero must remain 0');
      assert.equal(adjustStock(0, 5), 5);
    });

    test('3.3 - Rapid consecutive quick edits on the same menu item', async () => {
      const menuId = 3; // Sate Kulit Ayam
      const updates = [
        { price: 3000, stock: 10, name: 'Sate Kulit v1' },
        { price: 3500, stock: 15, name: 'Sate Kulit v2' },
        { price: 4000, stock: 20, name: 'Sate Kulit v3' },
        { price: 4500, stock: 25, name: 'Sate Kulit v4' },
        { price: 5000, stock: 30, name: 'Sate Kulit Spesial' },
      ];

      // Execute rapid sequential updates
      for (const upd of updates) {
        await db.runAsync(
          'UPDATE menus SET name = ?, price = ?, stock = ? WHERE id = ?',
          [upd.name, upd.price, upd.stock, menuId]
        );
      }

      // Final state must match the last update exactly
      const finalMenu = await db.getFirstAsync<{ name: string; price: number; stock: number }>(
        'SELECT name, price, stock FROM menus WHERE id = ?',
        [menuId]
      );
      assert.equal(finalMenu?.name, 'Sate Kulit Spesial');
      assert.equal(finalMenu?.price, 5000);
      assert.equal(finalMenu?.stock, 30);
    });

    test('3.4 - Deleting menu via Quick Edit: soft-delete preserves historical transactions', async () => {
      const menuId = 4; // Sate Usus Ayam

      // 1. Create historical transaction referencing menuId = 4
      await db.runAsync(
        `INSERT INTO transactions (invoice_number, business_date, table_number, subtotal, total, payment_method, payment_amount, status)
         VALUES ('INV-QD-01', '2026-11-07', 'Meja 01', 9000, 9000, 'tunai', 9000, 'completed')`
      );
      const tx = await db.getFirstAsync<{ id: number }>('SELECT id FROM transactions WHERE invoice_number = ?', ['INV-QD-01']);

      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
         VALUES (?, ?, 'Sate Usus Ayam', 3000, 3, 9000, 0)`,
        [tx!.id, menuId]
      );

      // 2. Perform Quick Edit Delete (soft-delete: UPDATE menus SET is_active = 0 WHERE id = ?)
      await db.runAsync('UPDATE menus SET is_active = 0 WHERE id = ?', [menuId]);

      // 3. Verify menu is hidden from active catalog
      const activeCatalog = await db.getAllAsync<{ id: number }>(
        'SELECT id FROM menus WHERE is_active = 1'
      );
      assert.ok(!activeCatalog.some((m) => m.id === menuId), 'Soft-deleted menu must be excluded from active catalog');

      // 4. Verify historical transaction item is unchanged
      const txItem = await db.getFirstAsync<{ menu_id: number; subtotal: number }>(
        'SELECT menu_id, subtotal FROM transaction_items WHERE transaction_id = ?',
        [tx!.id]
      );
      assert.equal(txItem?.menu_id, menuId);
      assert.equal(txItem?.subtotal, 9000);
    });
  });

  // =========================================================================
  // Challenge 4: Multi-Bank Accounts Robustness & Schema Validation
  // =========================================================================
  describe('Challenge 4: Multi-Bank Accounts Robustness & Schema Validation', () => {
    // Pure parser mirroring payment-modal.tsx load logic
    const parseBankAccounts = (jsonStr: string | null | undefined): BankAccount[] => {
      if (!jsonStr) return [];
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        return [];
      } catch {
        return [];
      }
    };

    test('4.1 - Empty array handling falls back gracefully without errors', () => {
      const result1 = parseBankAccounts('[]');
      assert.deepEqual(result1, []);

      const result2 = parseBankAccounts('');
      assert.deepEqual(result2, []);

      const result3 = parseBankAccounts(null);
      assert.deepEqual(result3, []);

      const result4 = parseBankAccounts(undefined);
      assert.deepEqual(result4, []);
    });

    test('4.2 - Corrupted JSON strings are caught safely by try/catch', () => {
      const badInputs = [
        '{invalid_json',
        '{"bank_name": "BCA"',
        'NOT_JSON_AT_ALL',
        '12345',
        'true',
        'null',
      ];

      for (const input of badInputs) {
        assert.doesNotThrow(() => {
          const res = parseBankAccounts(input);
          assert.deepEqual(res, []);
        }, `Corrupted JSON "${input}" must not throw uncaught error`);
      }
    });

    test('4.3 - Missing fields in BankAccount objects handled safely', () => {
      const accountsWithMissingFields: any[] = [
        { id: 'b1', bank_name: 'BCA', account_number: '1234567890' }, // account_holder missing
        { id: 'b2', account_number: '987654321', account_holder: 'Pak Joko' }, // bank_name missing
        { id: 'b3', bank_name: 'BRI' }, // account_number and account_holder missing
      ];

      const jsonStr = JSON.stringify(accountsWithMissingFields);
      const parsed = parseBankAccounts(jsonStr);
      assert.equal(parsed.length, 3);

      // Test display & copy helpers with missing fields
      const formatCopyAlert = (acc: any): string => {
        const bankName = (acc.bank_name || 'BANK').toUpperCase();
        const accNum = acc.account_number || '-';
        const holder = acc.account_holder || '-';
        return `Nomor Rekening ${bankName}:\n${accNum}\na.n. ${holder}`;
      };

      for (const acc of parsed) {
        assert.doesNotThrow(() => {
          const text = formatCopyAlert(acc);
          assert.ok(text.length > 0);
        });
      }

      // Check account with missing account_holder
      assert.match(formatCopyAlert(parsed[0]), /a\.n\. -/);
      // Check account with missing bank_name
      assert.match(formatCopyAlert(parsed[1]), /Nomor Rekening BANK:/);
    });

    test('4.4 - Account numbers with formatting (spaces, dashes) survive round-trip persistence', async () => {
      const bankAccounts: BankAccount[] = [
        {
          id: 'bca_01',
          bank_name: 'Bank Central Asia (BCA)',
          account_number: '123-456-7890',
          account_holder: 'Angkringan Jogja Pusat',
        },
        {
          id: 'mandiri_02',
          bank_name: 'Bank Mandiri',
          account_number: '137 00 1234567 8',
          account_holder: 'CV Angkringan Berkah',
        },
      ];

      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('bank_accounts', ?)", [
        JSON.stringify(bankAccounts),
      ]);

      const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'bank_accounts'");
      assert.ok(row);

      const parsed = parseBankAccounts(row.value);
      assert.equal(parsed.length, 2);
      assert.equal(parsed[0].account_number, '123-456-7890');
      assert.equal(parsed[1].account_number, '137 00 1234567 8');
    });
  });
});
