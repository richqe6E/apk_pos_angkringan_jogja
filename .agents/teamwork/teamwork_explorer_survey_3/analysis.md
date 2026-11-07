# Laporan Analisis Teknis & Evaluasi Fungsional
## Explorer 3: Data Layer, State Management & Integrations Explorer
**Proyek**: POS Angkringan Jogja (Pure Android Offline POS)  
**Tanggal Investigasi**: 7 November 2026  
**Status**: Investigasi Read-Only Selesai (Temuan Lengkap & Terverifikasi)  

---

## 1. Arsitektur Data Storage & State Management

### 1.1 Mekanisme Penyimpanan Fisik (Persistence Mechanism)
- **Engine**: SQLite lokal murni menggunakan pustaka modern Expo SDK 54 yaitu `expo-sqlite` (versi `~16.0.10`). Berkas basis data fisik disimpan secara lokal di media penyimpanan internal perangkat Android tablet dengan nama berkas `pos_angkringan.db`.
- **Mode Konkurensi & Integritas**:
  - Mode Jurnal: WAL (*Write-Ahead Logging*) via `PRAGMA journal_mode = 'wal';`
  - Sinkronisasi: `PRAGMA synchronous = NORMAL;`
  - Timeout Penguncian: `PRAGMA busy_timeout = 10000;` (10 detik)
  - Integritas Relasional: `PRAGMA foreign_keys = ON;`
  - Retry Helper: Dibungkus oleh fungsi utilitas `withSqliteRetry` (`services/database.ts:11-31`) yang menerapkan *exponential backoff retry* (3x percobaan dengan interval 150ms progresif) untuk mengeliminasi galat konkurensi `SQLITE_BUSY` atau *database locked* saat transaksi kasir berjalan simultan dengan pencatatan background.
- **Penyimpanan Foto Fisik**:
  - Foto absensi masuk karyawan dan foto nota pembelian bahan kulakan disimpan sebagai berkas citra terkompresi di direktori internal aplikasi via `expo-file-system/legacy` (`utils/imageStorage.ts`), sedangkan SQLite hanya menyimpan referensi URI lokal (`check_in_photo`, `receipt_photo_path`, `qris_image_path`).
- **Penyimpanan State Aplikasi**:
  - Manajemen state reaktif dikendalikan oleh **Zustand** (versi `^5.0.14`), terbagi ke dalam 8 modul store independen di bawah direktori `stores/`.

### 1.2 Peta Modul Store & Entitas Relasional
Arsitektur data terdistribusi secara terstruktur antara modul UI, layer store Zustand, dan tabel relasional SQLite:

| Modul Store | Berkas Sumber | Tabel SQLite Terkait | Tanggung Jawab Utama |
|---|---|---|---|
| `useMenuStore` | `stores/menuStore.ts` | `menus`, `categories` | Manajemen katalog menu, navigasi kategori, quick edit harga/stok, pencarian, dan pemindaian barcode. |
| `useTransactionStore` | `stores/transactionStore.ts` | `transactions`, `transaction_items`, `daily_counters`, `settings` | Keranjang belanja, pesanan pending meja, pelacakan delta pesanan tambahan (`is_additional`), penggabungan meja, dan checkout 2 tahap. |
| `useEmployeeStore` | `stores/employeeStore.ts` | `employees` | Master data staf/karyawan, status aktif/nonaktif, dan validasi duplikasi nama. |
| `useAttendanceStore` | `stores/attendanceStore.ts` | `attendance`, `operating_sessions` | Absensi kamera harian, perhitungan keterlambatan (patokan 17.30 WIB), penutupan sesi shift operasional, dan pembersihan foto usang. |
| `useCustomerStore` | `stores/customerStore.ts` | `customers`, `rewards` | Master pelanggan, riwayat akumulasi belanja seumur hidup, evaluasi tier hadiah, dan histori belanja. |
| `usePurchaseStore` | `stores/purchaseStore.ts` | `suppliers`, `purchases`, `cash_ledger` | Master supplier, pencatatan belanja tunai/tempo, akumulasi utang tempo, dan pelunasan utang kulakan. |
| `useFinancialStore` | `stores/financialStore.ts` | `cash_ledger`, `monthly_cogs`, `transactions` | Buku kas masuk/keluar, segregasi PnL/non-PnL, HPP global bulanan (Opsi A), dan laporan laba rugi anti-double-counting. |
| `usePrinterStore` | `stores/printerStore.ts` | `settings` | Konfigurasi MAC address printer Bluetooth kasir & dapur, serta pengaturan auto-print. |

---

## 2. Investigasi Mendalam Masalah Menu Bawaan (Default Menu Items)

### 2.1 Lokasi dan Alur Inisialisasi Seed Data Menu
- Master menu awal diinisialisasi dalam fungsi `migrateDbIfNeeded(db)` pada berkas `services/database.ts` (baris 276-292) bersama kategori default (baris 269-273).
- Menu bawaan mencakup 16 item khas angkringan (ID 1 sampai 16: *Nasi Kucing Sambal Teri*, *Nasi Kucing Oseng Tempe*, *Sate Usus*, *Sate Telur Puyuh*, *Kopi Jos Arang*, *Wedang Uwuh*, dll.).

### 2.2 Akar Penyebab Bug: Mengapa Menu Bawaan Gagal Dihapus atau Muncul Kembali?
Berdasarkan penelusuran kode, ditemukan **dua penyebab teknis fundamental** yang saling terkait:

1. **Kendala Integritas Relasional Foreign Key (`RESTRICT` bawaan)**:
   - Skema tabel `transaction_items` didefinisikan sebagai berikut (`services/database.ts:137`):
     ```sql
     CREATE TABLE IF NOT EXISTS transaction_items (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
       menu_id INTEGER NOT NULL REFERENCES menus(id),
       ...
     );
     ```
   - Perhatikan bahwa kolom `menu_id` memiliki foreign key ke `menus(id)` **tanpa klausul `ON DELETE SET NULL` atau `ON DELETE CASCADE`**.
   - Ketika `PRAGMA foreign_keys = ON;` aktif, jika menu dengan ID 1 s/d 16 pernah masuk ke dalam catatan transaksi (baik berstatus `completed`, `pending`, `merged`, maupun riwayat pengujian), eksekusi kueri penghapusan menu di `stores/menuStore.ts:175`:
     ```ts
     await db.runAsync('DELETE FROM menus WHERE id = ?', [id]);
     ```
     akan **ditolak keras oleh engine SQLite** dengan galat:
     `FOREIGN KEY constraint failed (code 787 SQLITE_CONSTRAINT_FOREIGNKEY)`.
   - UI menangkap galat ini dan menampilkan *Alert Gagal Hapus*, sehingga pengguna merasa menu tidak dapat dihapus.

2. **Masalah Eksekusi `PRAGMA user_version = 1;` di Akhir Multi-Statement**:
   - Pada baris 301 `services/database.ts`, `PRAGMA user_version = 1;` ditempatkan di dalam string multi-statement raksasa pada `await db.execAsync(...)`.
   - Pada `expo-sqlite`, perintah `PRAGMA` di tengah atau akhir blok multi-kueri batch dapat diabaikan atau gagal memperbarui nilai `user_version` basis data.
   - Akibatnya, pada pemeriksaan awal migrasi (`services/database.ts:60-63`):
     ```ts
     const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
     const currentVersion = versionRow?.user_version ?? 0;
     if (currentVersion >= DATABASE_VERSION) { return; }
     ```
     Jika `currentVersion` tetap `0`, fungsi migrasi akan dieksekusi ulang setiap kali aplikasi dibuka (`app/_layout.tsx:30-37`).
   - Karena seed data menggunakan perintah:
     ```sql
     INSERT OR IGNORE INTO menus (id, name, price, category_id, track_stock, stock) VALUES (1, 'Nasi Kucing Sambal Teri', ...);
     ```
     Jika pengguna berhasil menghapus menu #1 (misal belum ada transaksi terkait), ID 1 menjadi kosong. Saat aplikasi dimulai ulang, `INSERT OR IGNORE` melihat ID 1 tidak ada, lalu **memasukkan kembali (re-seed) menu bawaan tersebut secara otomatis**!

### 2.3 Solusi Teknis yang Direkomendasikan
1. Ubah foreign key relasional `transaction_items` menjadi `menu_id INTEGER REFERENCES menus(id) ON DELETE SET NULL` atau tambahkan kolom soft-delete `is_deleted INTEGER NOT NULL DEFAULT 0` pada tabel `menus`.
2. Pisahkan inisialisasi seed data default dengan penanda status di tabel `settings` (misal `key = 'initial_seed_done', value = '1'`), sehingga seed data **hanya dijalankan sekali seumur hidup aplikasi** dan tidak pernah mengembalikan menu yang sengaja dihapus oleh pemilik toko.
3. Pastikan `PRAGMA user_version` diperbarui secara eksplisit menggunakan kueri terpisah `await db.runAsync('PRAGMA user_version = 1')`.

---

## 3. Investigasi Manajemen Meja Dinamis & Integrasi Kasir (R4)

### 3.1 Status Representasi Meja Saat Ini
- Di dalam skema 15 tabel `services/database.ts`, **TIDAK ADA tabel khusus meja (`tables`)**.
- Representasi daftar meja saat ini **100% di-hardcode** sebagai konstanta JavaScript statis di berkas `components/table-selector-modal.tsx` (baris 28-33):
  ```ts
  const PRESET_TABLES = [
    'Meja 01', 'Meja 02', 'Meja 03', 'Meja 04', 'Meja 05',
    'Meja 06', 'Meja 07', 'Meja 08', 'Meja 09', 'Meja 10',
    'Lesehan 01', 'Lesehan 02', 'Lesehan 03', 'Lesehan 04', 'Lesehan 05',
    'Bungkus / Take-away'
  ];
  ```
- Pada tabel `transactions`, nomor meja disimpan sebagai string teks bebas pada kolom `table_number TEXT NOT NULL`.

### 3.2 Analisis Kebutuhan CRUD Meja Dinamis
Untuk memenuhi kriteria R4 (pemilik usaha dapat menambah meja baru, mengedit nama meja, dan mengedit nomor meja secara dinamis):
- **Struktur Penyimpanan Data Meja yang Direkomendasikan**:
  Tambahkan tabel ke-16 atau simpan dalam format terstruktur pada `settings`:
  *Opsi Skema Tabel Relasional*:
  ```sql
  CREATE TABLE IF NOT EXISTS store_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number TEXT NOT NULL UNIQUE,
    table_name TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  ```
  *Seed Awal Tabel Dinamis*: Meja 01 s/d Meja 10, Lesehan 01 s/d Lesehan 05, Bungkus / Take-away.
- **Integrasi dengan State Kasir (`stores/transactionStore.ts`)**:
  - Store memuat daftar meja aktif dari basis data saat inisialisasi (`loadStoreTables`).
  - Modal pemilih meja (`components/table-selector-modal.tsx`) membaca data dinamis tersebut dan menyediakan antarmuka CRUD (modal tambah/edit meja dengan input nomor meja dan nama meja).
  - Tampilan visual meja dapat mengintegrasikan status pesanan pending secara langsung:
    - Hijau (Tersedia / Kosong)
    - Kuning (Terisi / Pending Order Aktif)
    - Oranye (Billing / Sedang Minta Tagihan Sementara)
  - Fitur penggabungan meja (`mergeTables`) dan perubahan meja transaksi pending tetap kompatibel karena tetap mengacu pada `table_number` dinamis.

---

## 4. Investigasi Identitas Kasir Operasional (R5)

### 4.1 Kondisi Eksisting
- **Struktur Tabel Transaksi**:
  Kolom `cashier_name TEXT NOT NULL DEFAULT 'Kasir'` sudah tersedia di tabel `transactions` (`services/database.ts:130`).
- **Data Master Karyawan**:
  Tabel `employees` (`id, name, phone, is_active, created_at`) dikelola penuh melalui `stores/employeeStore.ts`.
- **Kelemahan Implementasi Saat Ini**:
  1. Pada `app/(tabs)/index.tsx:129`, tombol *"Buka Kasir Transaksi"* langsung mengarahkan ke rute `/transaksi` via `router.push('/transaksi')` **tanpa ada alur pemilihan kasir bertugas**.
  2. Pada `stores/transactionStore.ts`, state transaksi (`TransactionState`) **tidak memiliki properti identitas kasir** (`cashierName` atau `cashierId`).
  3. Kueri penyimpanan transaksi pending (`saveAsPendingOrder` baris 559) dan pembayaran selesai (`checkout` baris 772) **tidak memasukkan nilai `cashier_name`**, sehingga selalu jatuh kembali ke nilai default bawaan SQL (`'Kasir'`).
  4. Pada `app/transaksi.tsx` (baris 201 dan 607), nilai `cashierName: 'Kasir'` di-hardcode secara statis pada payload cetak struk customer dan tagihan sementara.

### 4.2 Desain Alur Pemilihan Kasir yang Sesuai Regulasi Operasional
1. **Modal Pemilihan Kasir (Gatekeeper)**:
   - Sebelum membuka layar transaksi `/transaksi` dari dashboard (atau saat pertama kali masuk ke kasir), sistem memunculkan modal wajib: *"Pilih Kasir Bertugas"*.
   - Kasir dipilih dari daftar staf aktif (`employees WHERE is_active = 1`).
   - Jika belum ada data karyawan terdaftar, sistem memberikan peringatan untuk mendaftarkan minimal 1 karyawan atau menggunakan mode supervisor darurat.
2. **Propagasi State & Persistensi**:
   - Tambahkan `cashierName: string` ke `TransactionState` di `stores/transactionStore.ts`.
   - Simpan `cashier_name` yang dipilih ke dalam setiap `INSERT INTO transactions` (baik status `pending` maupun `completed`).
3. **Pencantuman pada Struk**:
   - Struk Penjualan Customer (`printCustomerReceipt`): Menampilkan baris `Kasir : [Nama Kasir]`.
   - Struk Tagihan Sementara (`formatTemporaryBillReceipt` & `printTemporaryBill`): Menampilkan baris `Kasir : [Nama Kasir]`.
   - Struk Audit Internal / Tutup Shift Kasir: Menampilkan ringkasan omset dan total transaksi yang ditangani oleh masing-masing nama kasir terkait.

---

## 5. Investigasi Customer Rewards & Pembelian Supplier (R6)

### 5.1 Skema Customer Rewards
- **Tabel Basis Data**: `rewards` (`id, tier_name, min_spend, reward_description`) dan `customers` (`id, name, phone, total_spent, total_visits`).
- **Logika Akumulasi & Tiering**:
  - Akumulasi belanja bertambah otomatis pada saat kasir menyelesaikan pembayaran non-tunai/tunai di `stores/transactionStore.ts:813-820`:
    ```sql
    UPDATE customers SET total_spent = total_spent + ?, total_visits = total_visits + 1 WHERE id = ?
    ```
  - Pada `stores/customerStore.ts:97-121`, tier hadiah dievaluasi secara dinamis dengan mengurutkan tier berdasarkan `min_spend` secara descending.
- **Kondisi Form `RewardTierModal`**:
  - Berkas `components/reward-tier-modal.tsx` sudah memiliki komponen input lengkap:
    - Nama Tingkatan Tier (`tierName`)
    - Ambang Batas Belanja Minimal Rupiah (`minSpendText` dengan formatter rupiah otomatis)
    - Keterangan Hadiah Reward (`rewardDescription`)
  - Aksi tombol kanan atas di `app/customers.tsx:104` memanggil `setRewardTierModalVisible(true)` yang membuka form ini.

### 5.2 Skema Pembelian Supplier & Integrasi Finansial
- **Tabel Basis Data**: `suppliers` (`id, name, phone`), `purchases` (`id, supplier_id, supplier_name, business_date, total_amount, payment_type, due_date, payment_status, paid_at, receipt_photo_path, notes`), dan `cash_ledger`.
- **Integrasi Alur Finansial**:
  - Terverifikasi pada `stores/purchaseStore.ts:145-200`:
    - **Pembelian Tunai (`cash`)**:
      Status langsung `'paid'`. Dalam transaksi atomik database (`withTransactionAsync`), sistem otomatis menyisipkan entri pengeluaran ke buku kas:
      ```sql
      INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
      VALUES (?, 'expense', 1, 'Pembelian Bahan/Kulakan', ?, ?)
      ```
      Ini langsung memotong kas fisik laci dan dihitung sebagai beban operasional PnL pada laporan keuangan.
    - **Pembelian Tempo / Utang (`tempo`)**:
      Status ditetapkan sebagai `'unpaid'`. Transaksi ini **TIDAK mencemari buku kas fisik** saat pembelian berlangsung. Total utang tempo diagregasikan per supplier:
      ```sql
      SELECT supplier_id, SUM(total_amount) as debt FROM purchases WHERE payment_type = 'tempo' AND payment_status = 'unpaid' GROUP BY supplier_id
      ```
    - **Pelunasan Utang Tempo (`settleTempoDebt`)**:
      Saat pemilik melunasi utang (`purchaseStore.ts:202-235`), status pembelian diubah menjadi `'paid'`, dan entri kas keluar dicatat di `cash_ledger` dengan kategori `'Pelunasan Hutang Supplier'` (`type = 'expense', affects_pnl = 1`).

---

## 6. Investigasi Absensi & Pemetaan Kalender (R7)

### 6.1 Struktur Data Absensi
- **Tabel**: `attendance` (`id, employee_id, employee_name, business_date, check_in_time, check_in_photo, is_late, late_minutes, check_out_time, created_at`).
- **Aturan Bisnis Terverifikasi**:
  - Tanggal operasional dihitung via `sessionHelper.ts:getBusinessDate()` (siklus jam kerja sore s/d dini hari dengan batas potong jam 06.00 WIB).
  - Satu karyawan hanya diizinkan absen 1 kali per tanggal bisnis melalui constraint `CONSTRAINT uq_emp_date UNIQUE (employee_id, business_date)`.
  - Penutupan shift harian mencatat `check_out_time` seluruh karyawan aktif secara serentak (`attendanceStore.ts:140-146`).

### 6.2 Kesenjangan Tampilan Riwayat Eksisting
- Pada `app/(tabs)/attendance.tsx:350-376`, tab *"Rekap & Riwayat"* saat ini hanya menampilkan daftar vertikal (`FlatList`) sederhana dari seluruh riwayat absensi.
- Tidak tersedia kalender visual bulanan untuk melihat distribusi kehadiran karyawan per tanggal.

### 6.3 Desain Arsitektur Kalender Bulanan Interaktif (R7)
1. **Pemetaan Tanggal**:
   - Basis pencarian: `SELECT * FROM attendance WHERE business_date LIKE 'YYYY-MM%'`.
   - Buat matriks 7x5 atau 7x6 hari dalam bulan aktif (Senin s/d Minggu).
2. **Indikator Kehadiran pada Sel Kalender**:
   - Sel tanggal menampilkan nomor tanggal (1..31).
   - Tanda warna/badge ringkas:
     - Hijau: Ada kehadiran tepat waktu.
     - Merah/Kuning: Ada staf terlambat (`is_late = 1`).
     - Abu-abu/Kosong: Tidak ada operasional / libur.
3. **Interaktivitas Pemilihan Tanggal**:
   - Mengklik tanggal tertentu (`selectedDate = 'YYYY-MM-DD'`) langsung memfilter daftar rincian absensi di panel bawah: nama karyawan, jam masuk, status keterlambatan, foto kehadiran, dan jam pulang.

---

## 7. Investigasi Pengaturan Pembayaran: QRIS & Multi-Bank (R8)

### 7.1 Tempat Penyimpanan
Pengaturan disimpan di tabel `settings` (KeyValue store):
- `qris_image_path`: Path berkas fisik foto QRIS statis yang disimpan lokal di direktori `logo/`.
- `bank_accounts`: String JSON yang memuat daftar rekening bank toko, misalnya:
  ```json
  [
    {
      "id": "1731000000000",
      "bank_name": "BCA",
      "account_number": "1234567890",
      "account_holder": "Angkringan Jogja"
    },
    {
      "id": "1731000001000",
      "bank_name": "Bank Mandiri",
      "account_number": "1370012345678",
      "account_holder": "Angkringan Jogja"
    }
  ]
  ```

### 7.2 Akar Penyebab Bug di Layar Pembayaran Kasir
- Di `app/(tabs)/settings.tsx`, formulir unggah foto QRIS toko (`handlePickQrisImage`) dan pendaftaran beberapa rekening transfer bank (`handleSaveBankAccount`) **sudah tersedia dan berfungsi normal**.
- Di `components/payment-modal.tsx:88-107`, kode pemanggilan `qris_image_path` dan `bank_accounts` dari SQLite **sudah dijalankan ke state lokal**.
- **Namun, di bagian render JSX (`components/payment-modal.tsx:354-364`)**:
  Komponen UI sama sekali **tidak menampilkan foto QRIS maupun daftar rekening bank**. Komponen hanya menampilkan kotak placeholder abu-abu statis berisi emoji handphone `📱` dan teks statis *"Siap Terima Pembayaran..."*.
- Akibatnya, saat kasir memilih metode QRIS atau Transfer di hadapan pelanggan, pelanggan tidak dapat melihat kode QR untuk dipindai dan kasir tidak dapat melihat nomor rekening toko untuk diberikan ke pelanggan.

---

## 8. Evaluasi Mendalam Fitur Struk Tagihan Sementara (R3)

### 8.1 Penelusuran Kode & Alur Eksekusi
Fitur tagihan sementara (*temporary bill / print bill*) diimplementasikan pada beberapa titik:
1. `services/print.ts`:
   - `formatTemporaryBillReceipt(data: PrintReceiptData)` (baris 313-357): Pemformatan teks 32 karakter untuk kertas thermal 58mm.
   - `printTemporaryBill(data: PrintReceiptData)` (baris 362-473): Eksekusi pengiriman ESC/POS via Bluetooth ke printer kasir.
2. `stores/transactionStore.ts`:
   - `markTableAsBilling(db, txId)` (baris 392-397): Mengubah status transaksi pending dari `'pending'` menjadi `'billing'`.
3. `components/receipt-preview-modal.tsx`:
   - Tab `'temp_bill'` (baris 113-121): Merender pratinjau kertas thermal realistis dengan watermark peringatan.
4. `app/transaksi.tsx` & `components/table-selector-modal.tsx`:
   - Tombol *"Tagihan Sementara"* pada keranjang kasir dan pada kartu pesanan meja pending.

### 8.2 Matriks Komparasi: Struk Tagihan Sementara vs Struk Kasir Final

| Dimensi Parameter | Struk Tagihan Sementara (Temporary Bill) | Struk Kasir Final (Final Receipt) |
|---|---|---|
| **Header & Watermark** | Memuat tanda tegas: `*** TAGIHAN SEMENTARA ***` dan `(BUKAN BUKTI BAYAR)` | Menampilkan identitas resmi toko (`ANGKRINGAN JOGJA`), alamat lengkap, dan nomor telepon |
| **Status Transaksi** | `Status: BELUM LUNAS (SEMENTARA)` | Transaksi telah berstatus `LUNAS` / `completed` |
| **Rincian Finansial** | Menampilkan Subtotal, Diskon, Pajak, dan `TOTAL TAGIHAN`. **Tidak memuat metode bayar, nominal uang tunai diterima, maupun kembalian.** | Menampilkan Subtotal, Diskon, Pajak, TOTAL, Metode Pembayaran (`TUNAI/QRIS/TRANSFER`), Uang Diterima, dan Kembalian |
| **Dampak Finansial Sistem** | **TIDAK mencatat kas masuk** di `cash_ledger`, **TIDAK memotong stok**, dan **TIDAK dihitung ke dalam omset**. | Mencatat kas masuk di `cash_ledger` (jika tunai), memotong stok menu bertrack, dan mengakumulasi omset toko. |
| **Klausul Penutup (Footer)** | `*** BUKAN BUKTI BAYAR *** - Harap lakukan pembayaran di kasir` | `Matur Nuwun Sampun Rawuh! Simpan struk ini sebagai bukti transaksi` |

### 8.3 Fungsi dan Tujuan Operasional Riil di Usaha F&B / Angkringan
1. **Konfirmasi & Verifikasi Pesanan di Meja (Pre-Settlement Check)**:
   Pada operasional angkringan makan di tempat (meja/lesehan), pelanggan sering memesan berkali-kali secara bertahap (nasi kucing di awal, kemudian sate bakar tambahan, lalu wedangan). Sebelum membayar, pelanggan meminta bon (*"Mas/Mbak, minta bon-nya dulu"*). Pelayan mencetak tagihan sementara agar pelanggan dapat mencocokkan jumlah tusuk sate atau porsi wedang yang benar-benar mereka konsumsi.
2. **Pencegahan Kecurangan Kasir / Pelayan (Anti-Fraud Protection)**:
   Watermark mencolok `(BUKAN BUKTI BAYAR)` melindungi pemilik usaha dari potensi penggelapan dana. Jika pelayan membawa struk biasa tanpa uang disetorkan ke sistem, kasir nakal bisa membatalkan transaksi di sistem dan mengantongi uang tunai pelanggan. Pelanggan yang membaca *"Bukan Bukti Bayar"* akan sadar bahwa mereka belum menerima struk lunas resmi.
3. **Mencegah Distorsi Laporan Finansial (Preventing Premature Settlement)**:
   Jika kasir dipaksa menyelesaikan transaksi (*checkout*) hanya demi mencetak total tagihan, transaksi tersebut akan langsung masuk ke pembukuan laba rugi dan kas toko. Apabila pelanggan ternyata ingin menambah pesanan atau membatalkan item yang tidak keluar dari dapur, kasir harus melakukan *void/refund* rumit yang berisiko merusak audit kas harian.
4. **Evaluasi Kelayakan (Rekomendasi)**:
   **Fitur Struk Tagihan Sementara SANGAT DIBUTUHKAN dan WAJIB DIPERTAHANKAN** dalam alur kerja POS restoran/angkringan dine-in. Fitur ini merupakan standar industri operasional F&B modern.

---

## 9. Analisis Komprehensif Integrasi Data Penerimaan Bank (R8)

Sesuai instruksi R8 (evaluasi mendalam tanpa implementasi sepihak), berikut disajikan 4 alternatif arsitektur metode integrasi bank beserta perbandingan komprehensif:

```
+------------------------------------------------------------------------------------------------+
|                     SPEKTRUM ALTERNATIF INTEGRASI PENERIMAAN BANK TOKO                         |
+------------------------------------------------------------------------------------------------+
|                                                                                                |
|   [Pendekatan 1]           [Pendekatan 2]           [Pendekatan 3]           [Pendekatan 4]    |
|   Open Banking             Aggregator Mutasi        Dynamic QRIS             Rekonsiliasi      |
|   SNAP BI (Bank API)       (Moota / Oy! / Scraper)  Payment Gateway          Offline Hybrid    |
|   -----------------        -----------------------  -----------------        --------------    |
|   • Legal 100% BI          • SaaS Langganan         • Real-time Webhook      • 100% Offline    |
|   • Biaya Tinggi           • Akun Rekening Pribadi  • Otomatisasi Tinggi     • Tanpa Biaya API |
|   • Butuh Badan PT         • Butuh Akses Internet   • MDR 0.3% - 0.7%        • Verifikasi Kasir|
+------------------------------------------------------------------------------------------------+
```

### 9.1 Alternatif 1: Open Banking API / Standar SNAP BI (Standar Nasional Open API Pembayaran)
- **Konsep**: Menghubungkan POS langsung ke API resmi perbankan nasional (BCA, Mandiri, BRI, BNI) menggunakan spesifikasi SNAP BI yang diatur oleh Bank Indonesia.
- **Arsitektur Teknis**:
  - Tablet Android tidak boleh menyimpan Private Key RSA perbankan. Diperlukan server perantara (Cloud Backend Gateway) untuk menangani enkripsi asimetris RSA-SHA256, `X-SIGNATURE`, `X-TIMESTAMP`, dan OAuth 2.0 Token.
  - Endpoint yang dipanggil: `/v1.0/statement` (Mutasi Rekening Rekonsiliasi).
- **Kelebihan**:
  - Legalitas 100% resmi di bawah pengawasan regulasi Bank Indonesia.
  - Sangat andal dan stabil tanpa risiko pemblokiran akun internet banking.
- **Kekurangan**:
  - Persyaratan administratif sangat berat: Pemilik harus berbadan hukum (PT/CV), memiliki rekening bisnis korporat (KlikBCA Bisnis/Mandiri MCM), dan proses verifikasi bank berbulan-bulan.
  - Biaya lisensi API dan biaya deposit bulanan dari pihak bank sangat mahal untuk skala angkringan UMKM.

### 9.2 Alternatif 2: Layanan Aggregator Mutasi / Mutasi Scraper (Moota / Oy! Indonesia / Cekmutasi)
- **Konsep**: Mengintegrasikan POS dengan layanan agregator mutasi perbankan pihak ketiga. Layanan ini membaca mutasi rekening bank personal secara berkala dan meneruskan notifikasi transfer.
- **Arsitektur Teknis**:
  - Pemilik toko mendaftarkan akun m-banking atau aplikasi notifikasi bank ke layanan agregator.
  - POS Angkringan membuat kode unik nominal (misal total Rp 45.000 menjadi Rp 45.123).
  - Saat dana masuk, agregator mendeteksi nominal unik dan menembakkan Webhook notifikasi ke sistem kasir untuk melunasi transaksi otomatis.
- **Kelebihan**:
  - Mendukung rekening tabungan pribadi tanpa syarat badan hukum PT.
  - Biaya langganan terjangkau (sekitar Rp 50.000 – Rp 150.000 per bulan).
- **Kekurangan**:
  - Ketergantungan pada server pihak ketiga.
  - Isu keamanan jika menggunakan scraper yang membutuhkan kredensial login internet banking.
  - Mengharuskan tablet selalu terhubung ke jaringan internet aktif.

### 9.3 Alternatif 3: Dynamic QRIS Webhook via Payment Gateway (Midtrans / Xendit / Tripay)
- **Konsep**: Menggunakan QRIS Dinamis yang digenerate khusus per nomor nota transaksi secara real-time.
- **Arsitektur Teknis**:
  - Saat kasir menekan tombol bayar QRIS, POS memanggil API Payment Gateway untuk membuat string QRIS dinamis dengan nominal tagihan tepat.
  - Pelanggan memindai QRIS menggunakan aplikasi bank manapun (BCA, Mandiri, BRI, Livin, dll.) atau dompet digital (GoPay, OVO, ShopeePay, Dana).
  - Switching BI (ASPI) mengirim sinyal pelunasan ke Payment Gateway, lalu PG menembakkan Webhook sukses ke POS kasir dalam hitungan 1-3 detik.
  - Layar kasir otomatis berpindah ke status lunas dan mencetak struk.
- **Kelebihan**:
  - Rekonsiliasi 100% otomatis tanpa perlu kode nominal unik atau pencocokan manual.
  - Universal: diterima oleh seluruh nasabah bank dan e-wallet di Indonesia.
  - Biaya MDR sangat terjangkau untuk kategori usaha mikro (0.3% transaksi).
- **Kekurangan**:
  - Membutuhkan koneksi internet saat proses pembayaran berlangsung.
  - Pencairan dana dari payment gateway ke rekening bank toko memiliki jeda waktu kliring (H+1 atau biaya transfer penarikan instan).

### 9.4 Alternatif 4: Hybrid Offline-First / Rekonsiliasi Audit Kasir Manual (Rekomendasi Tahap 1)
- **Konsep**: Mempertahankan filosofi aplikasi yang 100% mandiri secara offline tanpa ketergantungan API pihak ketiga dan tanpa biaya langganan bulanan.
- **Arsitektur Teknis**:
  - Layar pembayaran kasir menampilkan pilihan rekening bank yang telah disimpan di modul pengaturan (nama bank, nomor rekening, nama pemilik).
  - Pelanggan melakukan transfer via m-banking.
  - Kasir memverifikasi notifikasi m-banking pada ponsel toko atau melihat bukti transfer pelanggan.
  - Kasir memasukkan nomor referensi transfer atau 4 digit terakhir bukti transfer ke dalam input kasir sebagai catatan audit.
  - Pada penutupan shift kasir (*operating session close*), sistem mencetak **Struk Audit Rekonsiliasi Bank** yang merinci setiap pembayaran transfer beserta referensinya untuk dicocokkan dengan mutasi rekening pemilik di akhir hari.
- **Kelebihan**:
  - Bebas biaya langganan, tanpa biaya setup, dan tanpa izin pihak ketiga.
  - Berjalan 100% offline di lingkungan toko tanpa jaringan internet.
  - Sesuai dengan model bisnis angkringan tunggal.
- **Kekurangan**:
  - Masih membutuhkan kehati-hatian kasir dalam memverifikasi notifikasi masuk guna menghindari penipuan bukti transfer palsu.

### 9.5 Tabel Matriks Perbandingan 4 Alternatif

| Kriteria Evaluasi | Alt 1: SNAP BI API | Alt 2: Aggregator / Moota | Alt 3: Dynamic QRIS PG | Alt 4: Hybrid Offline (Rekomendasi) |
|---|:---:|:---:|:---:|:---:|
| **Biaya Setup & Langganan** | Sangat Tinggi (Jutaan/Bln) | Murah (Rp 50k-150k/Bln) | Gratis Setup (MDR 0.3%) | **Rp 0 (Gratis Penuh)** |
| **Kebutuhan Badan Hukum** | Wajib PT / CV | Perorangan Bisa | Perorangan Bisa | **Bebas / Tanpa Syarat** |
| **Otomatisasi Verifikasi** | Otomatis | Otomatis (Kode Unik) | Otomatis Real-time | Semi-manual Kasir |
| **Dukungan Mode Offline** | Tidak Bisa (Wajib Online) | Tidak Bisa (Wajib Online) | Tidak Bisa (Wajib Online) | **100% Bekerja Offline** |
| **Waktu Implementasi** | 2 - 3 Bulan | 1 - 2 Minggu | 3 - 5 Hari | **Siap Diterapkan Langsung** |
| **Kesesuaian Angkringan** | Kurang Sesuai | Cukup Sesuai | Sangat Sesuai (Fase 2) | **Paling Ideal (Fase 1)** |

---

## 10. Ringkasan Temuan & Rekomendasi Eksekusi

1. **Masalah Menu Bawaan**: Perbaiki klausul foreign key di `transaction_items` (`ON DELETE SET NULL`), tambahkan tanda proteksi seed di `settings`, dan isolasi eksekusi `PRAGMA user_version` agar menu bawaan yang dihapus pemilik tidak muncul kembali.
2. **Tombol Aksi Kanan Atas**: Perbaiki binding event handler dan visibilitas modal untuk menu kategori, ekspor PDF/CSV riwayat, penambahan karyawan, input HPP global, pengaturan reward tier, dan penambahan supplier.
3. **Manajemen Meja Dinamis**: Ganti array statis `PRESET_TABLES` dengan tabel dinamis `store_tables` lengkap dengan form tambah/edit meja yang terhubung langsung ke kasir.
4. **Identitas Kasir**: Wajibkan modal pemilihan kasir dari daftar karyawan aktif sebelum membuka kasir, simpan `cashier_name` pada tabel `transactions`, dan cantumkan pada seluruh format struk.
5. **Kalender Absensi**: Ubah tampilan riwayat absensi menjadi kalender bulanan interaktif dengan pemetaan tanggal `business_date`.
6. **QRIS & Rekening Bank**: Aktifkan render citra QRIS dan kartu multi-rekening di layar pembayaran kasir (`payment-modal.tsx`), serta laporkan pendekatan integrasi perbankan sesuai roadmap yang dianalisis.
