# Handoff Report: Milestone 1 (Financial, Cash In & Transaction Integrity)

**Author:** Worker M1 (Financial, Cash In & Transaction Integrity Specialist)  
**Date:** 2026-11-07T04:25:00Z  
**Type:** Hard Handoff (Task Complete)

---

## 1. Observation

Direct observations and verified code facts across the workspace:

1. **Net Profit Calculation Double Counting (`stores/financialStore.ts`)**:
   - `grossSales` is aggregated from `transactions` table (`SELECT COALESCE(SUM(total), 0) FROM transactions WHERE status = 'completed' AND business_date LIKE ?`), which includes both cash and cashless sales.
   - At checkout in `stores/transactionStore.ts`, cash sales were also recorded in `cash_ledger` with `category = 'penjualan_tunai'` and `affects_pnl = 1`.
   - In `stores/financialStore.ts:136`, all rows with `affects_pnl === 1` were accumulated into `operIncome`.
   - Formula `const netOperatingProfit = grossSales + operIncome - operExpenses - monthlyCogs` added cash sales twice.
2. **Cash Sales Missing in 'Kas Masuk' (`stores/transactionStore.ts`)**:
   - In `stores/transactionStore.ts:611`, cash sales were inserted as `type = 'in'` (`VALUES (?, 'in', 1, 'penjualan_tunai', ?, ?)`).
   - In `app/(tabs)/history.tsx:113` and throughout the app, queries for Kas Masuk strictly expect `type = 'income'`. Because `'in' !== 'income'`, POS cash sales never appeared under the Kas Masuk tab.
3. **Database Transactions Missing Atomicity**:
   - Multi-query operations (`checkout`, `saveAsPendingOrder` in `stores/transactionStore.ts`, `recordPurchase`, `settleTempoDebt` in `stores/purchaseStore.ts`, and `closeOperatingSession` in `stores/attendanceStore.ts`) were previously executed as sequential individual statements without `db.withTransactionAsync`. A failure or interruption midway resulted in partial commits.
4. **Receipt Payment Method & Store Profile Hardcoded**:
   - In `stores/transactionStore.ts`, `checkout` did not return `paymentMethod`.
   - In `components/payment-modal.tsx`, `PaymentModalProps.onSuccess` omitted `paymentMethod`.
   - In `app/transaksi.tsx:504`, `paymentMethod` was hardcoded to `'tunai'` in `receiptPayload`, causing QRIS and Transfer transactions to print as "Bayar (TUNAI)".
   - Store name (`ANGKRINGAN JOGJA`), address (`Jl. Malioboro No. 45, Yogyakarta`), phone (`0812-3456-7890`), and footer (`Matur Nuwun Sampun Rawuh!`) were hardcoded string literals instead of loaded from SQLite `settings` table.
5. **Attendance Photo Cleanup Leaking Physical Files**:
   - In `utils/imageStorage.ts`, files are saved as `attendance_<timestamp>_<rand>.jpg`.
   - `deleteMonthlyAttendancePhotos` filtered for string inclusion of `monthPrefix` (e.g., `'2026-11'`), which never matched epoch milliseconds. Files were never removed from physical device storage, while `UPDATE attendance SET check_in_photo = ''` cleared the DB reference.
6. **Missing Startup Auto-Load in `app/_layout.tsx`**:
   - `loadSavedPrinters` was only invoked inside `app/(tabs)/settings.tsx`. Cashiers launching into transaction mode did not have saved Bluetooth printers or tax PB1 configurations loaded.

---

## 2. Logic Chain

1. **Resolving Net Profit Double Counting**:
   - Since `grossSales` already captures all sales from completed transactions, `operIncome` must represent only non-sales operating income (such as scrap/waste sales or consignment income).
   - In `stores/financialStore.ts:loadFinancialData`, by adding `if (e.category === 'penjualan_tunai') { /* skip operIncome */ }`, cash sales are retained in `cash_ledger` for cash drawer auditing without double-counting in net profit calculations.
2. **Aligning Kas Masuk Ledger Types**:
   - Changed the literal inserted in `stores/transactionStore.ts:checkout` from `'in'` to `'income'`.
   - Added an automatic legacy migration in `services/database.ts:migrateDbIfNeeded` and `app/_layout.tsx:handleDatabaseInit`:
     `UPDATE cash_ledger SET type = 'income' WHERE type = 'in'`.
   - This ensures all historical and new cash sales seamlessly display in the 'Kas Masuk' tab.
3. **Guaranteeing ACID Atomicity via `db.withTransactionAsync`**:
   - Wrapped sequential mutations inside `await withSqliteRetry(() => db.withTransactionAsync(async () => { ... }))`:
     - `stores/transactionStore.ts`: `checkout` and `saveAsPendingOrder`.
     - `stores/purchaseStore.ts`: `recordPurchase` and `settleTempoDebt`.
     - `stores/attendanceStore.ts`: `closeOperatingSession`.
   - All multi-table updates either fully commit or rollback cleanly on any failure, while `withSqliteRetry` handles concurrency retries.
4. **Propagating Dynamic Payment Method & Store Settings**:
   - Updated `checkout` to return `paymentMethod` in its result object.
   - Updated `PaymentModalProps.onSuccess` to include `paymentMethod`.
   - Added `StoreProfile` interface, state, and `loadStoreSettings(db)` to `useTransactionStore`.
   - In `app/transaksi.tsx`, populated `receiptPayload` using `result.paymentMethod` and the dynamically loaded `storeProfile`.
5. **Real Storage Reclamation for Attendance Photos**:
   - In `stores/attendanceStore.ts:cleanupOldAttendance`, queried SQLite for all `check_in_photo` paths where `business_date LIKE ? AND check_in_photo != ''`.
   - Verified file existence with `FileSystem.getInfoAsync`, then deleted each physical file via `FileSystem.deleteAsync(photoPath, { idempotent: true })`.
   - In `utils/imageStorage.ts:deleteMonthlyAttendancePhotos`, added epoch parsing (`parts[1]`) so files named `attendance_<epoch>_<rand>.ext` corresponding to the target month are properly matched and deleted.
   - Cleared SQLite references with `UPDATE attendance SET check_in_photo = '' WHERE business_date LIKE ?`.
6. **Startup Initialization in Root Layout**:
   - In `app/_layout.tsx`, added `handleDatabaseInit` in `SQLiteProvider.onInit` and `AppInitializer` inside the provider tree.
   - When the app starts, `usePrinterStore.getState().loadSavedPrinters(db)` and `useTransactionStore.getState().loadStoreSettings(db)` are invoked immediately.

---

## 3. Caveats

- **Scope Adherence**: In accordance with the dispatch instructions, table merge logic (`mergeTables`) and menu management files were left untouched for Workers M2 and M3 to implement.
- **Node Test Environment**: Tests were run with Node 24 native test runner (`node --test test/tier1-features.test.ts`), which confirmed 100% pass for all 7 Tier 1 test cases.

---

## 4. Conclusion

All requirements for Milestone 1 (R2 - Integritas Data Keuangan, Struk Transaksi & Database) are genuinely implemented:
- Net profit calculation is mathematically accurate without double counting cash sales.
- POS cash sales appear under the 'Kas Masuk' tab (`type = 'income'`).
- All multi-query mutations across transactions, purchases, and attendance are ACID-protected using `db.withTransactionAsync`.
- Receipt preview and printer data dynamically adopt the selected payment method (Tunai, QRIS, Transfer) and store profile settings.
- Attendance photo cleanup physically deletes files from local storage and clears database records.
- Printers, store profile, and PB1 tax settings auto-load upon application startup.
- Full TypeScript typecheck passes with 0 errors.

---

## 5. Verification Method

To independently reproduce and verify this milestone:

1. **TypeScript Typecheck**:
   ```powershell
   & "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit
   ```
   *Expected result*: Exit code 0, 0 errors.

2. **Run Feature Test Suite**:
   ```powershell
   & "D:\AI PROJEK\node.exe" --test "d:\Source_Code_Angkringan_Jogja\test\tier1-features.test.ts"
   ```
   *Expected result*:
   - T1.1 - Financial Store: grossSales and transaction count (PASS)
   - T1.2 - Financial Store: Net profit calculation prevents double-counting cash sales (PASS)
   - T1.3 - Financial Store: Non-PnL entries do not affect net profit (PASS)
   - T1.4 - Cash Ledger: verify income/expense entries, filtering, and categories (PASS)
   - T1.5 - Receipt Formatting: Dynamic payment methods (Tunai, QRIS, Transfer) (PASS)
   - T1.6 - Database Transaction Wrapper: Atomic commit and atomic rollback (PASS)
   - T1.7 - Photo Cleanup: Physical file deletion and database path clearing for expired month (PASS)
   - 7 passed, 0 failed.

3. **Code Inspection**:
   - `stores/financialStore.ts`: check lines 135-142 for `e.category === 'penjualan_tunai'` guard.
   - `stores/transactionStore.ts`: check lines 400-660 for `db.withTransactionAsync` and `'income'`.
   - `stores/purchaseStore.ts`: check lines 160-230 for `db.withTransactionAsync`.
   - `stores/attendanceStore.ts`: check `closeOperatingSession` and `cleanupOldAttendance`.
   - `utils/imageStorage.ts`: check `deleteMonthlyAttendancePhotos` epoch timestamp matching.
   - `components/payment-modal.tsx`: check `PaymentModalProps.onSuccess` paymentMethod propagation.
   - `app/transaksi.tsx`: check `receiptPayload` dynamic settings binding.
   - `app/_layout.tsx`: check `handleDatabaseInit` and `AppInitializer`.
