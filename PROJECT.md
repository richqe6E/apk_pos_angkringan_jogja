# Project: POS Angkringan Jogja (Pure Android)

## Architecture
- **Framework**: React Native with Expo (SDK 54), TypeScript, Expo Router (file-based navigation).
- **Target Platform**: Pure Android (smartphones and tablets), eliminating all iOS dependencies and platform branching.
- **State Management**: Zustand stores (`stores/transactionStore.ts`, `stores/menuStore.ts`, `stores/financialStore.ts`, `stores/printerStore.ts`, `stores/attendanceStore.ts`, `stores/purchaseStore.ts`).
- **Database Engine**: Local SQLite via `expo-sqlite` with atomic transactions (`db.withTransactionAsync`).
- **File System**: `expo-file-system/legacy` for permanent image storage in `documentDirectory`.
- **Thermal Printing**: ESC/POS formatting via Bluetooth SPP on Android.
- **Testing Engine**: Built-in `node:test` and `node:assert` via Node v24 for fast headless unit and integration testing.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Net Profit Fix | Fix double-counting of cash sales in `financialStore` | M1 | survey (R2) |
| 2 | Cash In Sync | Unify cash sale type to `'income'` so it appears in 'Kas Masuk' tab | M1 | survey (R2) |
| 3 | Receipt Info & Payment Method | Dynamic payment method (Tunai, QRIS, Transfer) & store profile in receipts | M1 | survey (R2) |
| 4 | Database Atomic Transactions | Wrap multi-query writes in `db.withTransactionAsync` | M1 | survey (R2) |
| 5 | Attendance Photo Cleanup | Delete physical files of expired months using DB-referenced paths | M1 | survey (R2) |
| 6 | Settings Auto-Loading | Auto-load store profile, PB1 tax, and printer configs at app startup | M1 | survey (R2) |
| 7 | Permanent Menu Photo Storage | Fix `file://` guard to ensure `saveImageLocally` writes to permanent storage | M2 | survey (R3) |
| 8 | Unified Menu Editor Modal | Consolidate Quick Edit & Edit into single `MenuFormModal`, delete duplicate modal | M2 | survey (R3) |
| 9 | Add-Menu Full Form | Comprehensive add-menu with image picker, barcode, stock, category | M2 | survey (R3) |
| 10 | iOS Cruft & Alert.prompt Elimination | Replace `Alert.prompt` with Android modal, remove Courier iOS font hacks | M2 | survey (R3) |
| 11 | Fast Long-Press on Transaction Screen | Reduce long-press delay to 200ms with haptics to open unified menu editor | M2 | survey (R3) |
| 12 | Additional Orders ('Pesanan Sambungan') | Track baseline qty to mark delta items with `is_additional = 1` | M3 | survey (R4) |
| 13 | Kitchen Ticket for Additional Orders | Trigger kitchen & delta ticket printing on pending save/update | M3 | survey (R4) |
| 14 | Table Merge Fix | Deduplicate identical items, preserve discount & PB1 tax in `mergeTables` | M3 | survey (R4) |
| 15 | Table Status & Temporary Bill | Add badges (Kosong, Terisi, Siap Bayar) and "Tagihan Sementara" print/preview | M3 | survey (R4) |
| 16 | Financial Reports Period Filters | Add Hari Ini, 7 Hari, 1 Bulan, Pilih Bulan period filters | M4 | survey (R5) |
| 17 | Payment Method Breakdown & CSV Export | Breakdown for Tunai, QRIS, Transfer in reports and CSV export | M4 | survey (R5) |
| 18 | Pending & Merged History Visibility | Display pending and merged transactions with appropriate badges in history | M4 | survey (R5) |
| 19 | Automated Test Suite (Tiers 1-4) | Native `node:test` suite covering financial, menu, table, and reports | M-E2E | survey (E2E) |
| 20 | Final E2E Pass & Adversarial Hardening | 100% E2E test pass, adversarial Tier 5 tests, forensic audit clean | M-FINAL | final |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Ponytail Initial Audit & Plan | R1: Comprehensive audit findings & repair plan | none | DONE |
| M-E2E | E2E Testing Suite (Tiers 1-4) | Automated headless test harness, test suites Tiers 1-4 | none | DONE |
| M1 | Financial, Cash In & Transaction Integrity | R2: Net profit, cash in sync, receipts, DB transactions, photo cleanup, settings auto-load | M0 | DONE |
| M2 | Menu Management & Pure Android Focus | R3: Permanent photo upload, unified editor modal, 200ms long press, iOS elimination | M0 | DONE |
| M3 | Table Management, Kitchen Tickets & Merge | R4: Additional orders, delta kitchen ticket, table merge, temporary bill & status | M1 | DONE |
| M4 | Financial Reports, History Sync & CSV Export | R5: Period filters, payment breakdown, pending/merged visibility, CSV sync | M1 | DONE |
| M-FINAL | Final Verification, E2E Pass & Hardening | Pass 100% E2E tests, Tier 5 adversarial hardening, TypeScript clean, Forensic Audit | M1, M2, M3, M4, M-E2E | DONE |

## Interface Contracts
### `stores/transactionStore.ts` ↔ Receipt & Kitchen Printing (`services/print.ts`, `components/receipt-preview-modal.tsx`)
- `checkout(...)`: Returns `{ txId, invoiceNumber, total, paymentAmount, change, dailySeq, paymentMethod }`
- `saveAsPendingOrder(...)`: Returns `{ txId, invoiceNumber, tableNumber, isAdditional, deltaItems }`
- `mergeTables(...)`: Preserves `discount_amount`, recalculates PB1 `tax_amount`, merges items with `GROUP BY menu_id, price`, updates `subtotal` and `total`.

### `components/menu-form-modal.tsx` ↔ `app/(tabs)/explore.tsx` & `app/transaksi.tsx`
- Single modal accepting `visible`, `onClose`, `initialData?: Menu | null`, `onSaved: () => void`, `onDeleted?: () => void`.
- Handles photo upload directly to `saveImageLocally(photoUri, 'menus')`.
- Includes stock adjustment steppers (`-5`, `-1`, `+1`, `+5`).

### `services/database.ts` ↔ Stores
- Multi-query operations MUST be wrapped in `await db.withTransactionAsync(async () => { ... })`.

## Code Layout
- `app/` - Expo Router screens
  - `_layout.tsx` - Root app layout, providers, settings auto-loader
  - `transaksi.tsx` - Main cashier POS screen (cart, menu grid, payment, hold order)
  - `(tabs)/`
    - `index.tsx` - Dashboard / Summary
    - `explore.tsx` - Menu management (unified edit modal, categories, stock)
    - `history.tsx` - Transaction history & cash ledger (period filters, payment breakdown)
    - `finance.tsx` - Financial report & PnL
    - `settings.tsx` - Store profile, PB1 tax, printer configuration
- `components/` - UI Components & Modals
  - `menu-form-modal.tsx` - UNIFIED comprehensive menu create/edit modal
  - `payment-modal.tsx` - Payment entry modal (Tunai, QRIS, Transfer)
  - `receipt-preview-modal.tsx` - Struk preview, temporary bill preview, kitchen preview
  - `table-selector-modal.tsx` - Table selection & status badges
  - `category-form-modal.tsx` - Pure Android category creation dialog
- `stores/` - Zustand application state
  - `transactionStore.ts` - Cart, checkout, pending orders, table merge
  - `menuStore.ts` - Menu CRUD, categories
  - `financialStore.ts` - Net profit, PnL, cash ledger
  - `printerStore.ts` - Printer connection & settings
  - `attendanceStore.ts` - Staff attendance & photo cleanup
- `services/` - Business logic & hardware drivers
  - `database.ts` - SQLite schema, migrations, connection
  - `print.ts` - ESC/POS receipt, kitchen ticket, temporary bill formatting
- `utils/` - Utility functions
  - `imageStorage.ts` - Local image persistence & cleanup
- `test/` - Automated test suites
  - `unit/` - Unit tests for stores, calculations, and deduplication
  - `e2e/` - Headless end-to-end integration flows
