# ALUR KERJA & PETA JALAN IMPLEMENTASI (WORKFLOW & ROADMAP)
## APLIKASI POS ANGKRINGAN — OFFLINE ANDROID
**Standar Rekayasa:** Industrial Offline-First POS Framework  
**Fokus Utama:** Kualitas Arsitektur, Akurasi Finansial, Ergonomi Meja Kasir, Responsivitas Tablet & HP

---

## 1. PRINSIP KERJA & DISIPLIN IMPLEMENTASI (QUALITY-FIRST ENGINEERING)

Untuk menghasilkan aplikasi POS yang kokoh, nyaman, dan terpercaya bagi pemilik usaha angkringan, seluruh proses implementasi wajib berpedoman pada 4 pilar utama:

1. **Konsistensi & Anti-Terburu-buru:**
   Setiap modul diselesaikan secara tuntas per fase, diverifikasi kinerjanya, dan lulus kriteria *Definition of Done (DoD)* sebelum melangkah ke modul berikutnya.
2. **Integritas Data Keuangan Mutlak (Zero Hallucination Financial):**
   Setiap rupiah yang masuk dan keluar harus terlacak pada jurnal buku kas terindeks. Arus kas operasional yang memengaruhi laba rugi dipisahkan secara tegas dari mutasi non-operasional.
3. **Ergonomi Meja Kasir & Alur Dua Tahap ala POS Azizah:**
   Mengikuti ritme nyata angkringan: kasir memilih menu di katalog/keranjang, lalu masuk ke jendela pembayaran (keypad uang, pecahan cepat, kembalian otomatis). Tombol sentuh minimal 48dp dan respon getar haptic instan.
4. **Keandalan Arsitektur Offline (SQLite Robustness):**
   Menerapkan pola teruji POS Azizah: `PRAGMA journal_mode = 'wal'`, `busy_timeout = 10000;`, helper retry `withSqliteRetry<T>`, mutex anti double-checkout, dan penomoran invoice atomik harian (`daily_counters`).

---

## 2. PETA JALAN PENGEMBANGAN 10 FASE (STEP-BY-STEP ROADMAP)

```text
[FASE 1: Fondasi & Engine SQLite]
       |
       v
[FASE 2: Menu & Kasir Dua Tahap] ----> (Katalog, Keranjang, Pending Meja, Bayar)
       |
       v
[FASE 3: Multi-Printer Bluetooth] ---> (Struk Customer, Kasir, Kitchen Sambungan)
       |
       v
[FASE 4: Absensi Kamera Karyawan] ---> (Lock Masuk 17.30, Tutup Sesi Pulang Riil)
       |
       v
[FASE 5: CRM Customer & Reward] -----> (Customer UMUM, Akumulasi Tiering Tetap)
       |
       v
[FASE 6: Supplier & Pembelian] ------> (Tunai/Tempo, Picker Jatuh Tempo, Foto Nota)
       |
       v
[FASE 7: Kas Dual-Pocket & HPP] -----> (Beban Operasional, HPP Global Akhir Bulan)
       |
       v
[FASE 8: Riwayat 3-Tab & Dashboard] -> (Riwayat Audit & Analitik KPI Omzet/Metode)
       |
       v
[FASE 9: Pengaturan & Data Tool] ----> (Backup/Restore JSON, CSV Menu, PIN Admin)
       |
       v
[FASE 10: Simulasi & Rilis APK] -----> (Audit TypeScript 0 Error, Stress Test, EAS)
```

---

## 3. RINCIAN SPESIFIKASI TIAP FASE IMPLEMENTASI

### 🔹 FASE 1: Inisialisasi Proyek Baru & Fondasi Engine SQLite
* **Tujuan:** Menyiapkan struktur proyek Expo baru, pustaka dependensi, sistem tema hijau-putih fresh, dan skema database lokal terintegrasi.
* **Langkah Kerja:**
  1. Inisialisasi struktur berkas proyek (`app/`, `stores/`, `services/`, `components/`, `constants/`, `utils/`).
  2. Setup `package.json` dan manifest `app.json` (nama aplikasi, package id Android, orientasi fleksibel/prioritas landscape tablet, izin kamera, bluetooth, dan sistem berkas).
  3. Konfigurasi `constants/theme.ts`: Palet warna Hijau Emerald (`#059669`), latar mint lembut (`#f4f8f5`), kartu putih murni (`#ffffff`), border tegas (`#e2e8f0`), dan tipografi slate pekat.
  4. Penyusunan `services/database.ts`: Inisialisasi engine SQLite lokal dengan migrasi skema tabel terpadu:
     * `settings`, `menus`, `categories`, `pending_orders`, `transactions`, `transaction_items`, `daily_counters`, `cash_ledger`, `employees`, `attendance`, `customers`, `rewards`, `suppliers`, `purchases`, `monthly_cogs`.
  5. Pembuatan komponen UI dasar (*Primitives*): `Button`, `Card`, `Badge` teks semantik minimalis (bebas lampu titik), `ThemedText`.
* **Kriteria Kelulusan (DoD):** Database SQLite berhasil diinisialisasi secara lokal dengan mode WAL dan tabel siap pakai tanpa error kompilasi.

---

### 🔹 FASE 2: Modul Katalog Menu & Transaksi Kasir Dua Tahap
* **Tujuan:** Membangun antarmuka transaksi kasir cepat dengan tata letak split-screen (katalog di kiri, keranjang di kanan) dan alur pembayaran dua tahap ala POS Azizah.
* **Langkah Kerja:**
  1. Implementasi `stores/menuStore.ts` dan `stores/transactionStore.ts`.
  2. Panel Kiri (Katalog):
     * Input pencarian menu realtime.
     * Grid kartu produk putih bersih dengan wadah foto persegi, nama menu, harga hijau bold, dan badge sisa stok.
     * Fitur tekan dan tahan (*long-press* 3 detik) untuk *Quick Edit Menu* (ubah harga jual/stok seketika).
     * Baris kategori menu horizontal di bagian bawah.
  3. Panel Kanan (Keranjang & Meja):
     * Pemilih Nomor Meja aktif & status pending.
     * Fitur **Gabung Meja** untuk menggabungkan tagihan rombongan beberapa meja.
     * Daftar item keranjang dengan stepper Qty `[-] Qty [+]` taktil dan tombol hapus.
     * Tombol `Simpan Meja / Pending` dan `Batal Pesanan`.
  4. **Tahap Pembayaran (Dua Tahap ala POS Azizah):**
     * Kasir menekan tombol `Bayar Sekarang` -> membuka jendela modal pembayaran.
     * Keypad angka nominal uang, tombol pecahan cepat (uang pas, 50k, 100k).
     * Pilihan metode bayar: **Tunai**, **QRIS**, **Transfer**.
     * Hitungan uang kembalian otomatis.
     * Guardrail *Mutex Anti Double-Checkout* (`isCheckingOut`) dan penomoran faktur atomik harian `daily_counters` (`INV-DDMMYY-XXX`).
* **Kriteria Kelulusan (DoD):** Transaksi bayar langsung dan pending meja berhasil disimpan ke SQLite dengan kalkulasi matematika 100% akurat.

---

### 🔹 FASE 3: Modul Multi-Printer Bluetooth ESC/POS (58mm)
* **Tujuan:** Mengelola pencetakan ke lebih dari 2 printer Bluetooth secara otomatis dengan format struk terstandarisasi.
* **Langkah Kerja:**
  1. Implementasi driver printer Bluetooth ESC/POS 58mm (`services/print.ts` dan `stores/printerStore.ts`).
  2. Format Struk 1: **Struk Customer** (Nama usaha, invoice, tanggal/jam, kasir, rincian menu, harga satuan, subtotal, total, uang diterima, kembalian, footer).
  3. Format Struk 2: **Struk Kasir** (Arsip audit internal).
  4. Format Struk 3: **Struk Kitchen (Dapur)**: Hanya memuat Nama Menu, Jumlah Pesanan, dan Nomor Meja (**TANPA mencantumkan harga**).
  5. **Struk Sambungan Kitchen:** Logika pencetakan pesanan tambahan yang hanya mencetak item delta baru bertanda *"Pesanan Tambahan / Sambungan"*.
  6. Auto-routing: Saat cetak struk customer ditekan, sistem otomatis mengirimkan tiket pesanan ke printer dapur.
* **Kriteria Kelulusan (DoD):** Tiket dapur tercetak bersih tanpa harga dan pesanan sambungan tidak mencetak ulang pesanan lama.

---

### 🔹 FASE 4: Modul Absensi Terintegrasi & Manajemen Karyawan
* **Tujuan:** Mendata staf angkringan dan mencatat kehadiran visual berbasis foto kamera dengan jam masuk tetap dan jam pulang otomatis saat toko tutup.
* **Langkah Kerja:**
  1. Implementasi `stores/employeeStore.ts` dan `stores/attendanceStore.ts`.
  2. Layar Absensi Masuk (Split Column):
     * Kolom Kiri: Daftar nama karyawan. Jika sudah absen pada hari tersebut, kartu terkunci redup (*One-Time Daily Lock*) dan tidak bisa dipilih lagi.
     * Kolom Kanan: Viewfinder kamera Android untuk mengambil foto wajah secara langsung.
  3. Logika Verifikasi Keterlambatan:
     * Batas jam masuk: **17.30**.
     * Jika absen $\le$ 17.30: Status `[Tepat Waktu]`.
     * Jika absen $>$ 17.30: Status `[Terlambat]` dengan **perhitungan otomatis jumlah menit keterlambatan** (misal: *"Terlambat 24 Menit"*).
  4. Kompresi foto otomatis sebelum disimpan di direktori internal aplikasi (`FileSystem.documentDirectory`).
  5. Fitur **"Tutup Sesi Operasional Toko"**: Merekam jam kepulangan secara serentak untuk seluruh staf aktif berdasarkan **jam riil saat tombol ditekan**.
  6. Ekspor laporan absensi berkala ke format **PDF** dan **Excel**.
* **Kriteria Kelulusan (DoD):** Karyawan yang sudah absen tidak bisa absen ganda di hari yang sama, menit keterlambatan terhitung presisi, dan jam pulang riil serentak terekam sempurna.

---

### 🔹 FASE 5: Modul Customer CRM & Program Reward Akumulatif
* **Tujuan:** Mendata loyalitas pelanggan angkringan dan memberikan reward transparan.
* **Langkah Kerja:**
  1. Implementasi `stores/customerStore.ts`.
  2. Profil master pelanggan dengan profil default `Customer UMUM` (untuk non-member tanpa reward).
  3. Integrasi ke layar kasir: Saat memilih member, kasir melihat Nama Customer, Nilai Akumulasi Belanja seumur hidup (*lifetime value*), dan Badge Reward yang berhak diklaim.
  4. Sistem **Tiering Level Akumulatif Tetap**: Akumulasi total transaksi tidak pernah berkurang saat reward diambil agar pemilik tetap mengetahui kontribusi belanja seumur hidup pelanggan.
* **Kriteria Kelulusan (DoD):** Nilai belanja customer bertambah otomatis setiap transaksi selesai dan badge reward aktif saat ambang batas tercapai.

---

### 🔹 FASE 6: Modul Supplier, Pembelian Bahan & Jatuh Tempo
* **Tujuan:** Mencatat mitra pemasok bahan makanan serta pembelanjaan tunai maupun tempo dengan pencatatan jatuh tempo yang fleksibel.
* **Langkah Kerja:**
  1. Implementasi `stores/supplierStore.ts` dan `stores/purchaseStore.ts`.
  2. Pencatatan pembelian Tunai (otomatis memotong kas laci/keluar) dan Pembelian Tempo (masuk ke buku utang supplier).
  3. Pengaturan Jatuh Tempo: Pilihan radio tegas `[ ] Tidak Ada Jatuh Tempo` atau `[*] Ada Jatuh Tempo` yang membuka kalender tanggal tanpa ketik manual.
  4. Pengambilan/pengunggahan foto struk nota pembelian bahan baku.
* **Kriteria Kelulusan (DoD):** Pembelian tunai tercatat pada mutasi kas dan pembelian tempo tersimpan rapi dengan tanggal jatuh tempo terverifikasi.

---

### 🔹 FASE 7: Modul Buku Kas (Dual-Category) & Laporan Keuangan (HPP Akhir Bulan)
* **Tujuan:** Mengelola arus kas masuk/keluar harian dan menyajikan laporan laba rugi dengan HPP global akhir bulan.
* **Langkah Kerja:**
  1. Implementasi `stores/cashStore.ts` dan `stores/financialStore.ts`.
  2. Pemisahan Kategori Kas Keluar:
     * **Memengaruhi Laba Rugi (Beban Operasional):** Menu utama kasir (listrik, air, plastik, arang, bumbu dapur).
     * **Tidak Memengaruhi Laba Rugi (Non-Operasional):** Menu terpisah (setor ke bank, prive pemilik, modal awal laci).
  3. Laporan Laba Rugi:
     * Penjualan Bruto & Penjualan Bersih.
     * Total Pengeluaran Beban Operasional.
     * Form Modal Input **HPP Global Akhir Bulan (Opsi A)**: Pemilik menginput satu nominal total modal bahan bulan tersebut.
     * Perhitungan **Laba Kotor** otomatis (Omzet - HPP Akhir Bulan).
* **Kriteria Kelulusan (DoD):** Kas non-operasional tidak bocor ke laporan laba rugi dan perhitungan laba kotor akhir bulan akurat 100%.

---

### 🔹 FASE 8: Modul Riwayat Transaksi 3-Tab & Dashboard KPI
* **Tujuan:** Menyajikan audit jejak transaksi historis dan dashboard analitik visual pertumbuhan usaha.
* **Langkah Kerja:**
  1. Layar Riwayat Transaksi 3 Tab Segmented:
     * Tab 1: `Penjualan` (detail pesanan meja, gabung meja, status lunas/pending, cetak ulang nota).
     * Tab 2: `Penerimaan Kas`.
     * Tab 3: `Pengeluaran Kas`.
  2. Dashboard KPI Perkembangan Usaha:
     * Filter rentang waktu: Hari Ini, 7 Hari Terakhir, 1 Bulan Terakhir.
     * Kartu Metrik: Omzet Penjualan, Pengeluaran Beban, Peringkat Menu Terlaris, dan Distribusi Metode Bayar (Tunai, QRIS, Transfer).
* **Kriteria Kelulusan (DoD):** Seluruh riwayat transaksi dapat diaudit ulang dan grafik/rekapitulasi dashboard sinkron dengan transaksi SQLite.

---

### 🔹 FASE 9: Modul Pengaturan, Backup/Restore JSON & Keamanan PIN
* **Tujuan:** Pusat administrasi, periferal hardware, pemeliharaan memori, dan integritas data.
* **Langkah Kerja:**
  1. Pengaturan Identitas Toko (Nama, Alamat, No HP, Catatan Kaki struk).
  2. Pengaturan Bluetooth Multi-Printer: Pairing, status koneksi, dan tombol tes cetak.
  3. Fitur Backup & Restore Mandiri:
     * Ekspor seluruh database aplikasi ke berkas terisolasi **JSON** melalui `expo-sharing`.
     * Pemulihan menyeluruh dari berkas JSON tanpa merusak integritas *Foreign Key*.
     * Impor katalog menu cepat secara massal via **CSV**.
  4. Fitur Pembersihan Data Terproteksi PIN 6-Digit:
     * Hapus foto absensi per bulan tertentu (menghemat penyimpanan tablet).
     * Hapus transaksi saja / Reset pabrik.
* **Kriteria Kelulusan (DoD):** Backup JSON berhasil diekspor-diimpor secara sempurna dan penghapusan data terlindungi PIN admin.

---

### 🔹 FASE 10: Pengujian Menyeluruh (Stress Testing) & Persiapan Build APK
* **Tujuan:** Memvalidasi seluruh fungsi, performa konkurensi di tablet fisik, dan memastikan kode siap rilis produksi.
* **Langkah Kerja:**
  1. Validasi Kompilasi TypeScript Statis: `npx tsc --noEmit` wajib lulus 100% (exit code 0).
  2. Simulasi Stres Operasional:
     * Transaksi kasir simultan dengan pesanan tambahan & gabung meja.
     * Uji memori RAM tablet saat membuka kamera absensi berulang kali.
     * Rekonsiliasi buku kas fisik vs laporan akhir bulan.
  3. Konfigurasi `eas.json` untuk profil build Android (`preview` APK mandiri).
* **Kriteria Kelulusan (DoD):** Aplikasi berjalan mulus, stabil tanpa force close pada tablet Android, dan paket APK siap diinstal di perangkat fisik toko.

---

## 4. MATRIKS DEFINITION OF DONE (DOD) TINGKAT KELULUSAN

Setiap fase implementasi dinyatakan selesai jika dan hanya jika:
* [ ] Logika bisnis dan rumus hitungan uang 100% akurat.
* [ ] Komponen antarmuka konsisten dengan tema Hijau-Putih Fresh dan bebas dari elemen AI-slop.
* [ ] Kode TypeScript bersih dari *type error* atau *warning unhandled promise*.
* [ ] Database SQLite mengeksekusi kueri secara atomik dengan indeks B-Tree.
* [ ] Disetujui dan diverifikasi bersama pemilik proyek.

