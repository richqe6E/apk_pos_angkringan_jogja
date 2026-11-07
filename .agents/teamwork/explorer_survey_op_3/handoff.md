# Handoff Report: Cashier Identity (R5), Calendar Attendance (R6), QRIS & Multi-Bank Settings (R7), Codebase Baseline (R8)

**Role**: Cashier & Attendance Explorer (explorer_survey_op_3)  
**Date**: 2026-11-07  
**Working Directory**: `d:\apk pos angkringan jogja\apk_pos_angkringan_jogja`  
**State Folder**: `d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\explorer_survey_op_3`  

---

## 1. Observation

### 1.1 Codebase Baseline & Automated Tests (R8)
- **Command Executed**: `npm test` (`node --test test/**/*.test.ts`)
- **Result**:
  - 10 test suites, 28 tests executed across 5 test tiers:
    - `test/tier1-features.test.ts`: 7 tests passed (financial store, cash ledger, dynamic receipt formatting, db transaction wrapper, photo cleanup).
    - `test/tier2-boundary.test.ts`: 4 tests passed (table merge deduplication, PB1 tax preservation, boundary 0 items/clamp, delta additional orders).
    - `test/tier3-cross-feature.test.ts`: 3 tests passed (table merge + additional order + non-cash payment, kitchen tickets, stock decrement).
    - `test/tier4-scenarios.test.ts`: 1 full real-world cashier shift scenario passed (session open, merge, ledger, COGS, PnL, close).
    - `test/tier5-adversarial.test.ts`: 13 adversarial hardening tests passed (multi-table stress, discount clamping, empty cart, rapid delta orders, PnL mathematical truth, photo cleanup idempotency, unicode/emoji receipt formatting).
  - Total duration: ~826ms. Exit code: 0. 28 pass, 0 fail.
- **Test Architecture**:
  - Native Node 22 test runner (`node:test`, `node:assert/strict`).
  - `test/helpers/db.js`: Emulates Expo SQLite using in-memory `node:sqlite` (`DatabaseSync(':memory:')`) with exact 15-table relational schema matching `services/database.ts`.
  - Helpers `transactionEngine.js`, `financialEngine.js`, `receiptFormatter.js`, `photoCleanup.js` emulate business logic.

---

### 1.2 Requirement R5: Pemilihan Identitas Kasir
- **Database Schema**:
  - `services/database.ts:130`: Table `transactions` definition:
    ```sql
    CREATE TABLE IF NOT EXISTS transactions (
      ...
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      cashier_name TEXT NOT NULL DEFAULT 'Kasir'
    );
    ```
    The column `cashier_name` already exists in the SQLite schema with default `'Kasir'`.
- **State Plumbing & Checkout Flow**:
  - In `stores/transactionStore.ts`:
    - Line 35: `TransactionState` interface contains no fields for `activeCashierId` or `activeCashierName`.
    - Lines 559-565: `saveAsPendingOrder()` inserts into `transactions` without specifying `cashier_name`:
      ```ts
      INSERT INTO transactions (
        invoice_number, business_date, table_number, customer_id, customer_name,
        subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
        change_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'tunai', 0, 0, 'pending')
      ```
    - Lines 726-742: `checkout()` for pending orders updates `transactions` without updating `cashier_name`.
    - Lines 772-790: `checkout()` direct payment inserts into `transactions` without specifying `cashier_name`:
      ```ts
      INSERT INTO transactions (
        invoice_number, business_date, table_number, customer_id, customer_name,
        subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
        change_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
      ```
  - In `app/transaksi.tsx`:
    - Line 201: Hardcoded `cashierName: 'Kasir'` in `tempBillPayload`.
    - Line 607: Hardcoded `cashierName: 'Kasir'` in `receiptPayload`.
    - No dialog or modal prompting cashier identity selection on startup or during operational shifts.
- **Receipt Printing & History**:
  - `services/print.ts:63`: `PrintReceiptData` interface defines `cashierName?: string`.
  - `services/print.ts:106`: `printCustomerReceipt()` already prints `Kasir    : ${data.cashierName || 'Kasir'}\n\r`.
  - `services/print.ts:326, 415`: `formatTemporaryBillReceipt()` and `printTemporaryBill()` already print `Kasir    : ${data.cashierName || 'Kasir'}`.
  - `components/receipt-preview-modal.tsx:139`: Renders `Kasir: {data.cashierName || 'Kasir'}` on the preview paper.
  - `app/(tabs)/history.tsx:56, 187`: `TransactionRow` has `cashier_name`, and reprints pass `cashierName: tx.cashier_name || 'Kasir'`.
  - `components/table-selector-modal.tsx:75, 91`: Already reads `cashier_name` from transactions for temporary billing.
- **Employee Source**:
  - `stores/employeeStore.ts:4-10`: `Employee` interface:
    ```ts
    export interface Employee {
      id: number;
      name: string;
      phone: string;
      is_active: number; // 1 = aktif, 0 = nonaktif
      created_at: string;
    }
    ```
    Master employee list is already maintained, loaded via `loadEmployees(db)`.

---

### 1.3 Requirement R6: Tampilan Rekap Absensi Berbasis Kalender
- **Current Screen Implementation**:
  - `app/(tabs)/attendance.tsx:305-377`: `renderHistoryTab()` renders a simple vertical `FlatList` displaying `attendanceHistory` sequentially with cards showing `#index`, photo thumbnail, employee name, business date, check in/out time, and late badge.
  - No monthly visual grid or interactive calendar navigation exists.
- **Database & Store Architecture**:
  - `stores/attendanceStore.ts:174-200`: `loadAttendanceHistory(db, monthPrefix)` already supports querying by month prefix:
    ```ts
    if (monthPrefix) {
      query = 'SELECT * FROM attendance WHERE business_date LIKE ? ORDER BY id DESC';
      params.push(`${monthPrefix}%`);
    }
    ```
  - `services/database.ts:156-168`: `attendance` table structure:
    - `id`, `employee_id`, `employee_name`, `business_date` (format `'YYYY-MM-DD'`), `check_in_time` (e.g. `'17:15'`), `check_in_photo`, `is_late`, `late_minutes`, `check_out_time`.
    - `CONSTRAINT uq_emp_date UNIQUE (employee_id, business_date)` guarantees at most 1 attendance record per employee per business date.
  - `stores/financialStore.ts:60-70`: Existing date helpers `getPreviousMonth(monthStr)` and `getNextMonth(monthStr)` can be reused.

---

### 1.4 Requirement R7: Pengaturan Pembayaran QRIS dan Multi-Rekening Transfer
- **Current Settings Screen**:
  - `app/(tabs)/settings.tsx`: Currently handles `storeName`, `storeAddress`, `storePhone`, `receiptFooter`, `adminPin`, multi-printer Bluetooth configuration, JSON backup/restore, and database reset.
  - Has NO section or state for uploading store QRIS image.
  - Has NO section or state for configuring bank accounts.
- **Current Cashier Payment Modal**:
  - `components/payment-modal.tsx:170-209`: Has buttons for `💵 Tunai`, `📱 QRIS`, `🏦 Transfer`.
  - Lines 237-242: When `paymentMethod === 'qris'` or `paymentMethod === 'transfer'`, it only renders static text:
    ```tsx
    <View style={styles.nonCashNotice}>
      <Text style={styles.nonCashText}>
        Pembayaran via <Text style={{ fontWeight: '700' }}>{paymentMethod.toUpperCase()}</Text> sebesar {formatRupiahDisplay(total)} diakui lunas secara otomatis tanpa kembalian uang fisik.
      </Text>
    </View>
    ```
    No image is displayed for QRIS, and no bank choices are presented for Transfer.
- **Image Storage Infrastructure**:
  - `utils/imageStorage.ts:9-48`: `saveImageLocally(sourceUri, folder)` copies image to isolated app document directory: `${FileSystem.documentDirectory}${folder}/${filename}`.
  - `expo-image-picker` is already installed in `package.json` (`~17.0.11`).
- **Database Key-Value Storage**:
  - Table `settings` (`key TEXT PRIMARY KEY, value TEXT NOT NULL`) is available for zero-migration storage of `'qris_image_path'` and `'bank_accounts'` (serialized JSON string).

---

## 2. Logic Chain

### 2.1 Cashier Identity Selection Logic (R5)
1. **Trigger Condition**:
   - An Angkringan shift starts with an active cashier on duty.
   - If `activeCashierName` in `useTransactionStore` is empty when the cashier screen (`app/transaksi.tsx`) is opened, a mandatory modal `CashierSelectorModal` must prompt the user to choose their name from registered employees (`employees.filter(e => e.is_active === 1)`).
2. **Persistence & Mutability**:
   - The selected cashier is saved in `useTransactionStore`: `activeCashierId` and `activeCashierName`.
   - A header badge button in `app/transaksi.tsx` (e.g., `👤 Kasir: Rian ▾`) displays the current cashier and allows switching cashiers at any time during shifts without restarting the application.
3. **Transaction Association**:
   - During `saveAsPendingOrder()`: `cashier_name = activeCashierName || 'Kasir'` is written to `transactions`.
   - During `checkout()`:
     - Direct checkout: `cashier_name = activeCashierName || 'Kasir'` is written into `transactions`.
     - Pending checkout: `cashier_name = activeCashierName || 'Kasir'` is updated on the completed transaction.
4. **Receipt Propagation**:
   - In `app/transaksi.tsx`, `receiptPayload.cashierName` and `tempBillPayload.cashierName` use `activeCashierName || 'Kasir'`.
   - `services/print.ts` and `components/receipt-preview-modal.tsx` already read `data.cashierName` and print `Kasir    : ${data.cashierName || 'Kasir'}`.
   - For internal audit: `formatCustomerReceiptLines` / `printCustomerReceipt` acts as the Struk Kasir / Arsip Audit Internal (as designated in `WORKFLOW_IMPLEMENTASI_POS_ANGKRINGAN.md:102`), with full price details, payment method, and cashier name clearly stamped.

### 2.2 Interactive Calendar Attendance Recap Logic (R6)
1. **Calendar State Representation**:
   - State: `selectedMonth` (`'YYYY-MM'`, default current month) and `selectedDate` (`'YYYY-MM-DD'`, default today).
   - Monthly Query: Call `loadAttendanceHistory(db, selectedMonth)`.
   - Group records in memory by date: `Map<string, AttendanceRecord[]>`.
2. **Pure React Native Grid Math (Zero Dependency)**:
   - Calculate days in month: `daysInMonth = new Date(year, month, 0).getDate()`.
   - Calculate month start weekday offset: `firstDayOfWeek = new Date(year, month - 1, 1).getDay()` (0 = Sun, 6 = Sat).
   - Generate grid cells (weeks rows x 7 days cols).
   - In each day cell:
     - Date number (1..31).
     - Indicator badge: green badge/dot if `records.length > 0` and all on time; amber badge/dot if any employee late (`is_late === 1`); blank if no attendance (off-day/closed).
     - Visual state: Active highlight (Emerald background + border) when `dateStr === selectedDate`.
3. **Interactive Date Detail Section**:
   - On tapping any date cell: `setSelectedDate(dateStr)`.
   - The detail view immediately updates to show:
     - Header: Formatted date (e.g. "Sabtu, 07 November 2026").
     - Metric chips: Total Staf Hadir, Tepat Waktu, Terlambat.
     - Attendance record cards for all employees on that date: Check-in photo thumbnail, Name, In/Out times, status pill.
     - Empty state banner if no attendance exists on that day.

### 2.3 QRIS & Multi-Bank Settings + Cashier Display Logic (R7)
1. **Storage Mechanism (Zero Database Migration)**:
   - To strictly respect Rule R8 ("Jaga konsistensi data tanpa mengubah struktur database tanpa kebutuhan jelas"), store:
     - `'qris_image_path'`: string path in `settings` table.
     - `'bank_accounts'`: JSON array string `[{"id":"1","bank_name":"BCA","account_number":"1234567890","account_holder":"Angkringan Jogja"}]` in `settings` table.
2. **Settings UI**:
   - QRIS section: Image picker launcher (`ImagePicker.launchImageLibraryAsync`), saves via `saveImageLocally(uri, 'logo')`, saves path to `settings`. Shows preview thumbnail and "Ganti / Hapus" buttons.
   - Multi-Bank section: Table/cards of configured accounts. Modal/form to add new account (Bank name, account number, account holder). Delete button per account.
3. **Cashier Screen (`components/payment-modal.tsx`)**:
   - When QRIS selected:
     - If QRIS image exists: render image prominently (e.g. 240x240px card with QR frame), display total amount, and button to open full-screen modal for customer scanning.
     - If QRIS image absent: show warning banner guiding user to configure it in Settings.
   - When Transfer selected:
     - Render selectable cards for all configured bank accounts.
     - Display bank name badge, bold account number with "Salin" (Copy to clipboard) button, and account holder.
     - Cashier selects which bank account customer transferred to.

### 2.4 Written Analysis on Automated Bank Mutation Reconciliation (R7)
- Detailed below in Section 4.3 as a structured, pragmatic report comparing 5 technical approaches for Indonesian angkringan operations.

### 2.5 Test Compatibility Logic (R8)
- In `transactions` table, `cashier_name` defaults to `'Kasir'`.
- All existing 28 tests omit `cashier_name` or test the default fallback:
  - `test/tier5-adversarial.test.ts:805`: `assert.ok(lines.some((l) => l === 'Kasir    : Kasir'));`
  - `test/tier1-features.test.ts:210`: Explicitly tests `cashierName: 'Rian Kasir'` in receipt formatting.
- Therefore, populating `cashier_name` dynamically with fallback to `'Kasir'` preserves 100% compatibility with all existing test assertions.

---

## 3. Caveats
1. **Network Independence**: The entire application is designed to operate 100% offline on Android tablets. Cloud-based banking webhook integrations requiring public internet endpoints (like direct bank open banking callbacks) cannot function in an offline local SQLite environment without an internet bridge.
2. **Static QRIS vs Dynamic QRIS**: The requested QRIS feature in R7 is a static store QRIS image (standard Merchant-Presented QRIS sticker uploaded by the owner). It displays the store's static QR code; customers scan and input the nominal amount manually on their e-wallet / m-Banking app. Dynamic QR generation (with embedded transaction amount) requires an active payment gateway API key and internet connectivity.
3. **External Dependencies**: No new external packages (such as `react-native-calendars`) should be installed. React Native's built-in `View`, `Text`, `TouchableOpacity`, and native JavaScript `Date` math are completely sufficient and preserve minimal bundle size.

---

## 4. Conclusion & Technical Implementation Plan

### 4.1 Requirement R5: Cashier Identity Architecture
- **Step 1: Update `stores/transactionStore.ts`**:
  - Add state properties:
    ```ts
    activeCashierId: number | null;
    activeCashierName: string;
    setActiveCashier: (id: number | null, name: string) => void;
    ```
  - In `saveAsPendingOrder()`:
    Include `cashier_name` in the SQL `INSERT INTO transactions` query:
    ```ts
    INSERT INTO transactions (..., cashier_name) VALUES (..., ?)
    ```
    passing `activeCashierName || 'Kasir'`.
  - In `checkout()`:
    - Direct payment insert: Include `cashier_name` in `INSERT INTO transactions`.
    - Pending settlement update: Include `cashier_name = ?` in `UPDATE transactions SET ...`.
- **Step 2: Component `components/cashier-selector-modal.tsx`**:
  - Dedicated modal listing active employees (`is_active === 1`).
  - Search/filter by employee name.
  - One-tap selection that calls `setActiveCashier(emp.id, emp.name)` and closes modal.
- **Step 3: Update `app/transaksi.tsx`**:
  - Add `cashierModalVisible` state.
  - In `useEffect` / `useFocusEffect`: if `!activeCashierName`, automatically set `cashierModalVisible(true)`.
  - In top navigation bar, place an interactive cashier pill badge:
    ```tsx
    <TouchableOpacity onPress={() => setCashierModalVisible(true)} style={styles.cashierBadge}>
      <IconSymbol name="person.crop.circle" size={16} color={Colors.primary} />
      <Text style={styles.cashierBadgeText}>Kasir: {activeCashierName || 'Pilih Kasir'}</Text>
    </TouchableOpacity>
    ```
  - In `handleDirectCheckout` and `handleSaveAsPending`: pass `activeCashierName || 'Kasir'` to `receiptPayload` and `tempBillPayload`.

---

### 4.2 Requirement R6: Calendar Attendance Recap Architecture
- **Step 1: Calendar Grid Algorithm**:
  - Compute calendar month matrix for `selectedMonth` (`'YYYY-MM'`):
    ```ts
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun
    ```
  - Build array of cells (empty prefix cells + day 1..daysInMonth).
  - Map attendance records into lookup dictionary: `recordsByDate[dateString] = AttendanceRecord[]`.
- **Step 2: Two-Tier Layout in `app/(tabs)/attendance.tsx:renderHistoryTab`**:
  - **Upper Section: Interactive Month Calendar**:
    - Header: Month switcher (`◀`, `November 2026`, `▶`, button "Bulan Ini").
    - Weekday labels: `Min`, `Sen`, `Sel`, `Rab`, `Kam`, `Jum`, `Sab`.
    - Day Cells:
      - Date number.
      - Pill badge: e.g. `✓ 4 Hadir` (green) if all on time; `! 1 Terlambat` (amber) if any late.
      - Selection style: Emerald background + white text when `cellDate === selectedDate`.
  - **Lower Section: Date Breakdown View (`selectedDate`)**:
    - Header: `📅 Rincian Absensi: ${formatFullIndonesianDate(selectedDate)}`.
    - Summary badges: Total Hadir, Tepat Waktu, Terlambat.
    - List of employee cards on that date showing: Check-in photo thumbnail (tappable to view), Employee Name, Check-in Time, Check-out Time, Status Badge (`Tepat Waktu` / `Terlambat X Menit`).
    - Action buttons: "Unduh PDF (Hari Ini)", "Unduh CSV", "Bersihkan Foto".

---

### 4.3 Requirement R7: QRIS, Multi-Bank & Mutation Reconciliation Analysis

#### Implementation Specification
1. **Modul Pengaturan (`app/(tabs)/settings.tsx`)**:
   - **QRIS Image Management**:
     - State `qrisImagePath: string`.
     - Button "Pilih / Ganti Foto QRIS" using `ImagePicker.launchImageLibraryAsync`.
     - Saves image file using `saveImageLocally(uri, 'logo')`.
     - Persists path in `settings` table with key `'qris_image_path'`.
     - Previews image in card with a "Hapus QRIS" option.
   - **Multi-Bank Management**:
     - State `bankAccounts: BankAccount[]` where:
       ```ts
       interface BankAccount {
         id: string;
         bank_name: string;
         account_number: string;
         account_holder: string;
       }
       ```
     - Persists serialized JSON string in `settings` table with key `'bank_accounts'`.
     - UI displaying existing accounts with bank badge, account number, account holder, and delete button.
     - Modal form to add a new bank account.
2. **Modul Kasir (`components/payment-modal.tsx`)**:
   - **When QRIS is selected**:
     - Load `qris_image_path` from settings.
     - If path exists: render clean QRIS image card with store branding, scan instructions, and a "Tampilkan Layar Penuh" modal so the customer can scan directly.
     - Display total bill prominently underneath: `Total Tagihan: Rp XX.XXX`.
   - **When Transfer is selected**:
     - Load `bank_accounts` from settings.
     - Display selectable bank account cards (BCA, Mandiri, BRI, etc.).
     - Show account number in bold monospace with a "Salin" (Copy) button.
     - Cashier selects the destination account; selection is saved into transaction note.

---

#### Written Analysis: Automated Bank Mutation & Receipt Reconciliation for Angkringan Jogja

##### Context & Industry Challenge
Angkringan businesses in Yogyakarta operate with high transaction volume, fast customer turnaround, and predominantly low-to-medium ticket sizes (Rp 10.000 – Rp 150.000). During peak evening hours (19:00 – 23:00 WIB), manual transfer verification poses severe operational risks:
1. **Checkout Bottlenecks**: Cashiers must ask customers to show mobile banking transfer receipts on their personal phone screens, squint at tiny transaction numbers, or wait for the business owner to check mobile banking balance notifications.
2. **Fraud via Fake Receipt Apps**: Rogue customers utilize well-known Android mock receipt generators or Telegram bots that produce pixel-perfect fake BCA/BRI/Mandiri transfer screenshots.
3. **Offline POS Constraint**: The core strength of POS Angkringan Jogja is its 100% offline local SQLite architecture, which protects the store from internet outages.

##### Comparative Analysis of 5 Technical Alternatives

| Alternative | Architecture | Latency | Infrastructure Cost / Fees | Offline Viability | Fraud Prevention Rating |
|---|---|---|---|---|---|
| **Alt 1: Dynamic QRIS via Payment Gateway** (Midtrans/Xendit/Duitku) | Cloud Webhook / WebSocket | Real-time (1-3s) | 0.3% - 0.7% MDR per transaction | Requires Internet during checkout | **10/10** (Bank-backed cryptographic settlement) |
| **Alt 2: Web Scraping / Mutation Aggregator** (Moota/Oy! Bisnis/Cekmutasi) | Robot login to KlikBCA / BRI CMS + unique cents (kode unik) | 1 - 5 minutes polling | Subscription fee (Rp 50k - Rp 150k/month) | Requires Internet on server | **7/10** (Subject to bank captcha & UI breaking changes) |
| **Alt 3: SNAP BI Open Banking API** (Direct Corporate Bank API) | Official Bank Indonesia Standard Open API Webhook | Real-time (<1s) | High setup cost + Corporate PT/CV account requirements | Requires Internet & Corporate Server | **10/10** (Enterprise level compliance) |
| **Alt 4: On-Device Receipt OCR & Reference De-duplication** | Cashier snaps photo of customer's m-banking screen; local ML Kit OCR extracts Ref # & Amount | Immediate (<1s) | **Zero fees** (100% free & local) | **100% Offline Capable** | **8.5/10** (Detects duplicate ref numbers & amount mismatch) |
| **Alt 5: Local SMS/Push Notification Bridge** (Dedicated Owner Device) | Android Notification Listener service on owner phone broadcasts incoming bank alerts via local Wi-Fi | 2 - 5 seconds | **Zero fees** (Uses existing SIM & local network) | Works on Local LAN without Cloud Server | **9/10** (Real bank SMS/push confirmation) |

##### In-Depth Evaluation

1. **Alternative 1 (Dynamic QRIS via Payment Gateway - Midtrans/Xendit/Duitku)**:
   - *How it works*: POS generates a unique dynamic QR code for each transaction containing the exact bill amount. When the customer scans and pays with BCA, GoPay, OVO, or Dana, the gateway triggers a webhook to confirm payment.
   - *Pros*: Completely eliminates manual checking; impossible to fake; eliminates transfer slips.
   - *Cons*: Requires active internet at the cashier; incurs Bank Indonesia QRIS MDR fee (0.3% for micro-merchants); requires internet server endpoint to receive webhooks.
2. **Alternative 2 (Bank Mutation Scraper with Unique Codes - Moota / Cekmutasi)**:
   - *How it works*: POS adds a random 3-digit unique code to the bill (e.g. Rp 45.123). A scraping bot logs into KlikBCA Bisnis every 2 minutes. When Rp 45.123 is spotted in mutations, the transaction is marked verified.
   - *Pros*: Works with regular bank accounts without payment gateway registration.
   - *Cons*: Kode unik complicates cash accounting; polling delay of 1-3 minutes causes queue backups; banks frequently block scraper IPs or implement biometric/CAPTCHA challenges; high maintenance burden.
3. **Alternative 3 (SNAP BI Open Banking API)**:
   - *How it works*: Standardized Bank Indonesia API for account balance and mutation queries.
   - *Pros*: Legally compliant, highly stable, direct bank SLA.
   - *Cons*: Prohibitive for independent angkringan owners; requires corporate entity registration (PT), bank compliance auditing, and minimum monthly transaction volume commitments.
4. **Alternative 4 (On-Device OCR & Reference De-duplication - RECOMMENDED FOR OFFLINE)**:
   - *How it works*: Cashier uses the tablet camera to scan the customer's transfer success screen. An on-device OCR extracts the Bank Transaction Reference Number (e.g. `BCA-20261107-987654`) and Amount. The POS verifies that the amount matches the bill and checks SQLite table `transactions` to ensure the reference number has not been used before.
   - *Pros*: Operates 100% offline; zero transaction fees; eliminates the common fraud of re-using an old transfer screenshot; takes less than 2 seconds.
   - *Cons*: Cannot detect if the customer generated a completely fictional reference number with a fake app (only catches duplicate re-use and amount mismatch).
5. **Alternative 5 (Local Push Notification Bridge)**:
   - *How it works*: The business owner's smartphone (which receives bank SMS and m-Banking push notifications) runs a lightweight background daemon that listens for "Dana masuk" notifications. When detected, it broadcasts an encrypted UDP/HTTP packet over the angkringan's local Wi-Fi router directly to the POS tablet.
   - *Pros*: Real-time verification that money actually reached the owner's bank account; works on local Wi-Fi without any cloud servers or subscription fees.
   - *Cons*: Requires the owner's phone to remain connected to the shop's local Wi-Fi network during operating hours.

##### Strategic Recommendation for Angkringan Jogja
- **Phase 1 (Immediate / R7 Scope)**:
  - Implement static store QRIS display with high-contrast screen presentation and zoom.
  - Implement multi-bank account selector with clear account number copy and account holder display.
  - Include cashier verification checkbox: *"Kasir telah memeriksa mutasi / struk transfer"*.
- **Phase 2 (Next Milestone - Offline Fraud Protection)**:
  - Add optional input field for `bank_transfer_ref_no` (last 4 digits or full transaction ID) recorded into SQLite `transactions` table with an indexed unique constraint to prevent screenshot re-use.
- **Phase 3 (Scale-up Milestone - Automated Cloud Reconciliation)**:
  - When the business scales or acquires stable Wi-Fi, integrate Midtrans / Xendit Dynamic QRIS for automated instant settlement verification.

---

## 5. Verification Method

### 5.1 Automated Test Verification
- Run existing test suite:
  ```bash
  npm test
  ```
  Expected result: 28 passing tests across Tier 1 through Tier 5 with 0 failures.
- Invalidation condition: Any failure or regression in `test/tier1-features.test.ts` through `test/tier5-adversarial.test.ts`.

### 5.2 Source File Inspection Checklist
| Requirement | Target File | Verification Check |
|---|---|---|
| **R5** | `stores/transactionStore.ts` | Verify `activeCashierName` state and that `cashier_name` is passed in `INSERT` and `UPDATE` statements |
| **R5** | `components/cashier-selector-modal.tsx` | Verify active employee list rendering and cashier selection handler |
| **R5** | `app/transaksi.tsx` | Verify modal prompt when no cashier active, top bar cashier badge button, and `receiptPayload.cashierName` propagation |
| **R6** | `app/(tabs)/attendance.tsx` | Verify interactive monthly calendar grid with `<` / `>` navigation, day cells with attendance indicators, and date breakdown view on click |
| **R7** | `app/(tabs)/settings.tsx` | Verify photo upload for QRIS (`saveImageLocally`), storage in `settings` table (`qris_image_path`), and multi-bank account management (`bank_accounts`) |
| **R7** | `components/payment-modal.tsx` | Verify QRIS image rendering when QRIS is selected, and multi-bank selector cards with copy button when Transfer is selected |

### 5.3 Manual Testing Steps on Device / Emulator
1. **Cashier Selection**:
   - Open Transaksi screen. Confirm `CashierSelectorModal` appears if no cashier selected.
   - Select an employee (e.g., "Agus"). Confirm header badge shows `Kasir: Agus`.
   - Complete checkout. Print receipt preview. Confirm receipt shows `Kasir    : Agus`.
2. **Attendance Calendar**:
   - Open Absensi tab -> Rekap & Riwayat.
   - Confirm monthly calendar displays with day numbers.
   - Click date with attendance records. Confirm employee details (photo, time, status) display underneath.
   - Click date without attendance. Confirm friendly empty state displays.
   - Navigate previous/next months.
3. **QRIS & Multi-Bank**:
   - Open Pengaturan. Upload a QRIS photo. Add two bank accounts (BCA and Mandiri). Save.
   - Open Transaksi -> Keranjang -> Bayar.
   - Select QRIS: confirm uploaded QRIS image appears clearly.
   - Select Transfer: confirm BCA and Mandiri cards appear with account numbers and account holders.
