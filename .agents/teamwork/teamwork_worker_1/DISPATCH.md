## 2026-11-07T11:34:13Z
You are Worker 1 (Full-Stack Implementation Specialist) for POS Angkringan Jogja.
Your state folder: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_worker_1\
Original request path: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\ORIGINAL_REQUEST.md
Project plan path: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\PROJECT.md
Domain skill path: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\skills\ponytail\SKILL.md

Reference Explorer Analysis Reports:
- Explorer 1 (UI & Components): d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_explorer_survey_1\analysis.md
- Explorer 2 (Tests & Quality): d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_explorer_survey_2\analysis.md
- Explorer 3 (Data & Models): d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_explorer_survey_3\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

SCOPE & IMPLEMENTATION INSTRUCTIONS:
Follow Ponytail principles: the smallest complete change that fully solves the task without bloat or regressions.

1. R1: Menu Management & Quick Edit
   - In `services/database.ts`:
     * In `migrateDbIfNeeded`: Ensure `is_active` column exists on `menus` (`ALTER TABLE menus ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`).
     * Fix seed menus logic: Ensure seed items are only inserted once on fresh database setup, guarded by a setting flag (e.g. `seed_menus_applied = '1'`) or checking if any menu ever existed, so that deleted default menus (IDs 1..16) are NEVER re-seeded when the app restarts.
     * Ensure `PRAGMA user_version = 1;` is executed cleanly as a separate statement.
   - In `stores/menuStore.ts`:
     * Update `deleteMenu`: Perform soft delete `UPDATE menus SET is_active = 0 WHERE id = ?` so that menus with sales history in `transaction_items` do not trigger foreign key errors.
     * Update `loadMenus`: Filter `SELECT * FROM menus WHERE is_active = 1 ORDER BY name ASC`.
     * Ensure `quickEditMenu(db, id, price, stock, name)` works and refreshes menu list.
   - In `components/menu-form-modal.tsx`:
     * Fix `useEffect` dependency array: Remove `categories` from dependency array so typing menu name or price is not wiped out when categories update.
     * Expose stock input clearly: Ensure stock input field and stepper controls are visible and editable (not hidden when `track_stock = 0`).
   - In `app/transaksi.tsx`:
     * On menu item long press (`onLongPress`), open an intuitive quick edit modal allowing the user to update price, update stock, click "Simpan", or click "Hapus Menu" (calling `deleteMenu`).

2. R2: Top-Right Action Buttons
   - In `components/monthly-cogs-modal.tsx`:
     * Fix critical syntax error at line 156 (remove stray closing brace `}`).
   - Verify action buttons:
     * Menu module (`app/(tabs)/explore.tsx`): Category button opens `CategoryFormModal`. Ensure categories can be added and viewed.
     * Riwayat module (`app/(tabs)/history.tsx`): 'Unduh PDF' and 'Unduh CSV' buttons work with `services/export.ts` and `services/backup.ts`.
     * Absensi module (`app/(tabs)/attendance.tsx`): 'Tambah Karyawan' button opens `EmployeeModal` and saves.
     * Keuangan module (`app/(tabs)/financial.tsx`): 'HPP Global' button opens `MonthlyCogsModal` smoothly without syntax error.
     * Customer module (`app/customers.tsx`): 'Atur Tingkatan Reward' button opens `RewardTierModal`. Ensure it calls `loadRewardTiers(db)` in `useEffect` when visible.
     * Supplier module (`app/purchases.tsx`): 'Supplier Baru' button opens `SupplierModal` and saves.

3. R4: Dynamic Table Management & Cashier Table Integration
   - In `components/table-selector-modal.tsx`:
     * Eliminate hardcoded static array as permanent constraint. Use dynamic storage in `settings` (`key = 'custom_tables'`) with fallback to initial defaults.
     * Implement full dynamic table management: Add new table (name, number, type), Edit table name, Edit table number, and Delete table (with protection against deleting tables with active pending/billing transactions).
     * Synchronize pending transactions atomically if table name/number is edited.
     * In `app/transaksi.tsx`: Ensure cashier table selector uses these dynamic tables seamlessly.

4. R5: Cashier Identity Selection & Struk Integration
   - In `stores/transactionStore.ts`:
     * Add `activeCashier: string` to store state and action `setActiveCashier(name: string)`.
     * In `saveAsPendingOrder` and `checkout`: Include `cashier_name` in the SQL `INSERT INTO transactions (..., cashier_name) VALUES (..., ?)`.
   - In `app/transaksi.tsx`:
     * Enforce cashier selection before transactions begin: If `activeCashier` is empty, present a clean cashier selection dialog from registered active employees (`employees WHERE is_active = 1`).
     * Display current active cashier badge in header with option to switch cashier.
     * Pass active cashier name to `cashierName` in `PrintReceiptData` for customer receipts, temporary bills, and audit shift receipts.
   - In `services/print.ts`:
     * Verify that customer receipt, temporary bill, and shift audit receipt print the actual `cashierName`.

5. R6: Customer & Supplier Transaction Forms
   - Customer module (`components/reward-tier-modal.tsx`): Ensure form opens, inputs for min spend and reward description work, and saves to `rewards` table.
   - Supplier module (`components/purchase-form-modal.tsx`): Ensure form opens, records purchased items and supplier, and integrates with `cash_ledger` (if cash expense) or tracks as tempo debt in supplier book.

6. R7: Interactive Attendance Calendar
   - In `app/(tabs)/attendance.tsx`:
     * In `renderHistoryTab`, implement an interactive monthly calendar matrix:
       - Month switcher (`◀ [ Bulan Tahun ] ▶`).
       - 7-column day headers (Sen, Sel, Rab, Kam, Jum, Sab, Min).
       - Days grid displaying day numbers (1..31) with visual attendance indicators (e.g. green dot for present on time, orange dot for late).
       - Highlight selected date.
       - Below calendar, render detailed list of employee attendance records for that selected date (showing employee name, check-in time, check-out time, status, photo thumbnail if available).

7. R8: QRIS & Bank Transfer Payment Methods
   - In `components/payment-modal.tsx`:
     * Replace static placeholder emoji at lines 354-364:
       - For QRIS: Render the store's QRIS image loaded from `qris_image_path` (with fallback message to set QRIS photo in Settings if not yet uploaded).
       - For Transfer: Render the list of bank accounts loaded from `bank_accounts` (JSON) as clean selectable cards showing Bank Name, Account Number, and Account Holder, with a one-tap Copy button.

8. Test Suite Alignment & Operational Test Suite (Tier 6)
   - In `test/helpers/db.js`:
     * Align line 82: Change `menu_id INTEGER NOT NULL REFERENCES menus(id)` to allow `ON DELETE SET NULL` or match `services/database.ts:137`.
   - Create `test/tier6-operational-enhancements.test.ts`:
     * Write automated tests using `node:test` and `node:assert/strict` covering:
       - T6.1: Menu soft-delete with existing transaction history & seed protection.
       - T6.2: Quick edit price/stock persistence.
       - T6.3: Dynamic table JSON parsing, add/edit/delete validation & pending sync.
       - T6.4: Active cashier name recorded on transactions and receipt formatter.
       - T6.5: Supplier purchase cash ledger vs tempo debt integration.
       - T6.6: Multi-bank account JSON parsing and validation.
       - T6.7: Attendance business_date calendar mapping and daily filtering.
   - Run the test suite:
     * Run `npm test` and verify that all tests (Tiers 1 through 6) pass with 100% success rate and 0 failures!

9. Reporting
   - Write comprehensive implementation report to:
     `d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_worker_1\changes.md`
   - Write summary handoff report to:
     `d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_worker_1\handoff.md`

Send a message when done with the file path.
