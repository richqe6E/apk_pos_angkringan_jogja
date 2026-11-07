## 2026-11-07T10:57:34Z
You are worker_m1 for Milestone 1 (Menu Management & Quick Edit Fixes, Category Management Modal).

## 🔒 MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Inputs
1. Working directory: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja
2. Original Request: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\ORIGINAL_REQUEST.md
3. Project Plan & Architecture: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\PROJECT.md
4. Explorer Survey Report: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\explorer_survey_op_1\handoff.md
5. State folder: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\worker_m1

## Scope & Assigned Tasks (Milestone 1)
Fix R1 & R2 (Menu part):
1. **Permanent Default Menu Deletion**:
   - In `services/database.ts`: Check `settings` table key `'seed_menus_applied'`. Only run `INSERT OR IGNORE INTO menus` if `seed_menus_applied` is not `'1'`. After seeding, set `seed_menus_applied = '1'`. Execute `PRAGMA user_version = 1;` explicitly outside the multi-statement string via `db.runAsync(...)`.
   - In `stores/menuStore.ts`: In `deleteMenu(db, id)`, before executing `DELETE FROM menus WHERE id = ?`, handle transaction item references (e.g. `UPDATE transaction_items SET menu_id = NULL WHERE menu_id = ?` or ensure safe detachment so historical sales records keep menu_name & price, avoiding foreign key constraint failure).
2. **Tambah Menu Form Persistence**:
   - In `components/menu-form-modal.tsx`: Fix `useEffect` dependency array so it doesn't wipe filled form data when `categories` updates (e.g., when a new category is added). Only reset fields when `visible` transitions from false to true for a new item. Keep user inputs intact.
3. **Edit Menu Form Data & Null Category**:
   - In `stores/menuStore.ts`: Refactor `updateMenu` so that passing `category_id: null` successfully sets `category_id = NULL` in SQLite without being blocked by `COALESCE(?, category_id)`.
   - In `components/menu-form-modal.tsx`: Preserve existing image path without unnecessary duplicate file copying in `saveImageLocally`.
4. **Quick Edit Menu Full Form Layout Fix**:
   - In `components/menu-form-modal.tsx`: Fix the modal layout collapse. Give `modalBox` an explicit height (e.g., `height: 540` or `height: '85%'`, with `maxHeight: '90%'`) so that `<ScrollView style={styles.body}>` with `flex: 1` does NOT collapse to 0 height. Ensure all inputs (name, price, category pills, stock stepper, barcode, photo) are fully visible and scrollable on Quick Edit (long-press from cashier screen). Wrap in `KeyboardAvoidingView`.
5. **Modul Menu: Tombol Kategori & Category Management**:
   - In `stores/menuStore.ts`: Add `updateCategory(db, id, name)`.
   - In `components/category-form-modal.tsx` (or `category-management-modal.tsx`): Create a full category management modal displaying list of categories, product count per category, ability to add a new category with duplicate validation, edit/rename a category, and delete a category with confirmation.
   - In `app/(tabs)/explore.tsx`: Wire the "+ Kategori" / "Kategori" header button to open this comprehensive category management modal.

## Exclusive File Ownership
You have exclusive write ownership of:
- `services/database.ts`
- `stores/menuStore.ts`
- `components/menu-form-modal.tsx`
- `components/category-form-modal.tsx` (and/or `components/category-management-modal.tsx`)
- `app/(tabs)/explore.tsx`

DO NOT modify files outside your ownership.

## Verification Requirements
Run the test suite:
- `npm test` or `node --test test/**/*.test.ts`
All 28 existing tests must pass with 0 regressions.
If TypeScript typecheck is available, run `npx tsc --noEmit`.
