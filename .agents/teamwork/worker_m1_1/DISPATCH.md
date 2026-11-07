## 2026-11-07T04:05:02Z
You are Worker M1: Financial, Cash In & Transaction Integrity Specialist.
Your working directory is: d:\Source_Code_Angkringan_Jogja\.agents\teamwork\worker_m1_1
Create and use your working directory for all metadata and reports.

You MUST read the authoritative request at:
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the project architecture and features at:
d:\Source_Code_Angkringan_Jogja\PROJECT.md
and the audit report and explorer findings at:
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\orchestrator\AUDIT_FINDINGS_AND_REPAIR_PLAN.md
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\explorer_survey_1\analysis.md
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\explorer_survey_1\handoff.md

WRITE OWNERSHIP:
You exclusively own:
- `stores/financialStore.ts`
- `stores/transactionStore.ts`
- `stores/purchaseStore.ts`
- `stores/attendanceStore.ts`
- `components/payment-modal.tsx`
- `app/transaksi.tsx` (only checkout, receipt preview, and settings binding)
- `utils/imageStorage.ts`
- `app/_layout.tsx`
Do NOT modify menu files or table merge logic outside this scope.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK (Milestone 1 Implementation - R2):
1. Fix Net Profit Calculation (`stores/financialStore.ts`):
   - In `loadPnlData`: `grossSales` already includes all cash and cashless sales from `transactions`.
   - When accumulating `operIncome` from `cash_ledger`, skip entries where `category === 'penjualan_tunai'`.
   - Ensure `netOperatingProfit = grossSales + operIncome - operExpenses - monthlyCogs` does not double-count cash sales.
2. Fix Cash Sales in 'Kas Masuk' (`stores/transactionStore.ts`):
   - In line ~611, change `VALUES (?, 'in', 1, 'penjualan_tunai', ?, ?)` from `'in'` to `'income'`.
   - Also in `services/database.ts` migration or init, update existing legacy records: `UPDATE cash_ledger SET type = 'income' WHERE type = 'in'`.
3. Wrap Database Multi-Query Operations in Transactions:
   - In `stores/transactionStore.ts`: wrap `checkout`, `saveAsPendingOrder`, and other multi-query mutations inside `await db.withTransactionAsync(async () => { ... })`.
   - In `stores/purchaseStore.ts`: wrap `recordPurchase` and `settleTempoDebt` in `await db.withTransactionAsync(async () => { ... })`.
   - In `stores/attendanceStore.ts`: wrap `closeOperatingSession` in `await db.withTransactionAsync(async () => { ... })`.
4. Fix Receipt Payment Method & Store Profile:
   - In `stores/transactionStore.ts`: return `paymentMethod` from `checkout`.
   - In `components/payment-modal.tsx`: pass `paymentMethod` in `onSuccess` callback.
   - In `app/transaksi.tsx`: use the actual `paymentMethod` from the checkout result when constructing `receiptData` (supports 'tunai', 'qris', 'transfer').
   - In `app/transaksi.tsx`: bind store name, address, phone, and receipt footer from the stored settings rather than hardcoded strings.
5. Fix Attendance Photo Cleanup (`stores/attendanceStore.ts` and `utils/imageStorage.ts`):
   - In `stores/attendanceStore.ts:cleanupOldAttendance`: query the database for all `check_in_photo` paths matching the expired `business_date LIKE ?`.
   - Delete physical files on disk using `FileSystem.deleteAsync(photoPath, { idempotent: true })`.
   - Then update `attendance SET check_in_photo = '' WHERE business_date LIKE ?`.
6. Auto-Load Settings on App Startup (`app/_layout.tsx`):
   - In the initial setup / startup effect, call `printerStore.loadSavedPrinters`, load store profile settings from database, and load PB1 tax settings into stores so they are ready on launch.
7. Verification:
   - Run typecheck using `run_command`:
     `& "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit`
   - Must pass with 0 errors.
8. Maintain `progress.md` with timestamps and create a 5-component `handoff.md` in your working directory.
When complete, send a message to orchestrator (`eac7280e-c735-4bcc-b8ca-6f3a330669d5`).
