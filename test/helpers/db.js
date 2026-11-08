import { DatabaseSync } from 'node:sqlite';

/**
 * Creates an in-memory SQLite database initialized with the exact
 * 15-table schema and default seed data from the POS Angkringan Jogja application.
 */
export function createTestDb() {
  const syncDb = new DatabaseSync(':memory:');

  // Initialize PRAGMAs and 15 Tables
  syncDb.exec(`
    PRAGMA foreign_keys = ON;

    -- 1. Pengaturan Toko & Preferensi
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- 2. Sesi Operasional Harian Toko
    CREATE TABLE IF NOT EXISTS operating_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_date TEXT NOT NULL UNIQUE,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opened_by TEXT NOT NULL DEFAULT 'Kasir',
      closed_by TEXT,
      status TEXT NOT NULL DEFAULT 'open'
    );

    -- 3. Penomoran Invoice Atomik Harian (Reset per business_date)
    CREATE TABLE IF NOT EXISTS daily_counters (
      business_date TEXT PRIMARY KEY,
      last_seq INTEGER NOT NULL DEFAULT 0
    );

    -- 4. Kategori Menu
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT 'restaurant-outline'
    );

    -- 5. Master Menu
    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      image_path TEXT DEFAULT '',
      barcode TEXT DEFAULT '',
      track_stock INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- 6. Transaksi Penjualan
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      business_date TEXT NOT NULL,
      table_number TEXT NOT NULL,
      customer_id INTEGER,
      customer_name TEXT NOT NULL DEFAULT 'Customer UMUM',
      subtotal REAL NOT NULL,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_amount REAL NOT NULL,
      change_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      merged_into_tx_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      cashier_name TEXT NOT NULL DEFAULT 'Kasir'
    );

    -- 7. Item Detail Transaksi
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      menu_id INTEGER REFERENCES menus(id) ON DELETE SET NULL,
      menu_name TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      is_additional INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- 8. Master Karyawan
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      phone TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- 9. Log Absensi Harian
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      employee_name TEXT NOT NULL,
      business_date TEXT NOT NULL,
      check_in_time TEXT NOT NULL,
      check_in_photo TEXT NOT NULL,
      is_late INTEGER NOT NULL DEFAULT 0,
      late_minutes INTEGER NOT NULL DEFAULT 0,
      check_out_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      CONSTRAINT uq_emp_date UNIQUE (employee_id, business_date)
    );

    -- 10. Master Customer
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      total_spent REAL NOT NULL DEFAULT 0,
      total_visits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- 11. Tingkatan Reward Akumulatif
    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tier_name TEXT NOT NULL,
      min_spend REAL NOT NULL,
      reward_description TEXT NOT NULL
    );

    -- 11b. Klaim Reward Customer
    CREATE TABLE IF NOT EXISTS customer_reward_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      reward_id INTEGER REFERENCES rewards(id) ON DELETE SET NULL,
      tier_name TEXT NOT NULL,
      reward_description TEXT NOT NULL,
      claimed_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      claimed_by TEXT NOT NULL DEFAULT 'Kasir',
      notes TEXT DEFAULT ''
    );

    -- 12. Master Supplier
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- 13. Pembelian Barang
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      supplier_name TEXT NOT NULL,
      business_date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      payment_type TEXT NOT NULL,
      due_date TEXT,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      paid_at TEXT,
      receipt_photo_path TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- 14. Buku Kas Masuk & Kas Keluar
    CREATE TABLE IF NOT EXISTS cash_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_date TEXT NOT NULL,
      type TEXT NOT NULL,
      affects_pnl INTEGER NOT NULL DEFAULT 1,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- 15. HPP Global Bulanan Pemilik (Opsi A)
    CREATE TABLE IF NOT EXISTS monthly_cogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_month TEXT NOT NULL UNIQUE,
      total_cogs_amount REAL NOT NULL,
      notes TEXT DEFAULT '',
      inputted_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- Indeks
    CREATE INDEX IF NOT EXISTS idx_tx_biz_date ON transactions (business_date);
    CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions (status);
    CREATE INDEX IF NOT EXISTS idx_tx_items_txid ON transaction_items (transaction_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_biz_date ON attendance (business_date);
    CREATE INDEX IF NOT EXISTS idx_cash_biz_date ON cash_ledger (business_date);
    CREATE INDEX IF NOT EXISTS idx_cash_pnl ON cash_ledger (affects_pnl, type);
    CREATE INDEX IF NOT EXISTS idx_purchases_biz_date ON purchases (business_date);

    -- Data Pengaturan Default
    INSERT OR IGNORE INTO settings (key, value) VALUES ('store_name', 'Angkringan Jogja');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('store_address', 'Jl. Malioboro No. 45, Yogyakarta');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('store_phone', '0812-3456-7890');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_pin', '123456');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_footer', 'Matur Nuwun Sampun Rawuh!');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_enabled', '0');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_rate', '10');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('printer_cashier_mac', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('printer_kitchen_mac', '');

    -- Customer UMUM Default
    INSERT OR IGNORE INTO customers (id, name, phone, total_spent, total_visits)
    VALUES (1, 'Customer UMUM', '', 0, 0);

    -- Kategori Default
    INSERT OR IGNORE INTO categories (id, name, icon) VALUES (1, 'Nasi Kucing', 'restaurant');
    INSERT OR IGNORE INTO categories (id, name, icon) VALUES (2, 'Sate & Bakaran', 'flame');
    INSERT OR IGNORE INTO categories (id, name, icon) VALUES (3, 'Gorengan', 'fast-food');
    INSERT OR IGNORE INTO categories (id, name, icon) VALUES (4, 'Wedangan / Minuman', 'cafe');
    INSERT OR IGNORE INTO categories (id, name, icon) VALUES (5, 'Camilan', 'nutrition');

    INSERT OR IGNORE INTO settings (key, value) VALUES ('seed_menus_applied', '1');

    -- Master Menu Default
    INSERT OR IGNORE INTO menus (id, name, price, category_id, track_stock, stock, is_active) VALUES
      (1, 'Nasi Kucing Sambal Teri', 5000, 1, 0, 0, 1),
      (2, 'Nasi Kucing Oseng Tempe', 5000, 1, 0, 0, 1),
      (3, 'Nasi Kucing Bandeng', 5000, 1, 0, 0, 1),
      (4, 'Sate Usus Bakar', 3000, 2, 0, 0, 1),
      (5, 'Sate Telur Puyuh', 4000, 2, 0, 0, 1),
      (6, 'Sate Kulit Ayam', 3500, 2, 0, 0, 1),
      (7, 'Sate Cecek Pedas', 3000, 2, 0, 0, 1),
      (8, 'Tempe Mendoan Hangat', 2000, 3, 0, 0, 1),
      (9, 'Bakwan Sayur Krispi', 2000, 3, 0, 0, 1),
      (10, 'Tahu Isi Pedas', 2000, 3, 0, 0, 1),
      (11, 'Wedang Jahe Geprek', 6000, 4, 0, 0, 1),
      (12, 'Kopi Jos Arang Membara', 7000, 4, 0, 0, 1),
      (13, 'Teh Kampul Solo', 5000, 4, 0, 0, 1),
      (14, 'Wedang Uwuh Rempah', 7000, 4, 0, 0, 1),
      (15, 'Susu Jahe Hangat', 7000, 4, 0, 0, 1),
      (16, 'Jadah Bakar Manis Gurih', 4000, 5, 0, 0, 1);

    -- Tingkatan Reward Default
    INSERT OR IGNORE INTO rewards (id, tier_name, min_spend, reward_description) VALUES
      (1, 'Tier 1: Sahabat Angkringan', 300000, 'Gratis 1 Porsi Wedang Jahe / Teh Kampul'),
      (2, 'Tier 2: Langganan Setia', 600000, 'Gratis 3 Tusuk Sate Pilihan + 1 Nasi Kucing'),
      (3, 'Tier 3: Juragan Angkringan', 1000000, 'Potongan Langsung Rp 25.000 pada Transaksi');
  `);

  return {
    async execAsync(sql) {
      syncDb.exec(sql);
    },
    async runAsync(sql, params = []) {
      const stmt = syncDb.prepare(sql);
      const info = stmt.run(...params);
      return {
        lastInsertRowId: Number(info.lastInsertRowid),
        changes: Number(info.changes),
      };
    },
    async getFirstAsync(sql, params = []) {
      const stmt = syncDb.prepare(sql);
      const row = stmt.get(...params);
      return row ?? null;
    },
    async getAllAsync(sql, params = []) {
      const stmt = syncDb.prepare(sql);
      return stmt.all(...params);
    },
    async withTransactionAsync(task) {
      syncDb.exec('BEGIN IMMEDIATE TRANSACTION');
      try {
        const result = await task();
        syncDb.exec('COMMIT');
        return result;
      } catch (err) {
        try {
          syncDb.exec('ROLLBACK');
        } catch (_) {
          // Ignore rollback failure if already rolled back
        }
        throw err;
      }
    },
    close() {
      syncDb.close();
    },
  };
}
