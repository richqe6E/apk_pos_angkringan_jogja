## 2026-11-07T11:32:25Z
You are worker_m4 for Milestone 4 (Cashier Identity - Requirement R5, and Calendar Attendance Recap - Requirement R6).

## 🔒 MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Inputs
1. Working directory: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja
2. Original Request: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\ORIGINAL_REQUEST.md
3. Project Plan & Architecture: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\PROJECT.md
4. Explorer Survey Report 3 (Sections 1.2, 1.3, 2.1, 2.2, 4.1, 4.2): d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\explorer_survey_op_3\handoff.md
5. State folder: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\worker_m4

## Scope & Assigned Tasks (Milestone 4 - Requirements R5 & R6)

### 1. Pemilihan Identitas Kasir (Requirement R5)
- **Store Updates (`stores/transactionStore.ts`)**:
  - Add state properties:
    - `activeCashierId: number | null`
    - `activeCashierName: string` (default: `''`)
    - `setActiveCashier: (id: number | null, name: string) => void`
  - In `saveAsPendingOrder()`:
    - Include `cashier_name` in the SQL `INSERT INTO transactions (..., cashier_name)` query, passing `get().activeCashierName || 'Kasir'`.
  - In `checkout()`:
    - Direct payment insert: Include `cashier_name` in `INSERT INTO transactions`, passing `get().activeCashierName || 'Kasir'`.
    - Pending settlement update: Include `cashier_name = ?` in `UPDATE transactions SET ...`, passing `get().activeCashierName || 'Kasir'`.
- **Component Modal (`components/cashier-selector-modal.tsx`)**:
  - Create dedicated modal displaying list of registered active employees (`employees.filter(e => e.is_active === 1)`).
  - Search/filter input by employee name.
  - Tapping an employee sets active cashier (`setActiveCashier(emp.id, emp.name)`) and closes modal.
  - Include option to enter/confirm without closing if employees list is empty (fallback).
- **Cashier Screen Integration (`app/transaksi.tsx`)**:
  - Automatically prompt `CashierSelectorModal` on screen mount if `!activeCashierName`.
  - Add a visible interactive cashier badge/button in the top header bar (e.g. `👤 Kasir: [activeCashierName || 'Pilih Kasir'] ▾`) so cashiers can switch identity anytime during shifts.
  - In `handleDirectCheckout` and `handleSaveAsPending`, ensure `receiptPayload.cashierName` and `tempBillPayload.cashierName` pass `activeCashierName || 'Kasir'`.
- **Receipt Printing & Audit Slips (`services/print.ts` & `components/receipt-preview-modal.tsx`)**:
  - Ensure customer receipt and internal cashier audit receipt formatters clearly display the active cashier name (`Kasir    : ${data.cashierName || 'Kasir'}`).

### 2. Tampilan Rekap Absensi Berbasis Kalender (Requirement R6)
- **Interactive Calendar Grid (`app/(tabs)/attendance.tsx`)**:
  - Replace the plain flat list in `renderHistoryTab()` with an interactive monthly calendar view.
  - Month navigation bar: Previous Month (`◀`), Current Month Label (e.g. `November 2026`), Next Month (`▶`), and button `Bulan Ini`.
  - Pure React Native & JavaScript Date math (zero external packages):
    - Compute days in month and day-of-week offset (Min, Sen, Sel, Rab, Kam, Jum, Sab).
    - Grid layout displaying day cells (1..daysInMonth).
    - In each day cell: Date number, presence indicators (e.g. dot or badge if staff present, amber if any late, clear if no attendance).
    - Active cell styling: Emerald background and white text when date equals `selectedDate`.
  - **Date Breakdown View (`selectedDate`)**:
    - Below the calendar grid, render the attendance detail view for the selected date:
      - Header: `📅 Rincian Absensi: [Sabtu, 07 November 2026]`.
      - Summary metric chips: Total Hadir, Tepat Waktu, Terlambat.
      - List of employee attendance cards on that date: Check-in photo thumbnail (tappable to view enlarged modal), Employee Name, Check-in Time, Check-out Time, Status badge (`Tepat Waktu` / `Terlambat X Menit`).
      - Friendly empty state when no attendance is recorded on that date.
      - Action buttons: "Unduh PDF (Hari Ini)", "Unduh CSV", "Bersihkan Foto".

## Exclusive File Ownership
You have exclusive write ownership of:
- `stores/transactionStore.ts`
- `components/cashier-selector-modal.tsx`
- `app/transaksi.tsx`
- `services/print.ts`
- `components/receipt-preview-modal.tsx`
- `app/(tabs)/attendance.tsx`

DO NOT touch files owned by other milestones.

## Verification Requirements
Run the test suite:
- `npm test` or `node --test test/**/*.test.ts`
All 28 existing tests must pass with 0 regressions.
If TypeScript typecheck is available, run `npx tsc --noEmit`.

## Output
When complete, write your handoff report to:
`d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\worker_m4\handoff.md`
and notify orchestrator via `send_message`.
