# Antigravity Project Instructions - POS Angkringan Jogja

@.agents/rules/ponytail.md
@.agents/rules/systematic-debugging.md
@.agents/rules/verification-before-completion.md
@.agents/rules/test-driven-development.md
@.agents/rules/frontend-design.md

## Core Project Guidelines
- **Offline-First & Data Integrity**: SQLite transactions must be atomic. Never alter financial ledger logic without running full reconciliation tests (`npm test`).
- **Minimal Clean Code**: Smallest complete diff, zero bloat, standard libraries first.
- **Hardware Integration**: Real Bluetooth thermal printers and camera require proper runtime permissions and defensive fallbacks.
- **Strict Verification**: Always run `npx tsc --noEmit` and `npm test` before committing changes. Evidence before assertions.
