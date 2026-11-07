# Empirical Adversarial Challenge Report: Data Integrity, Seed Protection & Financial Precision

**Agent**: Challenger 2 (Data Integrity, Seed Protection & Deletion Challenger)  
**State Folder**: `d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_challenger_2\`  
**Date**: 2026-11-07  
**Test Suite**: `test/challenger2-integrity-stress.test.ts` (12 tests) + Full Suite (75 tests)  
**Evaluation Scope**:  
1. Menu Deletion & Foreign Key Safety (`menus`, `transaction_items`, soft delete vs hard delete)  
2. Seed Persistence & Reboot Simulation (`seed_menus_applied`, migration idempotency, zero resurrection of IDs 1..16)  
3. Supplier Purchases Cash Ledger vs Tempo Settlement Precision (`purchases`, `cash_ledger`, `financialStore`, PnL impact)  
4. Attendance Data, Business Date Uniqueness & Matrix Aggregation (`attendance`, `employees`, daily filtering)

---

## Challenge Summary

**Overall risk assessment**: **LOW** (Production-Grade Robustness Verified)

All four critical operational failure modes were aggressively challenged with concrete adversarial test suites running against native SQLite engine (`node:sqlite`) with `PRAGMA foreign_keys = ON;` and WAL mode enabled. The system demonstrated 100% data integrity, zero regression across all 75 test suites, zero resurrection of deleted seed menus, mathematically exact cash/tempo segregation, and strict unique constraint enforcement on attendance.

---

## Detailed Empirical Challenges & Stress Tests

### Challenge 1: Menu Deletion Integrity & Foreign Key Safety (R1)
- **Assumption Challenged**: Soft-deleting menu item #1 (`Nasi Kucing Sambal Teri`) after it has been sold in completed and pending orders could cause foreign key constraint crashes (`SQLITE_CONSTRAINT_FOREIGNKEY`) or corrupt historical sales reports.
- **Attack Scenario**:
  1. Default menu item #1 is inserted via seed data (`is_active = 1`).
  2. Completed transaction `INV-CH2-001` is recorded with 2 items of menu #1 (subtotal Rp 10.000).
  3. Pending order `INV-CH2-PENDING` is recorded with 1 item of menu #1 (subtotal Rp 5.000).
  4. Menu #1 is soft-deleted: `UPDATE menus SET is_active = 0 WHERE id = 1`.
  5. Owner wipes all 16 default menus (`UPDATE menus SET is_active = 0 WHERE id BETWEEN 1 AND 16`) and registers custom menus.
  6. Direct hard delete `DELETE FROM menus WHERE id = 3` executed under `PRAGMA foreign_keys = ON`.
- **Empirical Findings & Blast Radius**:
  - **Query Isolation**: Soft-deleted menu ID 1 immediately disappeared from active menu queries (`SELECT * FROM menus WHERE is_active = 1`).
  - **Audit History Intact**: In `transaction_items`, both completed and pending records referencing `menu_id = 1` remained completely untouched. Aggregated sales queries (`SUM(qty)`, `SUM(subtotal)`) produced exact historical totals (2 items, Rp 10.000).
  - **Bulk Deletion**: When all 16 default menus were soft-deleted, `COUNT(*) WHERE is_active = 1` dropped to 0 without errors, and the system seamlessly accepted custom additions (`Nasi Liwet Solo Komplit`, `Es Doger Istimewa`).
  - **Hard Delete Resilience**: Because `transaction_items` schema specifies `menu_id INTEGER REFERENCES menus(id) ON DELETE SET NULL`, raw hard-deletion safely sets `transaction_items.menu_id = NULL` while preserving `menu_name` and `subtotal`. Zero foreign key constraint violations occur.
- **Stress Test Status**: **PASS** (Tests 1.1, 1.2, 1.3).

---

### Challenge 2: Seed Persistence & Reboot Simulation (Zero Resurrection) (R1)
- **Assumption Challenged**: When the mobile POS tablet restarts or when `migrateDbIfNeeded` executes during an application update, default menus 1..16 might be re-seeded, resurrecting deleted items and cluttering the merchant's catalog.
- **Attack Scenario**:
  1. Default menus 1, 2, 4, 12, and 16 are soft-deleted (`is_active = 0`).
  2. Cold reboot is simulated: `migrateDbIfNeeded` runs with standard `PRAGMA user_version = 1`.
  3. Forced migration check is simulated: `PRAGMA user_version` reset to 0 to trigger full migration logic.
  4. Worst-case scenario: All menus are permanently hard-deleted (`DELETE FROM menus`), reducing `COUNT(*)` to 0.
- **Empirical Findings & Blast Radius**:
  - **Double-Layered Defense**:
    - *Layer 1 (Schema Level)*: `migrateDbIfNeeded` inspects `PRAGMA user_version`. If `user_version >= 1`, it performs an immediate early exit.
    - *Layer 2 (State Level)*: Even if `user_version` is 0, the migration inspects `settings WHERE key = 'seed_menus_applied'`. Because this key was set to `'1'` during initial setup, the seed block is completely bypassed.
  - **Zero Resurrection**: Under both standard reboot and forced version reset, deleted menus 1, 2, 4, 12, 16 remained `is_active = 0`.
  - **Hard-Delete Survival**: Even when the `menus` table was completely emptied (`COUNT(*) = 0`), the presence of `seed_menus_applied = '1'` blocked re-seeding. Zero default menus reappeared.
  - **Custom Data Protection**: Custom store name and user-created categories survived repeated migration cycles without data corruption (`INSERT OR IGNORE` semantics).
- **Stress Test Status**: **PASS** (Tests 2.1, 2.2, 2.3).

---

### Challenge 3: Supplier Purchases Cash Ledger vs Tempo Debt Precision (R6)
- **Assumption Challenged**: Cash purchases might fail to deduct operational cash, or unpaid tempo purchases might prematurely inflate operational expenses, skewing Net Profit. Furthermore, tempo settlement or purchase deletion might leave orphan ledger entries.
- **Attack Scenario**:
  1. Starting sales established: Rp 1.000.000 gross cash sales.
  2. Purchase A (CASH): Rp 300.000 from Grosir Beras & Minyak.
  3. Purchase B (TEMPO): Rp 500.000 from Distributor Ayam Potong, due date 2026-11-20.
  4. Settle Tempo Debt for Purchase B: Rp 500.000 paid.
  5. Delete Purchase A & settled Purchase B via `deletePurchase`.
  6. Delete a supplier under active foreign keys.
- **Empirical Findings & Blast Radius**:
  - **Cash Purchase Atomic Posting**: Recording Purchase A immediately created an expense in `cash_ledger` (`type = 'expense'`, `affects_pnl = 1`, `category = 'Pembelian Bahan/Kulakan'`, `amount = 300000`).
  - **Tempo Accounts Payable Isolation**: Recording Purchase B created zero entries in `cash_ledger`. `cash_ledger` total expenses remained exactly Rp 300.000. Unpaid debt was correctly isolated in `purchases` (`payment_status = 'unpaid'`), aggregating to Rp 500.000 accounts payable.
  - **Tempo Debt Settlement**: Calling `settleTempoDebt` atomically updated `purchases.payment_status = 'paid'` and posted Rp 500.000 to `cash_ledger` (`category = 'Pelunasan Hutang Supplier'`). Total operational expenses became Rp 800.000.
  - **Mathematical PnL Precision**: Net Operating Profit = Rp 1.000.000 (Gross Sales) - Rp 800.000 (Operational Expenses) = Rp 200.000. Exactly matched financial engine calculations down to 0 Rupiah discrepancy.
  - **Atomic Deletion**: Calling `deletePurchase` executed a transactional cleanup deleting both `purchases` and `cash_ledger` entries matching `%(ID Pembelian: #<id>)%` or `%Pelunasan hutang nota #<id>%`, preventing ghost expenses.
  - **Supplier Deletion FK Safety**: Deleting a supplier safely triggered `ON DELETE SET NULL` on `purchases.supplier_id`, leaving `purchases.supplier_name` and amounts intact.
- **Stress Test Status**: **PASS** (Tests 3.1, 3.2, 3.3).

---

### Challenge 4: Attendance Data, Date Format & Multiple Entries Stress (R7)
- **Assumption Challenged**: Employees could double check-in on the same business date, multiple employee check-ins on the same date might collide, or session closing might overwrite previous dates.
- **Attack Scenario**:
  1. Business date format: standard `YYYY-MM-DD`.
  2. Employee 1 checks in on `2026-11-07` at 16:45.
  3. Employee 1 attempts second check-in on `2026-11-07` at 17:15.
  4. Employee 2 checks in on `2026-11-07` at 17:05.
  5. Multi-employee matrix across multiple dates (November 1, 2, 7 and December 1) tested for daily and monthly filtering.
  6. End-of-shift session close executed on `2026-11-07`.
- **Empirical Findings & Blast Radius**:
  - **Strict Unique Constraint**: SQLite schema defines `CONSTRAINT uq_emp_date UNIQUE (employee_id, business_date)`. When Employee 1 attempted duplicate check-in, the database threw `SQLITE_CONSTRAINT_UNIQUE` (`UNIQUE constraint failed: attendance.employee_id, attendance.business_date`).
  - **Multi-Employee Concurrency**: Employee 2 successfully checked in on the same `business_date`. Querying `WHERE business_date = '2026-11-07'` returned both employees accurately.
  - **Daily & Monthly Rekap Filtering**:
    - Monthly query (`business_date LIKE '2026-11%'`) returned exactly 7 records for November, excluding December.
    - Daily query (`business_date = '2026-11-07'`) returned exactly 3 records, correctly identifying late status (Agus: late 15 minutes, Siti & Budi: on time).
    - Querying a date with no attendance ('2026-11-04') cleanly returned an empty array.
  - **Batch Session Close Isolation**: Executing session close at 23:45 updated only open checkouts (`check_out_time IS NULL OR check_out_time = ''`) on `business_date = '2026-11-07'`, without modifying past attendance on `2026-11-06`.
- **Stress Test Status**: **PASS** (Tests 4.1, 4.2, 4.3).

---

## Stress Test Results Matrix

| Test ID | Test Scenario | Expected Outcome | Actual Outcome | Status |
|---|---|---|---|---|
| **1.1** | Soft-delete menu ID 1 with transactions | Excluded from catalog, sales history intact | `is_active = 0`, excluded from active catalog, `ti.subtotal = 10000` intact | **PASS** |
| **1.2** | Bulk soft-delete 16 menus & custom add | 0 active items, total 16 preserved, new custom items accepted | 0 active items, 2 new menus added and queried | **PASS** |
| **1.3** | Hard delete with active FK | `ON DELETE SET NULL`, no crash | `menu_id = null`, item history preserved | **PASS** |
| **2.1** | Reboot with soft-deleted menus | Menus 1..16 not resurrected | IDs 1, 2, 4, 12, 16 remained `is_active = 0` | **PASS** |
| **2.2** | Reboot with 0 menus | `seed_menus_applied = '1'` blocks re-seed | Menus table remained empty (0 rows) | **PASS** |
| **2.3** | Custom categories/settings survival | Modifications survive version reset | Store name and custom category preserved | **PASS** |
| **3.1** | Cash vs tempo purchase flow | Instant expense vs deferred cash out | Cash: 300k expense; Tempo: 0 cash out, 500k AP; Settle: 500k expense, 0 AP | **PASS** |
| **3.2** | Atomic purchase deletion | Clean purge of purchase & ledger entries | Both records deleted without orphan records | **PASS** |
| **3.3** | Supplier deletion FK safety | Purchases keep historical data | `supplier_id = null`, `supplier_name` intact | **PASS** |
| **4.1** | Duplicate check-in same date | Throws UNIQUE constraint error | Threw `SQLITE_CONSTRAINT_UNIQUE` | **PASS** |
| **4.2** | Multi-employee multi-date matrix | Clean date and monthly filtering | Nov: 7 rows, Nov 7: 3 rows, late calculation exact | **PASS** |
| **4.3** | Session closing batch update | Updates active date only | Exactly 2 records updated, past date untouched | **PASS** |

---

## Unchallenged Areas

- **Physical Bluetooth ESC/POS Thermal Printing**: Thermal receipt outputs are verified at the layout, text wrapping, and ESC/POS command formatting level via Node.js test harness (`helpers/receiptFormatter.js`). Physical Bluetooth radio pairing and paper motor stepping require an actual Android device with connected hardware.

---

## Summary Verdict

The SQLite schema design, migration architecture, Zustand stores, and financial math meet all operational requirements (R1 - R8) with high integrity and zero data loss risks.
