# Handoff Report: Financial & Database Integrity Survey (R2 & R5)

**Agent:** Explorer 1 (Financial & Database Integrity Specialist)  
**Recipient:** Orchestrator (`eac7280e-c735-4bcc-b8ca-6f3a330669d5`)  
**Date:** 2026-11-07T04:02:00Z  
**Type:** Hard Handoff (Investigation Complete)

---

## 1. Observation

Direct observations and citations from the codebase:

1. **Net Profit Double Counting:**
   - In `stores/financialStore.ts:100-106`:
     ```typescript
     `SELECT COALESCE(SUM(total), 0) as total_sales, COUNT(id) as tx_count
      FROM transactions
      WHERE status = 'completed' AND business_date LIKE ?`
     ```
     `grossSales` aggregates all completed sales (including Tunai, QRIS, Transfer).
   - In `stores/transactionStore.ts:607-615`:
     ```typescript
     if (paymentMethod === 'tunai') {
       await withSqliteRetry(() =>
         db.runAsync(
           `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
            VALUES (?, 'in', 1, 'penjualan_tunai', ?, ?)`,
           [businessDate, total, `Penjualan Nota ${finalInvoice} (${tableNumber})`]
         )
       );
     }
     ```
   - In `stores/financialStore.ts:136-141`:
     ```typescript
     } else {
       if (e.affects_pnl === 1) {
         operIncome += e.amount;
       } else {
         nonPnlIncome += e.amount;
       }
     }
     ```
   - In `stores/financialStore.ts:160`:
     ```typescript
     const netOperatingProfit = grossSales + operIncome - operExpenses - monthlyCogs;
     ```

2. **Cash Sales in 'Kas Masuk' Tab:**
   - In `stores/transactionStore.ts:611`:
     `VALUES (?, 'in', 1, 'penjualan_tunai', ?, ?)`
     The inserted `type` is string `'in'`.
   - In `app/(tabs)/history.tsx:115-120`:
     ```typescript
     const type = activeTab === 'cash_in' ? 'income' : 'expense';
     const query = filterTodayOnly
       ? 'SELECT * FROM cash_ledger WHERE type = ? AND business_date = ? ORDER BY id DESC'
       : 'SELECT * FROM cash_ledger WHERE type = ? ORDER BY id DESC';
     ```
     The query strictly checks `WHERE type = 'income'`.
   - In `components/cash-entry-modal.tsx:58`: `type` is typed as `'expense' | 'income'`.

3. **Receipt Preview & Printing:**
   - In `stores/transactionStore.ts:622-629`: `checkout` returns `{ txId, invoiceNumber, total, paymentAmount, change, dailySeq }` omitting `paymentMethod`.
   - In `components/payment-modal.tsx:23-29`: `onSuccess` callback omits `paymentMethod`.
   - In `app/transaksi.tsx:504`: `paymentMethod: 'tunai', // default or selected` is hardcoded.
   - In `app/transaksi.tsx:484-487`: Store name `'ANGKRINGAN JOGJA'`, address `'Jl. Malioboro No. 45, Yogyakarta'`, phone `'0812-3456-7890'`, and footer `'Matur Nuwun Sampun Rawuh!'` are hardcoded.
   - In `app/(tabs)/history.tsx:136-152`: `storeAddress`, `storePhone`, and `receiptFooter` are completely missing when opening the receipt preview.

4. **Database Multi-Query Operations:**
   - `git grep -n "withTransactionAsync"` shows only 2 occurrences in `services/backup.ts:104` and `services/backup.ts:152`.
   - Zero occurrences in `stores/transactionStore.ts` (affects `checkout` lines 480-615, `saveAsPendingOrder` lines 312-388, `mergeTables` lines 394-436).
   - Zero occurrences in `stores/purchaseStore.ts` (affects `recordPurchase` lines 157-192, `settleTempoDebt` lines 208-228).
   - Zero occurrences in `stores/attendanceStore.ts` (affects `closeOperatingSession` lines 134-154).

5. **Attendance Photo Cleanup:**
   - In `utils/imageStorage.ts:35`: File saved as `${folder}_${Date.now()}_${rand}.${cleanExt}` (e.g. `attendance_1730953820123_abcde.jpg`).
   - In `utils/imageStorage.ts:66-70`:
     ```typescript
     for (const f of files) {
       if (f.includes(monthPrefix.replace('-', '')) || f.includes(monthPrefix)) {
         await FileSystem.deleteAsync(`${targetDir}${f}`, { idempotent: true });
         deletedCount++;
       }
     }
     ```
     `monthPrefix` is in format `'YYYY-MM'` (e.g. `'2026-11'`). No match occurs against epoch timestamp filenames. Zero files are deleted.
   - In `stores/attendanceStore.ts:199`: `UPDATE attendance SET check_in_photo = '' WHERE business_date LIKE ?` executes and blanks DB references, leaving physical files orphaned.

6. **Settings Auto-Loading:**
   - In `app/_layout.tsx:32`: Only `migrateDbIfNeeded` is passed to `onInit`.
   - In `stores/printerStore.ts:55`: `loadSavedPrinters` exists but is only invoked in `app/(tabs)/settings.tsx:61`.
   - In `stores/transactionStore.ts:85-86`: `taxEnabled: false, taxRate: 10` is kept in local state without initialization from the database.
   - In `app/(tabs)/settings.tsx:64-80`: Store profile is loaded into local component state only, without broadcasting to other screens.

7. **Financial Reports & Transaction History Synchronization:**
   - In `app/(tabs)/history.tsx:93,106`:
     `WHERE t.status = 'completed'`
     Filters out any order with `status = 'pending'` or `status = 'merged'`.
   - Period filters in `history.tsx:63`: Only `filterTodayOnly` toggle exists; 7 days, 1 month, and custom period filters are absent.
   - Payment method breakdown: No breakdown for Tunai, QRIS, and Transfer is rendered.

8. **Ponytail Debt & Bloat:**
   - `git grep -nE "(#|//|/\*) ?(shortcut|ponytail):"`: 0 markers found. Clean ledger.
   - `app/(tabs)/explore.tsx:61`: Uses `Alert.prompt`, which fails silently/crashes on Android.
   - `components/receipt-preview-modal.tsx`: 18 instances of `Platform.OS === 'ios' ? 'Courier' : 'monospace'`.

---

## 2. Logic Chain

1. **Double Counting Deduction:**
   - From Obs 1: `grossSales` captures 100% of revenue from `transactions`.
   - Cash checkout inserts an identical total into `cash_ledger` with `affects_pnl = 1`.
   - `financialStore` iterates over `cash_ledger` and adds any row with `affects_pnl = 1` and `type !== 'expense'` to `operIncome`.
   - Formula `grossSales + operIncome - operExpenses - monthlyCogs` therefore includes the cash sales amount twice.
   - Conclusion: Excluding `category === 'penjualan_tunai'` from `operIncome` immediately resolves the double counting while preserving cash drawer audit records.

2. **Kas Masuk Tab Missing Deduction:**
   - From Obs 2: `transactionStore` writes `'in'`.
   - `history.tsx` queries `'income'`.
   - In SQLite, `'in' = 'income'` evaluates to false.
   - Conclusion: Updating the insert statement to write `'income'` and migrating legacy rows fixes the tab immediately.

3. **Receipt Payment Method Deduction:**
   - From Obs 3: `checkout` and `PaymentModal` do not propagate `paymentMethod` back to the caller.
   - `transaksi.tsx` receives no `paymentMethod` in `result` and uses a fallback string literal `'tunai'`.
   - Consequently, QRIS and Transfer transactions print as "Bayar (TUNAI)".
   - Conclusion: Returning `paymentMethod` from `checkout` and passing it through `onSuccess` resolves the issue with minimal code.

4. **Multi-Query Inconsistency Deduction:**
   - From Obs 4: During `checkout`, 6 sequential SQL operations run across 4 distinct tables (`daily_counters`, `transactions`, `transaction_items`, `menus`, `customers`, `cash_ledger`).
   - If any step fails, SQLite commits preceding writes because auto-commit is active outside transactions.
   - Conclusion: Wrapping the operation blocks inside `db.withTransactionAsync` guarantees ACID atomicity.

5. **Storage Leak Deduction:**
   - From Obs 5: `imageStorage` names files by `Date.now()`.
   - The deletion logic tests `f.includes('2026-11')`.
   - An epoch timestamp never contains `'2026-11'`, so deletion never executes.
   - The database reference is cleared, abandoning physical files on disk.
   - Conclusion: Querying DB file paths for that month first and calling `FileSystem.deleteAsync` on each path guarantees 100% clean deletion.

---

## 3. Caveats

- **No Caveats.** Every finding has been verified via direct code inspection and file tracing. No source code modifications were made during this investigation phase in compliance with the read-only directive.

---

## 4. Conclusion

All 8 requested survey areas have been fully investigated with confirmed root causes and minimal diff solutions:
1. `financialStore.ts`: Fix `operIncome` accumulation to skip `category === 'penjualan_tunai'`.
2. `transactionStore.ts`: Fix `'in'` to `'income'` in cash ledger insertion.
3. `payment-modal.tsx`, `transactionStore.ts`, `transaksi.tsx`: Propagate `paymentMethod` to receipt preview; bind store profile from `settings`.
4. Wrap all multi-table mutations in `transactionStore`, `purchaseStore`, and `attendanceStore` with `db.withTransactionAsync`.
5. `attendanceStore.ts`: Delete photo files by their database paths rather than relying on filename month matching.
6. `_layout.tsx`: Auto-load store profile, PB1 tax, and printer configurations at app startup.
7. `history.tsx`: Include pending and merged transactions with appropriate badges; add period selector and payment breakdown.
8. Clean up iOS-specific artifacts (`Alert.prompt` in `explore.tsx`, `Platform.OS` branching in receipt previews).

---

## 5. Verification Method

Once implemented, the orchestrator or tester can independently verify each item:

1. **Verify Net Profit Calculation:**
   - Inspect `stores/financialStore.ts:135-142`.
   - Ensure `operIncome` does not increase when cash sales are added.
2. **Verify Kas Masuk Tab:**
   - Execute a cash checkout. Inspect `app/(tabs)/history.tsx` under "Buku Kas Masuk" tab.
   - Query: `SELECT * FROM cash_ledger WHERE type = 'income' AND category = 'penjualan_tunai'`.
3. **Verify Receipt Printing:**
   - Execute a checkout with QRIS.
   - Check receipt preview modal: verify label displays `Bayar (QRIS)` and displays the custom store profile.
4. **Verify Database Atomicity:**
   - Inspect `stores/transactionStore.ts` and `stores/purchaseStore.ts` to confirm `db.withTransactionAsync` wraps multi-statement blocks.
5. **Verify Attendance Photo Cleanup:**
   - Trigger monthly cleanup in `app/(tabs)/attendance.tsx`.
   - Verify files in `expo-file-system` document directory `attendance/` are removed.
