## 2026-11-07T03:46:15Z

Perbaiki seluruh bug, integrasi terputus, dan fitur yang belum terealisasi pada aplikasi POS Angkringan Jogja sesuai PRD dan temuan audit, difokuskan murni untuk perangkat Android (tablet dan smartphone) dengan meniadakan seluruh percabangan/teknologi khusus iOS, diawali dengan penyajian hasil temuan audit dan rencana perbaikan menggunakan keahlian /ponytail-audit, /ponytail-debt, /ponytail-review, dan /ponytail-help sebelum eksekusi perbaikan kode.

Integrity mode: development

## Requirements

### R1. Tahap Audit Awal & Rencana Kerja
Sajikan dokumen temuan audit komprehensif dan rencana perbaikan terstruktur mencakup seluruh temuan audit sebelumnya (bug kalkulasi laba bersih & kas masuk, struk kasir, manajemen meja & pending, upload gambar menu dan penyatuan editor menu, transaksi atomik database, pembersihan foto absensi, laporan keuangan/riwayat, integrasi pengaturan & printer, serta eliminasi kode khusus iOS) sebelum mulai mengubah kode implementasi.

### R2. Integritas Data Keuangan, Struk Transaksi & Database
Perbaiki penghitungan laba bersih agar penjualan tunai tidak terhitung ganda dan pastikan transaksi tunai tampil pada riwayat kas masuk. Perbaiki pencetakan struk dan preview transaksi agar menggunakan profil toko, footer, dan metode pembayaran aktual (Tunai, QRIS, Transfer) dari pengaturan. Bungkus operasi multi-query pada transaksi dan pembelian ke dalam transaksi database atomik. Perbaiki pembersihan file foto absensi agar benar-benar terhapus dari media penyimpanan. Muat otomatis pengaturan profil toko, pajak, dan printer saat aplikasi dimulai.

### R3. Manajemen Menu, Upload Foto Produk & Fokus Khusus Android
Sediakan fitur upload gambar menu dengan penyimpanan lokal permanen dan tampilkan foto menu pada kartu menu. Satukan tombol 'Quick Edit' dan 'Edit' menjadi satu modal edit menu lengkap yang memungkinkan pengubahan seluruh atribut (foto, nama, harga, kategori, stok, barcode) baik dari halaman menu maupun saat mengelola menu dari halaman transaksi. Sediakan form tambah menu yang lengkap. Hapus dan bersihkan seluruh percabangan atau ketergantungan khusus iOS (seperti `Alert.prompt` dan pengecekan platform iOS) di seluruh sistem, dan ganti dengan solusi yang bekerja murni dan optimal untuk tablet/HP Android. Pada halaman transaksi, buat interaksi tahan produk (long-press) lebih cepat dan responsif untuk membuka editor produk.

### R4. Manajemen Meja, Pesanan Pending & Tiket Dapur
Perkuat fungsionalitas manajemen meja dan pesanan pending: penambahan pesanan sambungan pada meja aktif harus mencatat delta tambahan porsi menu (`is_additional = 1`) dan mendukung pencetakan tiket dapur/sambungan. Perbaiki penggabungan meja (`mergeTables`) agar tidak mereset pajak/diskon dan tidak menduplikasi menu yang sama. Lengkapi visibilitas status meja dan tagihan sementara.

### R5. Laporan Keuangan, Riwayat Transaksi & Ekspor Data
Lengkapi pencatatan serta pelaporan kas masuk dan kas keluar sesuai PRD agar tersinkronisasi antara halaman Keuangan, Riwayat Transaksi, dan Ekspor CSV. Sediakan filter periode (Hari Ini, 7 Hari, 1 Bulan, Pilih Bulan/Tanggal) serta rincian pembayaran (Tunai, QRIS, Transfer). Pastikan transaksi pending dan merged tampil semestinya di riwayat transaksi.

## Acceptance Criteria

### Audit & Rencana Kerja
- [ ] Dokumen temuan audit dan rencana perbaikan disajikan secara terperinci mencakup seluruh area perbaikan sebelum modifikasi kode dilakukan.

### Integritas Transaksi & Data
- [ ] Penjualan tunai tidak terhitung ganda pada kalkulasi laba bersih di financialStore.
- [ ] Transaksi tunai muncul pada tab Kas Masuk di riwayat transaksi.
- [ ] Struk kasir dan pratinjau struk mencetak metode bayar yang sesuai (Tunai, QRIS, Transfer) dan informasi toko dari settings.
- [ ] Operasi multi-query pada transaksi dan pembelian menggunakan transaksi database (`db.withTransactionAsync`).
- [ ] Pembersihan bulanan foto absensi menghapus file fisik di penyimpanan lokal.
- [ ] Pengaturan profil toko, pajak PB1, dan printer tersimpan dimuat otomatis saat inisialisasi aplikasi.

### Pengelolaan Menu & Kompatibilitas Android
- [ ] Foto menu berhasil dipilih dari galeri/kamera, tersimpan permanen di penyimpanan lokal, dan tampil pada kartu menu.
- [ ] Hanya terdapat satu modal edit menu komprehensif (edit foto, nama, harga, kategori, stok, barcode) yang dapat diakses dari menu maupun transaksi.
- [ ] Seluruh percabangan dan ketergantungan khusus iOS (seperti `Alert.prompt` pada tambah kategori) dihilangkan dan diganti dengan implementasi modal/input yang berfungsi penuh di Android.
- [ ] Aksi tahan produk (long-press) di halaman transaksi merespons cepat (delay sekitar 200ms) dan membuka modal edit menu.

### Meja & Pending Order
- [ ] Tambah pesanan sambungan pada meja pending menghasilkan tiket dapur/sambungan dan mencatat penambahan porsi sebagai item tambahan.
- [ ] Penggabungan meja mempertahankan pengaturan pajak/diskon dan menggabungkan item menu yang sama tanpa duplikasi baris.

### Laporan Keuangan
- [ ] Kas masuk dan kas keluar tercatat akurat dan sinkron antara halaman Keuangan, Riwayat Transaksi, dan file CSV hasil ekspor.
- [ ] Filter periode laporan dan rincian metode pembayaran berfungsi akurat sesuai PRD.

### Verifikasi Otomatis
- [ ] Pemeriksaan tipe TypeScript (`npx tsc --noEmit` atau sejenisnya) dan linter berjalan bersih tanpa error baru.
- [ ] Automated test suite di proyek berjalan sukses untuk memverifikasi logika toko, kalkulasi finansial, dan transaksi pada target Android.


## 2026-11-07T03:49:06Z
Acknowledged. Proceed with synthesizing the comprehensive audit findings and structured repair plan (R1) using the ponytail skills, and present the report once the 3 explorers complete their survey.


## 2026-11-07T04:03:54Z
Audit findings and structured work plan (Requirement R1) have been received and presented to the caller. Rencana perbaikan disetujui. Silakan lanjutkan eksekusi Dual Track (E2E Testing Track dan Implementasi Milestone 1-4) sesuai rencana kerja yang telah disajikan.
