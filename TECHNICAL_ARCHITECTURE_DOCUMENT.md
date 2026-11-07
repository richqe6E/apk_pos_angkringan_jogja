# TECHNICAL ARCHITECTURE DOCUMENT (TAD)
## APLIKASI POINT OF SALE (POS) KHUSUS ANGKRINGAN — OFFLINE ANDROID
**Versi Dokumen:** 1.0  
**Target Platform:** Android Tablet (Primary Landscape) & Android Smartphone (Portrait Compatible)  
**Lingkungan Eksekusi:** 100% Full Standalone Offline (SQLite Local Engine)

---

## 1. PENANGANAN OPERASIONAL LINTAS TENGAH MALAM (CROSS-MIDNIGHT SHIFT ARCHITECTURE)

### 1.1 Masalah Nyata Operasional Angkringan
Angkringan beroperasi pada rentang waktu: **Sore 17.30 WIB $\rightarrow$ Dini Hari 01.00 / 02.00 WIB**.  
Jika sistem hanya menggunakan tanggal kalender standar (`date('now')` / `YYYY-MM-DD`):
1. **Penjualan Terbelah Dua:** Transaksi jam 23.50 masuk laporan hari Jumat, sedangkan transaksi jam 00.15 masuk laporan hari Sabtu. Rekap omzet satu malam menjadi terpecah dan rusak.
2. **Reset Nomor Nota di Tengah Shift:** Nomor invoice yang me-reset pada jam 00.00 tengah malam akan membingungkan kasir dan pelanggan saat shift sedang ramai.
3. **Absensi Karyawan Terdistorsi:** Karyawan absen masuk Jumat 17.30, namun ketika toko tutup Sabtu 01.15, pencatatan absensi pulang akan mencari tanggal Sabtu dan mengacaukan perhitungan jam kerja.

---

### 1.2 Solusi Rekayasa: Konsep Tanggal Bisnis (`business_date`) & Sesi Operasional

Untuk menyelesaikan masalah ini secara tuntas dan presisi, sistem menerapkan **Konsep Tanggal Bisnis (`business_date`) yang diikat oleh Sesi Operasional Toko**:

```text
[Jumat, 17.30 WIB]                                   [Sabtu, 00.00 WIB]                   [Sabtu, 01.15 WIB]
Sesi Toko Dibuka                                    Pergantian Kalender                  Admin Tekan Tutup Sesi
       |                                                    |                                       |
       v                                                    v                                       v
business_date: '2026-11-06'                          business_date TETAP '2026-11-06'     business_date TETAP '2026-11-06'
Karyawan Absen Masuk                                 Transaksi Jam 00.20                  Seluruh Staf Absen Pulang Serentak
Nota: INV-061126-001                                 Nota: INV-061126-042 (Berlanjut)     Rekap Omzet 1 Malam Utuh Selesai
```

#### Aturan Sistem (Business Rules):
1. **Pemisahan `business_date` vs `created_at`:**
   * `created_at` (TIMESTAMP): Menyimpan stempel waktu fisik asli (misal: `2026-11-07 00:25:10`) untuk kebutuhan forensik dan audit jejak waktu riil.
   * `business_date` (TEXT - `YYYY-MM-DD`): Menyimpan tanggal buku operasional angkringan (misal: `2026-11-06`).
2. **Penentuan Otomatis `business_date` (Threshold Jam 06.00 Pagi):**
   * Transaksi antara pukul **06.00 pagi s.d. 23.59 malam** $\rightarrow$ `business_date = Tanggal Kalender Hari Ini`.
   * Transaksi antara pukul **00.00 malam s.d. 05.59 dini hari** $\rightarrow$ `business_date = Tanggal Kemarin (Sore saat shift dimulai)`.
   * *Hasil:* Seluruh transaksi penjualan, kas keluar darurat (beli es/arang), dan pesanan meja dari buka hingga tutup toko dini hari **100% terkonsolidasi dalam satu tanggal buku operasional yang utuh**.
3. **Absensi Karyawan Lintas Hari:**
   * Karyawan masuk Jumat 17.30 $\rightarrow$ `business_date = '2026-11-06'`, `check_in_time = '17:30'`.
   * Karyawan terkunci: tidak bisa absen masuk lagi pada `business_date = '2026-11-06'`.
   * Admin menekan tombol *"Tutup Sesi Operasional Toko"* pada Sabtu 01.15 dini hari:
     * Sistem memperbarui baris absensi dengan `business_date = '2026-11-06'`.
     * `check_out_time` dicatat jam riil penutupan: `'01:15'`.
     * Durasi jam kerja terhitung utuh (7 jam 45 menit) sebagai hari kerja **Jumat, 6 November 2026**.
     * Karyawan baru dapat melakukan absensi masuk lagi ketika sesi toko berikutnya dibuka pada Sabtu sore pukul 17.30 (`business_date = '2026-11-07'`).

---

## 2. ARSITEKTUR SISTEM (LAYERED ARCHITECTURE)

Sistem dirancang dengan pola **4-Tier Clean Layer** terisolasi:

```text
+-------------------------------------------------------------------------------+
|  1. PRESENTATION LAYER (React Native & Expo Router v6)                       |
|     - Layar Kasir Split-Panel (Katalog, Keranjang, Modal Bayar 2 Tahap)      |
|     - Layar Absensi Kamera, Keuangan Laba Rugi, Riwayat 3 Tab, Pengaturan     |
|     - UI Primitives (Button, Card, Badge Teks Semantik, Realtime Clock)       |
+---------------------------------------+---------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|  2. DOMAIN & STATE MANAGEMENT LAYER (Zustand 5 Modular Stores)                |
|     - transactionStore (Keranjang, Meja, Gabung Meja, Mutex Checkout)         |
|     - menuStore (Master Menu, Kategori, In-Memory Lookup O(1))                |
|     - attendanceStore (Absensi Masuk Kamera, Kunci Harian, Tutup Sesi)        |
|     - cashStore (Kas Beban Laba Rugi vs Non-Operasional)                      |
|     - financialStore (HPP Akhir Bulan, Laba Kotor, Laporan Finansial)         |
|     - customerStore (CRM Member, Tiering Reward Akumulatif)                   |
|     - supplierStore (Pembelian Tunai/Tempo, Picker Jatuh Tempo)               |
|     - printerStore (Koneksi Multi-Printer Bluetooth ESC/POS)                  |
+---------------------------------------+---------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|  3. DATA ACCESS & ENGINE LAYER (SQLite Local Persistence via expo-sqlite)     |
|     - PRAGMA journal_mode = 'wal' (Konkurensi tinggi & proteksi corrupt)     |
|     - PRAGMA busy_timeout = 10000ms & withSqliteRetry backoff helper          |
|     - B-Tree Composite Indexing pada business_date & created_at               |
|     - Atomic Daily Counter (INV-DDMMYY-XXX per business_date)                 |
+---------------------------------------+---------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|  4. HARDWARE & PLATFORM BRIDGE LAYER                                          |
|     - Bluetooth ESC/POS Thermal 58mm (Antrean cetak Customer, Kasir, Kitchen) |
|     - Expo Camera (Capture foto absensi & barcode scanner)                    |
|     - Expo FileSystem & DocumentPicker (Kompresi foto, JSON backup/restore)   |
|     - Expo Haptics & ScreenOrientation (Getaran taktil & landscape lock)      |
+-------------------------------------------------------------------------------+
```

---

## 3. SKEMA LENGKAP DATABASE SQLITE (15 TABEL RELASIONAL)

### 3.1 Tabel Konfigurasi & Sesi
```sql
-- 1. Pengaturan Toko & Preferensi
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 2. Sesi Operasional Harian Toko
CREATE TABLE IF NOT EXISTS operating_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_date TEXT NOT NULL UNIQUE,       -- 'YYYY-MM-DD' tanggal operasional
  opened_at TEXT NOT NULL,                  -- ISO timestamp jam buka toko (sore)
  closed_at TEXT,                           -- ISO timestamp jam tutup toko (dini hari)
  opened_by TEXT NOT NULL DEFAULT 'Kasir',
  closed_by TEXT,
  status TEXT NOT NULL DEFAULT 'open'       -- 'open' | 'closed'
);

-- 3. Penomoran Invoice Atomik Harian
CREATE TABLE IF NOT EXISTS daily_counters (
  business_date TEXT PRIMARY KEY,           -- Terikat ke tanggal operasional toko
  last_seq INTEGER NOT NULL DEFAULT 0
);
```

### 3.2 Tabel Katalog Menu
```sql
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
  track_stock INTEGER NOT NULL DEFAULT 0,   -- 0: Unlimited, 1: Track Stock
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

### 3.3 Tabel Transaksi & Meja (Open Bill)
```sql
-- 6. Transaksi Penjualan
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,      -- INV-DDMMYY-XXX
  business_date TEXT NOT NULL,              -- Terikat tanggal operasional
  table_number TEXT NOT NULL,               -- 'Meja 03', 'Meja 05-08' (gabung), 'Take-away'
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT 'Customer UMUM',
  subtotal REAL NOT NULL,
  tax_amount REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL,             -- 'tunai' | 'qris' | 'transfer'
  payment_amount REAL NOT NULL,
  change_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed' | 'pending' | 'merged'
  merged_into_tx_id INTEGER,                -- ID transaksi tujuan jika digabung
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  cashier_name TEXT NOT NULL DEFAULT 'Kasir'
);

-- 7. Item Detail Transaksi
CREATE TABLE IF NOT EXISTS transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  menu_id INTEGER NOT NULL REFERENCES menus(id),
  menu_name TEXT NOT NULL,
  price REAL NOT NULL,
  qty INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  is_additional INTEGER NOT NULL DEFAULT 0, -- 0: Pesanan Awal, 1: Pesanan Sambungan
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

### 3.4 Tabel Absensi & Staf Karyawan
```sql
-- 8. Master Karyawan
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 9. Log Absensi Harian (Terkunci per business_date)
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  business_date TEXT NOT NULL,              -- Mengikat absensi ke sesi malam hari
  check_in_time TEXT NOT NULL,              -- Jam masuk riil (e.g. '17:42')
  check_in_photo TEXT NOT NULL,             -- Path foto terkompresi lokal
  is_late INTEGER NOT NULL DEFAULT 0,       -- 0: Tepat Waktu, 1: Terlambat
  late_minutes INTEGER NOT NULL DEFAULT 0,  -- Jumlah menit terlambat dari 17.30
  check_out_time TEXT,                      -- Jam pulang serentak saat sesi toko ditutup
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  CONSTRAINT uq_emp_date UNIQUE (employee_id, business_date) -- Kunci 1x absen per hari
);
```

### 3.5 Tabel Customer & Reward Akumulatif
```sql
-- 10. Master Customer
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  total_spent REAL NOT NULL DEFAULT 0,      -- Akumulasi belanja seumur hidup (tetap)
  total_visits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 11. Tingkatan Reward
CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier_name TEXT NOT NULL,                  -- 'Tier 1: Free Wedang', 'Tier 2: Diskon 50rb'
  min_spend REAL NOT NULL,                  -- Syarat akumulasi belanja (e.g. 500000)
  reward_description TEXT NOT NULL
);
```

### 3.6 Tabel Supplier & Pembelian Barang
```sql
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
  payment_type TEXT NOT NULL,               -- 'tunai' | 'tempo'
  due_date TEXT,                            -- NULL jika tidak ada jatuh tempo, 'YYYY-MM-DD' jika ada
  receipt_photo_path TEXT DEFAULT '',       -- Path foto nota bukti beli
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

### 3.7 Tabel Buku Kas & HPP Akhir Bulan
```sql
-- 14. Buku Kas Masuk & Kas Keluar
CREATE TABLE IF NOT EXISTS cash_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_date TEXT NOT NULL,
  type TEXT NOT NULL,                       -- 'in' (Penerimaan) | 'out' (Pengeluaran)
  affects_pnl INTEGER NOT NULL DEFAULT 1,   -- 1: Memengaruhi Laba Rugi (Beban Operasional), 0: Non-Operasional
  category TEXT NOT NULL,                   -- 'listrik', 'plastik', 'arang', 'setor_bank', 'prive'
  amount REAL NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 15. HPP Global Bulanan Pemilik (Opsi A)
CREATE TABLE IF NOT EXISTS monthly_cogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_month TEXT NOT NULL UNIQUE,        -- 'YYYY-MM' e.g. '2026-11'
  total_cogs_amount REAL NOT NULL,          -- Nominal total modal yang diinput pemilik
  notes TEXT DEFAULT '',
  inputted_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

---

## 4. INDEKS PERFORMA TINGGI (B-TREE COMPOSITE INDEXES)

Untuk menjamin kueri pencarian transaksi dan filter laporan keuangan secepat kilat (< 20ms) di tablet Android:
```sql
CREATE INDEX IF NOT EXISTS idx_tx_biz_date ON transactions (business_date);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_tx_items_txid ON transaction_items (transaction_id);
CREATE INDEX IF NOT EXISTS idx_attendance_biz_date ON attendance (business_date);
CREATE INDEX IF NOT EXISTS idx_cash_biz_date ON cash_ledger (business_date);
CREATE INDEX IF NOT EXISTS idx_cash_pnl ON cash_ledger (affects_pnl, type);
CREATE INDEX IF NOT EXISTS idx_purchases_biz_date ON purchases (business_date);
```

---

## 5. PROTOKOL CETAK MULTI-PRINTER BLUETOOTH (SERIAL QUEUE)

Android hanya dapat mengalirkan data serial RFCOMM ke satu soket Bluetooth pada satu waktu. Untuk melayani pencetakan simultan (Struk Customer + Struk Dapur):
1. **Serial Execution Lock:** Sistem mengeksekusi cetak nota pelanggan ke Printer Kasir (MAC address A) $\rightarrow$ Tunggu konfirmasi selesai $\rightarrow$ Ganti koneksi socket ke Printer Dapur (MAC address B) $\rightarrow$ Cetak tiket pesanan dapur.
2. **Format Tiket Dapur (Kitchen Ticket):**
   * Lebar 32 kolom (ESC/POS 58mm).
   * Menampilkan: Header `TIKET DAPUR`, Nomor Meja (`MEJA 03`), Jam, Nama Menu, dan Kuantitas (*Contoh: `[x2] Nasi Teri`, `[x1] Wedang Jahe`*).
   * **NOL HARGA:** Baris harga satuan, subtotal, dan nominal uang diabaikan sepenuhnya.
3. **Format Struk Sambungan:**
   * Filter item: `WHERE transaction_id = ? AND is_additional = 1`.
   * Header: `PESANAN TAMBAHAN (SAMBUNGAN) - MEJA 03`.

---

## 6. DEFINISI KESIMPULAN ARSITEKTUR
Dokumen ini mengunci seluruh fondasi teknis: penanganan operasional lintas tengah malam berbasis `business_date`, skema 15 tabel relasional lengkap, indeks performa tinggi, dan antrean cetak multi-printer.

