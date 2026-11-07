# DOKUMEN RENCANA DESAIN & SISTEM ANTARMUKA (DESIGN SYSTEM)
## APLIKASI POS ANGKRINGAN — OFFLINE ANDROID
**Tema Visual:** Fresh Natural Industrial (Hijau Emerald & Putih Bersih)  
**Target Perangkat:** Tablet Android Landscape (Primer) & Smartphone Android Portrait (Kompatibel)  
**Filosofi:** Minimalis, Taktil, Bersih, Fungsional Cepat, Bebas AI-Slop

---

## 1. PALET WARNA & IDENTITAS VISUAL (HIJAU - PUTIH FRESH)

Aplikasi mengusung tema **Hijau - Putih** yang segar, tenang, dan nyaman untuk mata kasir yang bekerja pada malam hingga dini hari, dipadukan dengan kontras slate yang tegas.

### 1.1 Palet Warna Utama (Color Tokens)
* **Warna Primer (Brand / Fresh Emerald):**
  * `Primary Dark` (Header & Tombol Utama): `#059669` (Emerald 600)
  * `Primary Active / Pressed`: `#047857` (Emerald 700)
  * `Primary Soft / Tint`: `#ecfdf5` (Emerald 50 - untuk latar kartu terpilih / badge)
  * `Primary Border`: `#a7f3d0` (Emerald 200)
* **Warna Netral & Latar (Neutral Slate & Pure White):**
  * `Screen Background`: `#f4f8f5` (Off-white dengan sentuhan mint lembut, sejuk di mata)
  * `Card / Panel Background`: `#ffffff` (Putih murni)
  * `Surface Hover / Alternate`: `#f8fafc` (Zinc/Slate 50)
  * `Border Standar`: `#e2e8f0` (Garis pembatas tegas 1px)
  * `Border Active / Fokus`: `#cbd5e1`
* **Warna Teks (Typography Contrast):**
  * `Text Heading / Primary`: `#0f172a` (Slate 900 - kontras tinggi, mudah terbaca)
  * `Text Body`: `#334155` (Slate 700)
  * `Text Muted / Subtitle`: `#64748b` (Slate 500)
  * `Text White`: `#ffffff` (Teks di atas header & tombol primer)
* **Warna Semantik & Aksi (Functional Colors):**
  * `Success / Lunas`: `#16a34a` (Latar: `#dcfce7`, Border: `#86efac`)
  * `Warning / Pending Meja / Tempo`: `#d97706` (Latar: `#fef3c7`, Border: `#fcd34d`)
  * `Danger / Terlambat / Hapus / Batal`: `#dc2626` (Latar: `#fee2e2`, Border: `#fca5a5`)

---

## 2. PRINSIP ERGONOMI & ANTI-AI SLOP (STRICT DESIGN RULES)

Untuk memastikan antarmuka terasa seperti alat kasir profesional yang nyata (*industrial tactile tool*) dan bukan hasil mockup AI murahan, berikut aturan ketatnya:

1. 🚫 **DILARANG Menggunakan Lampu Titik Status (*No Pulsing / Glow Indicator Dots*):**
   * Tidak boleh ada titik bundar neon hijau/merah/kuning berkedip untuk menandai status buka/tutup, status printer, atau kehadiran.
   * **Pengganti Standar:** Gunakan **Badge Teks Semantik Minimalis** (kotak sudut tumpul terukur radius 6px) dengan teks status yang gamblang:
     * `[Tepat Waktu]` (Teks hijau pekat, latar mint muda)
     * `[Terlambat 18 Menit]` (Teks merah pekat, latar merah muda)
     * `[Meja 03: Pending]` (Teks amber pekat, latar kuning muda)
     * `[Printer Dapur: Terhubung]` (Teks slate pekat, border halus)
2. 🚫 **DILARANG Gradasi Warna Berlebihan (*No Fancy Neon Gradients*):**
   * Semua kartu, tombol, dan panel menggunakan warna *flat* solid dengan hierarki kontras yang jelas.
3. 🚫 **DILARANG Bentuk Bulat Kapsul Balon (*No Over-Rounded Bubble Pills*):**
   * Radius sudut (*border-radius*) distandarisasi secara tegas:
     * Kartu & Kontainer Panel: `8px` – `10px`
     * Tombol Aksi & Input Field: `6px` – `8px`
     * Tag / Badge Status: `4px` – `6px`
   * Hal ini menjaga tampilan tetap kokoh, profesional, dan rapi.
4. 📱 **Ergonomi Kasir Tablet (Touch Targets):**
   * Ukuran tombol aksi kasir minimal **$48 \times 48\text{ dp}$** agar tidak meleset saat dioperasikan secara terburu-buru.
   * Konfirmasi haptic getar instan pada setiap ketukan menu dan scan barcode.

---

## 3. ARSITEKTUR LAYOUT MODUL 1: TRANSAKSI KASIR (MENGACU FOTO REFERENSI)

Mengacu langsung pada pola tata letak foto referensi yang Anda unggah, tampilan transaksi dioptimalkan dengan pembagian **Dual-Panel Split Screen**:

```text
+--------------------------------------------------------------------------------------------------+
| [≡ Menu]  ANGKRINGAN JOGJA                     Jumat, 6 Nov 2026 | 19:45 WIB  [Kasir: Budi]      |
+---------------------------------------------------------------+----------------------------------+
|  PANEL KATALOG PRODUK (65% Lebar Layar)                       |  PANEL CHECKOUT & KERANJANG      |
|                                                               |  (35% Lebar Layar)               |
|  +--------------------+  +---------------------------------+  |  +----------------------------+  |
|  | + TAMBAH MENU      |  | [🔍 Cari menu makanan/minuman...] |  |  | Checkout - Meja: [03]  [v] |  |
|  +--------------------+  +---------------------------------+  |  | Customer: Bpk. Joko        |  |
|  Customer Info: [Customer UMUM / Member] | Reward: [Badge Rp] |  |  | Total Kunjungan: Rp 650rb  |  |
|                                                               |  +----------------------------+  |
|  GRID MENU (Kotak Kartu Putih Bersih - Radius 8px):           |  Item            Qty     Harga   |
|  +----------+ +----------+ +----------+ +----------+         |  +----------------------------+  |
|  | [ Foto ] | | [ Foto ] | | [ Foto ] | | [ Foto ] |         |  | [x] Nasi Teri  [-] 2 [+] 10.000|  |
|  | Nasi Teri| | Sate Usus| | Es Jahe  | | Mendoan  |         |  | [x] Sate Usus  [-] 5 [+] 15.000|  |
|  | Rp 5.000 | | Rp 3.000 | | Rp 6.000 | | Rp 2.000 |         |  | [x] Kopi Jos   [-] 1 [+]  7.000|  |
|  | Stok: 15 | | (unlimit)| | (unlimit)| | Stok: 8  |         |  |                            |  |
|  +----------+ +----------+ +----------+ +----------+         |  |                            |  |
|  *(Tekan & Tahan 3 Detik: Quick Edit Harga & Stok)*           |  +----------------------------+  |
|                                                               |  Sub Total           Rp 32.000|  |
|  KATEGORI MENU HORIZONTAL (Bawah):                            |  Diskon (0%)             Rp  0|  |
|  +----------+ +----------+ +----------+ +----------+         |  Pajak (0%)              Rp  0|  |
|  |  Semua   | |  Nasi    | |  Bakaran | | Wedangan |         |  ------------------------------|  |
|  | (Aktif)  | |  Kucing  | |  & Sate  | | & Minuman|         |  TOTAL TAGIHAN       Rp 32.000|  |
|  +----------+ +----------+ +----------+ +----------+         |  +----------------------------+  |
|                                                               |  +------------+ +------------+|  |
|  TOMBOL OPERASIONAL MEJA:                                     |  | Batal Order| | Simpan Meja||  |
|  [ Gabung Meja ]                  [ Pending / Simpan Meja ]   |  +------------+ +------------+|  |
|                                                               |  +----------------------------+  |
|                                                               |  |   BAYAR SEKARANG (RP 32.000)| |
|                                                               |  +----------------------------+  |
+---------------------------------------------------------------+----------------------------------+
```

### 3.1 Rincian Komponen Panel Kiri (Katalog Menu)
1. **Header Toolbar Panel Kiri:**
   * Tombol `+ Tambah Menu` (outline hijau dengan teks hijau rapi).
   * Kolom Pencarian Input Bar dengan ikon kaca pembesar, border `#e2e8f0`, background putih bersih.
   * Strip Identitas Pelanggan: Menampilkan nama customer aktif. Default: `Customer UMUM`. Jika member dipilih: Menampilkan `Nama`, `Nilai Akumulasi Belanja (Rp xxx.xxx)`, dan `Badge Reward` jika sudah berhak klaim hadiah.
2. **Kartu Menu (Product Card Grid):**
   * Bentuk kotak terstruktur: Background putih, border tipis 1px `#e2e8f0`, sudut radius 8px.
   * Wadah Foto: Kotak foto persegi di bagian atas kartu dengan latar belakang abu-abu sangat muda (`#f8fafc`).
   * Teks Judul Menu: Slate pekat `#0f172a`, font medium 14dp, maksimal 2 baris (rapi tanpa terpotong jelek).
   * Teks Harga: Hijau emerald solid `#059669`, font bold 15dp.
   * Indikator Stok: Angka kecil di sudut atas `Stok: 12` (hanya tampil jika menu memiliki kuota stok; jika tidak, bersih tanpa teks).
   * **Fitur Taktil:**
     * Ketuk 1x: Langsung masuk ke keranjang pesanan (+ getar halus).
     * Tekan & Tahan (3 detik): Membuka popup cepat *Quick Edit* (edit harga jual dan stok langsung di tempat).
3. **Baris Pemilih Kategori (Horizontal Category Bar):**
   * Terletak di bagian bawah katalog (seperti foto referensi).
   * Tombol persegi panjang bersih dengan ikon minimalis dan nama kategori.
   * Kategori Terpilih: Border hijau pekat (`#059669`), teks & ikon hijau pekat, background putih atau hijau super muda (`#f0fdf4`).
   * Kategori Lain: Border abu-abu netral (`#e2e8f0`), teks & ikon slate `#64748b`.

### 3.2 Rincian Komponen Panel Kanan (Checkout & Keranjang)
1. **Header Meja & Status:**
   * Dropdown / Tombol pemilih Nomor Meja: misal `Meja 03` atau `Bungkus / Take-away`.
   * Tombol `Gabung Meja`: untuk menggabungkan pesanan beberapa meja rombongan menjadi 1 bill.
2. **Daftar Item Keranjang (Scrollable List):**
   * Tabel mini 3 kolom: Nama Menu, Kontrol Qty, dan Subtotal.
   * Kontrol Stepper: Tombol minus `[-]`, angka Qty bold di tengah, tombol plus `[+]` dengan tombol persegi sudut 6px yang empuk ditekan.
   * Tombol Hapus: Ikon tong sampah abu-abu netral yang berubah merah lembut saat disentuh.
3. **Ringkasan Tagihan (Summary Footer):**
   * Subtotal, Diskon (jika ada), Pajak (jika aktif).
   * **Grand Total:** Dibuat mencolok dengan teks besar tebal berwarna hijau tua gelap `#047857`.
4. **Tombol Eksekusi Bawah:**
   * Tombol Sekunder: `Batal Pesanan` (border merah halus) dan `Simpan Meja / Pending` (border hijau halus).
   * Tombol Primer: `BAYAR SEKARANG` berukuran besar penuh, background hijau emerald solid `#059669`, teks putih bold (tinggi 52dp) yang mengalirkan kasir ke jendela pembayaran (Tunai, QRIS, Transfer).

---

## 4. DESAIN KONSISTEN UNTUK MODUL-MODUL LAINNYA

Untuk menjaga keharmonisan aplikasi, seluruh modul lainnya menggunakan pola desain antarmuka yang seragam:

### 4.1 Header Universal Aplikasi (App Header Bar)
* Background: Hijau Emerald Solid (`#059669`).
* Sisi Kiri: Ikon Menu Navigasi / Drawer + Nama Usaha (`ANGKRINGAN JOGJA`).
* Sisi Kanan:
  * **Realtime Clock Badge:** Menampilkan **Hari, Tanggal, Bulan, Tahun, dan Jam (Detik Berjalan)** (Contoh: `Jumat, 06 Nov 2026 | 20:15:30 WIB`).
  * Informasi Kasir yang sedang aktif.

### 4.2 Modul 2: Absensi & Manajemen Karyawan
* **Layout Layar Absensi Masuk (Split Dual-Column):**
  * **Kolom Kiri (Daftar Karyawan):** Kartu karyawan berbentuk list rapi. Menampilkan avatar kotak sudut 8px, nama karyawan, dan badge status hari ini:
    * Karyawan Belum Absen: Tombol `[Pilih untuk Absen]`.
    * Karyawan Sudah Absen: Status `[Terkunci: Sudah Hadir 17.10 WIB]` (kartu teredupkan secara elegan, tidak bisa dipilih lagi).
    * Karyawan Terlambat: Badge teks merah tegas `[Terlambat 25 Menit]`.
  * **Kolom Kanan (Jendela Kamera Langsung):** Viewfinder kamera terbingkai rapi dengan rasio proporsional, tombol jepret bundar hijau di tengah bawah, dan preview foto terkompresi sebelum konfirmasi simpan.
* **Tombol "Tutup Sesi Operasional Toko"**:
  * Ditempatkan di bagian atas dengan warna merah marun industrial (`#b91c1c`), membuka dialog konfirmasi rangkuman sebelum serentak merekam jam kepulangan riil seluruh staf.

### 4.3 Modul 5: Laporan Keuangan & Penginputan HPP
* **Kartu Ringkasan Metrik (3 Kotak Sejajar):**
  * Kotak 1: `Total Penjualan Bruto` (Hijau)
  * Kotak 2: `Total Pengeluaran Kas (Beban)` (Merah Bata)
  * Kotak 3: `Estimasi Laba Kotor` (Emerald Tua)
* **Form Input HPP Bulanan (Opsi A):**
  * Form modal bersih di akhir bulan: Pemilik menginput nominal angka total modal bahan makanan angkringan bulan tersebut tanpa perlu menghitung per porsi. Laporan laba rugi otomatis menghitung laba kotor bersih.

### 4.4 Modul 6: Penerimaan & Pengeluaran Kas
* **Navigasi Tab Segmented:**
  * Tab 1 (Utama): `Kas Keluar - Beban Laba Rugi` (pembelian es, arang, plastik, listrik, air).
  * Tab 2 (Sekunder): `Kas Non-Laba Rugi` (setor ke bank, prive pemilik, modal awal).
* Setiap baris mutasi menampilkan tanggal, jam, nominal, kategori, dan keterangan yang rapi.

### 4.5 Modul 7: Riwayat Transaksi
* Menggunakan 3 tab segmentasi bersih: `Penjualan`, `Kas Masuk`, `Kas Keluar`.
* Kartu transaksi menyajikan: Nomor Nota (`INV-061126-001`), Waktu, Nomor Meja / Nama Pelanggan, Total Belanja, dan Badge Metode Bayar (`[Tunai]`, `[QRIS]`, `[Pending]`).

### 4.6 Modul 3 & 4: Manajemen Customer & Supplier
* Daftar kartu dengan kolom identitas yang presisi.
* Customer: Menampilkan akumulasi belanja seumur hidup dan status tingkatan reward (Tier 1, Tier 2).
* Supplier: Form pembelian menyediakan pilihan jatuh tempo yang tegas: radio button `[ ] Tidak Ada Jatuh Tempo` atau `[*] Ada Jatuh Tempo` yang memunculkan pemilih kalender tanggal tanpa ketik manual.

---

## 5. KOMPONEN DARI POS AZIZAH YANG DIADOPSI & DISESUAIKAN

| Komponen POS Azizah | Peran di POS Angkringan | Penyesuaian Desain |
|---|---|---|
| `components/ui/button.tsx` | Seluruh tombol aksi | Ganti palet ungu menjadi hijau emerald `#059669`. |
| `components/ui/card.tsx` | Kartu menu, kartu meja, list riwayat | Tetap menggunakan border 1px `#e2e8f0` dan radius 8px (bebas gradasi). |
| `components/quick-edit-product-modal.tsx` | Quick Edit Menu (Tekan 3 detik) | Dipertahankan 100% untuk kasir angkringan. |
| `components/receipt-preview-modal.tsx` | Preview struk thermal 58mm | Disesuaikan dengan 3 format struk: Customer, Kasir, Kitchen (tanpa harga). |
| `components/realtime-clock-badge.tsx` | Jam realtime header | Diperluas menampilkan Hari, Tanggal, Bulan, Tahun, dan Jam WIB. |
| `components/role-login-modal.tsx` | Proteksi PIN Admin | Dipertahankan untuk melindungi menu laporan keuangan dan hapus foto absensi. |
| `utils/formatRupiah.ts` | Format nominal uang | Dipertahankan untuk seluruh tampilan nominal Rp. |

