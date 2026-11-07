# E2E Test Infra: POS Angkringan Jogja

## Test Philosophy
- Opaque-box & domain-driven: Verifikasi logika bisnis, integritas data SQLite, transaksi penjualan, manajemen meja dinamis, identitas kasir, mutasi kas/hutang, dan pemformatan struk thermal.
- Framework: Native Node.js v24 `node:test` + `node:sqlite` in-memory standalone runner.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Cashier Shift Scenarios.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1-5 Status | Tier 6 (Operational) Plan |
|---|---------|---------------------|:---------------:|:-------------------------:|
| 1 | R1: Penghapusan Menu & Integritas Relasi | ORIGINAL_REQUEST §R1 | Pass (basic) | T6.1: Menu deletion with sales history & seed protection |
| 2 | R1: Form Tambah/Edit & Quick Edit Kasir | ORIGINAL_REQUEST §R1 | Pass (calc) | T6.2: Quick edit price/stock update & persistence |
| 3 | R2: Tombol Aksi Kanan Atas | ORIGINAL_REQUEST §R2 | Pass (UI/handlers) | T6.3: Export PDF/CSV data consistency & COGS logic |
| 4 | R4: Manajemen Meja Dinamis | ORIGINAL_REQUEST §R4 | Pass (table merge) | T6.4: Dynamic table JSON CRUD, ordering & pending sync |
| 5 | R5: Identitas Kasir Operasional | ORIGINAL_REQUEST §R5 | Pass (format) | T6.5: Active cashier binding to tx & receipt headers |
| 6 | R6: Form Reward & Pembelian Bahan | ORIGINAL_REQUEST §R6 | Pass (PnL) | T6.6: Tempo vs Cash supplier purchase & ledger flow |
| 7 | R7: Kalender Absensi Interaktif | ORIGINAL_REQUEST §R7 | Pass (attendance) | T6.7: Business date filtering & daily staff aggregation |
| 8 | R8: Metode Pembayaran QRIS & Multi-Bank | ORIGINAL_REQUEST §R8 | Pass (methods) | T6.8: Multi-bank JSON parsing & payment payload |

## Test Architecture
- Test runner: `node --test test/**/*.test.ts` (alias: `npm test`)
- Pass/Fail semantics: Exit code 0, 0 failures, 0 skipped.
- Test case format: Native `node:test` suites with strict `node:assert/strict`.
- Directory layout:
  * `test/helpers/`: SQLite in-memory database harness, schema migrations, engine simulators.
  * `test/tier1-features.test.ts`: Feature coverage unit tests.
  * `test/tier2-boundary.test.ts`: Boundary and corner cases.
  * `test/tier3-cross-feature.test.ts`: Cross-feature combinations.
  * `test/tier4-scenarios.test.ts`: Full real-world cashier shift workflow.
  * `test/tier5-adversarial.test.ts`: White-box adversarial edge cases.
  * `test/tier6-operational-enhancements.test.ts`: New operational verification suite for R1-R8.

## Coverage Thresholds
- Baseline Tiers 1-5: 28 passing tests.
- Tier 6 Target: ≥8 additional tests covering R1-R8 business logic.
- Total Target: ≥36 passing tests under `npm test`.
