# Modern Professional POS UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the POS Angkringan Jogja application from a generic AI-template look with raw Unicode emojis into a distinctive, world-class, professional tablet POS design inspired by industry standards (Square POS, Toast POS, Moka POS) while maintaining 100% functional stability and passing all 104 automated tests.

**Architecture:** We introduce a centralized design token system in `constants/theme.ts` (with backwards-compatible aliases) and a unified vector iconography component (`components/ui/app-icon.tsx` using `@expo/vector-icons`). We systematically upgrade UI primitives (`Button`, `Card`, `Badge`, `ModalHeader`) and screens (Cashier terminal, payment modal, catalog grid, and management tabs) without touching any SQLite database operations, business calculations, or state stores.

**Tech Stack:** React Native 0.81.5, Expo SDK 54, `@expo/vector-icons` (Ionicons & MaterialCommunityIcons), Zustand, TypeScript 5.9.

**Spec:** [DESIGN_PLAN_POS_ANGKRINGAN.md](file:///d:/Source_Code_Angkringan_Jogja/DESIGN_PLAN_POS_ANGKRINGAN.md) & [.agents/rules/frontend-design.md](file:///d:/Source_Code_Angkringan_Jogja/.agents/rules/frontend-design.md)

## Global Constraints

- **Strict Business Logic & Database Invariance**: Never alter any SQLite query, table schema, transaction ledger math, or state mutation logic.
- **Full Automated Test Coverage**: Every task must pass `npm test` (all 104 unit & integration tests) and `npx tsc --noEmit` (0 errors).
- **Tablet POS Ergonomics Floor**: Touch targets for interactive buttons, keypad pills, and quantity steppers must be at least 44x44px.
- **Eliminate Raw Unicode Emojis**: Replace all raw emojis in buttons, titles, modal triggers, and status tags with crisp vector icons from `@expo/vector-icons`.
- **Domain-Grounded Aesthetics**: Deep forest emerald green (`#047857`, `#059669`) anchored with warm background neutrals (`#f8fafc`, `#ffffff`) and crisp border contrasts (`#e2e8f0`).

## Review Focus

1. **Button & Text Contrast**: Ensure header outline buttons and primary action buttons maintain high contrast across both light backgrounds and dark header bars.
2. **Modal Height & Keyboard Avoiding**: Verify modal forms preserve `height: '85%'`, `minHeight: 460`, and `KeyboardAvoidingView` so inputs never collapse on tablet keyboards.
3. **Running Ticket Subtotals**: Check that payment and cart summaries show exact formatted Rupiah values without overlapping text.
4. **Touch Target Size**: Ensure quantity steppers (`+` and `-`) and table selection pills have generous margins preventing accidental adjacent taps.
5. **Icon Rendering**: Verify all icons render cleanly on Android without missing glyphs or clipping.

---

## Tasks

### Task 1: Professional Design System Tokens & Typography Scale

**Files:**
- Modify: `constants/theme.ts`
- Test: `test/tier1-financial-store.test.ts` (verify no regressions on imports)

**Steps:**
- [ ] Step 1: In `constants/theme.ts`, enrich `Colors` with high-contrast neutral surfaces (`surface`, `surfaceHover`, `surfaceActive`, `borderSubtle`, `headerBg`).
- [ ] Step 2: Add `Typography` tokens (`h1`, `h2`, `h3`, `body`, `caption`, `mono`, `number`) with clear font weights, sizes, and line heights.
- [ ] Step 3: Add `Spacing` tokens (`xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 20`, `xxl: 24`, `xxxl: 32`) and `Radii` tokens (`sm: 6`, `md: 10`, `lg: 14`, `xl: 18`, `full: 9999`).
- [ ] Step 4: Run `npx tsc --noEmit` to verify backwards compatibility with all existing screens.
- [ ] Step 5: Commit: `git commit -m "style: enrich design system tokens with typography and spacing scales"`

---

### Task 2: Centralized Professional Vector Iconography Component

**Files:**
- Create: `components/ui/app-icon.tsx`
- Modify: `components/ui/icon-symbol.tsx` (re-export or alias for backwards compatibility)
- Test: `npx tsc --noEmit`

**Steps:**
- [ ] Step 1: Create `components/ui/app-icon.tsx` importing `Ionicons` from `@expo/vector-icons/Ionicons` and `MaterialCommunityIcons` from `@expo/vector-icons/MaterialCommunityIcons`.
- [ ] Step 2: Implement semantic icon mapping for POS operations:
  - Navigation: `dashboard`, `menu`, `history`, `attendance`, `financial`, `settings`.
  - Actions: `search`, `close`, `check`, `plus`, `minus`, `delete`, `edit`, `camera`, `print`, `refresh`.
  - Business: `cart`, `cash`, `qris`, `bank`, `table`, `people`, `supplier`, `receipt`, `lock`, `filter`.
- [ ] Step 3: Provide standard sizing presets (`xs: 14`, `sm: 18`, `md: 22`, `lg: 26`, `xl: 32`) with clean prop forwarding.
- [ ] Step 4: Run `npx tsc --noEmit` to verify type safety.
- [ ] Step 5: Commit: `git commit -m "feat: create centralized AppIcon component with vector icons"`

---

### Task 3: Modern Touch-Ergonomic UI Primitives

**Files:**
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/card.tsx`
- Modify: `components/ui/badge.tsx`
- Create: `components/ui/modal-header.tsx`
- Test: `npx tsc --noEmit` && `npm test`

**Steps:**
- [ ] Step 1: In `components/ui/button.tsx`, add support for `icon` (ReactNode or icon name), `iconPosition` ('left' | 'right'), and `iconGap`.
- [ ] Step 2: In `components/ui/button.tsx`, standardize tablet touch heights: `sm: 36`, `md: 46`, `lg: 54`. Add active touch feedback opacity (0.75).
- [ ] Step 3: In `components/ui/card.tsx`, add clean elevation and border variants (`flat`, `elevated`, `outlined`, `interactive`) with balanced padding options.
- [ ] Step 4: In `components/ui/badge.tsx`, modernize status badges with soft-tint backgrounds and crisp font weights (`success`, `danger`, `warning`, `primary`, `neutral`).
- [ ] Step 5: Create `components/ui/modal-header.tsx` featuring icon badge, bold title, supportive subtitle, and circular touch-friendly close button (`AppIcon name="close"`).
- [ ] Step 6: Run `npx tsc --noEmit` and `npm test` to verify all existing tests pass.
- [ ] Step 7: Commit: `git commit -m "feat: modernize Button, Card, Badge primitives and create ModalHeader"`

---

### Task 4: Cashier Terminal & Catalog Card Modernization

**Files:**
- Modify: `app/transaksi.tsx` (and `app/(tabs)/index.tsx`)
- Modify: `components/quick-edit-modal.tsx`
- Modify: `components/table-selector-modal.tsx`
- Test: `npm test` (verify table selector & cashier shift scenarios pass)

**Steps:**
- [ ] Step 1: In catalog product cards, replace raw emoji placeholders with clean category icon badges or image thumbnails. Add clear stock indicators (`Tersedia: 12`, `Stok Menipis`, `Habis`).
- [ ] Step 2: In right-hand running ticket (cart), polish item rows: item title, quantity badge, price display, and delete action using vector `trash-outline` icon.
- [ ] Step 3: Style the empty cart state with a clean vector shopping cart icon (`AppIcon name="cart"`) and clear instruction copy.
- [ ] Step 4: Modernize bottom checkout action bar: prominent, full-width `Bayar Sekarang (Rp XX.XXX)` with tactile feedback and clean secondary buttons (`Batal`, `Simpan Pending`, `Tagihan`).
- [ ] Step 5: In `components/quick-edit-modal.tsx` and `components/table-selector-modal.tsx`, replace raw emojis (`🗑️`, `✏️`, `➕`, `✕`) with `AppIcon` and `ModalHeader`.
- [ ] Step 6: Run `npx tsc --noEmit` and `npm test`.
- [ ] Step 7: Commit: `git commit -m "refactor: modernize cashier catalog cards, running ticket, and table selector modal"`

---

### Task 5: Payment Modal Modernization

**Files:**
- Modify: `components/payment-modal.tsx`
- Test: `npm test` (verify payment methods & receipt formatting pass)

**Steps:**
- [ ] Step 1: In `components/payment-modal.tsx`, replace emoji payment method pills with modern segmented cards:
  - Tunai (Cash): `AppIcon name="cash"`
  - QRIS: `AppIcon name="qris"`
  - Transfer Bank: `AppIcon name="bank"`
- [ ] Step 2: Style quick-cash denomination buttons (`+Rp 10.000`, `+Rp 20.000`, `+Rp 50.000`, `+Rp 100.000`, `Uang Pas`) with tactile pill cards and active touch states.
- [ ] Step 3: Modernize payment summary card: large, high-contrast Total Tagihan, Cash Tendered, and Kembalian with clear visual hierarchy.
- [ ] Step 4: Replace modal close button and status icons with `ModalHeader` and `AppIcon`.
- [ ] Step 5: Run `npx tsc --noEmit` and `npm test`.
- [ ] Step 6: Commit: `git commit -m "refactor: modernize payment modal with vector icons and tactile cash keypad"`

---

### Task 6: Management & Settings Screens Modernization

**Files:**
- Modify: `app/(tabs)/attendance.tsx`
- Modify: `app/(tabs)/financial.tsx`
- Modify: `app/(tabs)/explore.tsx`
- Modify: `app/(tabs)/history.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/purchases.tsx`
- Modify: `components/menu-form-modal.tsx`
- Modify: `components/purchase-form-modal.tsx`
- Test: `npm test` (verify all 104 tests pass)

**Steps:**
- [ ] Step 1: In `app/(tabs)/attendance.tsx`: Replace `📷 Absen Masuk`, `🔒 Terkunci`, `🍃 Tidak Ada Data` with vector icons.
- [ ] Step 2: In `app/(tabs)/financial.tsx`: Modernize summary tiles (Omset, HPP, Beban Kas, Laba Bersih) with clean icon badges and professional typography.
- [ ] Step 3: In `app/(tabs)/explore.tsx`: Modernize search input with `AppIcon name="search"` and filter pills.
- [ ] Step 4: In `app/(tabs)/history.tsx`: Polish transaction list cards with payment method badges (`Tunai`, `QRIS`, `Transfer`) and clean timestamp typography.
- [ ] Step 5: In `app/(tabs)/settings.tsx`: Replace raw emojis in section headers (QRIS, Printer, Bank, Backup, Keamanan) with sleek vector icons.
- [ ] Step 6: In `components/menu-form-modal.tsx` and `components/purchase-form-modal.tsx`: Integrate `ModalHeader` and replace camera/gallery button emojis with vector icons.
- [ ] Step 7: Run `npx tsc --noEmit` and `npm test`.
- [ ] Step 8: Commit: `git commit -m "refactor: modernize management screens, settings, and CRUD modals with vector icons"`

---

### Task 7: End-to-End System Verification & Final Build Check

**Files:**
- Verification: Entire codebase
- Test: All suites (`npm test` and `npx tsc --noEmit`)

**Steps:**
- [ ] Step 1: Execute full TypeScript compiler check: `npx tsc --noEmit`. Verify 0 errors.
- [ ] Step 2: Execute automated test suite: `npm test`. Verify 104/104 tests pass.
- [ ] Step 3: Verify git status is clean and all commits adhere to professional conventions.
- [ ] Step 4: Await user review and confirmation before triggering EAS build.
