# Handoff Report: Financial & Table Exploration (R2 Part 2, R3, R4)

**Explorer**: `explorer_survey_op_2`  
**Working Directory**: `d:\apk pos angkringan jogja\apk_pos_angkringan_jogja`  
**Recipient**: Orchestrator (`d71ae8e5-c4f4-4cc3-9d99-01e0fe5bdc15`)  
**Date**: 2026-11-07  

---

## 1. Observation

### 1.1 Requirement R2 (Part 2): Tombol Bagian Kanan Atas dan Modal Form

#### A. Modul Keuangan: Tombol "HPP Global"
- **File**: `app/(tabs)/financial.tsx` (Lines 94–101, 370–375)
  ```tsx
  // app/(tabs)/financial.tsx:370-375
  <Button
    title="HPP Global"
    variant="outline"
    size="sm"
    onPress={handleOpenCogs}
    style={styles.headerBtn}
  />
  ```
  Handler `handleOpenCogs` mengarahkan ke `AdminPinModal` terlebih dahulu:
  ```tsx
  // app/(tabs)/financial.tsx:94-101
  const handleOpenCogs = () => {
    setAdminPinVisible(true);
  };
  const handleAdminPinSuccess = () => {
    setAdminPinVisible(false);
    setCogsModalVisible(true);
  };
  ```
- **Modal Component**: `components/monthly-cogs-modal.tsx` (Lines 1–136)
  - Mengambil data dari `useFinancialStore` (`selectedMonth`, `summary`, `saveMonthlyCogs`).
  - Input field: `amountText` (nominal HPP dalam Rupiah) dan `notes` (catatan owner).
  - Validasi: `parseRupiahInput(amountText)`. Bila `< 0`, muncul alert peringatan. Namun `parseRupiahInput` selalu mengembalikan `>= 0` (hanya digit). Input kosong bernilai `0`.
  - Penyimpanan: `saveMonthlyCogs(db, selectedMonth, amount, notes.trim())`.
- **Store & Database**: `stores/financialStore.ts` (Lines 363–376), `services/database.ts` (Lines 224–231)
  - Tabel SQLite: `monthly_cogs` (`period_month TEXT NOT NULL UNIQUE`, `total_cogs_amount REAL NOT NULL`, `notes TEXT`, `inputted_at TEXT`).
  - Query penyimpanan menggunakan upsert atomic:
    ```sql
    INSERT INTO monthly_cogs (period_month, total_cogs_amount, notes)
    VALUES (?, ?, ?)
    ON CONFLICT(period_month) DO UPDATE SET
      total_cogs_amount = excluded.total_cogs_amount,
      notes = excluded.notes,
      inputted_at = datetime('now','localtime')
    ```
  - **Temuan Khusus / Catatan**:
    1. Setelah penyimpanan berhasil, `saveMonthlyCogs` memanggil `await get().loadFinancialData(db, periodMonth)`. Bila pengguna sebelumnya sedang melihat filter `today` atau `7days`, pemanggilan ini otomatis mengubah konteks query periode menjadi `custom_month` untuk bulan tersebut.
    2. Input `TextInput` di `MonthlyCogsModal` belum menerapkan `formatRupiahInput` interaktif pada event `onChangeText`, meskipun terdapat `amountPreview` di bawah input.

---

#### B. Modul Customer: Tombol "Atur Tingkatan Reward"
- **File**: `app/customers.tsx` (Lines 103–109, 245–248)
  ```tsx
  // app/customers.tsx:103-109
  <Button
    title="Atur Tingkatan Reward"
    variant="outline"
    size="sm"
    onPress={() => setTierModalVisible(true)}
    style={styles.headerActionBtn}
  />
  ```
  Modal `RewardTierModal` langsung dipanggil tanpa otorisasi PIN.
- **Modal Component**: `components/reward-tier-modal.tsx` (Lines 1–230)
  - State lokal: `tierName`, `minSpendText`, `rewardDescription`, `editingId`, `isEditing`.
  - Validasi input (`handleSave` lines 52–82):
    1. `tierName.trim()` tidak boleh kosong.
    2. `minSpend = parseRupiahInput(minSpendText)` harus `> 0`.
    3. `rewardDescription.trim()` tidak boleh kosong.
  - Aksi CRUD:
    - Simpan baru: `addRewardTier(db, tierName, minSpend, rewardDescription)`.
    - Edit yang ada: `updateRewardTier(db, id, tierName, minSpend, rewardDescription)`.
    - Hapus: `deleteRewardTier(db, id)`.
- **Store & Database**: `stores/customerStore.ts` (Lines 74–105, 165–191), `services/database.ts` (Lines 181–186)
  - Tabel SQLite: `rewards` (`id INTEGER PRIMARY KEY`, `tier_name TEXT NOT NULL`, `min_spend REAL NOT NULL`, `reward_description TEXT NOT NULL`).
  - Setelah setiap perubahan (tambah/update/hapus), `loadCustomers(db)` dipanggil ulang, yang otomatis memuat `loadRewardTiers(db)` dan mengkalkulasi ulang `current_tier` serta `spend_to_next` untuk seluruh pelanggan aktif berdasarkan `total_spent`.

---

#### C. Modul Supplier: Tombol "Supplier Baru"
- **File**: `app/purchases.tsx` (Lines 344–353, 436–440)
  ```tsx
  // app/purchases.tsx:344-353
  <Button
    title="+ Supplier Baru"
    variant="outline"
    size="sm"
    onPress={() => {
      setEditingSupplier(null);
      setSupplierModalVisible(true);
    }}
    style={styles.headerBtn}
  />
  ```
- **Modal Component**: `components/supplier-modal.tsx` (Lines 1–118)
  - Input field: `name` (Nama Supplier / Toko Grosir, wajib) dan `phone` (Nomor Telepon / WA, opsional).
  - Validasi: `name.trim()` tidak boleh kosong.
  - Penyimpanan: memanggil `addSupplier(db, name.trim(), phone.trim())` atau `updateSupplier(...)`.
- **Store & Database**: `stores/purchaseStore.ts` (Lines 63–143), `services/database.ts` (Lines 189–194)
  - Tabel SQLite: `suppliers` (`id INTEGER PRIMARY KEY`, `name TEXT NOT NULL`, `phone TEXT DEFAULT ''`, `created_at TEXT`).
  - Pengecekan keamanan penghapusan (`purchases.tsx:110–117`): Supplier yang masih memiliki sisa hutang tempo belum lunas (`unpaid_debt > 0`) dilarang dihapus oleh sistem.

---

#### D. Modul Supplier: Fitur "Catat Pembelian Bahan"
- **File**: `app/purchases.tsx` (Lines 354–360, 430–434)
  ```tsx
  // app/purchases.tsx:354-360
  <Button
    title="+ Catat Pembelian"
    size="sm"
    onPress={() => setPurchaseModalVisible(true)}
    style={styles.headerBtn}
  />
  ```
- **Modal Component**: `components/purchase-form-modal.tsx` (Lines 1–144)
  - Komponen input:
    1. Supplier picker (memilih dari daftar supplier aktif, disertai shortcut modal pendaftaran supplier baru jika belum terdaftar).
    2. Total nominal pembelian (Rupiah).
    3. Jenis pembayaran: `cash` (Tunai / Kas Langsung) vs `tempo` (Hutang Tempo).
    4. Tanggal jatuh tempo (opsional untuk tempo, dengan preset cepat +7, +14, +30 hari).
    5. Foto bukti nota fisik kulakan (kamera langsung atau galeri) disimpan secara lokal via `saveImageLocally`.
    6. Catatan pembelian (opsional).
  - Validasi: Supplier wajib dipilih, nominal `> 0`, dan jika tempo dengan jatuh tempo aktif maka format tanggal harus valid.
- **Integrasi Keuangan & Arus Kas**: `stores/purchaseStore.ts` (Lines 145–235)
  - Transaksi DB dilakukan secara atomik (`db.withTransactionAsync`):
    1. Simpan ke tabel `purchases` (`payment_type`, `payment_status`, dll).
    2. **Jika pembayaran Tunai (Cash)**: Otomatis dicatat ke tabel `cash_ledger` sebagai pengeluaran kas operasional (`type = 'expense'`, `affects_pnl = 1`, `category = 'Pembelian Bahan/Kulakan'`). Transaksi ini langsung memotong Laba Operasional Bersih di `financialStore`.
    3. **Jika pembayaran Tempo (Kredit/Utang)**: `purchases.payment_status` diset ke `'unpaid'`. TIDAK ada catatan yang dibuat di `cash_ledger` (karena belum terjadi arus kas keluar). Utang diakumulasikan ke saldo buku utang berjalan (`unpaid_debt` per supplier dan `totalUnpaidDebt` toko).
    4. **Pelunasan Hutang Tempo**: Dilakukan via tombol "Lunasi Sekarang" (`settleTempoDebt`). Status pembelian diubah menjadi `'paid'`, dan sistem otomatis memasukkan pengeluaran kas ke `cash_ledger` (`type = 'expense'`, `affects_pnl = 1`, `category = 'Pelunasan Hutang Supplier'`).
  - **Temuan Edge Case**: Pada fungsi `deletePurchase` (`purchaseStore.ts:237–243`), penghapusan data pembelian tunai atau pembelian tempo yang sudah lunas hanya menjalankan `DELETE FROM purchases WHERE id = ?`. Catatan `cash_ledger` yang terbentuk saat pembelian tunai dibuat tidak ikut terhapus otomatis, sehingga membutuhkan penghapusan manual dari menu Keuangan jika nota dihapus.

---

### 1.2 Requirement R3: Evaluasi Fitur Struk Tagihan Sementara

#### A. Alur Kasir & Implementasi Kode Saat Ini
- **Trigger**:
  - `app/transaksi.tsx:172–224`: Tombol "Tagihan" (`handleTemporaryBill`) pada panel ringkasan keranjang kasir.
  - `components/table-selector-modal.tsx:68–113`: Tombol "📋 Tagihan Sementara" pada kartu meja pending.
- **Perubahan Status**: Memanggil `markTableAsBilling(db, txId)`, yang memperbarui `transactions.status = 'billing'`. Status ini membedakan meja yang sedang menunggu pelunasan (badge biru "Siap Bayar / Billing") dari meja yang masih makan (badge oranye "Terisi").
- **Visual & Formatting Struk**:
  - `components/receipt-preview-modal.tsx:201–276` (Tab `temp_bill`): Tampilan kertas struk 58mm dengan watermark visual tebal:
    ```
    *** TAGIHAN SEMENTARA ***
    BUKAN BUKTI PEMBAYARAN SAH
    ...
    Status   : BELUM LUNAS (SEMENTARA)
    ...
    TOTAL TAGIHAN : Rp XX.XXX
    *** BUKAN BUKTI BAYAR ***
    Harap lakukan pembayaran di kasir
    ```
  - `services/print.ts:313–357` (`formatTemporaryBillReceipt`) dan lines 362–473 (`printTemporaryBill`): Mengirimkan perintah ESC/POS ke printer Bluetooth 58mm dengan format serupa.
- **Cakupan Pengujian**:
  - `test/tier5-adversarial.test.ts:821–860` (Test T5.5.3) secara eksplisit menguji format `formatTemporaryBillReceiptLines` untuk memastikan adanya watermark `TAGIHAN SEMENTARA`, `BUKAN BUKTI PEMBAYARAN SAH`, dan `BELUM LUNAS`. Menghapus fungsi ini secara sembarangan akan menyebabkan test suite regresi gagal.

#### B. Matriks Perbandingan 5 Elemen Alur Kasir & Struk

| Jenis Dokumen / Alur | Media / Target | Nominal Harga Ditampilkan? | Status Transaksi Terkait | Tujuan Operasional Lapangan |
| :--- | :--- | :---: | :---: | :--- |
| **1. Pending Order per Meja** | Sistem (In-App SQLite) | Ya (Subtotal & Total) | `pending` / `billing` | Menyimpan pesanan meja makan di tempat (*dine-in* & lesehan) agar pelanggan bisa menambah pesanan berulang kali sebelum sesi bayar. |
| **2. Tiket Dapur / Kitchen** | Cetak Fisik Thermal (58mm) | **TIDAK (Tanpa Harga)** | `pending` | Perintah kerja bagian bakaran sate & bar wedangan untuk meracik menu. Menjaga kerahasiaan harga dari dapur & fokus pada kuantitas. |
| **3. Tiket Sambungan Dapur** | Cetak Fisik Thermal (58mm) | **TIDAK (Tanpa Harga)** | `pending` | Hanya mencetak menu delta (`is_additional = 1`) saat pelanggan nambah pesanan, menghindari pesanan ganda dibuat ulang. |
| **4. Struk Tagihan Sementara** | Cetak Fisik Thermal / Preview | Ya (Rincian Lengkap) | `billing` (Belum Lunas) | Diserahkan ke meja saat pelanggan meminta nota sebelum bayar (untuk cek menu dan urunan uang). Berstatus BUKAN BUKTI BAYAR. |
| **5. Struk Penjualan Customer** | Cetak Fisik Thermal (58mm) | Ya (Lengkap + Bayar & Kembali) | `completed` (LUNAS) | Bukti pembayaran sah transaksi selesai dengan metode bayar (Tunai/QRIS/Transfer) dan identitas kasir. |
| **6. Struk Audit Internal Kasir** | Ringkasan / Rekap Harian | Ya (Total Omset & Arus Kas) | Sesi Kasir / History | Rekonsiliasi fisik uang di laci kasir vs pencatatan sistem, audit selisih kas, dan pelaporan pergantian shift kasir. |

---

### 1.3 Requirement R4: Pengelolaan Meja Dinamis

#### A. Kondisi Kode Saat Ini
- **Hardcoded Preset**: `components/table-selector-modal.tsx` (Lines 28–33):
  ```tsx
  const PRESET_TABLES = [
    'Meja 01', 'Meja 02', 'Meja 03', 'Meja 04', 'Meja 05',
    'Meja 06', 'Meja 07', 'Meja 08', 'Meja 09', 'Meja 10',
    'Lesehan 01', 'Lesehan 02', 'Lesehan 03', 'Lesehan 04', 'Lesehan 05',
    'Bungkus / Take-away'
  ];
  ```
- **Kondisi Database**:
  - `services/database.ts` mendefinisikan 15 tabel. **Tidak ada tabel `dining_tables` atau `tables`**.
  - Kolom `table_number` pada tabel `transactions` didefinisikan sebagai `TEXT NOT NULL`.
  - Kolom ini tidak memiliki constraint `FOREIGN KEY`, sehingga dapat menerima string nama meja apa pun secara bebas (seperti yang diuji pada seluruh test case di `test/tier1-features.test.ts` hingga `test/tier5-adversarial.test.ts`).
- **Input Meja Khusus**:
  - Di `components/table-selector-modal.tsx:241–256`, terdapat field teks "Atau Ketik Nama/Nomor Meja Khusus:" (`customTable`).
  - Nilai ini hanya bersifat ad-hoc untuk satu sesi transaksi saat itu, **tidak tersimpan ke database master meja**, dan tidak muncul sebagai kartu meja pada grid untuk transaksi berikutnya.
- **Ketiadaan Fitur CRUD Meja**:
  - Pemilik toko saat ini tidak memiliki antarmuka untuk menambah meja baru permanen, mengedit nama/nomor meja yang ada (misal: "Meja 01" diubah menjadi "Gazebo 1" atau "Meja VIP"), maupun menghapus meja yang tidak digunakan.

---

## 2. Logic Chain

### 2.1 Evaluasi R2 (Part 2) Modals
1. Dari inspeksi berkas UI dan store, keempat komponen modal (HPP Global, Atur Tingkatan Reward, Supplier Baru, Catat Pembelian Bahan) sudah memiliki implementasi dasar yang terhubung dengan store dan database.
2. Validasi input telah ada pada setiap modal:
   - HPP Global memvalidasi nilai angka HPP dan diproteksi PIN Admin.
   - Reward tier memvalidasi kelengkapan nama, min spend > 0, dan deskripsi reward.
   - Supplier baru memvalidasi nama supplier wajib diisi.
   - Catat pembelian memvalidasi supplier, nominal, dan integrasi jenis pembayaran.
3. Arus kas pada modul supplier terintegrasi secara benar:
   - Pembelian tunai langsung memotong kas operasional di `cash_ledger` (`affects_pnl = 1`).
   - Pembelian tempo mencatat hutang berjalan tanpa memotong kas fisik hingga proses pelunasan (`settleTempoDebt`) dieksekusi.
4. Terdapat potensi perbaikan minor: sinkronisasi penghapusan transaksi pembelian tunai dengan `cash_ledger`, serta preservasi mode filter periode di `financialStore`.

### 2.2 Evaluasi R3: Struk Tagihan Sementara
1. **Analisis Operasional**: Pada warung makan, angkringan berkonsep semi-resto, dan lesehan Yogyakarta, pola konsumsi pelanggan adalah *order first, pay later*. Pelanggan sering meminta tagihan saat masih duduk di lesehan ("Mas, minta bill-nya").
2. **Kebutuhan Pengecekan**: Pelanggan perlu mencocokkan jumlah sate dan wedangan yang telah disantap sebelum mengumpulkan uang atau membayar ke kasir. Tanpa struk tagihan sementara, pelayan harus menyebutkan total secara lisan atau kasir harus langsung memproses transaksi sebelum uang diterima.
3. **Pemisahan Peran Struk**:
   - Struk Tagihan Sementara bukan pengganti struk penjualan, melainkan lembar konfirmasi pra-bayar.
   - Watermark tebal dan status `BELUM LUNAS` telah mencegah penyalahgunaan sebagai tanda terima sah.
4. **Dampak terhadap Kompleksitas Alur Kasir**:
   - Pada `app/transaksi.tsx`, alur kasir utama untuk bayar langsung (1-klik tombol `Bayar Sekarang`) sama sekali tidak terhalang oleh fitur tagihan sementara.
   - Kasir tidak dipaksa mencetak tagihan sementara jika pelanggan langsung datang ke kasir untuk membayar.
   - Fitur ini hanya dieksekusi jika kasir/pelayan secara sadar menekan tombol "Tagihan" atau tombol "📋 Tagihan Sementara" pada tab Meja Pending.
5. **Kesimpulan Evaluasi R3**: **Fitur Struk Tagihan Sementara SANGAT RELEVAN dan HARUS DIPERTAHANKAN** sebagai fitur opsional/on-demand. Fitur ini tidak menambah kompleksitas operasional kasir harian karena tidak menjadi gerbang wajib (*blocking step*), serta memiliki perlindungan integritas (watermark tegas dan unit test regression di test suite T5.5.3).

### 2.3 Evaluasi R4: Pengelolaan Meja Dinamis
1. `PRESET_TABLES` saat ini bersifat kaku (hardcoded array 16 meja). Angkringan di lapangan memiliki tata letak yang berkembang dinamis (penambahan lesehan baru, area tenda luar, meja gabungan VIP, dsb.).
2. Karena kolom `table_number` pada `transactions` adalah `TEXT`, penyimpanan nama meja yang fleksibel tidak memerlukan modifikasi skema tabel transaksi yang berisiko.
3. Dua alternatif pendekatan arsitektur untuk data master meja:
   - **Alternatif A (Minimalis & Bebas Migrasi Skema - Rekomendasi Ponytail)**:
     Menyimpan daftar meja dinamis di tabel `settings` yang sudah ada dengan key `'custom_tables'` (berupa format array terurut JSON).
     *Keunggulan*: Tetap menjaga skema 15 tabel tanpa migrasi baru, 100% kompatibel dengan `test/helpers/db.js`, tidak memicu regresi pada suite pengujian yang ada.
   - **Alternatif B (Tabel Master Meja Baru)**:
     Membuat tabel `dining_tables (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0)`.
     *Keunggulan*: Query relasional murni.
     *Kelemahan*: Menambah tabel ke-16, membutuhkan penyesuaian di migrasi `services/database.ts` dan fixture pengujian `test/helpers/db.js`.
4. Mekanisme integrasi dengan kasir (`app/transaksi.tsx`):
   - Daftar meja pada `components/table-selector-modal.tsx` membaca data dinamis (menggantikan `PRESET_TABLES`).
   - Penambahan tombol "+ Tambah Meja" dan aksi "Edit/Hapus Meja" pada modal pengelolaan meja.
   - Meja yang sedang memiliki pesanan pending aktif dicegah untuk dihapus, tetapi nama mejanya dapat diperbarui (dan otomatis memperbarui `table_number` pada transaksi pending terkait).

---

## 3. Caveats

1. **Hardware Bluetooth Printer**: Pengujian eksekusi fisik cetak Bluetooth ESC/POS hanya dapat divalidasi pada perangkat fisik Android dengan printer thermal terpasang; pada lingkungan desktop/pengujian lokal divalidasi via string formatting dan test helper (`test/helpers/receiptFormatter.js`).
2. **Ketergantungan Test Suite**: Seluruh pengujian otomatis di `test/tier1` hingga `test/tier5` berasumsi skema database awal memiliki 15 tabel default. Setiap perubahan skema SQLite harus memperbarui `test/helpers/db.js` agar suite `npm test` tetap lulus 100%.
3. **Penyelidikan Read-Only**: Sesuai peran Explorer, berkas kode sumber aplikasi tidak diubah selama penyelidikan ini; rancangan perubahan dan spesifikasi teknis diserahkan melalui laporan ini.

---

## 4. Conclusion

1. **R2 (Part 2) Modals**:
   - Seluruh tombol kanan atas dan modal form (Keuangan: HPP Global, Customer: Atur Reward, Supplier: Supplier Baru, Supplier: Catat Pembelian Bahan) sudah memiliki implementasi fungsional dasar yang memadai.
   - Integrasi arus kas pembelian bahan (tunai = potong kas; tempo = buku utang berjalan hingga pelunasan) telah beroperasi dengan benar secara atomik.
   - Rekomendasi perbaikan minor: tambahkan pemformatan Rupiah interaktif pada input HPP Global, dan tangani pembersihan catatan kas saat pembelian tunai dihapus.
2. **R3 (Evaluasi Struk Tagihan Sementara)**:
   - **Keputusan**: **Pertahankan fitur struk tagihan sementara**.
   - **Alasan**: Berfungsi krusial untuk operasional meja makan/lesehan pra-bayar, tidak menghambat alur kasir cepat (bersifat *optional on-demand*), memiliki watermark anti-fraud yang ketat, dan dilindungi oleh pengujian regresi T5.5.3.
3. **R4 (Pengelolaan Meja Dinamis)**:
   - Meja saat ini masih di-hardcode dalam `PRESET_TABLES` di `table-selector-modal.tsx`.
   - Diperlukan mekanisme CRUD meja dinamis yang terintegrasi langsung dengan `table-selector-modal.tsx` dan `transactionStore`.
   - Pendekatan penyimpanan yang paling aman dan efisien sesuai filosofi *ponytail* adalah memanfaatkan tabel `settings` (`key = 'custom_tables'`), atau menambahkan tabel master meja jika relasi terstruktur diperlukan.

---

## 5. Verification Method

### 5.1 Verifikasi Mandiri Pemeriksaan Kode
1. **Periksa Tombol & Modal HPP Global**:
   - Buka `app/(tabs)/financial.tsx` baris 370–375 dan `components/monthly-cogs-modal.tsx` baris 38–58.
2. **Periksa Tombol & Modal Reward Tier**:
   - Buka `app/customers.tsx` baris 103–109 dan `components/reward-tier-modal.tsx` baris 52–82.
3. **Periksa Tombol Supplier Baru & Catat Pembelian**:
   - Buka `app/purchases.tsx` baris 344–360, `components/supplier-modal.tsx`, dan `components/purchase-form-modal.tsx`.
   - Cek integrasi arus kas di `stores/purchaseStore.ts` baris 181–193 (`isCash` -> `cash_ledger`) dan baris 219–229 (`settleTempoDebt`).
4. **Periksa Alur Tagihan Sementara**:
   - Buka `app/transaksi.tsx` baris 172–224, `components/receipt-preview-modal.tsx` baris 201–276, dan `services/print.ts` baris 313–357.
5. **Periksa Definisi Meja Hardcoded**:
   - Buka `components/table-selector-modal.tsx` baris 28–33 (`PRESET_TABLES`).

### 5.2 Verifikasi Test Suite Otomatis
Jalankan pengujian integritas aplikasi pada root workspace:
```bash
npm test
```
**Kondisi Validasi Saat Ini**: 28 pengujian dari 10 test suite (Tier 1 hingga Tier 5) harus lulus 100% tanpa kegagalan (pass 28, fail 0).
