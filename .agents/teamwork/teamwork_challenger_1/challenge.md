# Empirical Challenge & Stress-Testing Report (Challenger 1)

**Evaluator**: Challenger 1 (Operational Stress & Edge Case Challenger)  
**Date**: 2026-11-07  
**Target System**: POS Angkringan Jogja (Offline SQLite + Zustand + React Native Expo)  
**Scope**: Operational Stress & Edge Case Resilience (Table Management, Cashier Identity, Quick Edit, Multi-Bank Accounts)

---

## Challenge Summary

**Overall risk assessment**: **LOW**  
All 4 critical operational stress vectors (Dynamic Table Management, Cashier Identity Propagation, Quick Edit catalog controls, and Multi-Bank accounts resilience) were empirically tested with 16 dedicated stress scenarios in `test/operational-stress-challenger.test.ts`. All 16 stress tests passed with 100% precision. The complete project test suite now comprises 104 tests across 33 suites with 0 failures and 0 regressions.

---

## Challenges & Stress Scenarios

### [Medium] Challenge 1: Dynamic Table Concurrency, Renaming Propagation & Deletion Guard
- **Assumption challenged**: Renaming or deleting tables during live store operations might disconnect or orphan pending orders, overwrite historical completed orders, or crash if table names contain special characters or duplicate inputs.
- **Attack scenario**:
  1. Renaming a table (e.g. `'Meja 05'` to `'Gazebo VIP Melati'`) while it holds active orders in both `'pending'` and `'billing'` statuses, alongside past `'completed'` orders.
  2. Attempting to delete a table while active orders (`status IN ('pending', 'billing')`) are ongoing.
  3. Attempting to create duplicate table names (case-insensitive variations like `'meja 01'`, `'LESEHAN BAMBU'`, or leading/trailing whitespace `'   Meja 01   '`).
  4. Injecting special characters, quotes, HTML tags, and emoji into table names (`Lesehan #04 & 'Gazebo' <VIP> 🌟 "Pojok"`).
- **Blast radius**: If table renaming fails to synchronize pending orders, cashiers cannot reopen or checkout open tables. If deletion is allowed on active tables, orders become un-payable ghosts. If past completed orders get modified, sales audit records are corrupted.
- **Empirical verification**:
  - *Table Renaming Atomic Sync*: `UPDATE transactions SET table_number = ? WHERE table_number = ? AND status IN ('pending', 'billing')` successfully migrated open pending and billing orders to `'Gazebo VIP Melati'` while leaving historical completed transactions retaining `'Meja 05'` intact.
  - *Deletion Guard Check*: Guard query `SELECT COUNT(*) FROM transactions WHERE table_number = ? AND status IN ('pending', 'billing')` returned `count = 1` for pending and billing, strictly rejecting deletion. Once settled (`status = 'completed'`), `count = 0` and deletion from `custom_tables` succeeded cleanly without touching historical records.
  - *Validation*: `validateTableName` accurately rejected duplicates, case-insensitive duplicates, whitespace duplicates, and blank names, while correctly permitting self-edit without name changes (`excludeId`).
  - *Special Characters*: SQLite parameterized binding and JSON round-trip safely preserved symbols, emojis, and quotes without SQL injection or parsing failure.

### [Low] Challenge 2: Cashier Identity Stamping, Mid-Shift Handover & Formatter Resilience
- **Assumption challenged**: Cashier identity might fail to persist under empty/whitespace inputs, fail during mid-order cashier handovers, or break thermal printer formatting under extreme character lengths and special names.
- **Attack scenario**:
  1. Cashier leaves name field blank, enters spaces, or provides null/undefined.
  2. Cashier A creates a pending order; Cashier B takes over the shift and completes checkout.
  3. Cashier name is extremely long (120 characters) or contains titles, nicknames, and quotes (`"Dr. H. Bambang S., S.E."`, `"Ahmad 'Ompong' ☕"`).
- **Blast radius**: Misattribution of cash revenue to the wrong cashier in internal shift audits, or crashes in ESC/POS line formatting routines.
- **Empirical verification**:
  - *Fallback*: The resolution logic `(activeCashier || activeCashierName || 'Kasir')` strictly resolved empty, whitespace, and null inputs to `'Kasir'`. Database rows confirmed `cashier_name = 'Kasir'`.
  - *Shift Handover*: When Cashier B (`'Dewi Sartika'`) settled Cashier A's (`'Rian Hidayat'`) pending order, the checkout transaction atomical updated `cashier_name = 'Dewi Sartika'`, ensuring physical drawer and shift accountability.
  - *Receipt Formatting*: `formatCustomerReceiptLines` and `formatTemporaryBillReceiptLines` cleanly formatted long titles and special characters without throwing, maintaining readable 32-column receipt layout.

### [Medium] Challenge 3: Quick Edit Price Extremes, Stock Clamping & Rapid Consecutive Updates
- **Assumption challenged**: Quick edit inputs in rapid succession might cause race conditions, negative prices/stocks might be saved into the database, or quick deletion might violate foreign keys on menus with sales history.
- **Attack scenario**:
  1. Setting price to Rp 0 (complimentary/promo item) or Rp 75,000,000 (extreme value) to test arithmetic overflow or NaN in subtotal calculations.
  2. Stepper decrementing stock past 0 to test for negative stock values.
  3. 25 rapid consecutive updates to price, stock, and name on a single menu item to stress SQLite WAL serial execution.
  4. Deleting a menu item that is referenced in historical sales records.
- **Blast radius**: Negative prices/stocks corrupt inventory and ledger math. Concurrency lockouts crash the UI. Deleting referenced items causes `SQLITE_CONSTRAINT_FOREIGNKEY` crashes.
- **Empirical verification**:
  - *Price Boundaries*: Rp 0 prices yielded clean Rp 0 subtotal without NaN; Rp 75,000,000 prices calculated correctly without overflow; negative prices are rejected by validation (`price >= 0`).
  - *Stock Clamping*: `Math.max(0, prev + delta)` reliably prevented negative values even when subtracting 5 from 2.
  - *Rapid Concurrency*: 25 consecutive updates executed with 0 locking errors, and final database state strictly matched the terminal update.
  - *Soft-Delete Safety*: Deleting a menu executed `UPDATE menus SET is_active = 0 WHERE id = ?`, immediately excluding it from active catalog queries while retaining historical `transaction_items` intact.

### [Low] Challenge 4: Multi-Bank Accounts Robustness & Schema Validation
- **Assumption challenged**: Corrupted JSON, empty arrays, or missing object fields in `bank_accounts` settings might cause unhandled exceptions when opening the payment modal.
- **Attack scenario**:
  1. `settings.bank_accounts` stored as `""`, `"[]"`, `null`, or `undefined`.
  2. Corrupted JSON strings (`"{invalid"`, `"12345"`, `"NOT_JSON"`).
  3. Bank account objects with missing properties (e.g. `account_holder` missing, `bank_name` missing).
  4. Account numbers containing spaces and dashes (`"123-456-7890"`).
- **Blast radius**: Opening payment modal crashes during checkout, halting store operations.
- **Empirical verification**:
  - *Empty Array & Nulls*: Safely resolved to `[]`, allowing UI to display the empty state card ("Belum Ada Rekening Terdaftar").
  - *Corrupted JSON*: Caught by `try / catch`, returning `[]` without unhandled crashes.
  - *Missing Fields*: Handled safely with fallback defaults (`a.n. -`, `Nomor Rekening BANK:`), preventing `TypeError: Cannot read properties of undefined`.
  - *Formatted Numbers*: Dashed and spaced account numbers survived database round-trip and clipboard copy alerts without data loss.

---

## Stress Test Results

| Test ID | Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **1.1** | Table rename with pending, billing & completed orders | Open orders update to new name; completed orders preserve history | Pending & billing synced to 'Gazebo VIP Melati'; completed preserved 'Meja 05' | **PASS** |
| **1.2** | Table deletion guard on active pending/billing orders | Deletion blocked if active count > 0; allowed when settled | Deletion blocked on active orders; allowed when completed; history preserved | **PASS** |
| **1.3** | Table name duplicate & whitespace validation | Reject duplicates, whitespace & blanks; allow self-edit | All duplicate and empty variations rejected; self-edit passed | **PASS** |
| **1.4** | Special characters & symbols in table names | Parameterized storage without corruption or injection | Exact string preserved in JSON settings and SQLite transactions | **PASS** |
| **2.1** | Diverse & extreme length cashier names | Exact string stored in `transactions.cashier_name` | All names up to 120 chars and special titles stored verbatim | **PASS** |
| **2.2** | Empty / whitespace cashier fallback | Fallback strictly defaults to `'Kasir'` | Stored transaction has `cashier_name = 'Kasir'`, never empty | **PASS** |
| **2.3** | Shift handover midway through order | Settle update attributes order to the settling cashier | Pending created by Rian; settled by Dewi; DB reflects Dewi | **PASS** |
| **2.4** | Thermal receipt formatting with edge-case names | Struk customer and bill render `Kasir : <Name>` | Clean formatting on both customer and temporary bill slips | **PASS** |
| **3.1** | Price extremes: Rp 0, Rp 75jt, negative input | Subtotal math handles 0 and large numbers without NaN | Rp 0 subtotal = 0; Rp 75jt handled; negative rejected | **PASS** |
| **3.2** | Stock stepper decrement clamp past zero | Stock clamped to 0 (`Math.max(0, n)`) | Decrementing 2 by 5 yielded 0, preventing negative stock | **PASS** |
| **3.3** | Rapid consecutive quick edits (25 updates) | Sequential updates handle cleanly without lockups | All 25 updates executed; final state matches last update | **PASS** |
| **3.4** | Quick edit menu soft-delete integrity | `is_active = 0`, hidden from catalog, history intact | Active catalog excluded menu; transaction_items intact | **PASS** |
| **4.1** | Empty array & null bank accounts | Graceful fallback to `[]` | Empty state displayed without throwing | **PASS** |
| **4.2** | Corrupted JSON strings in settings | Safe try/catch error handling, return `[]` | 6 malformed inputs parsed safely with 0 crashes | **PASS** |
| **4.3** | Missing fields in BankAccount objects | Missing properties fallback gracefully | Formatter safely rendered missing holder/bank with `-` | **PASS** |
| **4.4** | Formatted account numbers round-trip | Dashed/spaced numbers preserved accurately | Exact string round-trip verified in SQLite settings | **PASS** |

---

## Unchallenged Areas

- **Physical Thermal Bluetooth ESC/POS Hardware**: Verified using receipt line formatters (`formatCustomerReceiptLines`, `formatTemporaryBillReceiptLines`); native Android Bluetooth hardware execution requires a physical Android thermal printer device.
- **Physical Camera Barcode Scanner**: Verified via software barcode lookup maps (`findMenuByBarcode`).
