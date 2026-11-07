Perbaikan bug, integrasi alur operasional, dan penambahan fitur pada aplikasi POS Angkringan Jogja untuk kesiapan lingkungan produksi (operasional riil toko), disertai laporan analisis teknis dan evaluasi fungsional.

Working directory: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja
Integrity mode: development

## Verification Resources
- Test suite yang tersedia di repositori: `npm test` (`test/*.test.ts`) dan dokumentasi `TEST_READY.md`.

## Requirements

### R1. Perbaikan Fitur Manajemen Menu dan Quick Edit Kasir
- Seluruh daftar menu (termasuk menu bawaan aplikasi) dapat dihapus dan dikelola sesuai kebutuhan operasional pemilik usaha.
- Form tambah menu baru harus muncul lengkap dengan komponen input data barang dan dapat menyimpan data menu dengan benar.
- Form edit menu harus menampilkan komponen input lengkap beserta data yang telah tersimpan sebelumnya.
- Fitur quick edit menu (tekan dan tahan pada item menu di kasir) harus menampilkan input pengubahan data (harga jual, stok, dll.), tombol simpan, dan tombol hapus yang berfungsi normal.

### R2. Perbaikan Tombol Aksi Kanan Atas pada Seluruh Modul
- Modul Menu: Tombol Kategori harus menampilkan modal/form pengelolaan kategori yang berfungsi.
- Modul Riwayat: Tombol Unduh PDF dan Unduh CSV harus menjalankan fungsi ekspor data riwayat transaksi.
- Modul Absensi: Tombol Tambah Karyawan harus memunculkan form/modal penambahan karyawan dan menyimpan datanya.
- Modul Keuangan: Tombol HPP Global harus menampilkan form/fungsi pengaturan HPP.
- Modul Manajemen Customer: Tombol Atur Tingkatan Reward harus memunculkan form untuk mengatur nominal pembelian dan keterangan hadiah reward.
- Modul Supplier: Tombol Supplier Baru harus memunculkan form penambahan supplier baru dan menyimpannya.

### R3. Evaluasi Fitur Struk Tagihan Sementara
- Pertahankan kode fitur struk tagihan sementara tanpa menghapusnya terlebih dahulu.
- Berikan penjelasan mendalam mengenai fungsi dan tujuan penggunaan struk tagihan sementara dalam alur transaksi aplikasi, serta evaluasi kebutuhan fitur tersebut di dalam laporan akhir.

### R4. Manajemen Meja Dinamis dan Integrasi Kasir
- Tambahkan fitur manajemen meja yang memungkinkan pemilik usaha menambah meja baru, mengedit nama meja, dan mengedit nomor meja.
- Data meja tidak boleh ditetapkan secara permanen (hardcoded) oleh sistem, dan harus terintegrasi langsung dengan pemilihan meja serta transaksi pending pada modul kasir.

### R5. Pemilihan Identitas Kasir Operasional
- Wajibkan alur pemilihan nama kasir sebelum memulai transaksi operasional kasir dari daftar karyawan terdaftar.
- Identitas kasir yang dipilih harus tercatat pada transaksi penjualan, ditampilkan pada struk penjualan customer, dan dicantumkan pada struk audit internal kasir.

### R6. Perbaikan Form Transaksi pada Customer dan Supplier
- Form Atur Tingkatan Reward pada modul customer harus dapat dibuka, diisi (nominal pembelian dan keterangan hadiah), dan disimpan sesuai skema reward.
- Form Catat Pembelian Bahan pada modul supplier harus dapat dibuka, mencatat bahan/barang yang dibeli, dan terintegrasi dengan pengeluaran kas atau utang supplier sesuai jenis transaksi.

### R7. Rekap Absensi Berbasis Tampilan Kalender
- Ubah tampilan riwayat absensi karyawan menjadi kalender bulanan interaktif.
- Setiap tanggal pada kalender dapat dipilih untuk menampilkan rincian data absensi karyawan pada tanggal tersebut.

### R8. Pengaturan Metode Pembayaran dan Analisis Integrasi Bank
- QRIS: Pengaturan untuk mengunggah atau menyimpan foto QRIS toko dan menampilkannya otomatis di halaman pembayaran saat kasir memilih metode QRIS.
- Transfer: Pengaturan untuk menyimpan beberapa rekening bank (nomor rekening dan data identitas rekening) dan menampilkannya otomatis di halaman pembayaran saat kasir memilih metode transfer.
- Integrasi Bank: Jangan langsung mengimplementasikan integrasi perbankan; berikan analisis dan beberapa alternatif pendekatan metode integrasi data penerimaan bank di laporan akhir untuk dibahas lebih lanjut.

### R9. Ketentuan Pelaksanaan, Audit Mutu, dan Pelaporan
- Periksa akar penyebab setiap bug (event handler, form, modal, validasi input, integrasi penyimpanan data) sebelum melakukan perubahan kode.
- Pertahankan fungsi dan logika bisnis lain yang sudah berjalan dengan baik, tanpa mengubah struktur database tanpa kebutuhan jelas.
- Manfaatkan kemampuan analisis dan audit mutu (skill /plan, /ponytail-audit, /ponytail-gain).
- Sediakan laporan akhir komprehensif berisi: daftar bug yang ditemukan, penyebab utama, perubahan yang dilakukan, status keberhasilan perbaikan, hasil pengujian setiap fitur, dan masalah yang belum terselesaikan.

## Acceptance Criteria

### Manajemen Menu & Quick Edit
- [ ] Seluruh menu bawaan dapat dihapus dari sistem tanpa pesan galat atau kegagalan data.
- [ ] Form tambah menu dan edit menu muncul dengan komponen input lengkap dan data tersimpan dengan benar.
- [ ] Quick edit menu via tekan-dan-tahan menampilkan form input lengkap untuk edit harga/stok serta tombol simpan dan hapus berfungsi normal.

### Tombol Aksi Kanan Atas
- [ ] Tombol Kategori (Menu), Unduh PDF/CSV (Riwayat), Tambah Karyawan (Absensi), HPP Global (Keuangan), Atur Tingkatan Reward (Customer), dan Supplier Baru (Supplier) memunculkan form/modal atau mengeksekusi fungsinya tanpa kegagalan.

### Struk Tagihan Sementara & Analisis Bank
- [ ] Fitur struk tagihan sementara tetap ada dan laporan akhir memuat penjelasan fungsi serta evaluasi relevansi fiturnya dalam alur transaksi kasir.
- [ ] Laporan akhir menyajikan analisis mendalam dan alternatif pendekatan integrasi penerimaan dana bank tanpa implementasi sepihak.

### Manajemen Meja & Identitas Kasir
- [ ] Pemilik usaha dapat menambah, mengedit nama, dan nomor meja baru; modul kasir dan transaksi pending menggunakan data meja dinamis ini.
- [ ] Operasional kasir mewajibkan pemilihan kasir dari data karyawan terdaftar; nama kasir tercatat pada penjualan, struk customer, dan struk audit internal kasir.

### Customer, Supplier & Absensi Kalender
- [ ] Form Atur Tingkatan Reward dan Catat Pembelian Bahan terbuka serta menyimpan data dengan integrasi keuangan yang sesuai.
- [ ] Rekap absensi menampilkan kalender bulanan dan memilih tanggal menampilkan data absensi tanggal tersebut secara akurat.

### Pembayaran QRIS & Rekening Transfer
- [ ] Foto QRIS dapat disimpan di pengaturan dan tampil otomatis pada pembayaran QRIS.
- [ ] Data rekening bank dapat disimpan lebih dari satu dan pilihan rekening tampil pada pembayaran transfer.

### Pengujian & Laporan
- [ ] Seluruh pengujian otomatis yang relevan (`npm test`) berjalan sukses tanpa regresi.
- [ ] Laporan perbaikan operasional disajikan lengkap sesuai format yang diminta mencakup penyebab, perubahan, hasil uji, dan evaluasi.