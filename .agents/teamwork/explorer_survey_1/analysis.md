# Analysis Report: Financial & Database Integrity Specialist (R2 & R5)

**Author:** Explorer 1  
**Timestamp:** 2026-11-07T04:00:00Z  
**Target Architecture:** Android Tablet & Smartphone (100% Offline, Expo React Native, SQLite)  
**Principle:** Ponytail (Lazy Senior Dev Mode - smallest complete change, no bloat, root cause focused)

---

## 1. Executive Summary

This investigation analyzed Requirements R2 and R5 across the financial store, cash flow logging, receipt printing, database atomicity, photo cleanup, settings management, reporting, and codebase debt.

Every defect was traced to exact file paths and line numbers:
1. **Net Profit Double Counting:** Cash sales are recorded both in `transactions` (summed into `grossSales`) and in `cash_ledger` with `affects_pnl = 1` (summed into `operIncome`), inflating Net Profit by 100% of cash revenue.
2. **Missing Cash Sales in 'Kas Masuk':** `transactionStore.ts` inserts `type = 'in'`, whereas `history.tsx` queries `type = 'income'`. Because `'in' !== 'income'`, cash sales never appear in the Kas Masuk tab.
3. **Receipt Preview & Printer Bugs:** `checkout` and `PaymentModal` do not propagate `paymentMethod`, causing `transaksi.tsx` to hardcode `paymentMethod: 'tunai'` for all receipts. Store name, address, phone, and footer are hardcoded instead of loaded from database settings.
4. **Database Non-Atomicity:** Crucial multi-table operations (`checkout`, `saveAsPendingOrder`, `mergeTables`, `recordPurchase`, `settleTempoDebt`, `closeOperatingSession`) execute individual statements without `db.withTransactionAsync`, risking inconsistent states on crash.
5. **Attendance Photo Cleanup Failure:** Physical photos are saved with millisecond timestamps (`attendance_<epoch>_<rand>.jpg`), but the cleanup function searches for month strings like `2026-11`. Zero files are deleted from device storage while the DB reference is wiped.
6. **Settings Auto-Loading Missing:** App initialization in `_layout.tsx` does not load store profile, PB1 tax settings, or printer configurations.
7. **Report & History Synchronization:** `history.tsx` hardcodes `status = 'completed'` (excluding pending and merged orders), lacks 7-day and 1-month period filters, and omits payment method breakdowns.
8. **Ponytail Debt & iOS Remnants:** 0 marker debt comments; however, iOS-specific APIs (`Alert.prompt` in `explore.tsx`, 18 `Platform.OS === 'ios'` checks in `receipt-preview-modal.tsx`) remain and require cleanup.

---

## 2. Detailed Findings by Area

---

### Area 1: Net Profit Calculation & Double Counting of Cash Sales

#### Observation
- In `stores/financialStore.ts` (lines 98-106):
  ```typescript
  const salesRow = await withSqliteRetry(() =>
    db.getFirstAsync<{ total_sales: number; tx_count: number }>(
      `SELECT COALESCE(SUM(total), 0) as total_sales, COUNT(id) as tx_count
       FROM transactions
       WHERE status = 'completed' AND business_date LIKE ?`,
      [`${targetMonth}%`]
    )
  );
  const grossSales = salesRow?.total_sales || 0;
  ```
  `grossSales` includes ALL transactions (Tunai, QRIS, Transfer).
- In `stores/transactionStore.ts` (lines 607-615):
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
- In `stores/financialStore.ts` (lines 127-142):
  ```typescript
  entries.forEach((e) => {
    if (e.type === 'expense') {
      if (e.affects_pnl === 1) {
        operExpenses += e.amount;
        catMap[e.category] = (catMap[e.category] || 0) + e.amount;
      } else {
        nonPnlExpenses += e.amount;
      }
    } else {
      if (e.affects_pnl === 1) {
        operIncome += e.amount;
      } else {
        nonPnlIncome += e.amount;
      }
    }
  });
  ```
- In `stores/financialStore.ts` (line 160):
  ```typescript
  const netOperatingProfit = grossSales + operIncome - operExpenses - monthlyCogs;
  ```

#### Root Cause
`operIncome` was designed for auxiliary business income (such as scrap/waste sales or consignment revenue). Cash sales from cashier checkouts are already counted in `grossSales`. Because cash sales are logged to `cash_ledger` with `affects_pnl = 1`, they are also accumulated into `operIncome`. As a result, formula `grossSales + operIncome - operExpenses - monthlyCogs` adds cash sales twice.

#### Proposed Ponytail Fix
In `stores/financialStore.ts`:
When summing `operIncome`, exclude cashier sales (`e.category === 'penjualan_tunai'`). Cash sales remain in `cash_ledger` for cash drawer auditing, but are not added to `operIncome`.
```typescript
// stores/financialStore.ts (lines 135-141)
} else {
  if (e.category === 'penjualan_tunai') {
    // Already accounted in grossSales; do not double count
  } else if (e.affects_pnl === 1) {
    operIncome += e.amount;
  } else {
    nonPnlIncome += e.amount;
  }
}
```

---

### Area 2: Cash Sales Missing from 'Kas Masuk' Tab

#### Observation
- In `stores/transactionStore.ts` (line 611):
  ```typescript
  VALUES (?, 'in', 1, 'penjualan_tunai', ?, ?)
  ```
  The inserted type is string literal `'in'`.
- In `app/(tabs)/history.tsx` (lines 115-120):
  ```typescript
  const type = activeTab === 'cash_in' ? 'income' : 'expense';
  const query = filterTodayOnly
    ? 'SELECT * FROM cash_ledger WHERE type = ? AND business_date = ? ORDER BY id DESC'
    : 'SELECT * FROM cash_ledger WHERE type = ? ORDER BY id DESC';
  const params = filterTodayOnly ? [type, todayBizDate] : [type];
  ```
  The query filters `WHERE type = 'income'`.
- In `components/cash-entry-modal.tsx` (line 58):
  ```typescript
  const [type, setType] = useState<'expense' | 'income'>('expense');
  ```
- In `stores/financialStore.ts` (line 8):
  ```typescript
  type: 'income' | 'expense';
  ```

#### Root Cause
Type mismatch between insertion (`'in'`) and query (`'income'`). Because `'in' !== 'income'`, SQL queries filtering `type = 'income'` return zero rows for POS cash sales.

#### Proposed Ponytail Fix
1. Change `'in'` to `'income'` in `stores/transactionStore.ts:611`:
   ```typescript
   VALUES (?, 'income', 1, 'penjualan_tunai', ?, ?)
   ```
2. In `services/database.ts:migrateDbIfNeeded`, add a one-line migration:
   ```typescript
   await db.runAsync("UPDATE cash_ledger SET type = 'income' WHERE type = 'in'");
   ```

---

### Area 3: Receipt Printing, Preview & Store Settings Integration

#### Observation
- In `components/payment-modal.tsx`:
  - `PaymentModalProps.onSuccess` only passes `{ txId, invoiceNumber, total, paymentAmount, change }`.
  - `paymentMethod` is known by `PaymentModal` and passed to `checkout(...)`, but omitted from the callback object.
- In `stores/transactionStore.ts` (lines 622-629):
  - `checkout` does not return `paymentMethod`.
- In `app/transaksi.tsx` (line 504):
  ```typescript
  paymentMethod: 'tunai', // default or selected
  ```
  `paymentMethod` is hardcoded as `'tunai'`, causing receipts to say "Bayar (TUNAI)" even when paid via QRIS or Transfer.
- In `app/transaksi.tsx` (lines 484-487):
  ```typescript
  storeName: 'ANGKRINGAN JOGJA',
  storeAddress: 'Jl. Malioboro No. 45, Yogyakarta',
  storePhone: '0812-3456-7890',
  receiptFooter: 'Matur Nuwun Sampun Rawuh!',
  ```
  Store information is hardcoded.
- In `app/(tabs)/history.tsx` (lines 136-152):
  `storeAddress`, `storePhone`, and `receiptFooter` are completely missing when opening receipts from transaction history.

#### Root Cause
1. Information truncation: `checkout` returns an object lacking `paymentMethod`, so the UI caller falls back to `'tunai'`.
2. Settings isolation: The `settings` table is only queried inside `app/(tabs)/settings.tsx`, leaving other components with hardcoded strings.

#### Proposed Ponytail Fix
1. In `stores/transactionStore.ts`, include `paymentMethod` in `checkout` return object:
   ```typescript
   return {
     txId: finalTxId,
     invoiceNumber: finalInvoice,
     total,
     paymentAmount,
     change,
     dailySeq,
     paymentMethod,
   };
   ```
2. Update `PaymentModalProps.onSuccess` to include `paymentMethod: 'tunai' | 'qris' | 'transfer'`.
3. In `app/transaksi.tsx` and `app/(tabs)/history.tsx`, query or subscribe to store profile settings from the `settings` table.

---

### Area 4: Database Transactions Audit (Missing Atomicity)

#### Observation
The codebase has `withSqliteRetry` for retry handling, but only uses `db.withTransactionAsync` in `services/backup.ts`. All multi-query mutations across stores are executed outside transaction boundaries:

1. **`checkout` in `stores/transactionStore.ts` (lines 480-615):**
   - Direct checkout executes: `daily_counters` select & upsert -> `transactions` insert -> `transaction_items` inserts (loop) -> `menus` stock update (loop) -> `customers` update -> `cash_ledger` insert.
   - Pending checkout executes: `transactions` update -> `transaction_items` delete & reinsert (loop) -> `menus` stock update (loop) -> `customers` update -> `cash_ledger` insert.
2. **`saveAsPendingOrder` in `stores/transactionStore.ts` (lines 312-388):**
   - For existing: `transactions` update -> `transaction_items` delete -> `transaction_items` re-insert.
   - For new: `daily_counters` update -> `transactions` insert -> `transaction_items` insert.
3. **`mergeTables` in `stores/transactionStore.ts` (lines 394-436):**
   - Updates items of other tables to primaryId -> marks other transactions as 'merged' -> recalculates sum -> updates primary transaction.
4. **`recordPurchase` in `stores/purchaseStore.ts` (lines 157-192):**
   - `purchases` insert -> `cash_ledger` insert.
5. **`settleTempoDebt` in `stores/purchaseStore.ts` (lines 208-228):**
   - `purchases` update -> `cash_ledger` insert.
6. **`closeOperatingSession` in `stores/attendanceStore.ts` (lines 134-154):**
   - `attendance` batch checkout update -> `operating_sessions` upsert.

#### Risk
If an exception or power loss occurs in any loop iteration (e.g. out of memory, battery dies, constraint violation), partial state is committed, leaving orphaned transaction records, desynchronized stock counts, or unbalanced cash logs.

#### Proposed Ponytail Fix
Wrap the sequence of SQL statements inside each method with:
```typescript
await db.withTransactionAsync(async () => {
  // atomic queries
});
```

---

### Area 5: Attendance Photo Cleanup & Local Storage

#### Observation
- In `utils/imageStorage.ts` (lines 35-36):
  ```typescript
  const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;
  const destinationUri = `${targetDir}${filename}`;
  ```
  Generates file names like: `attendance_1730953820123_abcde.jpg`.
- In `utils/imageStorage.ts` (lines 66-70):
  ```typescript
  for (const f of files) {
    if (f.includes(monthPrefix.replace('-', '')) || f.includes(monthPrefix)) {
      await FileSystem.deleteAsync(`${targetDir}${f}`, { idempotent: true });
      deletedCount++;
    }
  }
  ```
  `monthPrefix` is formatted as `'YYYY-MM'` (e.g. `'2026-11'`) or `'YYYYMM'`.
- In `stores/attendanceStore.ts` (lines 192-209):
  ```typescript
  const deletedFiles = await deleteMonthlyAttendancePhotos(monthPrefix);
  await withSqliteRetry(() =>
    db.runAsync(
      `UPDATE attendance SET check_in_photo = '' WHERE business_date LIKE ?`,
      [`${monthPrefix}%`]
    )
  );
  ```

#### Root Cause
Epoch milliseconds (e.g. `1730953820123`) never match `'2026-11'` or `'202611'`. The filter condition is always `false`. Thus, zero physical files are deleted. However, `db.runAsync` clears `check_in_photo = ''` in the database, leaving orphaned image files occupying storage on the Android device indefinitely.

#### Proposed Ponytail Fix
In `stores/attendanceStore.ts`, retrieve the actual `check_in_photo` paths recorded in the database for the given month, delete those specific files from `FileSystem`, and then clear the column in the database:
```typescript
const rows = await db.getAllAsync<{ check_in_photo: string }>(
  "SELECT check_in_photo FROM attendance WHERE business_date LIKE ? AND check_in_photo != ''",
  [`${monthPrefix}%`]
);
let deletedCount = 0;
for (const r of rows || []) {
  if (r.check_in_photo) {
    try {
      const info = await FileSystem.getInfoAsync(r.check_in_photo);
      if (info.exists) {
        await FileSystem.deleteAsync(r.check_in_photo, { idempotent: true });
        deletedCount++;
      }
    } catch (e) {
      console.warn('Gagal menghapus file foto:', e);
    }
  }
}
await db.runAsync(
  "UPDATE attendance SET check_in_photo = '' WHERE business_date LIKE ?",
  [`${monthPrefix}%`]
);
```

---

### Area 6: Settings Auto-Loading (Store Profile, PB1 Tax, Printer)

#### Observation
- `app/_layout.tsx` only invokes `migrateDbIfNeeded(db)` upon startup.
- `loadSavedPrinters(db)` is only called inside `app/(tabs)/settings.tsx`. If a cashier opens `transaksi.tsx` without first visiting the Settings screen, no printer configuration is loaded.
- `taxEnabled` and `taxRate` exist in `transactionStore`, but:
  - There is no table or key in `settings` storing tax settings.
  - There is no tax configuration UI in `settings.tsx`.
- Store profile fields (`store_name`, `store_address`, `store_phone`, `receipt_footer`) are stored in `settings`, but kept only in local component state in `settings.tsx`.

#### Root Cause
Missing centralized startup configuration loader.

#### Proposed Ponytail Fix
1. Extend `migrateDbIfNeeded` or add a root initialization hook in `app/_layout.tsx` (or a lightweight store/service `settingsService.ts` or `stores/settingsStore.ts`):
   - Load store profile into memory.
   - Load `tax_enabled` (default `0`) and `tax_rate` (default `10`) into `useTransactionStore.getState().setTaxSettings(...)`.
   - Call `usePrinterStore.getState().loadSavedPrinters(db)`.
2. In `app/(tabs)/settings.tsx`:
   - Add a section for "Pengaturan Pajak Restoran (PB1)" with a switch and rate input, persisting to `settings` (`tax_enabled`, `tax_rate`).

---

### Area 7: Financial Reports, Transaction History, CSV Export Synchronization

#### Observation
- In `app/(tabs)/history.tsx` (lines 80-107):
  ```typescript
  WHERE t.status = 'completed'
  ```
  Pending (`status = 'pending'`) and merged (`status = 'merged'`) transactions are completely hidden from the history screen.
- Filtering in `history.tsx`:
  Only provides `filterTodayOnly` (Today vs All Dates). Missing filters for 7 Days, 1 Month, and Month/Date picker required by PRD Modul 9 & 10.
- Payment method breakdown:
  Neither `history.tsx` nor `financial.tsx` provides a breakdown card of sales by payment method (Tunai, QRIS, Transfer).
- CSV Exports:
  - `history.tsx`: CSV export filenames are hardcoded to `todayBizDate` regardless of whether the filter is today or all dates. Does not export status, discount, or tax columns.
  - `financial.tsx`: CSV export only exports `cashEntries`; does not export the PnL summary statement to CSV.

#### Root Cause
Under-implemented query filters and aggregation views.

#### Proposed Ponytail Fix
1. In `app/(tabs)/history.tsx`:
   - Change query to fetch transactions regardless of status, or add a status filter toggle (`'all' | 'completed' | 'pending' | 'merged'`).
   - Add status badges in the transaction card: `Completed` (Green), `Pending` (Yellow), `Merged` (Gray).
   - Add period selector: `Hari Ini`, `7 Hari`, `1 Bulan`, `Semua`.
   - Calculate and display payment method summary cards:
     - `Tunai: Rp X`
     - `QRIS: Rp Y`
     - `Transfer: Rp Z`
2. Sync CSV export columns with full details (status, subtotal, tax, discount, total, payment method, date).

---

### Area 8: Ponytail Debt & Audit

#### Code Audit Findings
- **Shortcut markers (`shortcut:`, `ponytail:`):** 0 markers found. Clean ledger.
- **iOS-Specific Bloat:**
  - `app/(tabs)/explore.tsx:61`: Uses `Alert.prompt`, which fails on Android. Must be replaced with a modal input dialog.
  - `components/receipt-preview-modal.tsx`: 18 lines containing `Platform.OS === 'ios' ? 'Courier' : 'monospace'`. Can be simplified to `'monospace'`.
  - Multiple `Platform.OS === 'ios'` checks across components that can be cleaned up since the target is exclusively Android.
- **`mergeTables` in `stores/transactionStore.ts` (lines 405-435):**
  - Deduplication: Currently moves items blindly (`UPDATE transaction_items SET transaction_id = ?`), resulting in duplicate rows of the same menu.
  - Tax/Discount: Overwrites `total` with `newSubtotal` (`total = newSubtotal`), destroying tax and discount settings.
  - Needs to merge quantities of identical menu items and recompute taxes/discounts.

---

## 3. Implementation Risk Assessment

| Item | Complexity | Risk | Mitigation |
|---|---|---|---|
| Fix double-counted cash sales | Low (1 branch check in `financialStore.ts`) | Very Low | Verifiable via unit test / calculation test |
| Fix 'Kas Masuk' tab sync | Low (change `'in'` to `'income'` + DB migration) | Very Low | Backward-compatible update query |
| Atomic DB transactions | Medium (wrap operations in `withTransactionAsync`) | Low | Test checkout, pending, and purchase flows |
| Attendance photo cleanup | Low (read DB paths before deleting files) | Very Low | Safe with `getInfoAsync` and `idempotent: true` |
| Receipt & settings sync | Medium (propagate `paymentMethod`, load settings) | Low | Clean single source of truth for store profile |
| History filters & breakdown | Medium (add UI segmented control and SQL date filter) | Low | Standard SQLite date comparisons |

---

## 4. Verification Plan

1. **Double Count Check:**
   Create 1 completed cash transaction of Rp 50,000.
   Verify in `financialStore`: `totalGrossSales = 50000`, `operIncome = 0`, `netOperatingProfit = 50000 - monthlyCogs - operExpenses`.
2. **Kas Masuk Tab Check:**
   Execute a cash transaction. Open Riwayat Transaksi -> Tab "Buku Kas Masuk".
   Verify the entry appears with category `penjualan_tunai`.
3. **Receipt Payment Method & Profile Check:**
   Execute a QRIS transaction. Preview receipt and inspect printed text.
   Verify text says `Bayar (QRIS)` and displays the store name/address configured in Settings.
4. **Photo Cleanup Check:**
   Record attendance with photo. Trigger monthly photo cleanup with Admin PIN.
   Verify physical file is removed from `FileSystem.documentDirectory` and DB column is empty.
5. **Atomic Transaction Check:**
   Simulate failure during checkout item insertion.
   Verify no partial row exists in `transactions` or `transaction_items`, and counter does not produce duplicate invoice numbers.
