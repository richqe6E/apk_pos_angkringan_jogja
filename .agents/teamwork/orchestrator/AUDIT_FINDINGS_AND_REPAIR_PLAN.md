# Dokumen Temuan Audit Komprehensif & Rencana Perbaikan (PRD POS Angkringan Jogja - Pure Android)

Dokumen ini disusun sebagai pemenuhan **Requirement R1 (Tahap Audit Awal & Rencana Kerja)** menggunakan prinsip **Ponytail (Lazy Senior Dev Mode: perubahan terkecil yang menyelesaikan masalah secara tuntas, eliminasi kode berlebih/bloat, tanpa over-engineering)** sebelum eksekusi modifikasi kode dimulai.

---

## Ringkasan Eksekutif & Ponytail Audit Ledger

Berdasarkan hasil survei 3 Explorer spesialis terhadap seluruh basis kode aplikasi POS Angkringan Jogja:
- **TypeScript Status**: Bersih (`tsc --noEmit` exit code 0, 0 error).
- **Target Platform**: Difokuskan murni untuk perangkat **Android** (smartphone & tablet).
- **Eliminasi Bloat & Efisiensi Kode**:
  - Penghapusan modal redundan `QuickEditProductModal` (316 baris) digantikan oleh penyatuan ke `MenuFormModal`.
  - Penghapusan 18 percabangan `Platform.OS === 'ios'` yang tidak relevan untuk target Android.
  - Eliminasi bug `Alert.prompt` (API khusus iOS) digantikan dengan dialog native Android.
  - Penurunan latensi long-press dari 2000ms menjadi 200ms pada kartu menu transaksi.
  - Pengurangan bersih kode: **~360 baris kode dihapus**.
- **Integritas Finansial & Transaksi**:
  - Perbaikan bug perhitungan laba bersih (eliminasi pencatatan ganda penjualan tunai).
  - Penyelarasan tipe transaksi `'in'` vs `'income'` agar penjualan tunai tampil pada tab 'Kas Masuk'.
  - Pembungkusan seluruh operasi multi-query database ke dalam `db.withTransactionAsync` (ACID).
  - Perbaikan pembersihan fisik foto absensi bulanan yang sebelumnya mengalami kebocoran media penyimpanan.
  - Integrasi dinamis metode pembayaran aktual (Tunai, QRIS, Transfer) dan profil toko pada struk kasir & pratinjau.
  - Perbaikan penggabungan meja (`mergeTables`) agar tidak mereset pajak/diskon dan mengonsolidasikan item menu identik tanpa duplikasi baris.
  - Pelacakan pesanan tambahan (`is_additional = 1`) dan pencetakan tiket dapur/sambungan.

---

## Bagian I: Rincian Temuan Audit Berdasarkan Modul

### 1. Integritas Finansial: Bug Kalkulasi Laba Bersih & Kas Masuk (R2 & R5)
- **File Terdampak**: `stores/financialStore.ts` (baris 100-106, 136-160), `stores/transactionStore.ts` (baris 607-615), `app/(tabs)/history.tsx` (baris 115-120).
- **Temuan & Akar Masalah**:
  1. **Laba Bersih Terhitung Ganda**: Pada `financialStore.ts`, nilai `grossSales` diperoleh dari agregasi tabel `transactions` yang telah mencakup seluruh metode pembayaran (Tunai, QRIS, Transfer). Saat checkout tunai berhasil, `transactionStore.ts` juga menyisipkan rekaman ke `cash_ledger` dengan `category = 'penjualan_tunai'` dan `affects_pnl = 1`. Akibatnya, rekaman tersebut masuk ke variabel `operIncome`. Saat menghitung laba bersih operasional dengan rumus:
     $$\text{netOperatingProfit} = \text{grossSales} + \text{operIncome} - \text{operExpenses} - \text{monthlyCogs}$$
     penjualan tunai terhitung dua kali lipat.
  2. **Kas Masuk Tidak Menampilkan Penjualan Tunai**: `transactionStore.ts` menyisipkan rekaman kas ledger dengan `type = 'in'`. Namun, query di `app/(tabs)/history.tsx` secara kaku mencari `type = 'income'`. Karena `'in' !== 'income'`, tab Kas Masuk menampilkan 0 baris untuk penjualan tunai kasir.

### 2. Struk Transaksi, Pengaturan Toko & Pembersihan Foto Absensi (R2)
- **File Terdampak**: `stores/transactionStore.ts`, `components/payment-modal.tsx`, `app/transaksi.tsx`, `components/receipt-preview-modal.tsx`, `utils/imageStorage.ts`, `stores/attendanceStore.ts`, `app/_layout.tsx`.
- **Temuan & Akar Masalah**:
  1. **Metode Pembayaran Struk Tidak Dinamis**: Fungsi `checkout` dan callback `onSuccess` pada `PaymentModal` tidak mengembalikan atribut `paymentMethod`, sehingga `transaksi.tsx` mengisi nilai default hardcoded `'tunai'`. Transaksi QRIS dan Transfer tetap tercetak sebagai "Bayar (TUNAI)".
  2. **Profil Toko Hardcoded**: Nama toko (`ANGKRINGAN JOGJA`), alamat, nomor telepon, dan footer struk masih hardcoded di kode komponen dan tidak mengambil data dari tabel `settings`.
  3. **Multi-Query Tanpa Transaksi Atomik**: Terdapat 6 operasi multi-kueri berturut-turut pada saat checkout, penahanan pesanan pending, dan merge meja tanpa dibungkus `db.withTransactionAsync`. Jika terjadi kegagalan di tengah proses, database berada pada kondisi tidak konsisten.
  4. **Kebocoran Media Penyimpanan Foto Absensi**: File foto absensi disimpan dengan nama berbasis epoch timestamp (`attendance_<timestamp>_<rand>.jpg`). Namun logika pembersihan di `imageStorage.ts` mencari nama file yang mengandung format string `'YYYY-MM'` (`f.includes('2026-11')`). Pola ini tidak pernah cocok, sehingga file fisik di media penyimpanan tidak pernah terhapus sementara entri database dikosongkan.
  5. **Inisialisasi Pengaturan**: Root layout (`app/_layout.tsx`) tidak memuat konfigurasi profil toko, tarif pajak PB1, dan printer tersimpan saat startup aplikasi.

### 3. Manajemen Menu, Upload Foto Produk & Pemurnian Android (R3)
- **File Terdampak**: `components/menu-form-modal.tsx`, `components/quick-edit-product-modal.tsx`, `app/(tabs)/explore.tsx`, `app/transaksi.tsx`, `components/receipt-preview-modal.tsx`.
- **Temuan & Akar Masalah**:
  1. **Penyimpanan Foto Menu Gagal Permanen**: Pada `menu-form-modal.tsx:121`, terdapat pengecekan guard:
     `if (photoUri && !photoUri.startsWith('file://') && !photoUri.startsWith('/'))`
     URI yang dikembalikan oleh `expo-image-picker` pada Android selalu diawali dengan `file:///`. Akibat pengecekan di atas, `saveImageLocally` tidak pernah dipanggil, dan file cache sementara disimpan langsung ke SQLite yang akan hilang ketika cache Android dibersihkan oleh sistem operasi.
  2. **Duplikasi Modal Edit Menu**: Terdapat dua modal terpisah (`QuickEditProductModal` 316 baris dan `MenuFormModal` 479 baris). Pada halaman manajemen menu (`explore.tsx`), setiap kartu menu menampilkan tombol redundan "Quick Edit" dan "Edit".
  3. **Ketergantungan API Khusus iOS (`Alert.prompt`)**: Pada `app/(tabs)/explore.tsx:61`, penambahan kategori menggunakan `Alert.prompt` yang tidak didukung oleh React Native pada Android, menyebabkan fitur tambah kategori tidak dapat digunakan.
  4. **Pengecekan Platform iOS pada Font Struk**: Terdapat 18 kali pengecekan `Platform.OS === 'ios' ? 'Courier' : 'monospace'` pada `receipt-preview-modal.tsx` yang tidak diperlukan pada build murni Android.
  5. **Responsivitas Long-Press Produk**: Pada `app/transaksi.tsx:231`, `delayLongPress` dipatok sebesar `2000` (2 detik penuh), membuat interaksi kasir terasa lambat dan tidak responsif.

### 4. Manajemen Meja, Pesanan Pending & Tiket Dapur (R4)
- **File Terdampak**: `stores/transactionStore.ts` (baris 109-136, 312-392, 394-439), `app/transaksi.tsx` (baris 102-118), `services/print.ts`, `components/table-selector-modal.tsx`.
- **Temuan & Akar Masalah**:
  1. **Kerusakan Pajak & Diskon pada `mergeTables`**: Kueri update pada saat penggabungan meja mengeksekusi `UPDATE transactions SET total = newSubtotal` yang mereset diskon (`discount_amount = 0`) dan tidak memperbarui pajak PB1 (`tax_amount`).
  2. **Duplikasi Baris Menu pada Penggabungan Meja**: `mergeTables` hanya memindahkan `transaction_id = primaryId` untuk seluruh `transaction_items` tanpa mengelompokkan item yang memiliki `menu_id` sama.
  3. **Pesanan Sambungan Tidak Menandai Delta Porti (`is_additional = 1`)**: Saat pesanan sambungan ditambahkan ke keranjang meja pending, penambahan kuantitas tidak menandai item sebagai delta tambahan.
  4. **Tidak Ada Pencetakan Tiket Dapur Saat Penahanan Meja**: `handleHoldOrder` di `app/transaksi.tsx` hanya menyimpan ke database tanpa mencetak tiket dapur atau tiket sambungan.
  5. **Ketiadaan Tagihan Sementara (Temporary Bill)**: Belum tersedia pratinjau dan pencetakan tagihan sementara untuk meja aktif, serta status meja pada `TableSelectorModal` belum menampilkan visual indikator status (Kosong, Terisi, Siap Bayar).

### 5. Laporan Keuangan, Riwayat Transaksi & Ekspor CSV (R5)
- **File Terdampak**: `app/(tabs)/history.tsx`, `app/(tabs)/finance.tsx`.
- **Temuan & Akar Masalah**:
  1. **Transaksi Pending & Merged Tidak Muncul**: Kueri riwayat transaksi memfilter secara mutlak `WHERE t.status = 'completed'`, sehingga kasir tidak dapat melihat riwayat pesanan pending atau transaksi yang telah digabung.
  2. **Filter Periode Terbatas**: Hanya terdapat toggle filter "Hari Ini", belum tersedia filter periode 7 Hari, 1 Bulan, maupun pilihan rentang bulan/tanggal.
  3. **Rincian Metode Pembayaran**: Belum ada kartu ringkasan pembagian omset berdasarkan metode pembayaran (Tunai, QRIS, Transfer) yang sinkron dengan file ekspor CSV.

---

## Bagian II: Rencana Kerja Perbaikan Terstruktur (Ponytail Work Plan)

Rencana perbaikan diorganisasikan ke dalam milestone independen yang dapat diverifikasi secara modular dan komprehensif.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Survey & Initial Plan (M0)               │
                    │      [Dokumen Temuan Audit & Rencana Kerja R1]         │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
      ┌─────────────────────────────┐                       ┌─────────────────────────────┐
      │   E2E Test Suite (M-E2E)    │                       │  Milestone 1: Finansial &   │
      │   - Harness native Node 24  │                       │   Integritas DB (R2)        │
      │   - Tier 1-4 Test Suites    │                       │   - Net Profit & Kas Masuk  │
      │   - Output: TEST_READY.md   │                       │   - Atomic Transactions     │
      └──────────────┬──────────────┘                       │   - Struk & Profil Toko     │
                     │                                      │   - Pembersihan Foto        │
                     │                                      └──────────────┬──────────────┘
                     │                                                     │
                     │                                                     ▼
                     │                                      ┌─────────────────────────────┐
                     │                                      │  Milestone 2: Manajemen     │
                     │                                      │   Menu & Android UX (R3)    │
                     │                                      │   - Upload Foto Permanen    │
                     │                                      │   - Penyatuan Modal Edit    │
                     │                                      │   - Hapus Alert.prompt &    │
                     │                                      │     kode iOS                │
                     │                                      │   - Long-press 200ms        │
                     │                                      └──────────────┬──────────────┘
                     │                                                     │
                     │                                                     ▼
                     │                                      ┌─────────────────────────────┐
                     │                                      │  Milestone 3: Meja, Pending │
                     │                                      │   Order & Tiket Dapur (R4)  │
                     │                                      │   - Pesanan Sambungan       │
                     │                                      │   - mergeTables tanpa duplikat │
                     │                                      │   - Tagihan Sementara &     │
                     │                                      │     Status Meja             │
                     │                                      └──────────────┬──────────────┘
                     │                                                     │
                     │                                                     ▼
                     │                                      ┌─────────────────────────────┐
                     │                                      │  Milestone 4: Laporan,      │
                     │                                      │   Riwayat & Ekspor CSV (R5) │
                     │                                      │   - Filter Periode          │
                     │                                      │   - Breakdown Pembayaran    │
                     │                                      │   - Status Pending/Merged   │
                     │                                      └──────────────┬──────────────┘
                     │                                                     │
                     └──────────────────────────┬──────────────────────────┘
                                                │
                                                ▼
                               ┌──────────────────────────────────┐
                               │     Milestone Final (M-FINAL)    │
                               │   - 100% E2E Pass (Tiers 1-4)    │
                               │   - Tier 5 Adversarial Hardening │
                               │   - TypeScript Clean & Lint      │
                               │   - Forensic Audit Clean         │
                               └──────────────────────────────────┘
```

### Rincian Pelaksanaan Tiap Milestone

#### Milestone 1: Integritas Finansial, Struk Transaksi & Database (R2)
1. **Perbaikan Kalkulasi Laba Bersih**:
   - Lokasi: `stores/financialStore.ts`.
   - Aksi: Saat mengiterasi `cash_ledger` untuk menghitung `operIncome`, tambahkan syarat penyaringan: abaikan baris yang memiliki `category === 'penjualan_tunai'`.
2. **Penyelarasan Kas Masuk**:
   - Lokasi: `stores/transactionStore.ts`.
   - Aksi: Ganti nilai literal `'in'` menjadi `'income'` pada saat menyisipkan catatan kas masuk tunai. Sediakan migrasi otomatis untuk mengubah baris lama `type = 'in'` menjadi `'income'`.
3. **Pembungkusan Database Atomik**:
   - Lokasi: `stores/transactionStore.ts`, `stores/purchaseStore.ts`, `stores/attendanceStore.ts`.
   - Aksi: Bungkus seluruh rangkaian mutasi multi-tabel (`checkout`, `saveAsPendingOrder`, `mergeTables`, `recordPurchase`, `settleTempoDebt`, `closeOperatingSession`) ke dalam blok `await db.withTransactionAsync(async () => { ... })`.
4. **Metode Pembayaran Struk & Profil Toko**:
   - Lokasi: `stores/transactionStore.ts`, `components/payment-modal.tsx`, `app/transaksi.tsx`, `app/(tabs)/history.tsx`.
   - Aksi: Kembalikan `paymentMethod` dari `checkout`, teruskan melalui `onSuccess` modal pembayaran, serta hubungkan pencetakan struk dan pratinjau dengan data `settings` (nama toko, alamat, no telp, footer).
5. **Pembersihan Fisik Foto Absensi**:
   - Lokasi: `stores/attendanceStore.ts`, `utils/imageStorage.ts`.
   - Aksi: Lakukan kueri path file foto dari tabel `attendance` untuk bulan yang bersangkutan, hapus file fisik satu per satu menggunakan `FileSystem.deleteAsync(path, { idempotent: true })`, lalu perbarui kolom database menjadi string kosong.
6. **Auto-Load Pengaturan Saat Startup**:
   - Lokasi: `app/_layout.tsx`.
   - Aksi: Panggil pemuatan pengaturan profil toko, tarif pajak PB1, dan konfigurasi printer Bluetooth pada fungsi inisialisasi aplikasi.

#### Milestone 2: Manajemen Menu, Upload Foto Produk & Pemurnian Android (R3)
1. **Upload Foto Menu Lokal Permanen**:
   - Lokasi: `components/menu-form-modal.tsx`.
   - Aksi: Hapus guard keliru `!photoUri.startsWith('file://')`. Panggil langsung `await saveImageLocally(photoUri, 'menus')` saat `photoUri` ada dan belum tersimpan di direktori dokumen permanen. Tampilkan thumbnail foto pada kartu menu dengan placeholder icon saat foto kosong.
2. **Penyatuan Modal Edit Menu**:
   - Lokasi: `components/menu-form-modal.tsx`, `components/quick-edit-product-modal.tsx`, `app/(tabs)/explore.tsx`, `app/transaksi.tsx`.
   - Aksi: Tambahkan stepper penyesuaian stok (`-5`, `-1`, `+1`, `+5`) dan tombol hapus menu ke dalam `MenuFormModal`. Hapus komponen `QuickEditProductModal` (menghapus 316 baris redundan). Ubah tombol pada `explore.tsx` menjadi satu tombol "Edit", dan hubungkan interaksi long-press pada `transaksi.tsx` langsung ke `MenuFormModal`.
3. **Eliminasi Kode & API Khusus iOS**:
   - Lokasi: `app/(tabs)/explore.tsx`, `components/receipt-preview-modal.tsx`.
   - Aksi: Ganti `Alert.prompt` pada fitur penambahan kategori dengan modal input dialog native Android (`TextInput`). Hapus seluruh pengecekan `Platform.OS === 'ios'` pada font struk kasir dan gunakan `'monospace'`.
4. **Percepatan Respon Long-Press Transaksi**:
   - Lokasi: `app/transaksi.tsx`.
   - Aksi: Ubah `delayLongPress={2000}` menjadi `delayLongPress={200}` dengan getaran haptik (`Haptics.impactAsync`).

#### Milestone 3: Manajemen Meja, Pesanan Pending & Tiket Dapur (R4)
1. **Penanganan Pesanan Sambungan & Penanda Delta**:
   - Lokasi: `stores/transactionStore.ts`.
   - Aksi: Simpan snapshot jumlah porsi awal saat membuka pesanan pending meja. Saat kasir menambahkan porsi baru ke keranjang, catat selisih porsi tersebut dengan flag `is_additional = 1`.
2. **Pencetakan Tiket Dapur Sambungan**:
   - Lokasi: `app/transaksi.tsx`, `services/print.ts`.
   - Aksi: Pada `handleHoldOrder`, jika terdapat item dengan `is_additional = 1`, picu pencetakan tiket dapur tambahan (`printKitchenAdditionalTicket`). Jika merupakan pesanan meja baru, picu pencetakan tiket dapur awal (`printKitchenTicket`).
3. **Penggabungan Meja Bersih (`mergeTables`)**:
   - Lokasi: `stores/transactionStore.ts`.
   - Aksi: Gabungkan item pesanan yang memiliki `menu_id` dan `price` yang sama menggunakan agregasi SQLite `GROUP BY menu_id, price` dengan `SUM(qty)` dan `SUM(subtotal)`. Pertahankan total diskon dari seluruh transaksi yang digabung, hitung ulang pajak PB1 berdasarkan subtotal baru, dan perbarui total akhir secara akurat dalam transaksi atomik.
4. **Visibilitas Meja & Tagihan Sementara**:
   - Lokasi: `components/table-selector-modal.tsx`, `services/print.ts`, `components/receipt-preview-modal.tsx`.
   - Aksi: Sediakan status visual meja ("Kosong", "Terisi", "Siap Bayar"). Tambahkan fungsi pencetakan dan pratinjau "Tagihan Sementara" dengan watermark teks `*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***`.

#### Milestone 4: Laporan Keuangan, Riwayat Transaksi & Ekspor CSV (R5)
1. **Filter Periode Laporan & Riwayat**:
   - Lokasi: `app/(tabs)/history.tsx`, `app/(tabs)/finance.tsx`.
   - Aksi: Tambahkan tombol pemilihan periode: "Hari Ini", "7 Hari Terakhir", "1 Bulan", dan "Pilih Bulan/Tanggal".
2. **Visibilitas Status Pending & Merged**:
   - Lokasi: `app/(tabs)/history.tsx`.
   - Aksi: Modifikasi kueri agar tidak hanya memuat transaksi berstatus `completed`. Tampilkan status transaksi dengan badge visual ("Selesai", "Pending", "Digabung", "Batal").
3. **Ringkasan Metode Pembayaran & Sinkronisasi CSV**:
   - Lokasi: `app/(tabs)/history.tsx`, `app/(tabs)/finance.tsx`, `services/backup.ts`.
   - Aksi: Tambahkan kartu ringkasan omset untuk Tunai, QRIS, dan Transfer. Pastikan data yang diekspor ke file CSV selaras dengan angka yang ditampilkan pada kartu ringkasan dan halaman Keuangan.

#### Track Pengujian E2E & Verifikasi Kualitas
1. **Infrastruktur Pengujian Otomatis**:
   - Menyediakan harness pengujian headless menggunakan pustaka bawaan `node:test` dan `node:assert` dari Node.js v24 (tanpa menambah dependensi runtime berat).
   - Pengujian mencakup unit test formula keuangan, simulasi deduplikasi penggabungan meja, penandaan delta pesanan sambungan, dan verifikasi struktur format cetak thermal.
2. **Pemeriksaan Statis & Keamanan**:
   - Memastikan `tsc --noEmit` bersih (0 error).
   - Menjalankan audit integritas forensik untuk memastikan tidak ada mock palsu atau data hardcoded.

---

## Bagian III: Tabel Rencana Eksekusi & Penerima Tugas

| No | Modul / Fitur | Target File | Estimasi Dampak Kode | PIC Subagent |
|---|---|---|---|---|
| 1 | E2E Testing Suite Harness | `test/`, `package.json` | +150 baris tes | `teamwork_test_writer` / Worker Test |
| 2 | Net Profit & Kas Masuk Fix | `financialStore.ts`, `transactionStore.ts` | ~25 baris | `teamwork_worker` M1 |
| 3 | Struk, Profil Toko & DB Atomic | `transactionStore.ts`, `purchaseStore.ts`, `attendanceStore.ts`, `print.ts` | ~60 baris | `teamwork_worker` M1 |
| 4 | Pembersihan Foto Absensi | `attendanceStore.ts`, `imageStorage.ts` | ~20 baris | `teamwork_worker` M1 |
| 5 | Upload Foto Menu Permanen | `menu-form-modal.tsx` | ~15 baris | `teamwork_worker` M2 |
| 6 | Penyatuan Modal Edit Menu | `menu-form-modal.tsx`, hapus `quick-edit-product-modal.tsx` | -316 baris net | `teamwork_worker` M2 |
| 7 | Eliminasi iOS & Long-press 200ms | `explore.tsx`, `transaksi.tsx`, `receipt-preview-modal.tsx` | ~40 baris | `teamwork_worker` M2 |
| 8 | Pesanan Sambungan & Tiket Dapur | `transactionStore.ts`, `transaksi.tsx`, `print.ts` | ~50 baris | `teamwork_worker` M3 |
| 9 | mergeTables Fix & Tagihan Sementara | `transactionStore.ts`, `table-selector-modal.tsx`, `print.ts` | ~70 baris | `teamwork_worker` M3 |
| 10 | Riwayat, Filter Periode & CSV | `history.tsx`, `finance.tsx` | ~80 baris | `teamwork_worker` M4 |
