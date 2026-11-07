# Comprehensive Analysis Report: Table Management, Kitchen Tickets & Testing Infrastructure

**Author**: Explorer Survey 3 (Table Management, Kitchen Tickets & Testing Infrastructure Specialist)  
**Date**: 2026-11-07  
**Scope**: Requirement R4 (Meja, Pesanan Pending, Tiket Dapur, Tagihan Sementara) & Test Environment  
**Framework**: Ponytail Senior Dev Mode (The smallest complete working solution, no bloat, zero speculation)

---

## Executive Summary

1. **Table Management & Pending Flow**: The app does not have a dedicated `tables` master table in SQLite; tables are managed via preset identifiers (`PRESET_TABLES` in `components/table-selector-modal.tsx`) and stored directly in `transactions.table_number` with `status = 'pending'`.
2. **Additional Orders ("Pesanan Sambungan") & Kitchen Tickets**:
   - When a pending order is updated, newly appended items that already existed in the initial order have their quantity increased without tracking the delta, and their `is_additional` flag is left as `0` (`stores/transactionStore.ts:111-122`).
   - Although `printKitchenAdditionalTicket` exists in `services/print.ts:231-278`, neither `printKitchenTicket` nor `printKitchenAdditionalTicket` is ever triggered during `saveAsPendingOrder` (`app/transaksi.tsx:102-118`). Kitchen tickets are only routed during final checkout, which is too late for food preparation.
3. **Table Merge (`mergeTables`)**:
   - `mergeTables` (`stores/transactionStore.ts:394-439`) directly sets `total = newSubtotal` in SQL, completely overwriting and discarding any tax amount or discount.
   - It re-points `transaction_id = primaryId` for all items without deduplicating identical `menu_id` entries, resulting in duplicate rows in the database, duplicate lines on printed receipts, and broken cart state in React.
4. **Table Status Visibility & Temporary Bill**:
   - Table status only distinguishes between "Pending" and plain (unbadged) cards. The three operational states ("Kosong", "Terisi", "Billing / Siap Bayar") are missing.
   - There is no implementation or UI trigger for "Tagihan Sementara" (Temporary Bill preview/printing), preventing customers from inspecting their bill before payment.
5. **Testing Infrastructure**:
   - The repository has **zero** test files and **no** `"test"` script in `package.json`.
   - Node.js v24.18.0 is available at `D:\AI PROJEK\node.exe`. It natively supports `node:test`, `node:assert`, and TypeScript execution without extra dependencies.
   - TypeScript compilation (`tsc --noEmit`) currently passes with **0 errors**.

---

## 1. Table Management & Pending Orders Architecture

### 1.1 Data Schema & State Representation
- **Schema**:
  - `transactions` table (`services/database.ts:108-126`):
    - `table_number TEXT NOT NULL`: Name of table (e.g. `'Meja 01'`, `'Lesehan 03'`).
    - `status TEXT NOT NULL DEFAULT 'completed'`: Holds `'pending'` for active unpaid dining tables, `'completed'` for finalized sales, and `'merged'` for subsumed tables.
  - `transaction_items` table (`services/database.ts:129-139`):
    - `transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE`
    - `menu_id INTEGER NOT NULL REFERENCES menus(id)`
    - `menu_name TEXT NOT NULL`
    - `price REAL NOT NULL`
    - `qty INTEGER NOT NULL`
    - `subtotal REAL NOT NULL`
    - `is_additional INTEGER NOT NULL DEFAULT 0` (0 = pesanan awal, 1 = pesanan sambungan)
- **Presets**:
  - Defined in `components/table-selector-modal.tsx:25-30`:
    - 10 Meja (`'Meja 01'` to `'Meja 10'`)
    - 5 Lesehan (`'Lesehan 01'` to `'Lesehan 05'`)
    - 1 Takeaway (`'Bungkus / Take-away'`)
    - Plus custom table names via text input.

### 1.2 Pending Order Lifecycle Trace
1. **Creation**:
   - Cashier selects a table from `TableSelectorModal`. `tableNumber` is set in `useTransactionStore`.
   - Cashier selects items -> `addToCart(menu, qty)`.
   - Cashier clicks "Simpan Pending" (`app/transaksi.tsx:109`).
   - `saveAsPendingOrder(db)` (`stores/transactionStore.ts:347-392`):
     - Acquires atomic sequence from `daily_counters` (e.g. `INV-071126-001`).
     - Inserts into `transactions` with `status = 'pending'`, `payment_method = 'tunai'`, `payment_amount = 0`, `change_amount = 0`.
     - Inserts all cart items into `transaction_items` with `is_additional = 0`.
     - Calls `loadPendingOrders(db)` to refresh pending table cache.
     - Cart is cleared, active transaction ID is reset in UI.
2. **Reopening**:
   - Cashier opens `TableSelectorModal`, selects "Meja Pending" tab, taps the order.
   - `openPendingOrder(db, txId)` (`stores/transactionStore.ts:232-288`):
     - Loads transaction row and its items.
     - Maps `items` into `cart`.
     - Sets `activePendingTransactionId = tx.id`, `tableNumber`, `customerId`, `customerName`, `discountAmount`.
3. **Saving Changes / Updating Active Table**:
   - `saveAsPendingOrder` (`stores/transactionStore.ts:312-345`):
     - Detects `activePendingTransactionId !== null`.
     - Executes `UPDATE transactions SET subtotal = ?, tax_amount = ?, discount_amount = ?, total = ?, table_number = ?, customer_name = ? WHERE id = ?`.
     - Deletes all existing rows in `transaction_items` for this `activePendingTransactionId`.
     - Re-inserts all current items from `cart`.

---

## 2. Additional Orders ("Pesanan Sambungan") & Kitchen Ticket Logic

### 2.1 The Root Cause of Delta Marking Bug
In `stores/transactionStore.ts:109-136` (`addToCart`):
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
} else {
  const isAdditional = activePendingTransactionId ? 1 : 0;
  const newItem: CartItem = {
    id: `${menu.id}-${Date.now()}`,
    menu_id: menu.id,
    name: menu.name,
    price: menu.price,
    qty,
    subtotal: menu.price * qty,
    is_additional: isAdditional,
  };
  set({ cart: [...cart, newItem] });
}
```

**Observed Bug**:
1. When opening a pending order, all existing items in cart have `is_additional: 0` (`transactionStore.ts:253`).
2. If customer orders **additional portions of an already ordered item** (e.g. was 2 Nasi Kucing, now customer asks for +1):
   - `existingIndex > -1` matches.
   - `qty` becomes 3, but `is_additional` remains `0`.
   - The delta (+1) is completely lost!
3. When `saveAsPendingOrder` executes, it deletes all items and inserts `Nasi Kucing (qty: 3, is_additional: 0)`.
4. When `services/print.ts:317` filters for delta items:
   `receiptData.items.filter((i) => i.is_additional === 1)`
   `deltaItems` is empty! The kitchen is never informed that an additional portion was ordered.

### 2.2 Kitchen Ticket Printing Gap
- In `services/print.ts`:
  - `printKitchenTicket` (lines 179-226) formats initial orders with large text `[ x${item.qty} ] ${item.name}` without prices.
  - `printKitchenAdditionalTicket` (lines 231-278) formats additional orders with `[ +${item.qty} ] ${item.name} (BARU)` and title `*** PESANAN TAMBAHAN *** MEJA: ... (SAMBUNGAN)`.
  - `autoRoutePrint` (lines 284-339) coordinates printing to cashier and kitchen Bluetooth printers.
- **Observed Gap**:
  - In `app/transaksi.tsx:102-118` (`handleHoldOrder`), when the cashier saves an order as pending or updates an active pending table:
    - **No printer function is ever called!**
    - The kitchen only gets printed during final checkout (`app/transaksi.tsx:513`). But food must be prepared while the customer is dining, not after they have finished and are paying!
  - **Proposed Ponytail Fix**:
    - When `saveAsPendingOrder` succeeds:
      - If it is a new pending order (`res.isNew === true`): trigger `printKitchenTicket` with all cart items (if `autoPrintKitchen` is enabled).
      - If it is an update on an existing table (`res.isNew === false`): trigger `printKitchenAdditionalTicket` with only the delta items (`is_additional === 1`).

### 2.3 Proposed Minimal Data Model for Delta Tracking
To track deltas with minimal complexity and zero extra libraries:
1. In `TransactionState`, track baseline quantities of the opened pending order:
   `initialQuantities: Record<number, number>` (mapping `menu_id -> saved_qty`).
2. When `openPendingOrder` loads items from SQLite:
   Populate `initialQuantities` with the quantities currently in database.
3. In `addToCart` and `updateCartQty`:
   For any item in cart:
   - If `activePendingTransactionId` is set:
     - `baseQty = initialQuantities[menu_id] || 0`
     - If current `qty > baseQty`:
       The item represents an additional order for the delta portion `qty - baseQty`.
4. When `saveAsPendingOrder` writes to database:
   For each cart item:
   - If `baseQty > 0`:
     - Insert base portion: `qty = Math.min(item.qty, baseQty)`, `is_additional = 0`.
     - If `item.qty > baseQty`:
       - Insert delta portion: `qty = item.qty - baseQty`, `is_additional = 1`.
   - If `baseQty === 0` (brand new item added):
     - Insert item: `qty = item.qty`, `is_additional = 1`.
5. For kitchen ticket printing on table update:
   Extract all items with delta portions (`qty > baseQty` or `baseQty === 0`), format as `PrintOrderItem` with `qty = deltaQty`, and send to `printKitchenAdditionalTicket`.
6. Once saved, update `initialQuantities` to match the newly committed quantities.

---

## 3. Table Merge (`mergeTables`) Deep Dive

### 3.1 Trace of Current Implementation
Location: `stores/transactionStore.ts:394-439`
```typescript
mergeTables: async (db: SQLiteDatabase, sourceTxIds: number[], targetTableNumber: string) => {
  if (sourceTxIds.length < 2) {
    throw new Error('Pilih minimal 2 meja pending untuk digabung.');
  }

  const primaryId = sourceTxIds[0];
  const otherIds = sourceTxIds.slice(1);

  for (const otherId of otherIds) {
    await withSqliteRetry(() =>
      db.runAsync(
        `UPDATE transaction_items SET transaction_id = ?, is_additional = 1 WHERE transaction_id = ?`,
        [primaryId, otherId]
      )
    );

    await withSqliteRetry(() =>
      db.runAsync(
        `UPDATE transactions SET status = 'merged', merged_into_tx_id = ? WHERE id = ?`,
        [primaryId, otherId]
      )
    );
  }

  const sumRow = await withSqliteRetry(() =>
    db.getFirstAsync<{ new_subtotal: number }>(
      `SELECT SUM(subtotal) as new_subtotal FROM transaction_items WHERE transaction_id = ?`,
      [primaryId]
    )
  );

  const newSubtotal = sumRow?.new_subtotal || 0;
  await withSqliteRetry(() =>
    db.runAsync(
      `UPDATE transactions SET table_number = ?, subtotal = ?, total = ? WHERE id = ?`,
      [targetTableNumber, newSubtotal, newSubtotal, primaryId]
    )
  );

  await get().loadPendingOrders(db);
  return primaryId;
}
```

### 3.2 Root Cause Analysis

#### Issue A: Tax and Discount Reset to Zero
- **Direct Cause**: Line 432:
  `UPDATE transactions SET table_number = ?, subtotal = ?, total = ? WHERE id = ?`
  with parameters `[targetTableNumber, newSubtotal, newSubtotal, primaryId]`.
- **Impact**:
  1. `tax_amount` is not touched in SQL, but `total` is set strictly equal to `newSubtotal`. Any PB1 tax is erased.
  2. `discount_amount` is completely ignored. Any discount previously applied to `primaryId` or any of `otherIds` is discarded.
  3. When `openPendingOrder(db, mergedId)` runs, `discountAmount` is read from `tx.discount_amount` (which no longer matches the overwritten `total`), corrupting the financial state.

#### Issue B: Duplicate Menu Items Not Merged
- **Direct Cause**: Lines 407-409:
  `UPDATE transaction_items SET transaction_id = ?, is_additional = 1 WHERE transaction_id = ?`
- **Impact**:
  1. If Table 1 had 2 Nasi Kucing and Table 2 had 3 Nasi Kucing, `transaction_items` now has two rows with `menu_id = 1`.
  2. When loaded into `cart`, `cart.findIndex((i) => i.menu_id === menu.id)` will only find the first row. Clicking `+` or `-` updates the first row or duplicates operations, and `removeFromCart` wipes out all instances.
  3. Printed customer receipt and temporary bill print Nasi Kucing on separate lines instead of combining them into `5 x 5.000 = 25.000`.

### 3.3 Proposed Minimal Ponytail Solution for `mergeTables`
Wrap the entire operation in a single atomic transaction `db.withTransactionAsync`:
```typescript
mergeTables: async (db: SQLiteDatabase, sourceTxIds: number[], targetTableNumber: string) => {
  if (sourceTxIds.length < 2) {
    throw new Error('Pilih minimal 2 meja pending untuk digabung.');
  }

  const primaryId = sourceTxIds[0];
  const otherIds = sourceTxIds.slice(1);
  const placeholders = sourceTxIds.map(() => '?').join(',');

  await withSqliteRetry(() =>
    db.withTransactionAsync(async () => {
      // 1. Ambil data seluruh transaksi sumber untuk menghitung akumulasi diskon & cek pajak
      const sourceTxs = await db.getAllAsync<{
        id: number;
        tax_amount: number;
        discount_amount: number;
      }>(`SELECT id, tax_amount, discount_amount FROM transactions WHERE id IN (${placeholders})`, sourceTxIds);

      const totalDiscount = (sourceTxs || []).reduce((sum, tx) => sum + (tx.discount_amount || 0), 0);
      const hasTax = (sourceTxs || []).some((tx) => (tx.tax_amount || 0) > 0) || get().taxEnabled;

      // 2. Ambil seluruh item dan gabungkan item yang identik secara otomatis via SQL GROUP BY
      const consolidatedItems = await db.getAllAsync<{
        menu_id: number;
        menu_name: string;
        price: number;
        total_qty: number;
        total_subtotal: number;
      }>(
        `SELECT menu_id, menu_name, price, SUM(qty) as total_qty, SUM(subtotal) as total_subtotal
         FROM transaction_items
         WHERE transaction_id IN (${placeholders})
         GROUP BY menu_id, price`,
        sourceTxIds
      );

      // 3. Hapus item lama dari seluruh transaksi sumber
      await db.runAsync(
        `DELETE FROM transaction_items WHERE transaction_id IN (${placeholders})`,
        sourceTxIds
      );

      // 4. Masukkan item yang sudah terkonsolidasi & bebas duplikasi ke primaryId
      for (const item of consolidatedItems) {
        await db.runAsync(
          `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          [primaryId, item.menu_id, item.menu_name, item.price, item.total_qty, item.total_subtotal]
        );
      }

      // 5. Hitung subtotal, pajak, dan grand total baru
      const newSubtotal = (consolidatedItems || []).reduce((sum, i) => sum + i.total_subtotal, 0);
      const taxRate = get().taxRate || 10;
      const newTaxAmount = hasTax ? Math.round((newSubtotal * taxRate) / 100) : 0;
      const newGrandTotal = Math.max(0, newSubtotal + newTaxAmount - totalDiscount);

      // 6. Update transaksi utama (primaryId)
      await db.runAsync(
        `UPDATE transactions
         SET table_number = ?, subtotal = ?, tax_amount = ?, discount_amount = ?, total = ?
         WHERE id = ?`,
        [targetTableNumber, newSubtotal, newTaxAmount, totalDiscount, newGrandTotal, primaryId]
      );

      // 7. Tandai transaksi lain sebagai merged dan nolkan nilai finansialnya agar tidak dobel hitung
      for (const otherId of otherIds) {
        await db.runAsync(
          `UPDATE transactions
           SET status = 'merged', merged_into_tx_id = ?, subtotal = 0, tax_amount = 0, discount_amount = 0, total = 0
           WHERE id = ?`,
          [primaryId, otherId]
        );
      }
    })
  );

  await get().loadPendingOrders(db);
  return primaryId;
}
```

**Why this is optimal**:
- SQLite's `GROUP BY menu_id, price` handles deduplication, quantity summation, and subtotal aggregation in a single query.
- Preserves all accumulated discounts and recalculates PB1 tax correctly.
- Prevents double-counting merged orders in financial summaries by zeroing subtotal and total on merged child transactions.
- Fully atomic via `db.withTransactionAsync`.

---

## 4. Table Status Visibility & Temporary Bill UI / Preview / Print

### 4.1 Table Status Visibility (Kosong, Terisi, Billing/Siap Bayar)
- **Current State**:
  In `components/table-selector-modal.tsx:138-166`:
  ```typescript
  const isCurrent = tableNumber === tName;
  const hasPending = pendingOrders.some((p) => p.table_number === tName);
  ```
  Only displays a `warning` badge saying "Pending" if `hasPending` is true. Unoccupied tables have no badge at all.
- **Required States (PRD / R4)**:
  1. **Kosong** (Green / Neutral badge): No pending order. Table is available.
  2. **Terisi** (Amber / Warning badge): Active pending order currently dining.
  3. **Billing / Siap Bayar** (Blue / Info badge): Table has requested a bill / temporary bill has been printed.
- **Minimal Implementation**:
  - In `transactions` table (or in-memory / settings flag), add column or state `is_billing INTEGER NOT NULL DEFAULT 0` (or derive from temporary bill print action).
  - On each table card in `TableSelectorModal`:
    - If `order?.is_billing === 1`: Display Badge "Siap Bayar" (variant: `info` / primary).
    - Else if `hasPending`: Display Badge "Terisi" (variant: `warning`) with `order.item_count` items.
    - Else: Display Badge "Kosong" (variant: `success`).
  - Add summary pills at the top of the modal:
    `[ Kosong: X ] [ Terisi: Y ] [ Siap Bayar: Z ]`.

### 4.2 Temporary Bill ("Tagihan Sementara")
- **Definition**: In an Indonesian angkringan / restaurant, customers request a preliminary bill ("Minta bill dong") before paying. The bill lists all consumed items, current subtotal, tax, discount, and estimated total, but explicitly states `*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***`.
- **Implementation Design**:
  1. **Printer Service Function** in `services/print.ts`:
     `printTemporaryBill(data: PrintReceiptData)`:
     - Header: Store Name, Store Address, Store Phone.
     - Title: `*** TAGIHAN SEMENTARA ***` (Large text, Center).
     - Notice: `(BUKAN BUKTI PEMBAYARAN)`.
     - Transaction Metadata: Table Number, Invoice Number, Time, Customer Name, Cashier Name.
     - Item Breakdown: Name, Qty x Price, Subtotal.
     - Financial Summary: Subtotal, Diskon (if any), Pajak PB1 (if any), `ESTIMASI TOTAL`.
     - Footer: `* Silakan Menuju Kasir Untuk Membayar *`.
  2. **Preview & Action Trigger** in `app/transaksi.tsx`:
     - Add a "Cetak Bill Sementara" button in the cart panel (active when `cart.length > 0`).
     - Clicking opens `ReceiptPreviewModal` with `previewTab = 'temporary_bill'`.
     - Clicking print sends the formatted bill to the cashier printer and marks the table as "Siap Bayar".

---

## 5. Testing Infrastructure & Typecheck Analysis

### 5.1 Current Environment Findings
- **Package.json Scripts**:
  ```json
  "scripts": {
    "start": "expo start",
    "dev": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "lint": "expo lint"
  }
  ```
  - **No `test` script exists**. Running `npm test` fails with `npm error Missing script: "test"`.
- **Dependencies**:
  - No Jest, Vitest, or Testing Library in `package.json` devDependencies.
- **Node.js Environment**:
  - Installed binary: `D:\AI PROJEK\node.exe` (Node.js v24.18.0).
  - Native features verified:
    - Built-in test runner: `node:test` and `node:assert` work out-of-the-box (verified: runs basic test suite in 34ms).
    - Native TypeScript support: Node.js 24 executes TypeScript syntax without external transpilers.
- **TypeScript Compile Check**:
  - Command: `& "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit`
  - Result: **Exit Code 0** (0 compile errors across the entire codebase).

### 5.2 Test Strategy (Ponytail Senior Dev Approach)
Instead of adding heavy dependencies (like `jest`, `babel-jest`, `ts-jest`, `@testing-library/react-native`) which could cause compatibility issues with Expo SDK 54 and React 19:
1. **Use Node's Native Test Runner (`node:test` + `node:assert`)**:
   Add script to `package.json`:
   ```json
   "scripts": {
     ...
     "test": "node --test test/**/*.test.ts",
     "typecheck": "tsc --noEmit"
   }
   ```
2. **Headless In-Memory SQLite Mock**:
   Create a lightweight SQLite mock (`test/helpers/mockDb.ts`) that implements:
   - `execAsync(sql: string): Promise<void>`
   - `runAsync(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes: number }>`
   - `getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>`
   - `getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>`
   - `withTransactionAsync<T>(task: () => Promise<T>): Promise<T>`
   This allows headless, blazing-fast (<1 second) automated testing of:
   - `useTransactionStore`: `addToCart`, delta portions, `saveAsPendingOrder`, `mergeTables`, `checkout`.
   - `useFinancialStore`: gross sales, net profit calculations, avoiding double-counting of cash sales.
   - Financial rounding, tax calculations, and discount thresholds.

---

## 6. Ponytail Debt & Audit Ledger

| Component / File | Current Issue / Bloat / Debt | Ponytail Recommendation | Risk / Impact |
|---|---|---|---|
| `stores/transactionStore.ts:394` (`mergeTables`) | Non-atomic queries, wipes tax & discount, creates duplicate item rows. | Merge items via SQL `GROUP BY`, preserve discount sum and tax rate, wrap in `withTransactionAsync`. | High: Corrupts receipt and bill amounts; React cart behaves erratically. |
| `stores/transactionStore.ts:111` (`addToCart`) | Does not record delta portions when increasing quantity on pending items. | Track `initialQuantities`; write delta portions with `is_additional = 1`. | Medium: Kitchen does not receive orders for extra food portions. |
| `app/transaksi.tsx:109` (`handleHoldOrder`) | Does not print kitchen tickets upon saving pending orders. | Trigger `printKitchenTicket` on new pending orders and `printKitchenAdditionalTicket` on updates. | High: Koki angkringan never gets kitchen tickets until checkout. |
| `components/table-selector-modal.tsx` | No table status states ("Kosong", "Terisi", "Siap Bayar"). | Add status badges and count indicators on table grid cards. | Low/Medium: Cashier lacks floor visibility. |
| `services/print.ts` & `components/receipt-preview-modal.tsx` | Missing "Tagihan Sementara" preview and print format. | Add `printTemporaryBill` and preview tab. | Medium: Unmet PRD requirement R4. |
| `package.json` | Missing `test` and `typecheck` scripts. | Add `"test": "node --test test/**/*.test.ts"` and `"typecheck": "tsc --noEmit"`. | Medium: Cannot run automated CI verification. |
| `services/print.ts:7,78,185,237,288` | Explicit checks `if (Platform.OS !== 'android') return;` scattered across functions. | App is strictly Android; clean up or unify check. | Low: Minor clutter. |
