## 2026-11-07T10:54:21Z

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

## Verification Resources
- Test suite pengujian otomatis di repositori: `test/tier1-features.test.ts` hingga `test/tier5-adversarial.test.ts`.
- Perintah eksekusi pengujian: `npm test` atau `node --test test/**/*.test.ts`.

## Acceptance Criteria

### Pengelolaan Menu & Quick Edit
- [ ] Menu bawaan aplikasi dapat dihapus oleh pengguna dan tidak muncul kembali setelah aplikasi dimuat ulang.
- [ ] Tombol Tambah Menu memunculkan form input lengkap dan data menu baru tersimpan dengan benar.
- [ ] Tombol Edit Menu dan Quick Edit (tekan & tahan) memunculkan form dengan data yang sudah terisi dan dapat disimpan perubahannya.

### Tombol Aksi & Modal Form Modul
- [ ] Tombol Kategori, Unduh PDF, Unduh CSV, Tambah Karyawan, HPP Global, Atur Tingkatan Reward, dan Supplier Baru memunculkan modal/menjalankan aksi yang sesuai.
- [ ] Form Catat Pembelian Bahan berhasil menyimpan data pembelian dan memperbarui catatan pengeluaran kas atau utang supplier.

### Pengelolaan Meja & Alur Kasir
- [ ] Fitur penambahan dan pengeditan nama/nomor meja berfungsi secara dinamis dan tersinkronisasi pada opsi meja transaksi pending kasir.
- [ ] Pengguna diminta memilih kasir aktif dari data karyawan sebelum transaksi, dan nama kasir tercetak pada struk penjualan customer serta struk audit internal kasir.

### Rekap Absensi & Pembayaran
- [ ] Tampilan rekap absensi berupa kalender bulanan yang dapat diklik per tanggal untuk melihat detail catatan absensi karyawan.
- [ ] Foto QRIS yang tersimpan di pengaturan otomatis tampil saat kasir memilih metode QRIS.
- [ ] Daftar rekening bank yang tersimpan di pengaturan otomatis tampil dan dapat dipilih saat kasir memilih metode Transfer.

### Verifikasi & Laporan
- [ ] Laporan evaluasi struk tagihan sementara dan analisis pendekatan integrasi bank tersedia lengkap dalam dokumentasi hasil perbaikan.
- [ ] Seluruh pengujian pada test suite (`npm test`) berhasil dieksekusi tanpa regresi pada fitur yang sudah berjalan.
- [ ] Laporan akhir perbaikan menyajikan daftar bug, akar masalah, perubahan, status pengujian, dan temuan review.
