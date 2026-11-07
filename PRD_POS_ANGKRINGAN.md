# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## APLIKASI POINT OF SALE (POS) KHUSUS ANGKRINGAN — OFFLINE ANDROID
**Versi Dokumen:** 1.1 (Final Kebutuhan Bisnis)  
**Status Dokumen:** Terverifikasi & Disetujui  
**Target Platform:** Android Tablet (Utama) & Android Smartphone (Kompatibel)  
**Lingkungan Operasional:** 100% Full Offline (Lokal Perangkat)

---

## 1. PENDAHULUAN & IDENTITAS SISTEM

### 1.1 Latar Belakang & Karakteristik Angkringan
Aplikasi ini dikembangkan secara khusus untuk proses bisnis dan operasional usaha **Angkringan** dengan karakteristik khas:
* **Jam Operasional:** Mulai sore pukul 17.30 hingga dini hari (tutup rata-rata pukul 01.00 atau fleksibel).
* **Alur Konsumsi:** Fleksibel — mendukung "makan dulu, bayar belakangan" berbasis nomor meja (open bill/pending) maupun pembayaran langsung di awal.
* **Informasi Realtime Header:** Menampilkan Hari, Tanggal, Bulan, Tahun, dan Jam realtime di bagian atas aplikasi.
* **Pencetakan Multi-Struk:** Struk customer, struk kasir, dan struk dapur (*kitchen*) tanpa harga.
* **Absensi Terintegrasi:** Absensi masuk berbasis foto kamera sebelum/pukul 17.30 (hitung otomatis menit terlambat), terkunci 1 kali per hari, dan absensi pulang otomatis serentak saat sesi operasional toko ditutup (berdasarkan jam riil penutupan).
* **Keuangan Sederhana & Tepat Guna:** HPP diinput secara global oleh pemilik di akhir bulan, beban operasional tercatat via kas keluar, serta pemisahan kas laba vs non-laba rugi.

---

## 2. MODUL 1: TRANSAKSI KASIR

### 2.1 Alur Transaksi Utama
1. **Bayar di Awal (Direct Order):**
   * Pelanggan memesan -> Kasir input menu -> Langsung tekan Bayar -> Input nominal uang -> Transaksi selesai -> Cetak Struk Customer & Struk Kitchen.
2. **Bayar di Akhir (Pending / Meja):**
   * Pelanggan duduk di meja -> Kasir input menu & pilih nomor meja -> Simpan transaksi sebagai **"Pending / Belum Dibayar"** -> Cetak Struk Kitchen (ke dapur) & Struk Customer.
   * Saat pelanggan selesai makan -> Kasir buka meja pending -> Tekan Bayar -> Input nominal bayar -> Transaksi selesai.
   * Tersedia tombol untuk **Cetak Ulang Struk Keseluruhan** (nota lunas akumulasi) jika diminta pelanggan.

### 2.2 Penanganan Pesanan Tambahan (Add Order)
* Kasir dapat membuka kembali meja pending dan menambahkan menu baru.
* **Struk Sambungan Kitchen:** Saat pesanan tambahan disimpan, printer kitchen **hanya mencetak item tambahan baru saja** dengan label tegas *"Pesanan Tambahan / Sambungan"* agar pihak dapur tidak memasak ulang pesanan sebelumnya.

### 2.3 Fitur Gabung Meja (Merge Table)
* Jika pelanggan datang rombongan besar dan menempati beberapa meja (misal Meja 5 sampai Meja 8), kasir dapat menggunakan fitur **Gabung Meja** untuk menggabungkan tagihan seluruh meja terkait menjadi satu nota pembayaran utuh saat pelanggan hendak melunasi bill acara mereka.

### 2.4 Kaitan Customer pada Transaksi
* **Customer UMUM (Default):** Jika pelanggan baru atau bukan member, kasir memilih opsi `Customer UMUM`. Transaksi ini tetap tercatat di laporan transaksi, tetapi tidak memiliki nomor HP dan tidak mengumpulkan reward.
* **Customer Member:** Kasir dapat mencari nama member. Pada tampilan transaksi, sistem hanya menampilkan: **Nama Customer, Indikator Reward yang berhak diklaim (jika ada), dan Nilai Akumulasi Belanja selama ini**. Jika belum memenuhi reward, tidak akan ditampilkan keterangan reward palsu/kosong.

---

## 3. MODUL 2: ABSENSI & MANAJEMEN KARYAWAN

### 3.1 Manajemen Data Karyawan
* Pendaftaran nama karyawan di aplikasi untuk masuk ke dalam daftar hadir aktif.

### 3.2 Absensi Masuk (Jam Patokan 17.30)
* Karyawan memilih namanya dari daftar karyawan.
* Mengambil foto wajah secara langsung melalui kamera perangkat Android.
* **Aturan Kunci Harian (One-Time Daily Lock):** Jika karyawan telah melakukan absensi masuk dan berfoto pada hari tersebut, sistem **mengunci namanya sehingga tidak dapat melakukan absensi ulang** pada hari yang sama (hanya bisa di hari berikutnya).
* **Perhitungan Otomatis Keterlambatan:**
  * Jika absen $\le$ 17.30: Status *"Tepat Waktu"*.
  * Jika absen $>$ 17.30: Status *"Terlambat"* (penanda merah) disertai **perhitungan otomatis jumlah menit keterlambatan** (contoh: *"Terlambat 24 Menit"*).

### 3.3 Absensi Pulang Otomatis & Serentak
* Karyawan tidak perlu absen pulang satu per satu.
* Saat kasir/admin menekan tombol **"Tutup Sesi Operasional Toko"**, seluruh karyawan yang hadir otomatis tercatat jam pulangnya secara serentak.
* **Jam Pulang Riil:** Jam yang dicatat adalah **jam riil saat tombol tutup sesi ditekan** (bukan patokan statis 01.00), mencerminkan realitas tutup toko (apakah lebih awal pukul 00.30 atau lebih larut pukul 02.00).

### 3.4 Penyimpanan Foto & Laporan
* Foto dikompresi sebelum disimpan di penyimpanan lokal perangkat.
* Modul pengaturan menyediakan fitur penghapusan foto absensi per bulan tertentu dengan proteksi sandi/PIN admin.
* Rekap absensi dapat diunduh dalam format **PDF** dan **Excel** per periode pilihan.

---

## 4. MODUL 3: CUSTOMER & PROGRAM REWARD

### 4.1 Master Data Customer
* Menyimpan: Nama Customer, Nomor HP.
* Menghitung otomatis: Menu favorit dan total akumulasi nilai transaksi belanja selama ini.
* Mendata profil khusus `Customer UMUM` sebagai penampung transaksi non-member.

### 4.2 Sistem Reward Akumulatif (Tiering Level Tetap)
* Menggunakan **Sistem Akumulatif Tetap (Tiering Level)**: Akumulasi nilai belanja customer **tidak pernah berkurang / tidak dipotong** saat reward diambil. Tujuannya agar pemilik toko tetap mengetahui riwayat seumur hidup (*lifetime value*) belanja pelanggan di angkringan tersebut.
* Pemilik dapat menambah tingkatan reward dan menentukan ambang batas nominal (misal Tier 1: Rp500.000, Tier 2: Rp1.000.000) beserta keterangan hadiahnya.

---

## 5. MODUL 4: SUPPLIER & PEMBELIAN BARANG

### 5.1 Data Supplier & Transaksi Pembelian
* Master Supplier: Nama supplier dan Nomor HP.
* Pembelian Tunai: Langsung memotong buku kas keluar.
* Pembelian Tempo / Utang: Dicatat pada buku utang supplier.

### 5.2 Pengaturan Jatuh Tempo Fleksibel
* Saat memilih pembelian tempo, pemilik/admin diberikan 2 pilihan tegas:
  1. **"Tidak Ada Jatuh Tempo"**
  2. **"Ada Jatuh Tempo"** $\rightarrow$ Menampilkan pemilih kalender / daftar tanggal tanpa perlu mengetik manual tanggalnya.
* Setiap pembelian dapat dilampiri foto nota/faktur pembelian (kamera/galeri).

---

## 6. MODUL 5: LAPORAN KEUANGAN & HPP

### 6.1 Laporan Laba Rugi Sederhana
* Menyajikan Penjualan Bruto, Penjualan Bersih, Total Pemasukan, dan Total Pengeluaran Kas.
* Beban operasional toko (listrik, air, plastik, sewa, bumbu) diinput oleh pemilik melalui modul **Kas Keluar**.

### 6.2 Perhitungan HPP Global Akhir Bulan
* Pemilik usaha menginput **nilai total modal/HPP secara global (Opsi A) saat akhir bulan**.
* Laporan laba rugi menyajikan perhitungan **Laba Kotor** berdasarkan akumulasi omzet penjualan periode berjalan dikurangi nilai total HPP yang diinput oleh pemilik usaha pada akhir bulan tersebut.

---

## 7. MODUL 6: PENERIMAAN KAS & PENGELUARAN KAS

### 7.1 Pembagian Kategori Arus Kas
1. **Kategori Memengaruhi Laba Rugi (Beban Operasional):** Ditampilkan sebagai menu utama (misal: listrik, air, plastik, arang, kebutuhan mendesak).
2. **Kategori Tidak Memengaruhi Laba Rugi (Mutasi Non-Operasional):** Disediakan pada daftar terpisah (misal: setor kas ke bank, penarikan pribadi/prive, modal awal laci). Kategori ini dapat dikustomisasi/ditambah oleh pemilik.

---

## 8. MODUL 7: RIWAYAT TRANSAKSI

Terbagi dalam 3 tab independen:
1. **Riwayat Penjualan:** Pesanan lunas, pending meja, riwayat gabung meja, rincian menu, metode bayar.
2. **Riwayat Penerimaan Kas:** Mutasi uang masuk di luar transaksi kasir.
3. **Riwayat Pengeluaran Kas:** Pembayaran beban operasional, belanja tunai supplier, dan kas non-operasional.

---

## 9. MODUL 8: PENGATURAN APLIKASI

1. **Identitas Toko:** Nama, Alamat, No HP, Catatan Kaki struk.
2. **Multi-Printer Bluetooth (> 2 Printer):**
   * Printer Kasir/Customer (cetak nota lengkap berharga).
   * Printer Kitchen (cetak otomatis tiket dapur tanpa harga).
3. **Backup, Restore & Impor:**
   * Ekspor seluruh data offline ke file JSON.
   * Pemulihan database dari file JSON.
   * Impor katalog menu instan via CSV.
4. **Penghapusan Data:**
   * Hapus transaksi saja.
   * Reset seluruh data (pabrik).
   * Hapus foto absensi berdasarkan bulan tertentu (dengan sandi).

---

## 10. MODUL 9: DASHBOARD & PERKEMBANGAN USAHA

* Periode: Hari Ini, 7 Hari Terakhir, 1 Bulan Terakhir.
* Ringkasan: Menu Terlaris, Total Omzet Penjualan, Total Pengeluaran Kas, Rincian Pembayaran (Tunai, QRIS, Transfer).

---

## 11. MODUL 10: MANAJEMEN MENU & PRODUK

* Master Menu: Nama Menu, Harga Jual, Foto Produk (kamera/galeri), Barcode (opsional), Stok (opsional/unlimited).
* Bebas dari input modal kaku (karena HPP diinput global di akhir bulan).

---

## 12. FITUR PENDUKUNG MODUL KASIR

1. **Pengaturan Pajak (PB1 / Restoran)** jika diaktifkan.
2. **Pencarian Cepat & Barcode Scanner**.
3. **Sisa Stok Terlihat di Kartu Menu & Keranjang**.
4. **Quick Edit Menu (Tekan & Tahan / Long-Press)** beberapa detik untuk ubah harga/stok instan.
5. **Anti-Double Entry Mutex & Faktur Atomik Reset Harian**.
