# Handoff Report: Table Management, Kitchen Tickets & Testing Infrastructure (Requirement R4)

**Agent**: Explorer Survey 3  
**Target Recipient**: Orchestrator (Conversation ID: `eac7280e-c735-4bcc-b8ca-6f3a330669d5`)  
**Working Directory**: `d:\Source_Code_Angkringan_Jogja\.agents\teamwork\explorer_survey_3`  
**Handoff Type**: Hard (Task complete)

---

## 1. Observation

### 1.1 Table Merge Resetting Tax & Discount and Duplicating Items
- **Location**: `stores/transactionStore.ts:394-439` (`mergeTables`)
- **Direct Code Observations**:
  - In `stores/transactionStore.ts:405-410`:
    ```typescript
    for (const otherId of otherIds) {
      await withSqliteRetry(() =>
        db.runAsync(
          `UPDATE transaction_items SET transaction_id = ?, is_additional = 1 WHERE transaction_id = ?`,
          [primaryId, otherId]
        )
      );
    ```
    This simply points `transaction_id = primaryId` for all items without checking whether `primaryId` already contains identical `menu_id` entries.
  - In `stores/transactionStore.ts:430-435`:
    ```typescript
    await withSqliteRetry(() =>
      db.runAsync(
        `UPDATE transactions SET table_number = ?, subtotal = ?, total = ? WHERE id = ?`,
        [targetTableNumber, newSubtotal, newSubtotal, primaryId]
      )
    );
    ```
    The query hardcodes `total = newSubtotal`, does not update `tax_amount`, and does not preserve `discount_amount` from any of the merged transactions.

### 1.2 Additional Orders Delta Portions Not Marked
- **Location**: `stores/transactionStore.ts:109-136` (`addToCart`)
- **Direct Code Observations**:
  - In `stores/transactionStore.ts:111-121`:
    ```typescript
    const existingIndex = cart.findIndex((item) => item.menu_id === menu.id);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const newQty = updatedCart[existingIndex].qty + qty;
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        qty: newQty,
        subtotal: newQty * updatedCart[existingIndex].price,
      };
      set({ cart: updatedCart });
    ```
    When an item already exists in the cart for a pending table (`activePendingTransactionId !== null`), incrementing its quantity modifies `qty` but leaves `is_additional` as `0`.
  - In `stores/transactionStore.ts:328-336` (`saveAsPendingOrder`):
    It deletes all existing rows from `transaction_items` and re-inserts each item using `item.is_additional`. Because `item.is_additional` remained `0`, the newly added portions are recorded with `is_additional = 0`.
  - In `services/print.ts:317`:
    `const deltaItems = receiptData.items.filter((i) => i.is_additional === 1);`
    Because `is_additional` is `0`, `deltaItems` is empty and no extra kitchen ticket is generated.

### 1.3 Missing Kitchen Ticket Printing on Pending Order Save
- **Location**: `app/transaksi.tsx:102-118` (`handleHoldOrder`)
- **Direct Code Observations**:
  ```typescript
  const handleHoldOrder = async () => {
    ...
    try {
      const res = await saveAsPendingOrder(db);
      Alert.alert(
        'Pesanan Meja Disimpan',
        `Pesanan ${tableNumber} berhasil disimpan sebagai pending (${res.invoiceNumber}).`,
        [{ text: 'OK', onPress: () => clearCart() }]
      );
    } catch (err: any) { ... }
  };
  ```
  No call to `printKitchenTicket` or `printKitchenAdditionalTicket` exists anywhere in `handleHoldOrder`. Kitchen printing is only called in `app/transaksi.tsx:513` during final customer checkout.

### 1.4 Absence of Temporary Bill (Tagihan Sementara)
- **Observations across codebase**:
  - Grep search for `sementara`, `tagihan`, `temp_bill` across `app`, `components`, `stores`, `services` found zero matches for temporary bill printing or preview.
  - `components/receipt-preview-modal.tsx` only has two tabs: "Struk Customer (Lengkap)" and "Tiket Dapur".
  - In `components/table-selector-modal.tsx`, tables only show a "Pending" badge; states for "Kosong", "Terisi", and "Billing / Siap Bayar" do not exist.

### 1.5 Testing Environment & TypeScript State
- **Tool Commands & Results**:
  - `& "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit`:
    Exited with code 0 (zero errors).
  - `& "D:\AI PROJEK\node.exe" -v`:
    Node.js v24.18.0.
  - Native Node test runner test:
    `& "D:\AI PROJEK\node.exe" -e "const test = require('node:test'); const assert = require('node:assert'); test('basic', () => { assert.strictEqual(1+1, 2); });"`
    Passed in 34ms.
  - `package.json`: Contains `"scripts"` without `"test"` or `"typecheck"`. Zero test files exist in the project tree.

---

## 2. Logic Chain

1. **Step 1 (Table Merge Logic)**:
   - Observation 1.1 reveals that `mergeTables` updates `transactions SET total = newSubtotal` and ignores `tax_amount` and `discount_amount`.
   - Observation 1.1 also reveals that `mergeTables` repoints `transaction_items` to `primaryId` directly.
   - Therefore, when tables are merged, any accumulated discount or tax PB1 is destroyed, and duplicate menu items produce duplicate rows. When loaded into the frontend, duplicate `menu_id` rows break React state manipulation in `updateCartQty` and print duplicate line items on customer receipts.
   - Deduction: Deduplicating via SQLite `GROUP BY menu_id, price` with `SUM(qty)` and `SUM(subtotal)`, recalculating tax and summing discounts inside `db.withTransactionAsync` solves both problems cleanly.

2. **Step 2 (Delta Portions & Kitchen Ticket Logic)**:
   - Observation 1.2 demonstrates that adding extra portions of an item already in a pending order fails to mark the delta as `is_additional = 1`.
   - Observation 1.3 shows that saving a pending table (`handleHoldOrder`) never triggers any kitchen printing.
   - Therefore, the kitchen staff never receives any kitchen ticket when a customer places an initial pending order, nor when they order additional portions during their meal.
   - Deduction:
     a. Baseline quantities must be tracked when opening a pending table so delta portions are saved with `is_additional = 1`.
     b. `handleHoldOrder` must trigger `printKitchenTicket` on initial pending save and `printKitchenAdditionalTicket` on table updates with delta items.

3. **Step 3 (Table Status & Temporary Bill Logic)**:
   - Observation 1.4 confirms that "Tagihan Sementara" (Temporary Bill) does not exist in the codebase, and table status visibility in `TableSelectorModal` lacks clear indicators for "Kosong", "Terisi", and "Siap Bayar".
   - Deduction: Providing a "Tagihan Sementara" preview & thermal print format (with `*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***`), plus status badges in `TableSelectorModal`, fulfills Requirement R4.

4. **Step 4 (Testing Infrastructure Logic)**:
   - Observation 1.5 shows Node.js v24 is available with native `node:test`, `node:assert`, and native TypeScript support, but `package.json` lacks `"test"` and `"typecheck"` scripts.
   - Deduction: Following Ponytail principles (using built-in platform capabilities instead of adding bloat), we can wire `"test": "node --test test/**/*.test.ts"` and `"typecheck": "tsc --noEmit"`, using a lightweight in-memory SQLite mock for fast headless verification.

---

## 3. Caveats

- **Physical Printer**: Physical Bluetooth ESC/POS printing cannot be executed in headless CLI environments; verification of printing logic relies on inspecting formatted string payloads and function execution paths in unit tests.
- **Node Execution Path**: On this Windows machine, `node` and `npx` are located at `D:\AI PROJEK\node.exe` rather than the system `PATH`. When executing commands or tests via PowerShell, invoke `& "D:\AI PROJEK\node.exe"` or add `D:\AI PROJEK` to the session `$env:PATH`.
- **Database Migrations**: The database version is currently `PRAGMA user_version = 1`. Any schema changes (such as adding `is_billing` or indexes) should be handled conditionally via `ALTER TABLE` or within a version increment.

---

## 4. Conclusion

Requirement R4 issues and the testing infrastructure gaps are cleanly diagnosed and fully solvable with minimal diffs:
1. **Fix `mergeTables`**: Group items using SQLite `GROUP BY menu_id, price`, sum `qty` and `subtotal`, preserve discount sum and tax rate, and wrap in `db.withTransactionAsync`.
2. **Fix Delta Marking & Kitchen Tickets**: Track baseline quantities upon `openPendingOrder`, record extra portions with `is_additional = 1`, and invoke `printKitchenTicket` / `printKitchenAdditionalTicket` in `handleHoldOrder`.
3. **Implement Temporary Bill & Table Visibility**: Add `printTemporaryBill` in `services/print.ts`, preview tab in `ReceiptPreviewModal`, and color-coded table badges ("Kosong", "Terisi", "Siap Bayar") in `TableSelectorModal`.
4. **Testing Infrastructure**: Add `"test"` and `"typecheck"` scripts in `package.json`, create an in-memory SQLite mock, and add unit test suites using Node's built-in `node:test`.

---

## 5. Verification Method

1. **TypeScript Typecheck**:
   ```powershell
   & "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit
   ```
   *Expected*: Exit code 0, 0 errors.

2. **Automated Store Tests**:
   Run headless unit tests with Node's native test runner:
   ```powershell
   & "D:\AI PROJEK\node.exe" --test test/**/*.test.ts
   ```
   *Expected*: Passes tests verifying:
   - `mergeTables`: duplicate items consolidated into single rows, tax and discount preserved.
   - `saveAsPendingOrder`: delta portions marked with `is_additional = 1`.
   - `financialStore`: gross sales and cash ledger calculations.

3. **Files to Inspect**:
   - `stores/transactionStore.ts` (lines 109-136, 312-392, 394-439)
   - `services/print.ts` (lines 179-278, new `printTemporaryBill`)
   - `components/table-selector-modal.tsx` (lines 138-166)
   - `components/receipt-preview-modal.tsx` (lines 31-67, 107-209)
   - `package.json` (scripts section)
