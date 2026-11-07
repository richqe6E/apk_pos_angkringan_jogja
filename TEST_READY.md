# TEST READY: POS Angkringan Jogja (Pure Android)

Dokumen ini menandai kesiapan harness dan rangkaian pengujian otomatis (*automated test suite*) komprehensif berbasis Node.js v24 native `node:test` dan `node:assert/strict` untuk memverifikasi logika finansial, integritas database SQLite (`PRAGMA foreign_keys = ON;`), struk kasir & dapur thermal, manajemen meja dinamis & pesanan pending, identitas kasir, absensi kalender, integrasi pembelian supplier & tempo, multi-bank accounts, serta proteksi penghapusan menu bawaan.

---

## 1. Perintah Menjalankan Pengujian (Test Runner Command)

### Menjalankan Seluruh Test Suite (104 Tests / 33 Suites)
```bash
npm test
# atau langsung via Node.js native test runner:
node --test test/**/*.test.ts
```

### Hasil Eksekusi Terakhir (Clean Pass)
```
ℹ tests 104
ℹ suites 33
ℹ pass 104
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

---

## 2. Ringkasan Matriks Pengujian Keseluruhan (Comprehensive Test Matrix)

| Kategori Pengujian | Berkas Pengujian | Suites | Tests | Status | Fokus Validasi |
|---|---|:---:|:---:|:---:|---|
| **Tier 1: Feature Coverage** | `test/tier1-features.test.ts` | 1 | 7 | ✅ PASS | Kalkulasi omset, anti-double-count laba bersih, filter modal/prive, format struk, atomisitas DB, cleanup foto absensi. |
| **Tier 2: Boundary & Corner Cases** | `test/tier2-boundary.test.ts` | 1 | 4 | ✅ PASS | Deduplikasi item gabung meja, rekalkulasi pajak PB1, batas diskon ekstrim, delta pesanan sambungan (`is_additional = 1`). |
| **Tier 3: Cross-Feature Combinations** | `test/tier3-cross-feature.test.ts` | 1 | 3 | ✅ PASS | Alur gabung meja + tambah porsi + QRIS/Transfer, tiket dapur awal vs sambungan, sinkronisasi stok riil. |
| **Tier 4: Real-World Shift Scenarios** | `test/tier4-scenarios.test.ts` | 1 | 1 | ✅ PASS | Simulasi shift harian penuh: buka sesi, modal awal, penjualan langsung, meja pending, split/merge, pengeluaran, HPP, tutup shift. |
| **Tier 5: Adversarial Hardening** | `test/tier5-adversarial.test.ts` | 6 | 13 | ✅ PASS | Stress test merge 4 meja simultan, presisi PB1 desimal ganjil, clamping diskon melebihi subtotal, rekonsiliasi PnL volume tinggi, ketahanan format struk & karakter unik. |
| **Tier 6: Operational Enhancements** | `test/tier6-operational-enhancements.test.ts` | 1 | 7 | ✅ PASS | R1-R8 requirements: Soft-delete menu & seed protection, quick edit, meja dinamis & pending sync, nama kasir di DB & struk, pembelian tempo supplier, multi-bank JSON, kalender absensi. |
| **Milestone 4: Cashier & Attendance** | `test/m4-cashier-attendance.test.ts` | 3 | 10 | ✅ PASS | Persistensi nama kasir aktif di DB & struk audit, pergantian kasir meja pending, matematika murni kalender tanpa pustaka eksternal, agregasi keterlambatan. |
| **Adversarial Challenger (Milestone 6)** | `test/adversarial-challenger.test.ts` | 5 | 18 | ✅ PASS | Uji ketahanan isolasi menu terhapus, proteksi hapus meja berpesanan aktif, sinkronisasi buku kas pembelian tunai vs tempo, handover kasir antar-shift. |
| **Challenger: Boundaries, Date & JSON** | `test/challenger-boundaries-date-json.test.ts` | 4 | 13 | ✅ PASS | Batas tahun kabisat lintas abad, navigasi bolak-balik bulan, toleransi JSON meja & bank rusak (graceful fallback), validasi duplikasi case-insensitive & whitespace. |
| **Challenger: Integrity & Deletion Stress** | `test/challenger2-integrity-stress.test.ts` | 5 | 12 | ✅ PASS | Foreign key safety saat hard-delete (`ON DELETE SET NULL`), re-seed blocking saat reboot dengan seluruh menu terhapus, atomisitas penghapusan nota tempo supplier. |
| **Challenger: Operational Stress & Edge Cases** | `test/operational-stress-challenger.test.ts` | 5 | 16 | ✅ PASS | Penamaan meja simbol unik & self-edit exception, fallback kasir kosong ke default "Kasir", nilai ekstrem quick edit (Rp 0, stok batas bawah), ketahanan parsing array rekening bank. |
| **TOTAL KESELURUHAN** | **11 Berkas Pengujian** | **33** | **104** | **100% PASS** | **Zero Failures, Zero Skips, Zero Regressions** |

---

## 3. Rincian Cakupan & Validasi Per Tingkatan (Detailed Breakdown)

### Tier 1: Feature Coverage Suites (`test/tier1-features.test.ts`)
- [x] **T1.1 Gross Sales & Tx Count**: Agregasi hanya mencakup transaksi berstatus `'completed'` pada bulan berjalan (`business_date LIKE 'YYYY-MM%'`). Transaksi `'pending'` dan `'cancelled'` diisolasi dari omset.
- [x] **T1.2 Net Profit & Anti-Double-Count**: Penjualan tunai (`category = 'penjualan_tunai'`) pada buku kas (`cash_ledger`) dikecualikan dari `operIncome` karena telah tercakup di `grossSales`. Mencegah pembengkakan laba ganda.
- [x] **T1.3 Non-PnL Filtering**: Entri modal awal / prive pemilik (`affects_pnl = 0`) tidak mendistorsi perhitungan laba bersih operasional.
- [x] **T1.4 Cash Ledger CRUD & Filter**: Entri kas bertipe `'income'` dan `'expense'` tersimpan dan terfilter secara presisi berdasarkan tipe, tanggal bisnis, dan kategori.
- [x] **T1.5 Struk Dinamis & Profil Toko**: Struk mencetak metode pembayaran dinamis (`TUNAI`, `QRIS`, `TRANSFER`), kembalian hanya pada pembayaran tunai, serta profil toko (nama, alamat, no telp, footer) dari pengaturan.
- [x] **T1.6 Database Atomic Transactions**: Pembungkusan `withTransactionAsync` menjamin *atomic commit* jika seluruh kueri berhasil dan *atomic rollback* jika terjadi kegagalan di tengah jalan.
- [x] **T1.7 Pembersihan Foto Fisik Absensi**: Logika pembersihan bulanan menghapus berkas fisik dari media penyimpanan dan mengosongkan path referensi di tabel `attendance`.

### Tier 2: Boundary & Corner Cases Suites (`test/tier2-boundary.test.ts`)
- [x] **T2.1 Table Merge Deduplication**: Penggabungan meja dengan item menu identik (menu_id & harga sama) mengonsolidasi baris menjadi satu entri dengan kuantitas dan subtotal teragregasi. Diskon dari meja sumber dijumlahkan dan dipertahankan.
- [x] **T2.2 Table Merge Tax Recalculation**: Pajak PB1 dihitung ulang secara akurat berdasarkan subtotal gabungan baru dan tidak tereset ke nol.
- [x] **T2.3 Diskon Maksimal & Pembulatan Pajak**: Diskon yang melebihi subtotal membatasi total tagihan minimal ke 0 (tidak pernah negatif). Pembulatan pajak PB1 presisi bilangan bulat.
- [x] **T2.4 Pesanan Tambahan (Delta `is_additional = 1`)**: Porsi tambahan pada meja pending ditandai dengan `is_additional = 1`, sementara pesanan awal tetap `is_additional = 0`.

### Tier 3: Cross-Feature Combinations Suites (`test/tier3-cross-feature.test.ts`)
- [x] **T3.1 Gabung Meja + Tambah Porsi + Bayar QRIS**: Alur gabungan meja aktif, penambahan pesanan sambungan, dan pelunasan dengan metode non-tunai (QRIS) mengubah status menjadi `'completed'` dan tidak mencemari buku kas tunai.
- [x] **T3.2 Tiket Dapur Awal vs Tiket Dapur Sambungan**: Penahanan pesanan pending mencetak tiket dapur tanpa rincian harga. Penambahan pesanan sambungan menghasilkan tiket dapur tambahan yang HANYA memuat item baru (`[ +qty ] (BARU)`).
- [x] **T3.3 Sinkronisasi Pemotongan Stok**: Item menu yang melacak stok (`track_stock = 1`) terpotong secara akurat saat checkout pesanan gabungan.

### Tier 4: Real-World Cashier Shift Scenarios (`test/tier4-scenarios.test.ts`)
- [x] **T4.1 Siklus Lengkap Shift Kasir**:
  1. Pembukaan sesi operasional harian kasir (`operating_sessions: open`).
  2. Pencatatan modal awal kasir (*cash float*).
  3. Transaksi langsung bungkus bayar tunai (kembalian & kas masuk tercatat).
  4. Pembukaan dua meja pending makan di tempat.
  5. Penambahan porsi sambungan pada meja aktif.
  6. Penggabungan meja dengan deduplikasi item dan konsolidasi diskon.
  7. Pelunasan meja gabungan via Transfer Bank.
  8. Pengeluaran kas operasional harian (beli es batu & arang).
  9. Pendapatan kas operasional lain (komisi titip produk).
  10. Penarikan prive kas oleh pemilik.
  11. Penginputan HPP bulanan (COGS).
  12. Verifikasi akurasi neraca finansial & saldo fisik laci kasir (*cash drawer*).
  13. Penutupan sesi operasional kasir (`operating_sessions: closed`).

### Tier 5: Adversarial Hardening & Stress Testing Suites (`test/tier5-adversarial.test.ts`)
- [x] **T5.1 Multi-Table Merge Stress Tests**:
  - `T5.1.1`: Penggabungan 4 meja simultan dengan kombinasi item tumpang-tindih dan item unik.
  - `T5.1.2`: Presisi pembulatan pajak PB1 dan PPN 11% pada subtotal ganjil.
  - `T5.1.3`: Penolakan penggabungan meja jika meja yang dipilih kurang dari 2.
- [x] **T5.2 Adversarial Edge Cases**:
  - `T5.2.1`: Clamping diskon ekstrim melebihi total pesanan strictly ke 0.
  - `T5.2.2`: Checkout langsung dan meja pending dengan keranjang kosong (0 item).
  - `T5.2.3`: Penambahan pesanan berturut-turut dalam 3 ronde delta berbeda.
- [x] **T5.3 Financial Reconciliation & Mathematical Truth**:
  - `T5.3.1`: Rekonsiliasi volume tinggi metode pembayaran campuran, pengeluaran operasional, modal non-PnL, dan COGS bulanan.
- [x] **T5.4 Attendance Photo Cleanup Edge Cases**:
  - `T5.4.1`: Idempotensi pembersihan direktori non-eksisten tanpa melempar eksepsi.
  - `T5.4.2`: Isolasi multi-bulan: hanya foto bulan kedaluwarsa yang terhapus.
  - `T5.4.3`: Format string tanggal tidak valid atau prefiks acak tidak menghapus data sembarangan.
- [x] **T5.5 Thermal Receipt Formatting Adversarial Inputs**:
  - `T5.5.1`: Karakter khusus, emoji Unicode, tanda baca pada nama item dan catatan pelanggan.
  - `T5.5.2`: Fallback profil toko kosong dan penanganan nama yang sangat panjang.
  - `T5.5.3`: Watermark penanda struk tagihan sementara dan tiket dapur.

### Tier 6: Operational Enhancements Suites (R1-R8) (`test/tier6-operational-enhancements.test.ts`)
- [x] **T6.1 Menu Soft-Delete & Seed Protection (R1)**:
  - Menu bawaan (ID 1) di-soft-delete (`is_active = 0`), diisolasi dari kueri menu aktif, sementara riwayat transaksi historis tetap utuh.
  - Flag `seed_menus_applied = '1'` menjamin menu yang dihapus tidak muncul kembali saat migrasi startup dijalankan ulang.
- [x] **T6.2 Quick Edit Price & Stock Persistence (R1)**:
  - Modifikasi instan harga dan stok pada tabel `menus` terverifikasi tersimpan permanen di SQLite.
- [x] **T6.3 Dynamic Table JSON & Pending Sync (R4)**:
  - Konfigurasi meja disimpan dalam JSON dinamis `custom_tables`.
  - Penambahan, pengeditan nama meja secara atomik memperbarui transaksi pending/billing terkait.
  - Proteksi integritas melarang penghapusan meja yang memiliki pesanan aktif.
- [x] **T6.4 Cashier Name Persistence & Thermal Receipt (R5)**:
  - Kolom `cashier_name` pada tabel `transactions` mencatat nama kasir operasional yang bertugas.
  - Formatter struk pelanggan dan tagihan sementara mencetak label `Kasir    : <Nama Kasir>`.
- [x] **T6.5 Supplier Purchases: Cash vs Tempo Debt Flow (R6)**:
  - Pembelian tunai langsung berstatus `'paid'` dan mencatat kas keluar operasional di `cash_ledger` (`affects_pnl = 1`).
  - Pembelian tempo tercatat sebagai hutang usaha (`purchases.payment_status = 'unpaid'`) tanpa mencemari `cash_ledger` sebelum pelunasan.
  - Pelunasan tempo memotong hutang menjadi 0 dan mencatat pengeluaran di `cash_ledger`.
- [x] **T6.6 Multi-Bank Accounts JSON Parsing & Resilience (R8)**:
  - Daftar rekening bank tersimpan dalam JSON array dinamis pada tabel `settings`.
  - Ketahanan terhadap data corrupt dengan fallback aman ke array kosong.
- [x] **T6.7 Attendance Calendar Mapping & Daily Details (R7)**:
  - Pemetaan absensi berbasis `business_date` (YYYY-MM-DD) dan agregasi status tepat waktu/terlambat harian.

### Milestone 4: Cashier Identity & Attendance Calendar (`test/m4-cashier-attendance.test.ts`)
- [x] **R5.1 - R5.5 Cashier Identity Suite**:
  - `R5.1`: Checkout langsung menyimpan nama kasir aktif ke SQLite.
  - `R5.2`: Penahanan pesanan meja pending mempertahankan nama kasir pencatat awal.
  - `R5.3`: Pelunasan pesanan pending memperbarui nama kasir dengan identitas kasir yang melunasi.
  - `R5.4`: Fallback kasir tanpa nama secara ketat bernilai `"Kasir"`.
  - `R5.5`: Format nota kasir mencetak nama kasir secara visual dan konsisten.
- [x] **R6.1 - R6.5 Attendance Calendar Mathematics**:
  - `R6.1`: Perhitungan jumlah hari dalam bulan (`daysInMonth`) akurat untuk tahun kabisat dan non-kabisat.
  - `R6.2`: Offset hari awal bulan (Minggu = 0 s.d. Sabtu = 6) selaras dengan grid UI kalender 7 kolom.
  - `R6.3`: Pengelompokan absensi harian dan deteksi indikator keterlambatan karyawan.
  - `R6.4`: Rekap metrik harian: jumlah hadir, tepat waktu, dan terlambat.
  - `R6.5`: Navigasi bolak-balik bulan dan pergantian tahun kalender berbasis pure date math tanpa dependensi library eksternal.

### Adversarial Challenger Test Suite (`test/adversarial-challenger.test.ts`)
- [x] **Scope 1: Menu Deletion Integrity (3 tests)**:
  - Soft-delete isolasi kueri aktif.
  - Hard-delete cascade aman via `ON DELETE SET NULL`.
  - Proteksi reboot aplikasi tidak memunculkan menu terhapus.
- [x] **Scope 2: Dynamic Table Stress & Concurrency (4 tests)**:
  - Pembuatan meja kustom dan asosiasi pesanan pending.
  - Guard pencegahan penghapusan meja dengan pesanan aktif.
  - Sinkronisasi perubahan nama meja pada pesanan pending tanpa mengubah transaksi historis selesai.
  - Penghapusan meja diizinkan setelah pesanan selesai.
- [x] **Scope 3: Cash Purchase & Tempo Debt Settlement Flow (7 tests)**:
  - Pembelian tunai menulis pengeluaran ke `cash_ledger`.
  - Pembelian tempo mengisolasi hutang dari `cash_ledger`.
  - Pelunasan tempo mencatat pengeluaran kas dan menghapus saldo hutang.
  - Penghapusan pembelian tunai/tempo membersihkan entri buku kas terkait secara atomik.
  - Rekonsiliasi laba rugi di financial engine.
  - Penghapusan supplier mempertahankan integritas historis pembelian (`ON DELETE SET NULL`).
- [x] **Scope 4: Cashier Identity Association (4 tests)**:
  - Checkout beruntun dengan kasir bergantian tersimpan presisi di database.
  - Handover pesanan pending antar-kasir.
  - Fallback kasir kosong ke default "Kasir".
  - Ketahanan pencetakan nama kasir berkarakter unik pada struk thermal.

### Challenger: Boundaries, Date Math & JSON (`test/challenger-boundaries-date-json.test.ts`)
- [x] **1. Calendar Math & Pure Date Mathematics (5 tests)**:
  - Penanganan tahun kabisat lintas abad (1900, 2000, 2024, 2026, 2100).
  - Navigasi batas bulan dua arah melintasi pergantian tahun.
  - Penyelarasan grid hari pertama tiap bulan (Minggu=0 .. Sabtu=6).
  - Agregasi absensi: dataset kosong, campuran tepat waktu/terlambat, dan 100% terlambat.
  - Perhitungan jam batas shift malam dan toleransi batas keterlambatan (17:30).
- [x] **2. Settings JSON & Malformed Data Resilience (4 tests)**:
  - JSON `custom_tables` rusak fallback aman ke 16 meja preset default.
  - Variasi elemen parsial atau array string pada `custom_tables`.
  - JSON `bank_accounts` rusak fallback aman ke array kosong.
  - Baris kueri pengaturan corrupt tidak mematahkan aplikasi.
- [x] **3. Input Boundaries & Duplicate Validation (4 tests)**:
  - Validasi duplikasi nama karyawan: case-insensitive dan variasi spasi.
  - Validasi duplikasi nama meja: case-insensitive dan spasi ganda.
  - Validasi duplikasi nama kategori: case-insensitive dan spasi.
  - Pembaruan kategori null: `updateMenu` mengizinkan pengosongan `category_id = NULL`.

### Challenger: Data Integrity & Deletion Stress (`test/challenger2-integrity-stress.test.ts`)
- [x] **Challenge 1: Menu Deletion Integrity & Foreign Key Safety (3 tests)**:
  - Soft-delete menu default ID 1 mempertahankan integritas transaksi historis.
  - Bulk soft-delete 16 menu bawaan membersihkan katalog dan menerima menu baru tanpa eror.
  - Hard delete pada menu dengan relasi foreign key mengaktifkan `SET NULL` tanpa pelanggaran constraint.
- [x] **Challenge 2: Seed Persistence & Reboot Simulation (3 tests)**:
  - Simulasi reboot aplikasi: menu default 1..16 yang terhapus tidak dibangkitkan kembali.
  - Reboot dengan seluruh menu terhapus: `seed_menus_applied = '1'` memblokir re-seeding liar.
  - Kategori kustom dan pengaturan tetap utuh saat migrasi dijalankan ulang.
- [x] **Challenge 3: Supplier Purchases Cash Ledger vs Tempo Debt Precision (3 tests)**:
  - Pembelian tunai langsung masuk PnL kas; pembelian tempo ditangguhkan hingga pelunasan.
  - Penghapusan nota pembelian tunai/tempo membersihkan entri kas terkait secara atomik.
  - Penghapusan supplier memicu `ON DELETE SET NULL` pada tabel pembelian.
- [x] **Challenge 4: Attendance Data, Date Format & Multiple Entries Stress (3 tests)**:
  - Format YYYY-MM-DD dan penegakan batas 1 kehadiran per karyawan per tanggal.
  - Matriks absensi multi-karyawan dan multi-tanggal terfilter akurat pada rekap harian & bulanan.
  - Penutupan sesi kasir memperbarui checkout terbuka hanya untuk tanggal aktif.

### Challenger: Operational Stress & Edge Case Test Suite (`test/operational-stress-challenger.test.ts`)
- [x] **Challenge 1: Table Management Operational Stress (4 tests)**:
  - Perubahan nama meja sinkron otomatis ke pesanan pending/billing, transaksi completed tetap tidak tersentuh.
  - Proteksi blokir penghapusan meja dengan pesanan aktif; diizinkan setelah nota lunas.
  - Validasi nama meja unik, spasi berlebih, dan pengecualian self-edit saat mengubah properti lain.
  - Dukungan nama meja dengan karakter khusus dan simbol.
- [x] **Challenge 2: Cashier Identity Operational Stress (4 tests)**:
  - Ragam nama kasir panjang dan karakter alfanumerik tersimpan aman di SQLite.
  - Nama kasir kosong / whitespace di-fallback otomatis ke "Kasir".
  - Transisi kasir pembuat pending order vs kasir penuntas pembayaran.
  - Formatter struk thermal tahan terhadap nama kasir panjang tanpa merusak layout kolom.
- [x] **Challenge 3: Quick Edit Price & Stock Stress Testing (4 tests)**:
  - Penanganan batas harga ekstrim (Rp 0 untuk bonus/komplimen, nominal jutaan, dan pencegahan input negatif).
  - Penolakan angka stok negatif dan penjepit batas bawah (*stepper clamp* ke 0).
  - Quick edit beruntun secara cepat pada item yang sama.
  - Penghapusan menu langsung via quick edit mengaktifkan soft-delete aman.
- [x] **Challenge 4: Multi-Bank Accounts Robustness & Schema Validation (4 tests)**:
  - Penanganan array kosong tanpa melempar runtime exception.
  - String JSON korup ditangkap dengan aman oleh blok try/catch.
  - Penanganan objek akun bank dengan properti opsional/parsial.
  - Nomor rekening bank dengan format spasi dan tanda minus tersimpan utuh.

---

## 4. Struktur Direktori Pengujian

```
test/
├── helpers/
│   ├── db.js & db.d.ts                  # Engine SQLite in-memory 15 tabel & skema migrasi PRAGMA foreign_keys = ON
│   ├── financialEngine.js & .d.ts      # Engine kalkulasi laba rugi anti-double-counting
│   ├── transactionEngine.js & .d.ts    # Engine transaksi, pending, merge, dan checkout
│   ├── receiptFormatter.js & .d.ts     # Format struk kasir, tagihan sementara & tiket dapur thermal
│   └── photoCleanup.js & .d.ts         # Simulator storage fisik & pembersihan foto absensi
├── tier1-features.test.ts              # 7 Unit tests cakupan fitur utama
├── tier2-boundary.test.ts              # 4 Tests boundary, corner cases & deduplikasi
├── tier3-cross-feature.test.ts         # 3 Tests integrasi lintas fitur
├── tier4-scenarios.test.ts             # 1 E2E test simulasi shift kasir menyeluruh
├── tier5-adversarial.test.ts           # 13 Tests adversarial hardening & stress testing
├── tier6-operational-enhancements.test.ts # 7 Tests operasional R1-R8 (Menu, Meja, Kasir, Supplier, Rekening, Kalender)
├── m4-cashier-attendance.test.ts       # 10 Tests identitas kasir & kalkulasi murni kalender absensi
├── adversarial-challenger.test.ts      # 18 Tests adversarial challenger isolasi menu, meja, kasir & supplier
├── challenger-boundaries-date-json.test.ts # 13 Tests batas tanggal kabisat, parsing JSON & validasi duplikasi
├── challenger2-integrity-stress.test.ts    # 12 Tests integritas foreign keys, reboot simulation & pembatalan nota
└── operational-stress-challenger.test.ts  # 16 Tests stres operasional nama meja, identitas kasir & multi-bank
```

---

## 5. Jaminan Integritas & Kesimpulan Pengujian

1. **Strict Foreign Keys**: Seluruh skema pengujian dan runtime produksi mengaktifkan `PRAGMA foreign_keys = ON;`. Tidak ada operasi manipulasi data yang melanggar integritas relasional relasi `menus`, `transactions`, `transaction_items`, `suppliers`, maupun `purchases`.
2. **Atomic Consistency**: Pengujian memvalidasi bahwa transaksi finansial (penjualan kasir, pembelian supplier, penggabungan meja) beroperasi secara atomik dengan rollback otomatis jika terjadi kegagalan parsial.
3. **No Mocks on Core Calculations**: Seluruh perhitungan finansial (omset kotor, laba bersih, HPP, diskon, pajak PB1, kembalian tunai, sisa hutang tempo) dihitung secara nyata melalui mesin kueri SQL dan fungsi komputasi matematika murni.
4. **Zero Regressions**: 104 pengujian otomatis terkonfirmasi lulus 100% (*clean pass*) pada lingkungan Node.js v24 native test runner.
