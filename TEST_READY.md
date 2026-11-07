# TEST READY: POS Angkringan Jogja (Pure Android)

Dokumen ini menandai kesiapan harness dan rangkaian pengujian otomatis (*automated test suite*) berbasis Node.js v24 native `node:test` dan `node:assert` untuk memverifikasi logika finansial, integritas database SQLite, struk kasir & dapur, manajemen meja & pesanan pending, serta alur operasional kasir.

---

## 1. Perintah Menjalankan Pengujian (Test Runner Command)

### Menjalankan Seluruh Test Suite
```bash
& "D:\AI PROJEK\node.exe" --test test/**/*.test.ts
# atau via npm script:
npm test
```

### Memeriksa Tipe TypeScript (Zero Errors)
```bash
& "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit
# atau via npm script:
npm run typecheck
```

---

## 2. Ringkasan Cakupan Pengujian (Coverage Summary)

| Tingkatan Pengujian | Berkas Pengujian | Jumlah Test Case | Status | Durasi Eksekusi |
|---|---|:---:|:---:|:---:|
| **Tier 1: Feature Coverage** | `test/tier1-features.test.ts` | 7 | ✅ PASS (7/7) | ~270 ms |
| **Tier 2: Boundary & Corner Cases** | `test/tier2-boundary.test.ts` | 4 | ✅ PASS (4/4) | ~55 ms |
| **Tier 3: Cross-Feature Combinations** | `test/tier3-cross-feature.test.ts` | 3 | ✅ PASS (3/3) | ~50 ms |
| **Tier 4: Real-World Application Scenarios** | `test/tier4-scenarios.test.ts` | 1 | ✅ PASS (1/1) | ~25 ms |
| **Total Keseluruhan** | **4 Test Suites** | **15 Tests** | **100% PASS** | **~1030 ms** |

---

## 3. Checklist Fitur & Validasi (Feature Checklist)

### Tier 1: Feature Coverage
- [x] **T1.1 Gross Sales & Tx Count**: Agregasi hanya mencakup transaksi berstatus `'completed'` pada bulan berjalan (`business_date LIKE 'YYYY-MM%'`). Transaksi `'pending'` dan `'cancelled'` tidak masuk perhitungan omset.
- [x] **T1.2 Net Profit & Anti-Double-Count**: Penjualan tunai (`category = 'penjualan_tunai'`) pada buku kas (`cash_ledger`) dikecualikan dari `operIncome` karena telah tercakup di `grossSales`. Mencegah pembengkakan laba operasional ganda.
- [x] **T1.3 Non-PnL Filtering**: Entri modal awal / prive pemilik (`affects_pnl = 0`) tidak mendistorsi perhitungan laba bersih operasional.
- [x] **T1.4 Cash Ledger CRUD & Filter**: Entri kas bertipe `'income'` dan `'expense'` tersimpan dan terfilter secara akurat berdasarkan tipe, tanggal bisnis, dan kategori.
- [x] **T1.5 Struk Dinamis & Profil Toko**: Struk mencetak metode pembayaran dinamis (`TUNAI`, `QRIS`, `TRANSFER`), kembalian hanya pada pembayaran tunai, serta profil toko (nama, alamat, no telp, footer) dari pengaturan.
- [x] **T1.6 Database Atomic Transactions**: Pembungkusan `withTransactionAsync` menjamin *atomic commit* jika seluruh kueri berhasil dan *atomic rollback* jika terjadi kegagalan di tengah jalan.
- [x] **T1.7 Pembersihan Foto Fisik Absensi**: Logika pembersihan bulanan menghapus berkas fisik dari media penyimpanan dan mengosongkan path referensi di tabel `attendance`.

### Tier 2: Boundary & Corner Cases
- [x] **T2.1 Table Merge Deduplication**: Penggabungan meja dengan item menu identik (menu_id & harga sama) mengonsolidasi baris menjadi satu entri dengan kuantitas dan subtotal teragregasi. Diskon dari meja sumber dijumlahkan dan dipertahankan.
- [x] **T2.2 Table Merge Tax Recalculation**: Pajak PB1 dihitung ulang secara akurat berdasarkan subtotal gabungan baru dan tidak tereset ke nol.
- [x] **T2.3 Diskon Maksimal & Pembulatan Pajak**: Diskon yang melebihi subtotal membatasi total tagihan minimal ke 0 (tidak pernah negatif). Pembulatan pajak PB1 presisi bilangan bulat.
- [x] **T2.4 Pesanan Tambahan (Delta `is_additional = 1`)**: Porsi tambahan pada meja pending ditandai dengan `is_additional = 1`, sementara pesanan awal tetap `is_additional = 0`.

### Tier 3: Cross-Feature Combinations
- [x] **T3.1 Gabung Meja + Tambah Porsi + Bayar QRIS**: Alur gabungan meja aktif, penambahan pesanan sambungan, dan pelunasan dengan metode non-tunai (QRIS) mengubah status menjadi `'completed'` dan tidak mencemari buku kas tunai.
- [x] **T3.2 Tiket Dapur Awal vs Tiket Dapur Sambungan**: Penahanan pesanan pending mencetak tiket dapur tanpa rincian harga. Penambahan pesanan sambungan menghasilkan tiket dapur tambahan yang HANYA memuat item baru (`[ +qty ] (BARU)`).
- [x] **T3.3 Sinkronisasi Pemotongan Stok**: Item menu yang melacak stok (`track_stock = 1`) terpotong secara akurat saat checkout pesanan gabungan.

### Tier 4: Real-World Cashier Shift Scenarios
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

---

## 4. Struktur Direktori Pengujian
```
test/
├── helpers/
│   ├── db.js & db.d.ts                  # Engine SQLite in-memory 15 tabel & schema migration
│   ├── financialEngine.js & .d.ts      # Engine kalkulasi laba rugi anti-double-counting
│   ├── transactionEngine.js & .d.ts    # Engine transaksi, pending, merge, dan checkout
│   ├── receiptFormatter.js & .d.ts     # Format struk kasir, tiket dapur awal & sambungan
│   └── photoCleanup.js & .d.ts         # Simulator storage fisik & pembersihan foto absensi
├── tier1-features.test.ts              # 7 Unit tests cakupan fitur utama
├── tier2-boundary.test.ts              # 4 Tests boundary, corner cases & deduplikasi
├── tier3-cross-feature.test.ts         # 3 Tests integrasi lintas fitur
└── tier4-scenarios.test.ts             # 1 E2E test simulasi shift kasir menyeluruh
```
