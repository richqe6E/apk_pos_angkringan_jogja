# Orchestrator Master Plan: POS Angkringan Jogja (Pure Android)

## Goal
Resolve all bugs, broken integrations, and unimplemented features in Angkringan Jogja POS per PRD & audit findings, purely optimized for Android (tablet & smartphone), eliminating iOS-specific branches, adhering to ponytail methodology, starting with a comprehensive audit report & structured work plan (R1) before code modification.

## Phases

### Phase 0: Survey & Ponytail Initial Audit & Work Plan (R1)
- Dispatch 3 parallel Explorers:
  - Explorer 1 (Financial, Transactions & Data Integrity - R2 & R5):
    - Net profit calculation & cash-in duplication
    - Receipt printing, preview, payment methods (Tunai, QRIS, Transfer) & settings profile
    - Database transactions (`db.withTransactionAsync`) for multi-query operations
    - Attendance photo storage cleanup
    - Auto-load store profile, PB1 tax, and printer settings on startup
    - Financial reports, transaction history, CSV export synchronization & date filters
  - Explorer 2 (Menu Management, Photo Upload & Pure Android UX - R3):
    - Photo upload for menu items & permanent local storage
    - Unified Menu Edit Modal (photo, name, price, category, stock, barcode) across menu screen and transaction screen
    - Full add-menu form
    - Elimination of iOS-specific branches (e.g. `Alert.prompt`, `Platform.OS === 'ios'`) replaced with Android-compatible modals
    - Responsive long-press on product cards (~200ms delay) to open product editor
  - Explorer 3 (Table Management, Pending Orders & Kitchen Tickets - R4 & Test Harness):
    - Additional order on active/pending table: recording delta with `is_additional = 1` and printing kitchen/additional ticket
    - `mergeTables` logic: preserve tax/discount and merge identical items without duplication
    - Table status visibility and temporary bill
    - TypeScript compilation checks & test suite assessment
- Synthesize all findings into:
  - `AUDIT_FINDINGS.md` & `PLAN_PERBAIKAN.md`
  - `PROJECT.md` with Feature Inventory, Architecture, Interface Contracts, and Milestones.
- Report Audit Findings & Structured Work Plan back to user/sentinel before proceeding to Phase 1.

### Phase 1: Dual Track Execution
- Track A: E2E Testing Track
  - Design & implement test suites across Tiers 1-4 (Coverage, Boundary, Cross-feature, Real-world).
  - Output: `TEST_READY.md`.
- Track B: Implementation Track
  - Milestone 1: Financial & Transaction Integrity (R2)
  - Milestone 2: Menu Management & Android Focus (R3)
  - Milestone 3: Table Management & Pending Orders (R4)
  - Milestone 4: Reports, Sync & History (R5)

### Phase 2: Final Milestone & Verification
- Run 100% E2E test suite (Tiers 1-4).
- Adversarial hardening (Tier 5) with Challengers.
- Static typing check (`tsc --noEmit`), linter, and full test suite passing.
- Forensic Auditor integrity verification.
- Final victory claim to Sentinel.
