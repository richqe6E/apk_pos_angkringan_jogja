## 2026-11-07T04:38:34Z
You are Worker M3: Table Management, Kitchen Tickets & Merge Specialist.
Your working directory is: d:\Source_Code_Angkringan_Jogja\.agents\teamwork\worker_m3_1
Create and use your working directory for all metadata and reports.

You MUST read the authoritative request at:
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the project architecture and features at:
d:\Source_Code_Angkringan_Jogja\PROJECT.md
and the audit report and explorer findings at:
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\orchestrator\AUDIT_FINDINGS_AND_REPAIR_PLAN.md
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\explorer_survey_3\analysis.md
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\explorer_survey_3\handoff.md

WRITE OWNERSHIP:
You exclusively own:
- `stores/transactionStore.ts` (table merge, baseline quantity tracking, pending order delta marking)
- `components/table-selector-modal.tsx` (table status badges: Kosong, Terisi, Siap Bayar)
- `services/print.ts` (kitchen ticket printing, additional order ticket, printTemporaryBill)
- `components/receipt-preview-modal.tsx` (temporary bill preview tab & formatting)
- `app/transaksi.tsx` (trigger kitchen ticket on hold order, trigger temporary bill preview/print)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK (Milestone 3 Implementation - R4):
1. Fix Table Merge (`mergeTables` in `stores/transactionStore.ts`):
   - Wrap the entire merge in `await withSqliteRetry(() => db.withTransactionAsync(...))`.
   - Sum all discounts from primary and merged transactions (`SUM(discount_amount)`).
   - Consolidate `transaction_items` with identical `(menu_id, price)`: sum their `qty` and `subtotal`. Re-insert or update deduplicated rows for `primaryId`, and remove items from `otherIds`.
   - Recalculate PB1 tax (`tax_amount = round(newSubtotal * (taxRate / 100))`) if tax is enabled.
   - Calculate `newTotal = newSubtotal - totalDiscount + newTax`.
   - Update `transactions SET table_number = ?, subtotal = ?, discount_amount = ?, tax_amount = ?, total = ? WHERE id = ?`.
   - Update `transactions SET status = 'merged' WHERE id IN (...)`.
2. Delta Marking for Additional Orders ('Pesanan Sambungan'):
   - In `stores/transactionStore.ts`: when `openPendingOrder(tx)` loads an active table order, save a baseline map of existing quantities: `{ [menu_id]: qty }`.
   - When saving or updating pending order (`saveAsPendingOrder`), calculate delta:
     If `currentQty > baselineQty`, mark the extra portion as `is_additional = 1` (or split into baseline item with `is_additional = 0` and delta item with `is_additional = 1`, or set `is_additional = 1` for delta items).
   - In `saveAsPendingOrder`, return `{ txId, invoiceNumber, tableNumber, isAdditional, deltaItems }`.
3. Kitchen Ticket Printing on Hold Order:
   - In `app/transaksi.tsx:handleHoldOrder`:
     If it is an additional order on an active table with delta items, trigger `printKitchenAdditionalTicket` (printing only items with `is_additional = 1`).
     If it is a new pending table order, trigger `printKitchenTicket` (printing all items with table number and notes, without prices).
4. Table Status Visibility & Temporary Bill ('Tagihan Sementara'):
   - In `components/table-selector-modal.tsx`:
     Display clear visual badges for table status:
     - "Kosong" (green badge when table has no pending order)
     - "Terisi" (amber badge when table has pending order)
     - "Siap Bayar / Billing" (blue/purple badge when bill has been requested/printed)
     Provide button to preview/print Temporary Bill.
   - In `services/print.ts`:
     Add `formatTemporaryBillReceipt` and `printTemporaryBill`: format receipt with clear watermark/header `*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***`.
   - In `components/receipt-preview-modal.tsx`:
     Add tab or support for "Tagihan Sementara" preview.
5. Verification:
   - Run TypeScript check:
     `& "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit`
     Must exit with 0 errors.
   - Run test suite:
     `& "D:\AI PROJEK\node.exe" --test test/**/*.test.ts`
     Must pass 100% (15/15 tests pass).
6. Maintain `progress.md` with timestamps and create a 5-component `handoff.md` in your working directory.
When complete, send a message to orchestrator (`eac7280e-c735-4bcc-b8ca-6f3a330669d5`).
