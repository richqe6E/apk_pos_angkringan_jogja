## 2026-11-07T10:59:22Z

You are worker_m3 for Milestone 3 (Dynamic Table Management - Requirement R4).

## 🔒 MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Inputs
1. Working directory: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja
2. Original Request: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\ORIGINAL_REQUEST.md
3. Project Plan & Architecture: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\PROJECT.md
4. Explorer Survey Report 2 (Section 1.3 & 2.3 Dynamic Tables): d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\explorer_survey_op_2\handoff.md
5. State folder: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\worker_m3

## Scope & Assigned Tasks (Milestone 3 - Requirement R4: Pengelolaan Meja Dinamis)
1. **Dynamic Tables Storage & Management**:
   - Store dynamic tables in SQLite `settings` table under key `'custom_tables'` as a JSON array string:
     ```json
     [
       {"id": "t1", "name": "Meja 01", "type": "meja"},
       {"id": "t2", "name": "Lesehan 01", "type": "lesehan"},
       ...
     ]
     ```
     Fallback to the existing default preset tables if `'custom_tables'` is empty or not yet set.
   - In `components/table-selector-modal.tsx`:
     - Load dynamic tables from SQLite `settings` table asynchronously on open.
     - Add interactive controls for table management:
       - "+ Tambah Meja": Modal/dialog to input new table name (e.g., "Meja 11", "Lesehan 06", "Gazebo VIP") with duplicate name validation.
       - "Edit Meja": Ability to edit/rename an existing table name. When a table name is renamed, automatically update any active pending orders (`UPDATE transactions SET table_number = ? WHERE table_number = ? AND status IN ('pending', 'billing')`) so that pending orders remain linked.
       - "Hapus Meja": Ability to remove a table. Prevent deleting a table that currently has an active pending/billing order (`unpaid transactions`).
2. **Integration with Cashier & Pending Transactions**:
   - The dynamic tables must seamlessly render in the table grid (Tab Semua, Tab Meja Reguler, Tab Lesehan, Tab Terisi / Billing).
   - Selecting a dynamic table correctly associates it with orders in cashier and pending order mechanics.

## Exclusive File Ownership
You have exclusive write ownership of:
- `components/table-selector-modal.tsx`
- (and optionally a helper modal if created, e.g. `components/table-crud-modal.tsx`)

DO NOT modify files owned by other workers (do NOT touch `services/database.ts`, `stores/menuStore.ts`, `stores/transactionStore.ts`, `app/transaksi.tsx`).

## Verification Requirements
Run the test suite:
- `npm test` or `node --test test/**/*.test.ts`
All 28 existing tests must pass with 0 regressions.
If TypeScript typecheck is available, run `npx tsc --noEmit`.

## Output
When complete, write your handoff report to:
`d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\worker_m3\handoff.md`
and notify orchestrator via `send_message`.
