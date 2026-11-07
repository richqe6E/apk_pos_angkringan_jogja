# Project: POS Angkringan Jogja — Kesiapan Lingkungan Produksi

## Architecture
- **Framework**: React Native with Expo Router (Offline-first, Pure Android Standalone)
- **Database Engine**: Local SQLite via `expo-sqlite` (WAL mode, busy_timeout 10000ms, 15 relational tables)
- **State Management**: Zustand stores (`menuStore`, `transactionStore`, `customerStore`, `purchaseStore`, `attendanceStore`, `financialStore`, `settingsStore`, `printerStore`)
- **Test Infrastructure**: Native Node.js v24 `node:test` + `node:sqlite` in-memory test runner (`npm test`)
- **Hardware Integration**: ESC/POS Bluetooth thermal printer (58mm/80mm), camera attendance, offline file sharing

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1: Penghapusan Menu Bawaan | Menu bawaan & kustom dapat dihapus secara permanen tanpa FK constraint error dan tanpa re-seed | M1 | ORIGINAL_REQUEST §R1 |
| 2 | R1: Form Tambah & Edit Menu | Input lengkap, initial values tidak ter-reset saat kategori bertambah, input stok tampil jelas | M1 | ORIGINAL_REQUEST §R1 |
| 3 | R1: Quick Edit Menu Kasir | Tekan-lama (long press) pada katalog menu kasir memunculkan dialog edit harga, stok, tombol simpan & hapus | M1 | ORIGINAL_REQUEST §R1 |
| 4 | R2: Tombol Aksi Kanan Atas | Perbaikan seluruh tombol kanan atas: Kategori (Menu), Unduh PDF/CSV (Riwayat), Tambah Karyawan (Absensi), HPP Global (Keuangan - fix syntax error), Atur Reward (Customer), Supplier Baru (Supplier) | M1 | ORIGINAL_REQUEST §R2 |
| 5 | R4: Manajemen Meja Dinamis | Penambahan meja baru, edit nama meja, edit nomor meja tanpa hardcode, terintegrasi ke kasir & pending order | M2 | ORIGINAL_REQUEST §R4 |
| 6 | R5: Identitas Kasir Operasional | Alur pemilihan kasir wajib sebelum operasional kasir, pencatatan di database transaksi dan pencantuman pada seluruh struk | M3 | ORIGINAL_REQUEST §R5 |
| 7 | R6: Form Reward Customer | Form atur reward dapat dibuka, diisi (nominal belanja & hadiah), dan tersimpan | M4 | ORIGINAL_REQUEST §R6 |
| 8 | R6: Form Pembelian Supplier | Form pembelian bahan dapat dibuka, mencatat bahan/supplier, terintegrasi dengan cash_ledger atau hutang tempo | M4 | ORIGINAL_REQUEST §R6 |
| 9 | R7: Kalender Absensi Interaktif | Tampilan riwayat absensi berupa kalender bulanan interaktif dengan seleksi tanggal untuk melihat rincian kehadiran staf | M4 | ORIGINAL_REQUEST §R7 |
| 10 | R8: Pengaturan Pembayaran QRIS | Foto QRIS toko tersimpan di settings dan tampil otomatis di modal pembayaran kasir | M4 | ORIGINAL_REQUEST §R8 |
| 11 | R8: Pengaturan Multi-Rekening Transfer | Penyimpanan banyak rekening bank di settings dan pilihan rekening tampil di modal pembayaran kasir | M4 | ORIGINAL_REQUEST §R8 |
| 12 | R3: Evaluasi Struk Tagihan Sementara | Mempertahankan kode tagihan sementara dan menyusun evaluasi mendalam fungsi operasional F&B di laporan akhir | M5 | ORIGINAL_REQUEST §R3 |
| 13 | R8: Analisis Integrasi Bank | Analisis teknis 4 pendekatan integrasi perbankan tanpa implementasi sepihak di laporan akhir | M5 | ORIGINAL_REQUEST §R8 |
| 14 | R9: Test Suite Tier 6 & Laporan Akhir | Pengujian otomatis komprehensif seluruh fitur operasional R1-R8 dan penyusunan laporan analisis teknis lengkap | M5 | ORIGINAL_REQUEST §R9 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Menu Management, Quick Edit & Action Buttons | Perbaikan skema/migrasi menu, soft-delete is_active, perbaikan form menu & quick edit kasir, perbaikan syntax error HPP global & seluruh tombol aksi | none | DONE |
| M2 | Dynamic Table Management & Cashier Table Flow | Skema/penyimpanan meja dinamis, modal manajemen meja (tambah, edit nama/nomor), integrasi ke kasir & transaksi pending | M1 | DONE |
| M3 | Cashier Identity Selection & Receipt Integration | Modal pemilih kasir operasional wajib sebelum masuk kasir, pencatatan cashier_name ke transaksi dan seluruh struk thermal | M1 | DONE |
| M4 | Customer Rewards, Supplier Purchases, Attendance Calendar & Payment Settings | Form reward customer, form kulakan supplier terintegrasi buku kas/hutang, kalender bulanan absensi interaktif, render QRIS & multi-bank di kasir | M1 | DONE |
| M5 | Automated Testing (Tier 6), Verification & Comprehensive Final Report | Penambahan test suite Tier 6, eksekusi npm test 100% pass, evaluasi R3 tagihan sementara, analisis R8 integrasi bank, dan laporan akhir operasional | M1, M2, M3, M4 | DONE |

## Code Layout
- `services/database.ts`: Inisialisasi SQLite, skema tabel, migrasi `migrateDbIfNeeded`, dan data seed.
- `services/print.ts`: Formatting ESC/POS struk customer, dapur, audit shift, dan tagihan sementara.
- `services/export.ts` & `services/backup.ts`: Ekspor riwayat PDF dan CSV buku kas/transaksi.
- `stores/`: Toko state Zustand (`menuStore.ts`, `transactionStore.ts`, `customerStore.ts`, `purchaseStore.ts`, `attendanceStore.ts`, `financialStore.ts`, `settingsStore.ts`).
- `components/`: Komponen modal antarmuka (`menu-form-modal.tsx`, `table-selector-modal.tsx`, `payment-modal.tsx`, `monthly-cogs-modal.tsx`, `employee-modal.tsx`, `category-form-modal.tsx`, `reward-tier-modal.tsx`, `purchase-form-modal.tsx`, `receipt-preview-modal.tsx`).
- `app/`: Halaman rute Expo Router (`(tabs)/index.tsx`, `(tabs)/explore.tsx`, `(tabs)/history.tsx`, `(tabs)/attendance.tsx`, `(tabs)/financial.tsx`, `(tabs)/settings.tsx`, `transaksi.tsx`, `customers.tsx`, `purchases.tsx`).
- `test/`: Test suite Node.js native (`tier1-features.test.ts` s/d `tier5-adversarial.test.ts`, `helpers/db.js`).

## Interface Contracts
### Menu Management & Store Contract
- `menus` table: `is_active INTEGER NOT NULL DEFAULT 1`
- `menuStore.deleteMenu`: `UPDATE menus SET is_active = 0 WHERE id = ?`
- `menuStore.loadMenus`: `SELECT * FROM menus WHERE is_active = 1 ORDER BY name ASC`
- `menuStore.quickEditMenu`: `(db, id, price, stock, name) => Promise<void>`

### Table Management Contract
- `settings` key: `'custom_tables'` containing JSON array:
  `Array<{ id: string, name: string, number: string, type: 'meja' | 'lesehan' | 'bungkus', sort_order: number }>`
- `transactionStore.updateActiveTableNumber`: atomik sinkronisasi saat nama/nomor meja diedit.

### Cashier Identity Contract
- `transactionStore.activeCashier`: string (nama karyawan yang dipilih dari master `employees WHERE is_active = 1`).
- `transactions` table: `cashier_name TEXT NOT NULL` (terisi nama kasir aktif).
- `PrintReceiptData.cashierName`: string diteruskan ke seluruh fungsi generator struk di `services/print.ts`.

### Payment Settings & Checkout Contract
- `settings.qris_image_path`: string (path lokal ke foto QRIS).
- `settings.bank_accounts`: string JSON `Array<{ bank_name: string, account_number: string, account_holder: string }>`
- `payment-modal.tsx`: render `Image` untuk QRIS dan daftar selectable bank cards dengan tombol copy.
