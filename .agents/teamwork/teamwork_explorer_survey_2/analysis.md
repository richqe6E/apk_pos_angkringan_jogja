# Comprehensive Technical Analysis: Test Suite, Quality Audit & Testing Recommendations (R1-R8)
**Investigator**: Explorer 2 (Test Suite & Quality Explorer)  
**Date**: 2026-11-07  
**Workspace**: `d:\apk pos angkringan jogja\apk_pos_angkringan_jogja`  
**Reference Request**: `ORIGINAL_REQUEST.md` (Requirements R1 through R8)

---

## 1. Executive Summary

A comprehensive investigation of the build and testing architecture of **POS Angkringan Jogja (Pure Android)** was conducted. The application utilizes **React Native 0.81 / Expo 54 (SDK 54) / Zustand 5 / Expo SQLite 16** for the production mobile runtime, and an exceptionally lean, zero-external-dependency automated test harness built directly upon **Node.js v24 native features** (`node:test`, `node:assert`, and `node:sqlite` via `DatabaseSync`).

### Baseline Test Suite Status
- **Test Command**: `npm test` (`node --test test/**/*.test.ts`)
- **Total Test Suites**: 5 test suites (Tiers 1 through 5)
- **Total Test Cases**: **28 tests**
- **Pass Rate**: **100% PASS (28 passed, 0 failed, 0 skipped, 0 cancelled)**
- **Execution Duration**: **~3.25 seconds**
- **Typecheck Script**: `npm run typecheck` (`tsc --noEmit`) currently fails because local `node_modules` is not installed in the workspace root (`'tsc' is not recognized as an internal or external command`). However, the test runner itself requires **zero external node_modules** to execute.

---

## 2. Test Suite Architecture & Existing Coverage

### 2.1 Harness Architecture
The testing harness bypasses mobile emulator and React Native bundling overhead by running tests directly in native Node.js v24. This provides sub-second database operations and instant regression feedback without mocking overhead.

```
test/
├── helpers/
│   ├── db.js & db.d.ts                  # In-memory SQLite engine (15-table relational schema & seed data)
│   ├── financialEngine.js & .d.ts      # Net profit & PnL calculation with anti-double-counting logic
│   ├── transactionEngine.js & .d.ts    # Transaction lifecycle, pending tables, merge, delta items, checkout
│   ├── receiptFormatter.js & .d.ts     # 58mm thermal ESC/POS text layout formatter for customer, kitchen & bill
│   └── photoCleanup.js & .d.ts         # In-memory storage simulator for monthly attendance photo purges
├── tier1-features.test.ts              # 7 Unit tests: Core features (Gross sales, anti-double-count, photo purge)
├── tier2-boundary.test.ts              # 4 Unit tests: Boundary cases (Table merge deduplication, PB1 tax, discounts)
├── tier3-cross-feature.test.ts         # 3 Integration tests: Cross-feature combinations (Merge + QRIS, delta kitchen)
├── tier4-scenarios.test.ts             # 1 E2E test: 13-step comprehensive cashier shift simulation
└── tier5-adversarial.test.ts           # 13 Stress & Hardening tests: 4-table merge, high volume, emoji formatting
```

### 2.2 Coverage Matrix of Existing Suites

| Test Suite | Focus Area | Test Count | Key Invariants Verified |
|---|---|:---:|---|
| **Tier 1: Feature Coverage** (`tier1-features.test.ts`) | Financial calculation, Cash ledger, Receipts, DB transactions, Photo cleanup | 7 | - Gross sales aggregates only `'completed'` status in target month.<br>- `penjualan_tunai` in `cash_ledger` is excluded from `operIncome` to prevent double-counting.<br>- Non-PnL entries (`affects_pnl = 0`, modal awal, prive) do not alter net profit.<br>- Atomic commit and rollback verified with `withTransactionAsync`.<br>- Attendance photo cleanup deletes physical files and zeroes DB paths. |
| **Tier 2: Boundary & Corner Cases** (`tier2-boundary.test.ts`) | Table merge, tax calculation, delta ordering | 4 | - Table merge deduplicates identical `menu_id` items into a single row, summing quantity and subtotal.<br>- Discounts from merged tables are consolidated.<br>- PB1 tax (10%) is recalculated on merged subtotal.<br>- Extreme discount exceeding total clamps total to 0 (never negative).<br>- Additional items on pending order are flagged with `is_additional = 1`. |
| **Tier 3: Cross-Feature Combinations** (`tier3-cross-feature.test.ts`) | Table merge + payment + kitchen ticketing | 3 | - Table merge + delta order + QRIS/Transfer checkout does not contaminate cash ledger.<br>- Initial kitchen ticket suppresses prices/Rp; delta kitchen ticket only prints `[ +qty ] (BARU)` items.<br>- Temporary bill prints watermark `BUKAN BUKTI PEMBAYARAN SAH`.<br>- Stock tracking decrements upon final checkout, not during pending status. |
| **Tier 4: Cashier Shift Scenarios** (`tier4-scenarios.test.ts`) | End-to-end full shift lifecycle | 1 | - 13-step operational simulation: opening shift, cash float, walk-in cash sale, pending tables, delta order, table merge, transfer payment, operational expense, operational income, owner prive, monthly COGS, cash drawer balance reconciliation, shift closing. |
| **Tier 5: Adversarial Hardening** (`tier5-adversarial.test.ts`) | Multi-table stress, volume reconciliation, edge cases | 13 | - Merging 4 simultaneous tables with overlapping and distinct items.<br>- Odd subtotal PB1 precision with custom rates (11% PPN).<br>- Empty cart / zero-item checkout safety.<br>- 3 rapid successive additional orders.<br>- High-volume (120 completed transactions) financial reconciliation & cash drawer proof.<br>- Attendance photo cleanup idempotency and date prefix safety.<br>- Unicode emoji and special characters in thermal receipts. |

---

## 3. Ponytail Quality Audit Report

**What this repo does:** An offline-first point-of-sale (POS) application tailored for traditional Yogyakarta Angkringan food stalls, running on pure Android tablets and phones with local SQLite database storage, thermal Bluetooth receipt printing, dynamic tables, employee attendance, and PnL accounting. Load assumed: 1-3 concurrent cashier devices per stall, processing 100-500 orders and table updates per evening shift.

### Findings

#### Group A: Must Fix (Bugs, Schema Drift & Build Health)

1. **Test Helper Schema Divergence on `transaction_items.menu_id`** (`test/helpers/db.js:82` vs `services/database.ts:137`)
   - **What this is:** In `services/database.ts`, `transaction_items.menu_id` is defined as `INTEGER REFERENCES menus(id) ON DELETE SET NULL`. In `test/helpers/db.js`, it is defined as `INTEGER NOT NULL REFERENCES menus(id)`.
   - **Problem:** When implementing R1 (allowing deletion of default or custom menus), deleting a menu with historical transactions will throw a SQLite `FOREIGN KEY constraint failed` error in tests because `NOT NULL` prevents `SET NULL` actions.
   - **Fix:** Align `test/helpers/db.js` line 82 to `menu_id INTEGER REFERENCES menus(id) ON DELETE SET NULL`.
   - **If we skip it:** Automated tests validating R1 menu deletion will fail in the test harness even if the mobile application works correctly.

2. **Node.js Typeless Module Reparsing Overhead** (`package.json`)
   - **What this is:** `package.json` does not include `"type": "module"`.
   - **Problem:** On every `npm test` invocation, Node.js logs `[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type ... is not specified and it doesn't parse as CommonJS. Reparsing as ES module because module syntax was detected.`
   - **Fix:** Add `"type": "module"` to `package.json`.
   - **If we skip it:** Node reparses all imported ES modules on every test run, adding log spam and execution latency.

3. **`npm run typecheck` Fails in CLI Environment** (`package.json:13`)
   - **What this is:** Script `"typecheck": "tsc --noEmit"`.
   - **Problem:** Because `node_modules` is not installed in the workspace root, `tsc` is not recognized, failing with code 1.
   - **Fix:** Document in `TEST_READY.md` that native test suite execution via `npm test` requires only Node.js v24, while `typecheck` requires `npm install` or local typescript binary resolution.

#### Group B: Should Fix (Untested Operational Logic & Risk)

4. **Cashier Identity in `transactions` Hardcoded to Default** (`stores/transactionStore.ts:563, 729`)
   - **What this is:** The `transactions` table has a `cashier_name` column defaulting to `'Kasir'`.
   - **Problem:** In `transactionStore.ts`, neither `saveAsPendingOrder` nor `checkout` updates `cashier_name` with the active operator's identity. All transactions are permanently attributed to the generic string `'Kasir'`, violating R5.
   - **Fix:** Add `activeCashierId` and `activeCashierName` to `useTransactionStore`, require cashier selection before order creation, and persist `cashier_name` into `transactions`.
   - **If we skip it:** Store owners cannot trace transactions, voids, or cash drawers back to individual staff members.

5. **Supplier Purchase Financial Integration Lacks Automated Test** (`stores/purchaseStore.ts:181-194`)
   - **What this is:** Purchases with `payment_type = 'cash'` should immediately write an operational expense entry into `cash_ledger`, while `payment_type = 'tempo'` should only write to `cash_ledger` when `settleTempoDebt()` is invoked.
   - **Problem:** While this logic exists in `purchaseStore.ts`, there is currently no test verifying that tempo purchases do NOT contaminate `cash_ledger`, and that settling them correctly creates a PnL entry.
   - **Fix:** Create a unit test verifying cash vs tempo purchase financial effects.
   - **If we skip it:** Risk of unrecorded cash disbursements or duplicate cash expense entries upon inventory procurement.

6. **Missing Automated Tests for R1-R8 Core Enhancements**
   - **What this is:** New features (menu deletion persistence, dynamic table configuration, reward tier progression, QRIS/multi-bank parsing) are not covered by tests in `test/`.
   - **Problem:** Future edits or refactorings could break dynamic table JSON parsing or menu deletion without test alerts.
   - **Fix:** Introduce `test/tier6-operational-enhancements.test.ts`.

#### Group C: Nice to Have (Lean & Cleanup)

7. **Double Calculation of Cart Subtotals in State Getters** (`stores/transactionStore.ts:126-142`)
   - **What this is:** `getSubtotal()`, `getTaxAmount()`, and `getTotal()` repeatedly iterate over the `cart` array on every render or state inspection.
   - **Problem:** For carts with many items, computing this repeatedly is slightly inefficient.
   - **Fix:** Cache `subtotal` and `total` directly on `cart` state updates.

### Ponytail Audit Verdict
**Verdict**: Very healthy core foundation. Financial math and transaction concurrency are rock-solid (28/28 tests passing). Primary fixes required: align test helper DB schema with production, add `"type": "module"` to `package.json`, and implement Tier 6 test suite to cover requirements R1 through R8.

---

## 4. Testing Recommendations for R1 through R8

To ensure complete coverage of the operational requirements without bloating the codebase, a new test suite **`test/tier6-operational-enhancements.test.ts`** should be implemented, using the existing zero-dependency Node.js test infrastructure.

### Detailed Test Specifications for R1-R8:

#### 1. R1: Menu Deletion Persistence & Category Unlinking
- **Test 1.1 — Permanent Deletion of Default Menu**:
  - Insert initial menu and set `seed_menus_applied = '1'`.
  - Simulate deleting menu `id: 1` (`Nasi Kucing Sambal Teri`).
  - Verify menu is gone from `menus`.
  - Simulate app restart / migration re-run (`seed_menus_applied === '1'`).
  - Assert that deleted menu `id: 1` is NOT re-inserted into database.
- **Test 1.2 — Historical Transaction Integrity on Menu Deletion**:
  - Create transaction containing menu `id: 2`.
  - Delete menu `id: 2` from `menus`.
  - Assert that `DELETE FROM menus WHERE id = 2` succeeds without FOREIGN KEY violation.
  - Assert that `transaction_items` retains `menu_name` and historical `subtotal`, while `menu_id` becomes `NULL`.
- **Test 1.3 — Menu Update with Category Cleared (`category_id = NULL`)**:
  - Update a menu having `category_id = 1` to `category_id = null`.
  - Assert that `menus.category_id` is updated to `NULL` (verifying dynamic fields fix over COALESCE).

#### 2. R2: Category Deletion Unlinking
- **Test 2.1 — Category Deletion Sets Menu Category to NULL**:
  - Associate 3 menus with category `id: 5` (`Camilan`).
  - Delete category `id: 5`.
  - Assert category is removed from `categories`.
  - Assert all 3 menus remain in `menus` with `category_id = NULL` (no orphaned cascade deletions).

#### 3. R4: Dynamic Table Management & Pending Order Integrity
- **Test 4.1 — Dynamic Table JSON Serialization & Parsing**:
  - Test `parseCustomTables()` with: null string, valid JSON array of objects, array of string names, empty array, and malformed JSON.
  - Assert all cases gracefully fall back or parse into valid `CustomTable[]`.
- **Test 4.2 — Table Renaming on Active Pending Transaction**:
  - Create pending transaction on `"Meja 04"`.
  - Rename `"Meja 04"` to `"Meja VIP 01"` in table management.
  - Settle transaction and assert invoice records `"Meja VIP 01"`.

#### 4. R5: Operational Cashier Identity
- **Test 5.1 — Cashier Name Recording in Transactions**:
  - Set active cashier to `"Mbak Siti (Kasir 1)"`.
  - Checkout an order.
  - Assert `transactions.cashier_name` strictly stores `"Mbak Siti (Kasir 1)"`.
- **Test 5.2 — Cashier Name Appearance on Customer Receipt & Audit Slip**:
  - Format customer receipt with `cashierName = "Mbak Siti"`.
  - Assert output contains `"Kasir    : Mbak Siti"`.

#### 5. R6: Supplier Purchase & Customer Reward Integration
- **Test 6.1 — Supplier Cash Purchase creates Cash Ledger Operational Expense**:
  - Record purchase with `payment_type = 'cash'`, amount 250.000.
  - Assert `purchases` record has `payment_status = 'paid'`.
  - Assert `cash_ledger` has entry: `type = 'expense'`, `affects_pnl = 1`, `amount = 250000`, `category = 'Pembelian Bahan/Kulakan'`.
- **Test 6.2 — Supplier Tempo Purchase does NOT create Cash Ledger Expense until Settled**:
  - Record purchase with `payment_type = 'tempo'`, amount 400.000.
  - Assert `purchases` record has `payment_status = 'unpaid'`.
  - Assert `cash_ledger` has 0 entries for this transaction.
  - Settle debt via `settleTempoDebt()`.
  - Assert `purchases.payment_status = 'paid'` and `cash_ledger` now has expense entry of 400.000.
- **Test 6.3 — Customer Reward Tier Threshold Calculation**:
  - Insert customer with `total_spent = 750000`.
  - Given tiers: Tier 1 (300k), Tier 2 (600k), Tier 3 (1000k).
  - Assert current tier is `Tier 2: Langganan Setia`, next tier is `Tier 3`, and `spend_to_next = 250000`.

#### 6. R8: Multi-Bank & QRIS Configuration Parsing
- **Test 8.1 — Multi-Bank JSON Persistence & Parsing**:
  - Store JSON array with 2 bank accounts in `settings` (`bank_accounts`).
  - Retrieve and parse; assert array length is 2 with correct bank names, account numbers, and holders.
  - Verify corrupted JSON falls back to empty array without crashing.

---

## 5. Maintenance Strategy: Fast, Clean, Zero-Regression Testing

1. **Keep Zero-Dependency Test Suite**:
   Avoid introducing Jest, Vitest, or heavy mock frameworks. Node.js v24 native `node:test` + `node:sqlite` executes 28 tests in 3.2s and runs in any development or CI environment without needing `npm install`.
2. **Harmonize Test Helpers with Production SQLite Schema**:
   Ensure any ALTER TABLE or constraint updates in `services/database.ts` are reflected in `test/helpers/db.js`.
3. **Execution Command**:
   ```bash
   npm test
   ```
   Add a pre-commit or pre-merge check to guarantee 100% pass status before any production artifact deployment.
