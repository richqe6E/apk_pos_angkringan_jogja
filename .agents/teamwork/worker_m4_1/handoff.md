# Handoff Report — Worker M4: Financial Reports, History Sync & CSV Export Specialist

## 1. Observation
- **Authoritative Requirements**:
  Requirement R5 (`ORIGINAL_REQUEST.md:23-25`) specifies: "Lengkapi pencatatan serta pelaporan kas masuk dan kas keluar sesuai PRD agar tersinkronisasi antara halaman Keuangan, Riwayat Transaksi, dan Ekspor CSV. Sediakan filter periode (Hari Ini, 7 Hari, 1 Bulan, Pilih Bulan/Tanggal) serta rincian pembayaran (Tunai, QRIS, Transfer). Pastikan transaksi pending dan merged tampil semestinya di riwayat transaksi."
- **Pre-existing Code State**:
  - `app/(tabs)/history.tsx:93,106`:
    ```sql
    WHERE t.business_date = ? AND t.status = 'completed'
    ...
    WHERE t.status = 'completed'
    ```
    This completely excluded transactions with statuses other than `'completed'` (`pending`, `merged`, `cancelled`), preventing cashiers from auditing in-flight or merged orders.
  - `app/(tabs)/history.tsx:63`: Only had a toggle boolean `filterTodayOnly` between today and all time; lacked 7-day, 1-month, and custom date/month selectors.
  - `app/(tabs)/financial.tsx:48-63`: Only had previous/next month navigation for `selectedMonth`; lacked options for "Hari Ini", "7 Hari Terakhir", and custom day selection.
  - `stores/financialStore.ts:98-106`: Agregated `total_sales` and `tx_count` only; lacked payment method breakdown fields (`salesTunai`, `salesQris`, `salesTransfer`).
  - `services/backup.ts:1-162`: Contained JSON backup/restore functions, but lacked standardized CSV export utilities for transactions and financial statements.
  - File route naming: Codebase had `app/(tabs)/financial.tsx` mapped to tab route `financial`, while dispatch referenced `finance.tsx`.

## 2. Logic Chain
1. **Period Filtering Architecture**:
   - Built `buildPeriodSqlCondition()` and date arithmetic helpers (`getDateNDaysAgo`, `getPreviousMonth`, `getNextMonth`, `getPreviousDay`, `getNextDay`) in `stores/financialStore.ts`.
   - Supported 5 modes:
     - `'today'`: `business_date = ?` with `[todayBizDate]`.
     - `'7days'`: `business_date >= ? AND business_date <= ?` with `[startDate (6 days ago), todayBizDate]`.
     - `'month'`: `business_date LIKE ?` with `['YYYY-MM%']`.
     - `'custom_month'`: `business_date LIKE ?` with `['YYYY-MM%']`.
     - `'custom_date'`: `business_date = ?` with `[customDate]`.
   - This single engine powers both `history.tsx` (transactions and cash ledger) and `financial.tsx` (sales, cash ledger, and COGS).

2. **Visibility of Pending & Merged Orders**:
   - Replaced hardcoded `WHERE t.status = 'completed'` in `app/(tabs)/history.tsx` with dynamic status filtering (`all`, `completed`, `pending`, `merged`, `cancelled`).
   - Added visual status badges on each transaction card:
     - "Selesai" (`variant="success"`, green)
     - "Pending" (`variant="warning"`, amber)
     - "Digabung" (`variant="info"`, blue)
     - "Batal" (`variant="danger"`, red)
   - Added status filter chip bar ("Semua", "Selesai", "Pending", "Digabung", "Batal") with real-time record counts.

3. **Payment Method Breakdown Cards**:
   - In `app/(tabs)/history.tsx`: Aggregated completed transactions into `totalOmset`, `salesTunai`, `salesQris`, and `salesTransfer`, rendered as distinct summary cards.
   - In `stores/financialStore.ts` & `app/(tabs)/financial.tsx`: Extended `FinancialSummary` with `salesTunai`, `salesQris`, and `salesTransfer`. Displayed breakdown chips on the main financial screen and itemized details under Gross Sales in the operational PnL statement.

4. **Synchronization of Financial Reports, History & CSV Export**:
   - Synchronized `cash_ledger` queries in `history.tsx` using `type IN ('income', 'in')` for cash in and `type IN ('expense', 'out')` for cash out, using the exact same period filter as selected.
   - In `services/backup.ts`, implemented:
     - `exportTransactionsCsv(transactions, periodLabel)`: Exports transaction records with complete metadata, status, payment method, tax, discount, and summary rows matching on-screen totals.
     - `exportCashLedgerCsv(entries, periodLabel, tabType)`: Exports cash ledger entries with PnL vs Non-PnL segregation and totals.
     - `exportFinancialReportCsv(summary, entries, periodLabel)`: Exports comprehensive PnL statement (with payment method breakdown, COGS, category breakdown) and ledger entries.
   - Integrated these export functions directly into the "Unduh CSV" buttons of `history.tsx` and `financial.tsx`.
   - Created `app/(tabs)/finance.tsx` as a re-export of `financial.tsx`.

## 3. Caveats
- `expo-sharing` and `expo-file-system` are native modules that write to device cache/documents and trigger Android system share sheet; in a headless Node environment, they are mocked or guarded by `isAvailableAsync()`.
- Monthly COGS (`monthly_cogs`) in `financialStore` is configured per calendar month (`YYYY-MM`). For daily or 7-day filters within a month, it loads the COGS record belonging to that calendar month.

## 4. Conclusion
Milestone 4 (R5) is fully and genuinely implemented. Period filters ("Hari Ini", "7 Hari", "1 Bulan", "Pilih Bulan / Tanggal") dynamically update transactions and cash ledger; pending and merged transactions are fully visible with dedicated status badges and filters; omset payment method breakdown cards (Tunai, QRIS, Transfer, Total Omset) display accurately across screens; and CSV exports reflect the period filter and match on-screen figures.

## 5. Verification Method
1. **TypeScript Typecheck**:
   Command:
   `& "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit`
   Result: Exits with code 0 (0 errors).
2. **Automated Test Suite**:
   Command:
   `& "D:\AI PROJEK\node.exe" --test test/**/*.test.ts`
   Result: 15/15 tests pass across Tiers 1-4 (100% pass rate).
3. **Inspect Output Files**:
   - `stores/financialStore.ts`: Verify `buildPeriodSqlCondition`, `salesTunai`, `salesQris`, `salesTransfer`.
   - `services/backup.ts`: Verify `exportTransactionsCsv`, `exportCashLedgerCsv`, `exportFinancialReportCsv`.
   - `app/(tabs)/history.tsx`: Verify period filters, status badges, payment breakdown cards.
   - `app/(tabs)/financial.tsx` and `app/(tabs)/finance.tsx`: Verify period filters and payment breakdown chips.
