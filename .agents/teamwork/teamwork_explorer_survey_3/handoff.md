# Handoff Report: Data Layer, State Management & Integrations Survey

**Subagent**: Explorer 3 (Data Layer, State Management & Integrations Explorer)  
**State Folder**: `d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_explorer_survey_3\`  
**Target File**: `handoff.md`  
**Timestamp**: 2026-11-07T11:23:00Z  

---

## 1. Observation

1. **Arsitektur Penyimpanan & Skema SQLite 15 Tabel**:
   - `services/database.ts:44-50`: Konfigurasi SQLite menggunakan `PRAGMA busy_timeout = 10000;`, `PRAGMA journal_mode = 'wal';`, `PRAGMA synchronous = NORMAL;`, `PRAGMA foreign_keys = ON;`.
   - `services/database.ts:68-241`: Skema 15 tabel relasional terpadu: `settings`, `operating_sessions`, `daily_counters`, `categories`, `menus`, `transactions`, `transaction_items`, `employees`, `attendance`, `customers`, `rewards`, `suppliers`, `purchases`, `cash_ledger`, `monthly_cogs`.
   - `app/_layout.tsx:54`: Provider SQLite `databaseName="pos_angkringan.db"`, `onInit={handleDatabaseInit}`, `useSuspense`.

2. **Akar Masalah Penghapusan & Kemunculan Menu Bawaan**:
   - `services/database.ts:137`: Kolom `menu_id` pada tabel `transaction_items` didefinisikan sebagai `menu_id INTEGER NOT NULL REFERENCES menus(id)`. Tidak ada klausul `ON DELETE SET NULL` atau `ON DELETE CASCADE`. Dengan `PRAGMA foreign_keys = ON`, setiap menu yang pernah tercatat dalam transaksi akan memicu galat `FOREIGN KEY constraint failed (787)` saat `DELETE FROM menus WHERE id = ?` dipanggil.
   - `services/database.ts:301`: `PRAGMA user_version = 1;` berada di baris paling bawah di dalam blok multi-statement raksasa `db.execAsync(...)`. Pada `expo-sqlite`, eksekusi `PRAGMA` di dalam blok multi-kueri rawan diabaikan sehingga `PRAGMA user_version` tetap terbaca `0`.
   - `services/database.ts:276-292`: Seed menu default menggunakan `INSERT OR IGNORE INTO menus (id, name, price, category_id, track_stock, stock) VALUES (1, ...), (2, ...)`. Jika menu dengan ID 1 dihapus oleh pemilik toko, maka saat aplikasi dibuka ulang (`app/_layout.tsx:31` memanggil `migrateDbIfNeeded`), kueri `INSERT OR IGNORE` mendeteksi bahwa ID 1 tidak ada, lalu memasukkannya kembali (re-seed otomatis).

3. **Manajemen Meja Dinamis & Hardcode Preset Meja**:
   - Skema basis data pada `services/database.ts` **tidak memiliki tabel meja** (`tables` atau sejenisnya).
   - `components/table-selector-modal.tsx:28-33`: Daftar meja di-hardcode sebagai array JavaScript statis:
     ```ts
     const PRESET_TABLES = [
       'Meja 01', 'Meja 02', 'Meja 03', 'Meja 04', 'Meja 05',
       'Meja 06', 'Meja 07', 'Meja 08', 'Meja 09', 'Meja 10',
       'Lesehan 01', 'Lesehan 02', 'Lesehan 03', 'Lesehan 04', 'Lesehan 05',
       'Bungkus / Take-away'
     ];
     ```
   - Tabel `transactions` kolom `table_number TEXT NOT NULL` hanya menyimpan string nama meja. Tidak ada mekanisme dinamis untuk menambah meja baru, mengedit nomor meja, atau mengubah nama meja.

4. **Identitas Kasir Operasional**:
   - `app/(tabs)/index.tsx:129`: Tombol "Buka Kasir Transaksi" langsung menjalankan `router.push('/transaksi')` tanpa mewajibkan atau memunculkan pemilih kasir.
   - `stores/transactionStore.ts:559` (`saveAsPendingOrder`) dan baris 772 (`checkout`): Kueri SQL penyimpanan transaksi tidak mengikutsertakan kolom `cashier_name`, sehingga selalu mengandalkan nilai default skema `'Kasir'`.
   - `app/transaksi.tsx:201, 607`: Nilai `cashierName: 'Kasir'` di-hardcode pada pembuatan payload cetak `PrintReceiptData`.

5. **Customer Rewards & Integrasi Pembelian Supplier ke Buku Kas/Utang**:
   - `stores/customerStore.ts:74-86, 165-191`: CRUD tingkatan reward membaca dan memanipulasi tabel `rewards` (`tier_name`, `min_spend`, `reward_description`).
   - `stores/purchaseStore.ts:182-194`: Pembelian tunai (`cash`) otomatis membuat catatan pengeluaran di `cash_ledger` (`type = 'expense', affects_pnl = 1, category = 'Pembelian Bahan/Kulakan'`).
   - `stores/purchaseStore.ts:70-82`: Pembelian tempo (`tempo`) tidak langsung masuk buku kas, melainkan diagregasi sebagai utang supplier (`payment_type = 'tempo' AND payment_status = 'unpaid'`). Saat dilunasi via `settleTempoDebt` (baris 202-232), barulah kas keluar dicatat di `cash_ledger`.

6. **Absensi Karyawan & Pemetaan Kalender**:
   - `stores/attendanceStore.ts:71-124`: Absensi masuk dicatat di tabel `attendance` dengan kolom `business_date` (format `'YYYY-MM-DD'`), `check_in_time`, dan referensi file foto `check_in_photo`.
   - `app/(tabs)/attendance.tsx:350-376`: Tab "Rekap & Riwayat" saat ini hanya menampilkan `FlatList` vertikal sederhana urut ID tanpa adanya tampilan kalender bulanan interaktif.

7. **Pengaturan Pembayaran (QRIS & Multi-Bank)**:
   - `app/(tabs)/settings.tsx:88-107`: Data foto QRIS (`qris_image_path`) dan rekening bank (`bank_accounts` dalam format string JSON) disimpan di tabel `settings`.
   - `components/payment-modal.tsx:88-107`: Modal pembayaran telah membaca `qris_image_path` dan `bank_accounts` dari tabel `settings`.
   - `components/payment-modal.tsx:354-364`: Pada saat metode pembayaran QRIS atau Transfer dipilih, JSX hanya menampilkan elemen placeholder statis berupa emoji `📱` dan teks generic *"Siap Terima Pembayaran..."*. Citra foto QRIS toko dan rincian rekening bank tidak dirender sama sekali.

8. **Struk Tagihan Sementara (R3)**:
   - `services/print.ts:313-357`: Fungsi `formatTemporaryBillReceipt` memformat struk 32 karakter dengan penanda tegas `*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***`, `Status: BELUM LUNAS (SEMENTARA)`, menampilkan Subtotal, Diskon, Pajak, dan TOTAL TAGIHAN tanpa rincian uang diterima maupun kembalian.
   - `services/print.ts:362-473`: Fungsi `printTemporaryBill` mencetak ke printer Bluetooth thermal dengan watermark `*** BUKAN BUKTI BAYAR ***`.
   - `stores/transactionStore.ts:392-397`: Fungsi `markTableAsBilling` memperbarui status transaksi menjadi `'billing'`.
   - `components/receipt-preview-modal.tsx:113-121`: Tab pratinjau tagihan sementara menampilkan visual struk thermal realistis.

9. **Hasil Pengujian Otomatis**:
   - Perintah pengujian `npm test` (`node --test test/**/*.test.ts`) mengeksekusi 28 test cases pada 5 tingkatan tier (Tier 1 s/d Tier 5) dengan hasil: **28 pass, 0 fail, durasi 1627 ms**.

---

## 2. Logic Chain

1. **Dari Observasi 2 ke Solusi Masalah Menu Bawaan**:
   - Karena kolom `menu_id` pada `transaction_items` memiliki referensi foreign key ke `menus(id)` tanpa `ON DELETE SET NULL`, dan `PRAGMA foreign_keys = ON` aktif, maka menu yang memiliki relasi transaksi tidak dapat dihapus (`SQLITE_CONSTRAINT_FOREIGNKEY`).
   - Karena `PRAGMA user_version = 1;` gagal diaplikasikan di akhir multi-statement `db.execAsync`, maka pengecekan versi mengembalikan `0` pada setiap pembukaan aplikasi, menyebabkan blok `INSERT OR IGNORE` pada `services/database.ts:276` dieksekusi ulang dan memasukkan kembali menu default yang telah dihapus jika ID 1..16 kosong.
   - *Inferensi Solusi*: Ubah referensi relasi menjadi `ON DELETE SET NULL` atau gunakan soft-delete `is_deleted = 1`, isolasi pembaruan `PRAGMA user_version` secara mandiri, dan tambahkan flag penanda seed selesai di tabel `settings`.

2. **Dari Observasi 3 ke Solusi Manajemen Meja Dinamis**:
   - Karena daftar meja hanya disimpan dalam konstanta JavaScript statis `PRESET_TABLES` di `components/table-selector-modal.tsx:28-33`, tidak ada antarmuka maupun tabel basis data untuk menambah atau mengubah data meja.
   - *Inferensi Solusi*: Buat tabel `store_tables` (`table_number`, `table_name`, `sort_order`, `is_active`) dengan data awal yang disalin dari preset lama, lalu hubungkan ke modal pemilih meja dan alur pesanan pending kasir.

3. **Dari Observasi 4 ke Solusi Identitas Kasir**:
   - Karena alur pembukaan kasir di `index.tsx` langsung membuka transaksi tanpa seleksi kasir, dan fungsi penyimpanan transaksi di `transactionStore.ts` tidak menyimpan nama kasir, maka seluruh transaksi tercatat atas nama `'Kasir'`.
   - *Inferensi Solusi*: Tambahkan modal gatekeeper pemilihan kasir dari `employees WHERE is_active = 1` sebelum transaksi kasir dapat diakses, simpan `cashier_name` pada tabel `transactions`, dan alirkan ke semua format struk (customer, tagihan sementara, dan audit shift).

4. **Dari Observasi 6 ke Solusi Kalender Absensi**:
   - Karena data absensi di tabel `attendance` sudah memiliki kolom `business_date` berformat standar ISO `'YYYY-MM-DD'`, data tersebut siap dipetakan ke dalam kalender bulanan interaktif.
   - *Inferensi Solusi*: Buat komponen matriks kalender bulanan di tab riwayat absensi yang menghitung jumlah kehadiran per tanggal dan menampilkan daftar staf yang bertugas ketika tanggal diklik.

5. **Dari Observasi 7 ke Solusi Tampilan QRIS & Bank**:
   - Karena data foto QRIS dan nomor rekening bank sudah berhasil disimpan di tabel `settings` dan sudah berhasil dibaca oleh `payment-modal.tsx`, namun bagian render JSX-nya masih menggunakan placeholder statis `📱`, maka solusi hanya memerlukan penggantian elemen placeholder tersebut dengan komponen `Image` (untuk QRIS) dan daftar kartu rekening bank yang dapat disalin dengan sekali sentuh (untuk Transfer).

6. **Dari Observasi 8 ke Evaluasi Struk Tagihan Sementara (R3)**:
   - Tagihan sementara diperlukan di industri F&B agar pelanggan dapat mencocokkan pesanan di meja sebelum menyerahkan uang pembayaran.
   - Tanda `BUKAN BUKTI BAYAR` mencegah kecurangan penggelapan uang oleh oknum staf.
   - Status `'billing'` mencegah transaksi dicatat prematur ke dalam kas dan omset sebelum uang benar-benar diterima di kasir.
   - *Inferensi*: Fitur ini harus dipertahankan secara utuh.

---

## 3. Caveats

1. **Lingkungan Pengujian**: Pengujian otomatis dijalankan menggunakan engine SQLite in-memory Node.js (`test/helpers/db.js`). Di perangkat fisik Android, perilaku timing I/O SQLite WAL dan driver Bluetooth printer ESC/POS dapat bervariasi bergantung pada spesifikasi hardware tablet.
2. **Keterbatasan TypeScript Command Line**: Perintah `npm run typecheck` gagal karena berkas biner `tsc` global tidak terpasang di path sistem Windows. Namun, seluruh berkas sumber TypeScript berhasil diproses dan dikompilasi oleh runner uji Node 24.
3. **Integrasi Perbankan (R8)**: Tidak ada integrasi API bank eksternal yang diuji coba secara langsung melalui jaringan perbankan nyata karena instruksi R8 menegaskan untuk tidak melakukan implementasi sepihak, melainkan menyajikan analisis komprehensif dan alternatif solusi arsitektural di laporan.

---

## 4. Conclusion

1. **Integritas Penyimpanan Data**: Arsitektur basis data SQLite 15 tabel pada `pos_angkringan.db` beroperasi dengan baik, namun membutuhkan penyesuaian foreign key pada `transaction_items` (`ON DELETE SET NULL`) dan perlindungan seed data pada `settings` agar penghapusan menu bawaan dapat bersifat permanen dan tidak memicu galat.
2. **Penyebab Seluruh Masalah Operasional Teridentifikasi**:
   - Masalah menu bawaan disebabkan oleh foreign key constraint `RESTRICT` dan eksekusi `PRAGMA user_version` yang terlewati dalam batch SQL.
   - Meja ter-hardcode pada konstanta statis array JavaScript di modal, bukan tabel dinamis.
   - Identitas kasir tidak memiliki alur seleksi wajib di awal dan tidak disimpan ke state transaksi.
   - Tampilan QRIS dan rekening bank di kasir hanya terganjal oleh JSX rendering placeholder pada `components/payment-modal.tsx:354-364`, sedangkan data setting-nya sudah tersimpan di SQLite.
   - Riwayat absensi memerlukan penggantian antarmuka list vertikal dengan grid kalender bulanan interaktif berbasis `business_date`.
3. **Evaluasi R3 (Tagihan Sementara)**: Fitur Tagihan Sementara (`formatTemporaryBillReceipt` & `printTemporaryBill`) merupakan instrumen vital operasional F&B angkringan untuk verifikasi pesanan meja, pencegahan fraud, dan akurasi fiskal kasir. Fitur ini **wajib dipertahankan**.
4. **Evaluasi R8 (Integrasi Bank)**: Pendekatan **Alternatif 4 (Hybrid Offline-First / Rekonsiliasi Kasir Manual via Struk Audit)** direkomendasikan sebagai solusi paling tepat guna untuk operasional angkringan saat ini, dengan opsi peningkatan ke **Alternatif 3 (Dynamic QRIS Webhook)** jika toko menghendaki otomatisasi penuh di masa depan.

---

## 5. Verification Method

Untuk memverifikasi secara independen seluruh temuan dan pengujian arsitektur data:

1. **Menjalankan Test Suite Proyek**:
   ```powershell
   npm test
   ```
   *Ekspektasi*: 28 test cases pada 5 test files (`tier1-features.test.ts`, `tier2-boundary.test.ts`, `tier3-cross-feature.test.ts`, `tier4-scenarios.test.ts`, `tier5-adversarial.test.ts`) lulus 100% (*zero failures*).

2. **Memeriksa Definisi Foreign Key & PRAGMA**:
   Buka berkas `services/database.ts`:
   - Periksa baris 48: `PRAGMA foreign_keys = ON;`
   - Periksa baris 137: `menu_id INTEGER NOT NULL REFERENCES menus(id)` (tanpa klausul `ON DELETE SET NULL`)
   - Periksa baris 301: `PRAGMA user_version = 1;` di akhir string `execAsync`.

3. **Memeriksa Hardcode Tabel Meja**:
   Buka berkas `components/table-selector-modal.tsx`:
   - Periksa baris 28-33: konstanta `PRESET_TABLES`.

4. **Memeriksa Placeholder QRIS & Rekening Bank di Pembayaran**:
   Buka berkas `components/payment-modal.tsx`:
   - Periksa baris 88-107: pemanggilan data `qris_image_path` dan `bank_accounts`.
   - Periksa baris 354-364: elemen JSX rendering yang hanya menampilkan placeholder emoji `📱`.

5. **Kondisi Invalidasi Analisis Ini**:
   Analisis ini dinyatakan tidak valid jika skema basis data telah diubah menjadi non-SQLite (misal NoSQL atau REST API backend eksternal), atau jika foreign key enforcement dinonaktifkan secara global (`PRAGMA foreign_keys = OFF`).
