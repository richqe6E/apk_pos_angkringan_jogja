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


## 2026-11-07T10:28:38Z

Lakukan pemeriksaan mendalam, perbaikan bug fungsional tombol dan modal form, penyesuaian alur operasional, serta penambahan fitur operasional pada aplikasi POS Angkringan sesuai hasil pengujian operasional.

Working directory: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja
Integrity mode: development

## Requirements

### R1. Perbaikan Bug Pengelolaan Menu
- Menu bawaan aplikasi harus dapat dihapus secara permanen sesuai kebutuhan operasional pemilik usaha.
- Form Tambah Menu baru harus menampilkan seluruh komponen input data barang secara lengkap dan data yang diisi dapat tersimpan dengan benar.
- Form Edit Menu harus menampilkan komponen input data barang lengkap beserta data menu yang telah tersimpan sebelumnya, dan perubahan data dapat disimpan dengan benar.
- Fitur Quick Edit Menu (tekan dan tahan menu pada kasir) harus menampilkan form perubahan data menu lengkap (seperti harga jual, stok, dll.), bukan hanya tombol Hapus Menu, Batal, dan Simpan Perubahan.

### R2. Perbaikan Tombol Bagian Kanan Atas dan Modal Form di Seluruh Modul
Lakukan pemeriksaan dan perbaikan pada event handler, pemanggilan form/modal, validasi input, dan fungsi penyimpanan data pada tombol-tombol kanan atas berikut:
- Modul Menu: Tombol Kategori menampilkan form/modal pengelolaan kategori produk.
- Modul Riwayat: Tombol Unduh PDF dan Tombol Unduh CSV menjalankan fungsi ekspor data riwayat transaksi ke format PDF dan CSV.
- Modul Absensi: Tombol Tambah Karyawan menampilkan form pendaftaran karyawan baru dan menyimpan data karyawan.
- Modul Keuangan: Tombol HPP Global menampilkan form/modal pengaturan HPP global dan menyimpan perubahannya.
- Modul Manajemen Customer: Tombol Atur Tingkatan Reward menampilkan form pengaturan tingkatan reward (nominal pembelian dan keterangan hadiah) dan menyimpan data reward.
- Modul Supplier: Tombol Supplier Baru menampilkan form tambah data supplier baru dan menyimpan data supplier.
- Modul Supplier: Fitur Catat Pembelian Bahan menampilkan form pencatatan pembelian bahan/barang dan tersimpan terintegrasi dengan pencatatan pengeluaran kas atau utang supplier sesuai jenis transaksi.

### R3. Evaluasi Fitur Struk Tagihan Sementara
- Buat laporan evaluasi tertulis mengenai fungsi dan tujuan penggunaan struk tagihan sementara dalam alur kasir (membandingkannya dengan transaksi pending nomor meja serta pencetakan struk customer, kasir, dan kitchen).
- Evaluasi apakah fitur ini relevan dipertahankan atau dihapus agar tidak menambah kompleksitas alur kasir.

### R4. Pengelolaan Meja Dinamis
- Pemilik usaha dapat menambahkan meja baru, mengubah nama meja, dan mengubah nomor meja secara dinamis (data meja tidak permanen/hardcoded).
- Perubahan data meja harus terintegrasi langsung dengan pemilihan meja dan mekanisme transaksi pending pada modul kasir.

### R5. Pemilihan Identitas Kasir
- Menampilkan dialog/pemilihan nama kasir dari daftar karyawan yang sudah terdaftar sebelum aktivitas operasional kasir dimulai.
- Identitas kasir yang dipilih harus tercatat pada setiap transaksi penjualan yang dijalankan.
- Nama kasir harus dicantumkan pada struk penjualan customer dan struk audit internal kasir.

### R6. Tampilan Rekap Absensi Berbasis Kalender
- Mengubah tampilan riwayat/rekap absensi karyawan menjadi tampilan kalender bulanan interaktif.
- Setiap tanggal pada kalender dapat dipilih/diklik untuk menampilkan data rincian absensi seluruh karyawan pada tanggal tersebut.

### R7. Pengaturan Pembayaran QRIS dan Multi-Rekening Transfer
- Modul Pengaturan menyediakan fitur untuk mengunggah atau menyimpan foto QRIS toko, yang otomatis ditampilkan pada layar kasir ketika metode pembayaran QRIS dipilih.
- Modul Pengaturan menyediakan fitur untuk menyimpan multi-rekening bank pemilik usaha (nomor rekening dan identitas rekening), yang otomatis ditampilkan sebagai pilihan rekening tujuan transfer pada layar kasir ketika metode transfer dipilih.
- Menyusun laporan analisis tertulis dan beberapa alternatif pendekatan integrasi data penerimaan bank untuk didiskusikan lebih lanjut, tanpa langsung mengimplementasikan integrasi perbankan.

### R8. Laporan Audit, Kualitas Kode, dan Stabilitas Sistem
- Pertahankan fungsi dan logika bisnis yang sudah berjalan, serta jaga konsistensi data tanpa mengubah struktur database tanpa kebutuhan jelas.
- Lakukan audit kualitas kode dan verifikasi menggunakan kaidah /ponytail-audit dan /ponytail-review.
- Menyusun laporan akhir pelaksanaan perbaikan yang mencakup:
  1. Daftar bug yang ditemukan
  2. Penyebab utama (root cause) setiap bug
  3. Perubahan yang dilakukan
  4. Status keberhasilan perbaikan
  5. Hasil pengujian setiap fitur
  6. Masalah yang masih belum terselesaikan (jika ada)
