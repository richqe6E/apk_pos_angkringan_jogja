## 2026-11-07T10:58:32Z
You are worker_m2 for Milestone 2 (Top-Right Action Modals across Modules: History, Attendance, Financial, Customer, Supplier).

## 🔒 MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Inputs
1. Working directory: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja
2. Original Request: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\ORIGINAL_REQUEST.md
3. Project Plan & Architecture: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\PROJECT.md
4. Explorer Survey Report 1 (History & Attendance): d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\explorer_survey_op_1\handoff.md
5. Explorer Survey Report 2 (Financial, Customer, Supplier): d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\explorer_survey_op_2\handoff.md
6. State folder: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\worker_m2

## Scope & Assigned Tasks (Milestone 2 - Requirement R2)
Verify and polish event handlers, form modals, input validations, and data saving for all top-right buttons:
1. **Modul Riwayat (PDF & CSV Export)**:
   - In `app/(tabs)/history.tsx`:
     - Validate empty data: If `filteredTransactions.length === 0`, display alert "Tidak ada data transaksi untuk diekspor pada periode ini."
     - On successful export, show feedback `Alert.alert('Export Berhasil', 'Berkas berhasil dibuat dan siap dibagikan.')`.
     - Catch share dismissal gracefully (do not show "Export Gagal" if user simply cancels the share sheet).
2. **Modul Absensi (Tambah Karyawan)**:
   - In `app/(tabs)/attendance.tsx` & `components/employee-modal.tsx`:
     - Ensure header button is clearly labeled "Tambah Karyawan" (or "+ Karyawan").
     - Validate input: name required, duplicate employee name check before insert (with friendly alert "Nama karyawan sudah terdaftar").
     - Show success feedback alert upon saving.
     - Add `KeyboardAvoidingView` so inputs are never obscured on smaller screens.
3. **Modul Keuangan (HPP Global)**:
   - In `app/(tabs)/financial.tsx`, `components/monthly-cogs-modal.tsx`, `stores/financialStore.ts`:
     - Maintain PIN Admin authorization.
     - Provide interactive Rupiah formatting / clean live preview for amount input.
     - When saving monthly COGS, preserve current period filter context or cleanly refresh the financial data without unintended side-effects.
4. **Modul Customer (Atur Tingkatan Reward)**:
   - In `app/customers.tsx`, `components/reward-tier-modal.tsx`, `stores/customerStore.ts`:
     - Input validation: tier name required, min spend > 0, reward description required.
     - Display success alert when adding/editing/deleting tiers.
     - Ensure customer tier status recalculation updates smoothly.
5. **Modul Supplier (Supplier Baru & Catat Pembelian Bahan)**:
   - In `app/purchases.tsx`, `components/supplier-modal.tsx`, `components/purchase-form-modal.tsx`, `stores/purchaseStore.ts`:
     - Tombol "Supplier Baru": input validation, prevent empty name, duplicate check, and success alert.
     - Fitur "Catat Pembelian Bahan":
       - Validate supplier selection, nominal > 0.
       - Payment type `cash`: atomik insert to `purchases` AND create expense in `cash_ledger` (`type = 'expense'`, `affects_pnl = 1`, `category = 'Pembelian Bahan/Kulakan'`).
       - Payment type `tempo`: insert to `purchases` with status `'unpaid'`, do NOT create cash ledger expense until settled via `settleTempoDebt`.
       - On `settleTempoDebt`: mark purchase paid AND record cash expense in `cash_ledger`.
       - Ensure `deletePurchase` also cleans up related `cash_ledger` entry if a cash purchase is deleted.

## Exclusive File Ownership
You have exclusive write ownership of:
- `app/(tabs)/history.tsx`
- `app/(tabs)/attendance.tsx`
- `components/employee-modal.tsx`
- `app/(tabs)/financial.tsx`
- `components/monthly-cogs-modal.tsx`
- `stores/financialStore.ts`
- `app/customers.tsx`
- `components/reward-tier-modal.tsx`
- `stores/customerStore.ts`
- `app/purchases.tsx`
- `components/supplier-modal.tsx`
- `components/purchase-form-modal.tsx`
- `stores/purchaseStore.ts`

DO NOT modify files outside your ownership (e.g., do NOT touch `services/database.ts`, `stores/menuStore.ts`, `components/menu-form-modal.tsx`).

## Verification Requirements
Run the test suite:
- `npm test` or `node --test test/**/*.test.ts`
All 28 existing tests must pass with 0 regressions.
If TypeScript typecheck is available, run `npx tsc --noEmit`.
