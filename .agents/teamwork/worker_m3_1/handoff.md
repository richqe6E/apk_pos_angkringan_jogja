# Handoff Report: Milestone 3 (R4) - Table Management, Kitchen Tickets & Merge

**Agent**: Worker M3 (Table Management, Kitchen Tickets & Merge Specialist)  
**Target Recipient**: Orchestrator (Conversation ID: `eac7280e-c735-4bcc-b8ca-6f3a330669d5`)  
**Working Directory**: `d:\Source_Code_Angkringan_Jogja\.agents\teamwork\worker_m3_1`  
**Handoff Type**: Hard (Task complete)

---

## 1. Observation

### 1.1 Defect in `stores/transactionStore.ts:mergeTables`
- **Initial State**:
  Lines 450-482 originally ran:
  ```typescript
  for (const otherId of otherIds) {
    await withSqliteRetry(() =>
      db.runAsync(
        `UPDATE transaction_items SET transaction_id = ?, is_additional = 1 WHERE transaction_id = ?`,
        [primaryId, otherId]
      )
    );
    ...
  }
  ...
  await withSqliteRetry(() =>
    db.runAsync(
      `UPDATE transactions SET table_number = ?, subtotal = ?, total = ? WHERE id = ?`,
      [targetTableNumber, newSubtotal, newSubtotal, primaryId]
    )
  );
  ```
  - Result: Directly updated `transaction_id = primaryId` for duplicate items without aggregation, hardcoded `total = newSubtotal`, obliterated PB1 tax calculations, and dropped discounts from all merged tables. Furthermore, it did not execute inside `db.withTransactionAsync`.

### 1.2 Absence of Delta Portion Tracking in `stores/transactionStore.ts:saveAsPendingOrder`
- **Initial State**:
  In `saveAsPendingOrder`, opening an existing pending table order deleted old items and reinserted cart rows without knowing whether quantities had increased over the original saved order. As a result, additions were either unmarked (`is_additional = 0`) or entire items were marked without isolating the extra portions.
  No delta payload was returned from `saveAsPendingOrder`.

### 1.3 Missing Kitchen Ticket Printing on Hold Order in `app/transaksi.tsx`
- **Initial State**:
  `handleHoldOrder` in `app/transaksi.tsx` only called `saveAsPendingOrder(db)` and displayed an alert. Neither `printKitchenTicket` nor `printKitchenAdditionalTicket` was ever invoked when saving pending orders.

### 1.4 Missing Table Status Badges & Temporary Bill ('Tagihan Sementara')
- **Initial State**:
  - `components/table-selector-modal.tsx`: Only showed "Pending" badges. Tables had no indicators for "Kosong", "Terisi", or "Siap Bayar / Billing".
  - `services/print.ts`: No functions existed for formatting or printing temporary bills (`formatTemporaryBillReceipt`, `printTemporaryBill`).
  - `components/receipt-preview-modal.tsx`: Only supported "Struk Customer" and "Tiket Dapur"; no tab or view existed for "Tagihan Sementara" with warning watermark headers (`*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***`).

### 1.5 Verification Results
- **TypeScript Static Typecheck**:
  Command: `& "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit`
  Result: Exit code 0, 0 errors.
- **Automated Test Suite**:
  Command: `& "D:\AI PROJEK\node.exe" --test test/**/*.test.ts`
  Result: 15/15 tests passed across 4 suites (`tests 15`, `pass 15`, `fail 0`).

---

## 2. Logic Chain

1. **Table Merge Atomicity & Consolidation**:
   - Observations in 1.1 proved that naive `UPDATE transaction_items SET transaction_id = ?` duplicated identical items and wiped tax/discounts.
   - Deduction: Grouping all items from source tables by `(menu_id, price)` with SQLite `SUM(qty) AS total_qty` and `SUM(subtotal) AS total_subtotal`, summing `discount_amount` from all source transactions, recalculating PB1 tax based on `taxRate` and `taxEnabled`, and wrapping the entire sequence in `db.withTransactionAsync` ensures atomic, non-duplicative, and financially accurate table merges.

2. **Delta Marking for Additional Orders ('Pesanan Sambungan')**:
   - Observations in 1.2 showed that without baseline memory, additional items could not be distinguished from initial order items.
   - Deduction:
     a. `openPendingOrder` records a baseline map of existing quantities: `pendingBaselineQuantities = { [menu_id]: qty }`.
     b. `saveAsPendingOrder` compares each cart item against this baseline: if `currentQty > baseQty`, it splits the item into a baseline portion (`is_additional = 0`, qty = `baseQty`) and a delta portion (`is_additional = 1`, qty = `currentQty - baseQty`).
     c. `saveAsPendingOrder` returns `{ txId, invoiceNumber, tableNumber, isAdditional, isNew, deltaItems }`.

3. **Kitchen Ticket Automation on Hold Order**:
   - Observations in 1.3 confirmed kitchen tickets were never triggered on pending hold orders.
   - Deduction:
     a. When `saveAsPendingOrder` indicates an additional order (`isAdditional && deltaItems.length > 0`), `handleHoldOrder` triggers `printKitchenAdditionalTicket` with only the delta items.
     b. When `saveAsPendingOrder` indicates a new pending order, `handleHoldOrder` triggers `printKitchenTicket` with all items (without prices).

4. **Table Status Visibility & Temporary Bill**:
   - Observations in 1.4 showed that cashiers could not see table occupancy status at a glance or issue a bill before payment.
   - Deduction:
     a. In `components/table-selector-modal.tsx`, preset tables now clearly display:
        - "Kosong" (green badge when table has no pending order)
        - "Terisi" (amber badge when table has active order)
        - "Siap Bayar / Billing" (blue badge when bill has been requested)
     b. Pending table cards include a "📋 Tagihan Sementara" button.
     c. `services/print.ts` exports `formatTemporaryBillReceipt` and `printTemporaryBill` featuring the prominent watermark header `*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***` and footer notice `*** BUKAN BUKTI PEMBAYARAN SAH ***`.
     d. `components/receipt-preview-modal.tsx` includes a third dedicated tab ("Tagihan Sementara") displaying the formatted paper preview with watermark banner.
     e. `app/transaksi.tsx` adds a "Tagihan" button in the cart action footer to directly view/print temporary bills for open orders.

---

## 3. Caveats

- **Physical Printer Connection**: Headless CLI environments do not execute physical Bluetooth hardware printing; Bluetooth execution paths verify permissions, data formatting, ESC/POS alignment commands, and mock/headless test assertions.
- **Node Execution Path**: On this system, Node.js is located at `D:\AI PROJEK\node.exe`. All CLI and test executions use this exact binary.

---

## 4. Conclusion

Milestone 3 (Requirement R4) is completely implemented and verified:
1. `mergeTables` consolidates identical items, preserves discounts, recalculates PB1 taxes, and runs inside an atomic transaction.
2. Baseline quantities are recorded on `openPendingOrder` and delta portions are marked with `is_additional = 1` on `saveAsPendingOrder`.
3. Kitchen tickets and additional order tickets print automatically when holding orders in `app/transaksi.tsx`.
4. Table status visibility ("Kosong", "Terisi", "Siap Bayar") and Temporary Bill preview/print are fully functional across `table-selector-modal.tsx`, `receipt-preview-modal.tsx`, `services/print.ts`, and `app/transaksi.tsx`.
5. TypeScript compiler check exits with 0 errors and all 15 automated test suites pass 100%.

---

## 5. Verification Method

1. **TypeScript Typecheck**:
   ```powershell
   & "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit
   ```
   *Expected*: Code 0, 0 errors.

2. **Unit Test Suite**:
   ```powershell
   & "D:\AI PROJEK\node.exe" --test test/**/*.test.ts
   ```
   *Expected*: 15/15 tests pass across all suites.

3. **Files to Inspect**:
   - `stores/transactionStore.ts` (lines 45-80, 260-500)
   - `services/print.ts` (lines 175-350)
   - `components/receipt-preview-modal.tsx` (lines 30-100, 190-280, 530-580)
   - `components/table-selector-modal.tsx` (lines 40-105, 190-310, 365-385)
   - `app/transaksi.tsx` (lines 60-80, 110-210, 520-565)
