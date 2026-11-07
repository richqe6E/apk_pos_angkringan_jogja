# HANDOFF REPORT — SURVEY & UI INVESTIGATION
**Agent**: Explorer 1 (UI & Component Explorer)  
**State Folder**: `d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_explorer_survey_1\`  
**Milestone**: Survey & UI Mapping Complete  
**Report File**: `analysis.md`

---

## 1. Observation

1. **R1: Kegagalan Hapus Menu Bawaan & Foreign Key Constraint**:
   - `services/database.ts:48`: `PRAGMA foreign_keys = ON;`
   - `services/database.ts:137`:
     ```sql
     CREATE TABLE IF NOT EXISTS transaction_items (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
       menu_id INTEGER NOT NULL REFERENCES menus(id),
       ...
     );
     ```
   - `stores/menuStore.ts:174`:
     ```ts
     deleteMenu: async (db: SQLiteDatabase, id) => {
       await withSqliteRetry(() =>
         db.runAsync('DELETE FROM menus WHERE id = ?', [id])
       );
       await get().loadMenus(db);
     }
     ```
   - Kueri penghapusan langsung `DELETE FROM menus WHERE id = ?` gagal dengan galat SQLite `SQLITE_CONSTRAINT_FOREIGNKEY` apabila menu tersebut pernah dimasukkan ke dalam item transaksi aktif atau riwayat penjualan.

2. **R1: Bug Reset Nilai Input & Stok Tersembunyi pada Form Menu**:
   - `components/menu-form-modal.tsx:43-61`:
     ```tsx
     useEffect(() => {
       if (menuItem) { ... }
       else {
         setName('');
         setPriceText('');
         setSelectedCatId(categories.length > 0 ? categories[0].id : null);
         ...
       }
     }, [menuItem, visible, categories]);
     ```
     `categories` berada di dalam dependency array `useEffect`. Ketika pengguna menekan "+ Kategori Baru" dan menyimpannya, perubahan state `categories` memicu kembali `useEffect`, menghapus seluruh teks `name` dan `priceText` yang telah diketik.
   - `components/menu-form-modal.tsx:316`:
     `{trackStock && (<View style={{ marginTop: 10 }}> ... <TextInput value={stockText} /> ...)}`
     Menu bawaan memiliki `track_stock = 0`, sehingga komponen input stok tersembunyi total dari layar.
   - `stores/menuStore.ts:39`: `quickEditMenu` didefinisikan tetapi tidak dipanggil di UI kasir; sebaliknya `app/transaksi.tsx:332` membuka modal penuh `MenuFormModal`.

3. **R2: Syntax Error pada HPP Global**:
   - `components/monthly-cogs-modal.tsx:154-158`:
     ```tsx
     154:   );
     155: }
     156: }
     157: 
     158: const styles = StyleSheet.create({
     ```
     Terdapat kurung kurawal penutup ganda `}` pada baris 156 di luar deklarasi komponen `MonthlyCogsModal`, menyebabkan galat sintaksis parsing.

4. **R2: Status Tombol Aksi Kanan Atas Lainnya**:
   - Menu: `explore.tsx:93` membuka `CategoryFormModal` (hanya tambah kategori, belum ada daftar kelola kategori).
   - Riwayat: `history.tsx:390 & 398` memanggil `exportTableToPdf` (`services/export.ts`) & `exportTransactionsCsv`/`exportCashLedgerCsv` (`services/backup.ts`) dengan `expo-print` dan `expo-sharing`. Berfungsi normal.
   - Absensi: `attendance.tsx:476` membuka `EmployeeModal` (`components/employee-modal.tsx`). Berfungsi normal.
   - Customer: `customers.tsx:104` membuka `RewardTierModal` (`components/reward-tier-modal.tsx`). Berfungsi, namun belum memanggil `loadRewardTiers(db)` di `useEffect` saat dibuka.
   - Supplier: `purchases.tsx:345` membuka `SupplierModal` (`components/supplier-modal.tsx`). Berfungsi normal.

5. **R3: Struk Tagihan Sementara**:
   - `services/print.ts:313 & 362`: Fungsi `formatTemporaryBillReceipt` dan `printTemporaryBill` memformat tagihan sementara dengan penanda status `BELUM LUNAS (SEMENTARA)` dan tanda air `*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***`.
   - `app/transaksi.tsx:172` & `components/table-selector-modal.tsx:322`: Tombol "Tagihan Sementara" memicu cetak bon sementara dan menandai meja ke status `'billing'`.

6. **R4: Manajemen Meja Dinamis**:
   - Hardcoded preset berada di `components/table-selector-modal.tsx:30-47` (`DEFAULT_PRESET_TABLES`).
   - Penyimpanan dinamis menggunakan tabel `settings` key `'custom_tables'` (format JSON).
   - Fungsi CRUD meja telah tersedia di `TableSelectorModal` (`handleOpenAddTable`, `handleOpenEditTable`, `handleDeleteTable`) dan menyinkronkan nama meja pada transaksi pending (baris 207–212).

7. **R5: Identitas Kasir Operasional**:
   - `app/transaksi.tsx:201`: `cashierName: 'Kasir'` (hardcoded).
   - `app/transaksi.tsx:607`: `cashierName: 'Kasir'` (hardcoded).
   - `stores/transactionStore.ts:560 & 773`: Kueri `INSERT INTO transactions` tidak menyertakan kolom `cashier_name`, sehingga selalu mengandalkan nilai default skema SQLite (`'Kasir'`).
   - Belum ada dialog pemilihan nama kasir dari daftar karyawan aktif sebelum memulai shift kasir.

8. **R6: Form Transaksi Customer & Supplier**:
   - Customer Reward Tier: `components/reward-tier-modal.tsx` mengelola tier belanja dan keterangan hadiah reward.
   - Supplier Purchase: `components/purchase-form-modal.tsx` dan `stores/purchaseStore.ts:145` mengelola belanja tunai (masuk `cash_ledger` sebagai beban PnL) dan belanja tempo (buku hutang supplier, pelunasan via `settleTempoDebt`).

9. **R7: Rekap Absensi Berbasis Kalender**:
   - `app/(tabs)/attendance.tsx:339-376`: `renderHistoryTab` merender `FlatList` vertikal sederhana dari `attendanceHistory`. Belum ada kalender matriks bulanan interaktif.

10. **R8: Pengaturan Pembayaran QRIS & Transfer**:
    - QRIS: Disimpan di `settings` (`key = 'qris_image_path'`) via `settings.tsx:114` dan ditampilkan di `payment-modal.tsx:88`.
    - Multi-Bank: Disimpan di `settings` (`key = 'bank_accounts'`) via `settings.tsx:170` dan ditampilkan sebagai daftar rekening di `payment-modal.tsx:94`.
    - Analisis integrasi bank: Sesuai batasan, tidak boleh diimplementasikan langsung; alternatif pendekatan (Aggregator Open API vs. Android Notification Listener vs. QRIS Statis Toko) diulas di laporan akhir.

---

## 2. Logic Chain

1. **Dari Observasi 1 (Foreign Key Constraint) ke Solusi Penghapusan Menu**:
   - Kueri `DELETE FROM menus WHERE id = ?` gagal karena tabel anak `transaction_items` mengikat `menu_id` secara ketat.
   - Menghapus baris `transaction_items` akan merusak riwayat transaksi dan integritas pembukuan omset.
   - Mengubah `menu_id` menjadi `NULL` melanggar `NOT NULL` constraint skema tabel.
   - **Maka**, solusi paling aman dan sesuai prinsip Ponytail adalah menambahkan kolom `is_active INTEGER NOT NULL DEFAULT 1` pada tabel `menus`. Operasi `deleteMenu` mengeksekusi `UPDATE menus SET is_active = 0 WHERE id = ?`, dan kueri katalog kasir memfilter `WHERE is_active = 1`. Menu langsung hilang dari katalog tanpa memicu galat database dan tanpa merusak histori transaksi.

2. **Dari Observasi 2 (Dependency Array & Hidden Stock) ke Form Menu & Quick Edit**:
   - `categories` dalam dependency array menyebabkan form ter-reset saat pengguna menambah kategori baru. Mengisolasi pemulihan form hanya saat `menuItem` atau `visible` berubah mencegah hilangnya input pengguna.
   - Kondisi `{trackStock && (...)` menyembunyikan kotak input stok jika `track_stock = 0`. Untuk quick edit kasir, input stok dan harga harus ditampilkan secara transparan dan mudah diakses bersama tombol "Simpan" dan "Hapus".

3. **Dari Observasi 3 (Stray Closing Brace) ke Solusi HPP Global**:
   - Menghapus karakter kurung kurawal ganda pada baris 156 di `components/monthly-cogs-modal.tsx` akan langsung memulihkan validitas sintaksis komponen modal HPP Global.

4. **Dari Observasi 7 (Hardcoded Kasir) ke Alur Pemilihan Kasir**:
   - Saat kasir dibuka, sistem harus memeriksa apakah `activeCashier` sudah dipilih.
   - Jika belum, tampilkan `CashierSelectorModal` yang memuat karyawan dari `employees WHERE is_active = 1`.
   - Setelah dipilih, nama kasir dimasukkan ke dalam klausa SQL `INSERT INTO transactions (..., cashier_name) VALUES (..., ?)` dan diteruskan ke generator struk thermal `PrintReceiptData`.

5. **Dari Observasi 9 (FlatList History) ke Kalender Absensi**:
   - Mengubah `renderHistoryTab` dari `FlatList` linier menjadi tampilan dua tingkat: Matriks Kalender Bulanan (header navigasi bulan + 7 kolom hari) di bagian atas, dan rincian kehadiran staf untuk tanggal terpilih di bagian bawah.

---

## 3. Caveats

1. Tidak ada dependensi pustaka luar baru yang ditambahkan ke `package.json` untuk menjaga kestabilan build Android lokal.
2. Sesuai batasan sistem dan instruksi R8, modul integrasi bank direct API tidak diimplementasikan langsung pada kode, melainkan diberikan analisis arsitektural.
3. Test suite otomatis saat ini (`npm test`) memverifikasi 28 test case backend logic (finansial, meja, stok, struk) dan lulus 100%. Pengujian UI visual tetap harus diverifikasi pada runtime perangkat Expo/Android.

---

## 4. Conclusion

Investigasi UI & Komponen telah memetakan seluruh file target, nomor baris, akar masalah bug, dan rekomendasi perbaikan berbasis prinsip Ponytail (perubahan terkecil yang menuntaskan masalah secara menyeluruh tanpa regresi). Dokumen laporan lengkap telah diterbitkan di `.agents/teamwork/teamwork_explorer_survey_1/analysis.md`. Seluruh temuan siap diserahkan kepada orkestrator dan tim pelaksana implementasi.

---

## 5. Verification Method

1. **Memeriksa Status Test Suite Otomatis**:
   ```bash
   npm test
   ```
   *Expected*: Seluruh 28 test cases dari Tier 1 hingga Tier 5 berstatus PASS (100%).
2. **Memeriksa Sintaksis Komponen**:
   - Buka `components/monthly-cogs-modal.tsx` baris 154–158 untuk memastikan tidak ada kurung kurawal berlebih.
   - Buka `components/menu-form-modal.tsx` baris 43–61 untuk memeriksa dependensi `useEffect`.
3. **Memeriksa Integritas Database**:
   - Buka `services/database.ts` baris 137 untuk memverifikasi definisi foreign key `transaction_items` terhadap `menus`.
   - Verifikasi bahwa penambahan kolom `is_active` pada `menus` dapat dijalankan dengan aman via migrasi SQLite.
