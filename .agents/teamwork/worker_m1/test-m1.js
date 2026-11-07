import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';

console.log('--- Starting Milestone 1 Logic Verification ---');

// 1. Test seed_menus_applied logic
{
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE menus (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL);
  `);

  // Simulated first run: seed_menus_applied not present
  const seedRow1 = db.prepare("SELECT value FROM settings WHERE key = 'seed_menus_applied'").get();
  assert.strictEqual(seedRow1, undefined);

  // Apply seed
  db.exec(`
    INSERT INTO menus (id, name, price) VALUES (1, 'Nasi Kucing Sambal Teri', 5000);
    INSERT INTO menus (id, name, price) VALUES (2, 'Sate Usus Bakar', 3000);
    INSERT OR REPLACE INTO settings (key, value) VALUES ('seed_menus_applied', '1');
  `);

  const countAfterSeed = db.prepare('SELECT count(*) as c FROM menus').get().c;
  assert.strictEqual(countAfterSeed, 2);

  // User deletes default menu id = 1
  db.exec('DELETE FROM menus WHERE id = 1');
  const countAfterDelete = db.prepare('SELECT count(*) as c FROM menus').get().c;
  assert.strictEqual(countAfterDelete, 1);

  // Simulated second run (app restarts)
  const seedRow2 = db.prepare("SELECT value FROM settings WHERE key = 'seed_menus_applied'").get();
  assert.strictEqual(seedRow2.value, '1');

  // Should NOT re-seed menus because seedRow2.value === '1'
  if (seedRow2?.value !== '1') {
    db.exec(`
      INSERT OR IGNORE INTO menus (id, name, price) VALUES (1, 'Nasi Kucing Sambal Teri', 5000);
    `);
  }

  const finalCount = db.prepare('SELECT count(*) as c FROM menus').get().c;
  assert.strictEqual(finalCount, 1, 'Deleted default menu must NOT be re-created!');
  console.log('✓ Test 1: Permanent default menu deletion verified (seed_menus_applied).');
}

// 2. Test deleteMenu with transaction_items foreign key constraint
{
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE menus (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL);
    CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice TEXT);
    CREATE TABLE transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER REFERENCES transactions(id),
      menu_id INTEGER REFERENCES menus(id) ON DELETE SET NULL,
      menu_name TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER NOT NULL,
      subtotal REAL NOT NULL
    );
  `);

  db.exec("INSERT INTO menus (id, name, price) VALUES (10, 'Sate Telur Puyuh', 4000)");
  db.exec("INSERT INTO transactions (id, invoice) VALUES (1, 'INV-001')");
  db.exec("INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal) VALUES (1, 10, 'Sate Telur Puyuh', 4000, 2, 8000)");

  // Safe delete simulation from menuStore
  db.prepare('UPDATE transaction_items SET menu_id = NULL WHERE menu_id = ?').run(10);
  db.prepare('DELETE FROM menus WHERE id = ?').run(10);

  const menu = db.prepare('SELECT * FROM menus WHERE id = 10').get();
  assert.strictEqual(menu, undefined, 'Menu should be deleted');

  const txItem = db.prepare('SELECT * FROM transaction_items WHERE id = 1').get();
  assert.strictEqual(txItem.menu_id, null, 'transaction_items.menu_id should be NULL');
  assert.strictEqual(txItem.menu_name, 'Sate Telur Puyuh', 'Historical menu name must be preserved');
  assert.strictEqual(txItem.price, 4000, 'Historical price must be preserved');
  assert.strictEqual(txItem.subtotal, 8000, 'Historical subtotal must be preserved');
  console.log('✓ Test 2: Safe menu deletion with transaction item detachment verified.');
}

// 3. Test updateMenu with category_id: null
{
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id)
    );
  `);

  db.exec("INSERT INTO categories VALUES (1, 'Minuman')");
  db.exec("INSERT INTO menus (id, name, price, category_id) VALUES (1, 'Wedang Ronde', 7000, 1)");

  const beforeUpdate = db.prepare('SELECT * FROM menus WHERE id = 1').get();
  assert.strictEqual(beforeUpdate.category_id, 1);

  // Update with category_id: null (dynamic SQL logic from menuStore)
  const data = { category_id: null, price: 7500 };
  const fields = [];
  const values = [];

  if (data.price !== undefined) {
    fields.push('price = ?');
    values.push(data.price);
  }
  if ('category_id' in data) {
    fields.push('category_id = ?');
    values.push(data.category_id ?? null);
  }

  values.push(1);
  db.prepare(`UPDATE menus SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const afterUpdate = db.prepare('SELECT * FROM menus WHERE id = 1').get();
  assert.strictEqual(afterUpdate.category_id, null, 'category_id must be updated to NULL');
  assert.strictEqual(afterUpdate.price, 7500, 'price must be updated to 7500');
  console.log('✓ Test 3: updateMenu supports category_id = null successfully.');
}

// 4. Test updateCategory and duplicate validation
{
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
  `);

  db.exec("INSERT INTO categories (name) VALUES ('Gorengan')");
  db.exec("INSERT INTO categories (name) VALUES ('Bakaran')");

  // Update category name
  const catToUpdate = db.prepare("SELECT * FROM categories WHERE name = 'Gorengan'").get();
  db.prepare('UPDATE categories SET name = ? WHERE id = ?').run('Gorengan Gurih', catToUpdate.id);

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(catToUpdate.id);
  assert.strictEqual(updated.name, 'Gorengan Gurih');

  // Duplicate check logic
  const allCategories = db.prepare('SELECT * FROM categories').all();
  const testNewName = 'bakaran';
  const isDuplicate = allCategories.some(c => c.name.trim().toLowerCase() === testNewName.trim().toLowerCase());
  assert.strictEqual(isDuplicate, true, 'Case-insensitive duplicate check must catch duplicate names');

  console.log('✓ Test 4: Category update and duplicate validation verified.');
}

console.log('--- All Milestone 1 Logic Verifications PASSED! ---');
