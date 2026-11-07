## 2026-11-07T11:00:10Z
You are worker_m5 for Milestone 5 (QRIS Photo & Multi-Bank Accounts Integration - R7, and Written Reports - R3 & R7).

## 🔒 MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Inputs
1. Working directory: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja
2. Original Request: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\ORIGINAL_REQUEST.md
3. Project Plan & Architecture: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\PROJECT.md
4. Explorer Survey Report 2 (Section 1.2 & 2.2 Struk Tagihan Sementara): d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\explorer_survey_op_2\handoff.md
5. Explorer Survey Report 3 (Section 1.4, 2.3, 2.4, 4.3 QRIS, Multi-Bank & Mutation Analysis): d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\explorer_survey_op_3\handoff.md
6. State folder: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\worker_m5

## Scope & Assigned Tasks (Milestone 5 - Requirements R7 & R3)
1. **Modul Pengaturan (`app/(tabs)/settings.tsx`)**:
   - **QRIS Photo Management**:
     - Allow user to pick an image from gallery via `ImagePicker.launchImageLibraryAsync`.
     - Save local image file using `saveImageLocally(uri, 'logo')`.
     - Persist the file path string in SQLite `settings` table with key `'qris_image_path'`.
     - Render QRIS preview card in Settings with "Ganti Foto" and "Hapus QRIS" options.
   - **Multi-Bank Accounts Management**:
     - Allow user to add and manage multiple destination bank accounts (e.g. BCA, Mandiri, BRI, BNI).
     - Fields: Bank Name, Account Number (Nomor Rekening), Account Holder (Nama Pemilik Rekening).
     - Persist as a JSON array string in SQLite `settings` table with key `'bank_accounts'`.
     - Render existing bank cards with account details and delete buttons.
2. **Modul Kasir (`components/payment-modal.tsx`)**:
   - **QRIS Payment Display**:
     - When payment method `QRIS` is selected:
       - Load `'qris_image_path'` from `settings` table.
       - If image exists: render image prominently with store branding, scan guidance, and a modal view for full-screen customer scanning.
       - If image not yet uploaded: display helpful placeholder banner guiding owner to set it up in Pengaturan.
   - **Transfer Payment Multi-Bank Display**:
     - When payment method `Transfer` is selected:
       - Load `'bank_accounts'` from `settings` table.
       - Render selectable bank account cards with bank badge, bold account number, "Salin" (copy to clipboard) button, and account holder name.
       - Allow cashier to tap a bank account to select it.
3. **Written Reports**:
   - Author `docs/EVALUASI_STRUK_TAGIHAN_SEMENTARA.md`:
     - Thorough operational evaluation of Temporary Bill Receipts in Angkringan operations.
     - Compare with table pending transactions, customer receipts, cashier audit receipts, and kitchen tickets.
     - Evaluate relevance, anti-fraud watermarks, and justify keeping it as an optional on-demand feature without cluttering fast checkout.
   - Author `docs/ANALISIS_INTEGRASI_MUTASI_BANK.md`:
     - In-depth comparative analysis of 5 alternative approaches for bank mutation & receipt reconciliation for Angkringan Jogja (Dynamic QRIS, Scraping/Aggregator, SNAP BI Open Banking, On-Device Receipt OCR, Local Push Notification Bridge).
     - Evaluate each against latency, cost, offline viability, and fraud risk.
     - Provide strategic phased recommendation for the business owner.

## Exclusive File Ownership
You have exclusive write ownership of:
- `app/(tabs)/settings.tsx`
- `components/payment-modal.tsx`
- `docs/EVALUASI_STRUK_TAGIHAN_SEMENTARA.md`
- `docs/ANALISIS_INTEGRASI_MUTASI_BANK.md`

DO NOT modify files owned by other workers.

## Verification Requirements
Run the test suite:
- `npm test` or `node --test test/**/*.test.ts`
All 28 existing tests must pass with 0 regressions.
If TypeScript typecheck is available, run `npx tsc --noEmit`.
