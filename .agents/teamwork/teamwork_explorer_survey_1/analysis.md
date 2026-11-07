# LAPORAN ANALISIS TEKNIS & PEMETAAN UI / KOMPONEN
## POS Angkringan Jogja (Pure Android Offline)
**Explorer**: Explorer 1 (UI & Component Explorer)  
**Tanggal Investigasi**: 7 November 2026  
**State Folder**: `.agents/teamwork/teamwork_explorer_survey_1/`

---

## 1. Ringkasan Eksekutif

Investigasi menyeluruh terhadap arsitektur UI, komponen modal, state management Zustand, serta relasi skema SQLite pada repositori POS Angkringan Jogja telah diselesaikan. Seluruh alur operasional, rute navigasi Expo Router (`app/`), komponen modal (`components/`), toko Zustand (`stores/`), dan layanan cetak/ekspor (`services/`) telah dipetakan terhadap 7 fokus kebutuhan utama (R1, R2, R4, R5, R6, R7, R8).

Hasil temuan menunjukkan bahwa arsitektur antarmuka telah tertata modular, namun terdapat beberapa titik kritis:
1. **Kegagalan Hapus Menu Bawaan (R1)**: Disebabkan oleh relasi integritas referensial kaku `FOREIGN KEY (menu_id) REFERENCES menus(id)` pada tabel `transaction_items` saat `PRAGMA foreign_keys = ON;` tanpa opsi soft-delete atau cascading aman.
2. **Bug Nilai Input & Form Quick Edit (R1)**: `useEffect` pada `MenuFormModal` mengalami reset tak diinginkan saat dependensi `categories` berubah, serta input stok tersembunyi total untuk menu berkategori tanpa stok (`track_stock = 0`).
3. **Syntax Error Kritis pada HPP Global (R2)**: Ditemukan kurung kurawal ganda penutup `}` pada `components/monthly-cogs-modal.tsx:156` yang berpotensi memutus kompilasi modal HPP Global.
4. **Ketiadaan Pemilihan Identitas Kasir (R5)**: Rute `/transaksi` terbuka langsung tanpa dialog pemilihan kasir, dan nama kasir tercatat statis/hardcoded `'Kasir'` pada database `transactions` serta struk thermal.
5. **Kebutuhan Transformasi Kalender Absensi (R7)**: Riwayat absensi saat ini masih berupa `FlatList` vertikal linier tanpa navigasi matriks tanggal bulanan interaktif.
6. **Kesiapan Modul Pembayaran & Meja (R4 & R8)**: Fondasi dinamis meja dan pengaturan QRIS/Transfer multi-rekening telah tersedia namun memerlukan pemolesan integrasi langsung pada alur kasir.

---

## 2. Pemetaan Modul & Komponen UI

### 2.1 Struktur Rute Aplikasi (`app/`)
| File Rute | Judul Modul | Deskripsi Fungsi | Komponen Modal yang Terpasang |
|---|---|---|---|
| `app/(tabs)/index.tsx` | Dashboard Operasional | Ringkasan KPI penjualan harian, menu terlaris, status sesi toko, dan pintasan modul. | - |
| `app/transaksi.tsx` | Terminal Kasir Meja | Panel ganda (katalog menu 65% + keranjang order meja 35%), split payment, pending order, tiket dapur, & tagihan sementara. | `TableSelectorModal`, `CustomerSelectorModal`, `MenuFormModal`, `PaymentModal`, `ReceiptPreviewModal`, `PrinterManagementModal` |
| `app/(tabs)/explore.tsx` | Manajemen Katalog Menu | Tampilan grid katalog menu makanan/minuman, filter kategori horizontal, pencarian barcode/nama. | `MenuFormModal`, `CategoryFormModal` |
| `app/(tabs)/history.tsx` | Riwayat & Audit Transaksi | Audit riwayat pesanan meja selesai/pending/batal/digabung, mutasi buku kas masuk/keluar, cetak ulang struk. | `ReceiptPreviewModal` |
| `app/(tabs)/attendance.tsx` | Absensi & Staf | Tiga tab: Absensi Hari Ini (kamera 17.30), Riwayat Absensi, dan Manajemen Karyawan. | `AttendanceCameraModal`, `EmployeeModal`, `AdminPinModal` |
| `app/(tabs)/financial.tsx` | Laporan Keuangan & Kas | Laba rugi operasional berbasis segregasi PnL, buku mutasi kas, input HPP bulanan owner. | `CashEntryModal`, `MonthlyCogsModal`, `AdminPinModal` |
| `app/(tabs)/settings.tsx` | Pengaturan Sistem POS | Profil toko, PIN admin, foto QRIS, multi-rekening bank transfer, printer Bluetooth, backup/restore JSON. | `PrinterManagementModal`, `AdminPinModal` |
| `app/customers.tsx` | Pelanggan & Multi-Tier Reward | Master pelanggan, akumulasi belanja seumur hidup, pengaturan tier hadiah reward. | `CustomerDetailModal`, `CustomerFormModal`, `RewardTierModal` |
| `app/purchases.tsx` | Supplier & Belanja Bahan | Pembelian bahan kulakan tunai (potong kas PnL) atau tempo (buku hutang), foto bukti nota, master supplier. | `PurchaseFormModal`, `SupplierModal` |

---

## 3. Analisis Investigasi per Kebutuhan Fungsional

### 3.1 R1: Perbaikan Fitur Manajemen Menu & Quick Edit Kasir
#### Lokasi Komponen
- **Daftar Menu**: `app/(tabs)/explore.tsx` (baris 168–234).
- **Form Tambah & Edit Menu**: `components/menu-form-modal.tsx` (baris 29–400).
- **Quick Edit Menu Kasir**: Dipicu via `onLongPress` pada kartu menu di `app/transaksi.tsx` (baris 332–337).

#### Akar Penyebab Bug (Root Cause Analysis)
1. **Mengapa Menu Bawaan Gagal Dihapus?**
   - **Observasi**: Pada `services/database.ts` baris 137, tabel `transaction_items` memiliki definisi:
     ```sql
     menu_id INTEGER NOT NULL REFERENCES menus(id)
     ```
     Sementara baris 48 mengaktifkan `PRAGMA foreign_keys = ON;`.
   - **Rantai Logika**: Setiap kali transaksi kasir atau meja pending dibuat, entri `transaction_items` menyimpan referensi ID menu tersebut. Ketika pemilik usaha menekan "Hapus Menu", perintah SQL yang dijalankan di `stores/menuStore.ts:175` adalah:
     ```sql
     DELETE FROM menus WHERE id = ?
     ```
     SQLite mendeteksi pelanggaran integritas referensial dan melemparkan galat:
     `Error: FOREIGN KEY constraint failed (code 787 SQLITE_CONSTRAINT_FOREIGNKEY)`.
     Karena kolom `menu_id` bertipe `NOT NULL`, penghapusan langsung ditolak sistem demi integritas database.
   - **Solusi Bersih (Ponytail Principle)**:
     Tambahkan kolom `is_active INTEGER NOT NULL DEFAULT 1` pada tabel `menus` melalui migrasi aman di `services/database.ts`. Pada fungsi `deleteMenu`, eksekusi penonaktifan:
     ```sql
     UPDATE menus SET is_active = 0 WHERE id = ?
     ```
     Pada fungsi `loadMenus`, filter hanya menu aktif:
     ```sql
     SELECT * FROM menus WHERE is_active = 1 ORDER BY name ASC
     ```
     Dengan cara ini:
     - Menu bawaan maupun menu kustom terhapus seketika dari layar katalog kasir dan manajemen menu.
     - Seluruh riwayat transaksi masa lalu, laporan omset, dan struk audit tidak mengalami kerusakan data (*zero regression*).

2. **Mengapa Nilai Awal Form Tambah/Edit Hilang atau Input Field Hilang?**
   - **Observasi**: Pada `components/menu-form-modal.tsx` baris 43–61:
     ```tsx
     useEffect(() => {
       if (menuItem) {
         setName(menuItem.name);
         setPriceText(formatRupiahInput(menuItem.price));
         setSelectedCatId(menuItem.category_id);
         setTrackStock(menuItem.track_stock === 1);
         setStockText(menuItem.stock.toString());
         setBarcode(menuItem.barcode || '');
         setPhotoUri(menuItem.image_path || null);
       } else {
         setName('');
         setPriceText('');
         setSelectedCatId(categories.length > 0 ? categories[0].id : null);
         setTrackStock(false);
         setStockText('0');
         setBarcode('');
         setPhotoUri(null);
       }
     }, [menuItem, visible, categories]);
     ```
   - **Masalah**:
     - Array dependensi memuat `categories`. Ketika pengguna sedang mengisi form dan menekan "+ Kategori Baru", kategori baru tersimpan dan memicu pembaruan `categories` di Zustand. Hal ini memicu kembali `useEffect`, mereset `name` dan `priceText` menjadi kosong seketika!
     - Untuk stok, pada baris 316 terdapat kondisi `{trackStock && (...)`. Pada 16 menu bawaan angkringan, nilai `track_stock` awal adalah `0` (unlimited). Akibatnya, kotak input sisa stok dan stepper (+1, +5, -1, -5) **tersembunyi secara total**. Pengguna mengira komponen input stok hilang padahal tersembunyi di balik tombol toggle.

3. **Mengapa Fitur Quick Edit Menu Gagal / Kurang Field?**
   - **Observasi**: Pada `app/transaksi.tsx:332`, event `onLongPress` langsung membuka `MenuFormModal` yang ditujukan untuk admin (lengkap dengan picker foto, kategori, dan barcode). `stores/menuStore.ts:154` sebenarnya telah memiliki fungsi `quickEditMenu(db, id, price, stock, name)`, namun fungsi ini tidak pernah dipanggil di UI manapun.
   - **Solusi**: Pastikan modal edit yang dipanggil menampilkan input Harga Jual dan input Stok secara gamblang (terbuka langsung tanpa harus mengaktifkan toggle tersembunyi), lengkap dengan tombol "Simpan Perubahan" dan tombol "Hapus Menu".

---

### 3.2 R2: Perbaikan Tombol Aksi Kanan Atas Seluruh Modul
Investigasi detail per modul:

| Modul | Tombol Aksi Kanan Atas | Handler Saat Ini | Komponen Modal yang Terkait | Status & Temuan Investigasi |
|---|---|---|---|---|
| **Menu** (`app/(tabs)/explore.tsx`) | `+ Kategori` | `onPress={() => setCategoryModalVisible(true)}` | `CategoryFormModal` (`components/category-form-modal.tsx`) | Tombol aktif dan memunculkan dialog tambah kategori baru. Belum ada antarmuka untuk melihat daftar kategori yang sudah ada atau menghapus kategori lama. |
| **Riwayat** (`app/(tabs)/history.tsx`) | `Unduh PDF` & `Unduh CSV` | `handleExportPdf` & `handleExportCsv` | `services/export.ts` (`exportTableToPdf`) & `services/backup.ts` (`exportTransactionsCsv`, `exportCashLedgerCsv`) | **Berfungsi normal**. Menggunakan `expo-print` dan `expo-sharing` untuk membagikan file PDF dan CSV secara offline. |
| **Absensi** (`app/(tabs)/attendance.tsx`) | `Tambah Karyawan` | `onPress={() => { setEditingEmployee(null); setEmployeeModalVisible(true); }}` | `EmployeeModal` (`components/employee-modal.tsx`) | **Berfungsi normal**. Form input nama, nomor HP, validasi duplikat, dan simpan ke database `employees`. |
| **Keuangan** (`app/(tabs)/financial.tsx`) | `HPP Global` | `handleOpenCogs` | `AdminPinModal` lalu `MonthlyCogsModal` (`components/monthly-cogs-modal.tsx`) | **CRITICAL BUG**: File `components/monthly-cogs-modal.tsx` baris 156 memiliki kurung kurawal ekstra `}` setelah penutupan fungsi komponen di baris 155, yang memicu galat sintaksis compiler. |
| **Customer** (`app/customers.tsx`) | `Atur Tingkatan Reward` | `onPress={() => setTierModalVisible(true)}` | `RewardTierModal` (`components/reward-tier-modal.tsx`) | Handler terpasang. Terdapat kekurangan pada `RewardTierModal`: tidak memanggil `loadRewardTiers(db)` saat `visible` berubah menjadi true, sehingga jika store belum terisi, daftar tier bisa tampak kosong. |
| **Supplier** (`app/purchases.tsx`) | `+ Supplier Baru` | `onPress={() => { setEditingSupplier(null); setSupplierModalVisible(true); }}` | `SupplierModal` (`components/supplier-modal.tsx`) | **Berfungsi normal**. Input nama toko/supplier grosir dan nomor kontak, tersimpan ke tabel `suppliers`. |

---

### 3.3 R3: Evaluasi Fitur Struk Tagihan Sementara (Temporary Bill)
#### Implementasi Teknis yang Ditemukan
- **Fungsi Cetak Thermal**: `services/print.ts:313` (`formatTemporaryBillReceipt`) dan baris 362 (`printTemporaryBill`).
- **Pratinjau Struk**: `components/receipt-preview-modal.tsx` (Tab `temp_bill`).
- **Pemicu pada Kasir**: Tombol "Tagihan Sementara" di `app/transaksi.tsx:172` (`handleTemporaryBill`).
- **Pemicu pada Manajemen Meja**: Tombol "Cetak Tagihan Sementara" di `components/table-selector-modal.tsx:322` untuk setiap meja pending.

#### Evaluasi Fungsional & Kebutuhan Operasional
1. **Tujuan dan Peran**:
   - Dalam operasional riil angkringan/restoran dengan sistem meja atau lesehan, pelanggan sering meminta total tagihan saat masih duduk sebelum beranjak ke meja kasir (*"Mas, minta bon meja 4"*).
   - Server/pramusaji mencetak struk tagihan sementara dan mengantarkannya ke meja pelanggan agar mereka dapat memeriksa rincian pesanan (misal: 3 nasi kucing, 5 sate, 2 teh kampul) dan menyiapkan uang tunai pas atau patungan antar teman.
2. **Aspek Keamanan Keuangan**:
   - Struk ini secara tegas memuat tanda air (*watermark*):  
     `*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***`  
     `Status : BELUM LUNAS (SEMENTARA)`  
     `BUKAN BUKTI PEMBAYARAN SAH. Harap lakukan pembayaran di kasir.`
   - Tanda air ini mutlak diperlukan untuk mencegah penipuan di mana pelanggan yang tidak bertanggung jawab menunjukkan bon tagihan sementara dan mengaku sudah membayar di meja lain.
3. **Integrasi Status Meja**:
   - Menjalankan fungsi ini menandai status transaksi menjadi `'billing'` di database (`markTableAsBilling`). Hal ini memberi sinyal visual kepada kasir bahwa meja tersebut sedang dalam proses penyelesaian pembayaran.
4. **Kesimpulan Evaluasi**:
   Kode fitur struk tagihan sementara **harus tetap dipertahankan 100% tanpa dihapus**, karena merupakan instrumen kendali operasional standar F&B meja makan di tempat.

---

### 3.4 R4: Manajemen Meja Dinamis & Integrasi Kasir
#### Lokasi dan Status Saat Ini
- **Komponen Meja**: `components/table-selector-modal.tsx`.
- **Preset Meja Bawaan**: Baris 30–47 (`DEFAULT_PRESET_TABLES`) memuat 16 meja bawaan (Meja 01–10, Lesehan 01–05, Bungkus / Take-away).
- **Mekanisme Penyimpanan**: Disimpan di tabel `settings` SQLite dengan `key = 'custom_tables'` dalam bentuk serialisasi JSON (`parseCustomTables` & `saveCustomTables`).
- **Fitur Pengelolaan**:
  - `handleOpenAddTable` (baris 175): Form tambah meja baru dengan penentuan tipe (meja, lesehan, bungkus).
  - `handleOpenEditTable` (baris 183): Mengubah nama meja dan tipe meja.
  - `handleDeleteTable` (baris 244): Validasi proteksi agar meja yang memiliki pesanan aktif (`pending`/`billing`) tidak dapat dihapus secara tidak sengaja.
  - **Sinkronisasi Otomatis**: Baris 207–212 mengupdate transaksi aktif secara atomik:
    ```sql
    UPDATE transactions SET table_number = ? WHERE table_number = ? AND status IN ('pending', 'billing')
    ```
- **Rekomendasi Integrasi UI**:
  Saat ini fitur kelola meja berada di dalam `TableSelectorModal` (tombol `+ Tambah Meja` dan `⚙️ Kelola Meja`). Untuk mempermudah pemilik usaha, tautan pintasan atau panel pengelolaan meja dapat juga diakses langsung dari menu `Pengaturan` (`settings.tsx`).

---

### 3.5 R5: Pemilihan Identitas Kasir Operasional
#### Analisis Alur Masuk Kasir Saat Ini
1. Pengguna membuka kasir dari Dashboard (`app/(tabs)/index.tsx:129`) melalui `router.push('/transaksi')`.
2. Halaman `app/transaksi.tsx` langsung memuat katalog dan keranjang belanja tanpa ada dialog otentikasi atau pemilihan kasir.
3. Nama kasir di-hardcode ke string statis `'Kasir'` di dua tempat:
   - Baris 201: `cashierName: 'Kasir'` pada payload cetak tagihan sementara.
   - Baris 607: `cashierName: 'Kasir'` pada payload struk pembayaran customer.
4. Pada `stores/transactionStore.ts`, fungsi `saveAsPendingOrder` (baris 559) dan `checkout` (baris 772) sama sekali **tidak menyertakan kolom `cashier_name`** dalam klausa SQL `INSERT INTO transactions`. Nilai `cashier_name` selalu diisi oleh nilai bawaan skema database (`'Kasir'`).

#### Desain Perbaikan Bersih (Ponytail Principle)
1. **State Kasir Aktif**: Tambahkan `activeCashier: string` pada `transactionStore.ts` (default: `''`).
2. **Dialog Pemilihan Kasir**: Saat `app/transaksi.tsx` dimuat (atau saat membuka kasir), jika `activeCashier` masih kosong, tampilkan modal sederhana `CashierSelectorModal` yang memuat daftar nama karyawan aktif dari tabel `employees` (`WHERE is_active = 1`).
3. **Penyematan Identitas**:
   - Masukkan `activeCashier` ke dalam kolom `cashier_name` pada kueri `INSERT INTO transactions`.
   - Teruskan `activeCashier` ke objek `PrintReceiptData` untuk struk pembayaran customer, struk dapur, dan struk tagihan sementara.
   - Tampilkan badge nama kasir yang sedang bertugas di bagian header atas `app/transaksi.tsx`, dengan opsi ganti shift/kasir.

---

### 3.6 R6: Form Transaksi pada Customer & Supplier
#### Form Tingkatan Reward Pelanggan (`components/reward-tier-modal.tsx`)
- Komponen input:
  - `tierName`: Nama tingkatan (contoh: Silver, Sahabat Angkringan).
  - `minSpendText`: Ambang batas akumulasi belanja dengan format Rupiah dinamis (`formatRupiahInput`).
  - `rewardDescription`: Keterangan hadiah reward (contoh: Gratis 3 tusuk sate + 1 wedang).
- Integrasi ke Database: Tersimpan ke tabel `rewards` melalui `addRewardTier`, `updateRewardTier`, dan `deleteRewardTier` di `stores/customerStore.ts`.
- Rekomendasi: Tambahkan pemanggilan `loadRewardTiers(db)` di `useEffect` saat modal dibuka agar daftar selalu tersinkronisasi.

#### Form Catat Pembelian Bahan Supplier (`components/purchase-form-modal.tsx`)
- Komponen input:
  - Pemilihan supplier (dari master `suppliers`, dilengkapi pintasan `+ Supplier Baru`).
  - Nominal total pembelian (Rupiah).
  - Metode pembayaran: `Tunai / Cash Langsung` vs `Tempo / Hutang Supplier`.
  - Konfigurasi jatuh tempo: Opsi tanpa jatuh tempo vs tanggal jatuh tempo (tombol cepat +3, +7, +14, +30 hari atau input kalender manual).
  - Foto bukti nota fisik kulakan (kamera langsung atau galeri, disimpan ke direktori lokal `purchases/`).
  - Catatan deskripsi belanja bahan.
- Integrasi Finansial:
  - Jika **Tunai**: Menggunakan `db.withTransactionAsync` untuk mencatat ke tabel `purchases` sekaligus memasukkan pengeluaran ke `cash_ledger` (`type = 'expense'`, `affects_pnl = 1`, `category = 'Pembelian Bahan/Kulakan'`).
  - Jika **Tempo**: Tercatat di `purchases` dengan status `'unpaid'`, menambah buku hutang supplier. Ketika dilunasi via `settleTempoDebt`, status berubah menjadi `'paid'` dan pengeluaran kas dicatat di `cash_ledger` pada tanggal pelunasan.

---

### 3.7 R7: Rekap Absensi Berbasis Tampilan Kalender Bulanan
#### Kondisi Saat Ini
Pada `app/(tabs)/attendance.tsx` baris 339–376 (`renderHistoryTab`), data absensi hanya dirender menggunakan `FlatList` vertikal sederhana berurutan dari ID terbaru. Tidak ada fasilitas navigasi tanggal visual berbasis matriks kalender.

#### Desain Transformasi Kalender Interaktif
1. **Navigasi Bulan**:
   - Menampilkan kontrol bulan aktif: `◀ [ Nama Bulan Tahun ] ▶` (contoh: `◀ November 2026 ▶`).
2. **Matriks Kalender Bulanan (7 Kolom)**:
   - Header hari: Sen, Sel, Rab, Kam, Jum, Sab, Min.
   - Menghitung offset hari pertama dalam bulan dan total hari dalam bulan (`new Date(year, month, 0).getDate()`).
   - Sel tanggal menampilkan nomor tanggal (1..31).
   - Indikator kehadiran visual pada sel tanggal:
     - Titik hijau: Ada karyawan hadir tepat waktu.
     - Titik merah/oranye: Ada karyawan terlambat.
     - Lingkaran penanda untuk tanggal yang sedang dipilih (*selected date*).
3. **Panel Rincian Kehadiran di Bawah Kalender**:
   - Ketika kasir/pemilik mengetuk suatu tanggal pada kalender, panel di bawah menampilkan seluruh staf yang hadir pada tanggal tersebut (`WHERE business_date = selectedDate`).
   - Setiap kartu menampilkan: Nama Karyawan, Jam Masuk, Jam Pulang, Badge Status (Tepat Waktu / Terlambat X Menit), dan thumbnail foto absensi kamera.

---

### 3.8 R8: Pengaturan Pembayaran & Analisis Integrasi Bank
#### 1. Pengaturan QRIS
- **Lokasi Pengaturan**: `app/(tabs)/settings.tsx` baris 114–167.
  - Memilih foto QRIS toko dari galeri perangkat.
  - Menyimpan foto secara permanen ke direktori lokal menggunakan `saveImageLocally(uri, 'logo')`.
  - Menyimpan path foto di tabel `settings` dengan `key = 'qris_image_path'`.
- **Tampilan Kasir**: `components/payment-modal.tsx` baris 88–90 & 250–350.
  - Saat kasir memilih metode "QRIS", foto QRIS toko otomatis tampil di layar tablet pelanggan/kasir beserta nominal total tagihan.
  - Tersedia opsi ketuk untuk memperbesar foto QRIS ke layar penuh (`qrisFullScreenVisible`).

#### 2. Pengaturan Multi-Rekening Transfer Bank
- **Lokasi Pengaturan**: `app/(tabs)/settings.tsx` baris 170–244.
  - Pemilik dapat menambahkan lebih dari satu rekening bank (contoh: BCA, Mandiri, BRI, BNI).
  - Setiap rekening menyimpan: `bank_name`, `account_number`, dan `account_holder` (atas nama).
  - Data disimpan di tabel `settings` dengan `key = 'bank_accounts'` sebagai array JSON.
  - Tersedia tombol hapus untuk masing-masing rekening.
- **Tampilan Kasir**: `components/payment-modal.tsx` baris 94–106 & 360–450.
  - Saat kasir memilih metode "Transfer", daftar rekening yang tersimpan tampil sebagai pilihan.
  - Kasir dapat memilih rekening tujuan pelanggan dan menekan tombol "Salin Nomor Rekening" untuk mempermudah operasional.

#### 3. Analisis Teknis Integrasi Penerimaan Dana Bank
Sesuai instruksi R8 dan `ORIGINAL_REQUEST.md`, integrasi perbankan **tidak boleh diimplementasikan secara terburu-buru**, melainkan dianalisis secara komprehensif dalam laporan teknis:
- **Pendekatan A: Payment Gateway Aggregator (QRIS Dinamis - API)**
  - *Mekanisme*: Menggunakan aggregator terdaftar BI (seperti Midtrans, Xendit, atau Duitku) untuk menerbitkan QRIS dinamis per transaksi via REST API webhook.
  - *Kelebihan*: Status bayar otomatis berubah menjadi 'completed' (*realtime callback*) tanpa verifikasi manual.
  - *Kekurangan*: Membutuhkan koneksi internet konstan (bertolak belakang dengan prinsip 100% offline standalone POS) serta membebankan biaya MDR transaksi (0.7% untuk QRIS reguler).
- **Pendekatan B: Android Notification Listener Service (On-Device)**
  - *Mekanisme*: Membangun *background service* Android native yang membaca notifikasi masuk dari aplikasi mobile banking (BCA Mobile, Livin' Mandiri, dsb.) di tablet kasir.
  - *Kelebihan*: 100% offline di tablet tanpa biaya gateway pihak ketiga.
  - *Kekurangan*: Bergantung pada izin `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE`, rentan terhadap perubahan format notifikasi bank, dan berisiko bila perangkat tablet kasir berganti.
- **Pendekatan C: QRIS Statis Toko + Validasi Kasir (Pendekatan POS Saat Ini - Direkomendasikan)**
  - *Mekanisme*: Menampilkan QRIS statis toko dan nomor rekening bank resmi milik pemilik di layar tablet kasir. Pelanggan memindai dan mentransfer, kasir melihat notifikasi di ponsel pemilik/kasir atau mutasi m-banking, lalu menekan konfirmasi bayar di kasir.
  - *Kelebihan*: Sangat andal, 0% kegagalan jaringan, aman, tidak membutuhkan biaya bulanan pihak ketiga, dan sepenuhnya cocok untuk ritel angkringan mandiri.

---

## 4. Evaluasi Mutu & Kepatuhan Prinsip Ponytail

Berdasarkan kaidah Ponytail (Lazy Senior Dev Mode):
- **Cakupan Terarah**: Seluruh perbaikan hanya menyentuh titik-titik yang bermasalah tanpa merombak lapisan arsitektur yang sudah berjalan dengan baik.
- **Tanpa Over-engineering**:
  - Tidak menambahkan pustaka dependensi baru untuk kalender absensi; kalender dibangun dengan *native layout flexbox* dan fungsi tanggal standar JavaScript.
  - Tidak merombak skema 15 tabel SQLite secara radikal; masalah penghapusan menu diatasi secara elegan melalui penambahan kolom `is_active` (*soft-delete safe*) tanpa merusak data penjualan yang sudah ada.
  - Mempertahankan integritas suite pengujian otomatis (`test/tier*.test.ts`) yang saat ini telah mencapai 28/28 lulus (100% PASS).

---

## 5. Ringkasan Rekomendasi Aksi untuk Implementer

1. **Perbaikan Database & Store Menu (R1)**:
   - Tambahkan `ALTER TABLE menus ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1` pada `migrateDbIfNeeded`.
   - Perbarui `deleteMenu` di `stores/menuStore.ts` untuk mengeksekusi `UPDATE menus SET is_active = 0 WHERE id = ?`.
   - Perbarui `loadMenus` untuk menambahkan filter `WHERE is_active = 1`.
   - Perbaiki dependensi `useEffect` di `components/menu-form-modal.tsx` agar tidak mereset data input saat `categories` berubah.
   - Buka input stok secara langsung di Quick Edit tanpa menyembunyikannya di balik toggle `trackStock`.
2. **Koreksi Sintaksis Modal HPP Global (R2)**:
   - Hapus kurung kurawal ganda penutup `}` di baris 156 pada `components/monthly-cogs-modal.tsx`.
3. **Penerapan Alur Pemilihan Identitas Kasir (R5)**:
   - Buat komponen modal pemilihan kasir dari daftar karyawan aktif (`employees`).
   - Simpan nama kasir terpilih di `transactionStore` dan sertakan dalam mutasi kueri `transactions` serta payload cetak struk thermal.
4. **Implementasi Kalender Absensi Interaktif (R7)**:
   - Bangun sub-komponen kalender bulanan interaktif di `renderHistoryTab` pada `app/(tabs)/attendance.tsx` yang memfilter rincian absensi berdasarkan tanggal yang diketuk.
