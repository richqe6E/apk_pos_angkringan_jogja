# Empirical Adversarial Challenge Report — Challenger 2

**Scope Focus**: Boundaries, Date Math, QRIS/Bank JSON, and Input Validation  
**Evaluator**: challenger_2 (Milestone 6)  
**Date**: 2026-11-07  
**Gate Verdict**: `APPROVE`

---

## 1. Observation

Direct empirical observations collected across implementation files, dedicated stress-testing harness (`test/challenger-boundaries-date-json.test.ts`), and full regression test execution:

### 1.1 Calendar Mathematics & Attendance Recap
- In `app/(tabs)/attendance.tsx` lines 115–117:
  ```ts
  const [yearNum, monthNum] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayOfWeek = new Date(yearNum, monthNum - 1, 1).getDay(); // 0 = Min, 6 = Sab
  ```
- Month navigation in `app/(tabs)/attendance.tsx` lines 97–107:
  ```ts
  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    changeMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    changeMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };
  ```
- Grid cell generation in `app/(tabs)/attendance.tsx` lines 448–455:
  ```tsx
  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
    <View key={`empty-${i}`} style={styles.dayCellEmpty} />
  ))}
  {Array.from({ length: daysInMonth }).map((_, i) => { ... })}
  ```
- `test/challenger-boundaries-date-json.test.ts` (Tests 1.1–1.5):
  - Leap years (2000, 2024, 2028, 2032, 2400) consistently return 29 days for February.
  - Non-leap years (1900, 2021, 2022, 2023, 2025, 2026, 2027, 2100) return 28 days for February.
  - Month transitions forward and backward across year boundaries (2026-12 ⇄ 2027-01) traverse with padded month strings (`01`–`12`) and zero off-by-one errors across 24 consecutive months.
  - Day-of-week offsets 0 through 6 (Minggu through Sabtu) generate exact matching empty leading cells (`firstDayOfWeek`).
  - Attendance date grouping successfully handles empty dates (length: 0, late: 0), mixed presence (e.g. 2 on-time, 2 late), and 100% late staff (3 late, 0 on-time) without undefined access or NaN values.

### 1.2 Settings JSON & Malformed Data Resilience
- In `components/table-selector-modal.tsx` lines 56–84:
  ```ts
  export function parseCustomTables(jsonString: string | null | undefined): CustomTable[] {
    if (!jsonString) return DEFAULT_PRESET_TABLES;
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return DEFAULT_PRESET_TABLES;
      }
      return parsed.map((item, idx) => { ... });
    } catch {
      return DEFAULT_PRESET_TABLES;
    }
  }
  ```
  - Empirically verified with adversarial inputs: `""`, `"   "`, `null`, `undefined`, `"{invalid_json: 123"`, `'{"name": "Meja VIP"}'` (non-array object), `'[]'` (empty array), `'12345'`, `'"plain string"'`, `'true'`. In all cases, `parseCustomTables` safely returns the 16 default preset tables (`DEFAULT_PRESET_TABLES.length === 16`).
- In `components/payment-modal.tsx` lines 94–106:
  ```ts
  if (row.key === 'bank_accounts') {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) {
        setBankAccounts(parsed);
        if (parsed.length > 0) {
          setSelectedBankId(parsed[0].id);
        }
      }
    } catch (err) {
      console.warn('Gagal parse bank_accounts:', err);
    }
  }
  ```
  - State default is `const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);`
  - Empirically tested with empty string, invalid JSON syntax, non-array objects, and numbers: all safely result in empty array `[]` fallback without unhandled exceptions or app crash.
  - Storing malformed string entries in SQLite `settings` table and re-querying confirmed zero database or query errors.

### 1.3 Input Boundaries & Duplicate Validation
- Employee modal duplicate validation in `components/employee-modal.tsx` lines 45–54:
  ```ts
  const trimmedName = name.trim();
  if (!trimmedName) { ... }
  const isDuplicate = employees.some(
    (e) => e.name.trim().toLowerCase() === trimmedName.toLowerCase() && e.id !== employee?.id
  );
  ```
- Table name validation in `components/table-selector-modal.tsx` lines 87–103:
  ```ts
  export function validateTableName(name: string, existingTables: CustomTable[], excludeId?: string) {
    const trimmed = name.trim();
    if (!trimmed) return { valid: false, error: 'Nama meja wajib diisi.' };
    const isDuplicate = existingTables.some(
      (t) => t.id !== excludeId && t.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) return { valid: false, error: `Meja dengan nama "${trimmed}" sudah terdaftar.` };
    return { valid: true };
  }
  ```
- Category duplicate validation in `components/category-form-modal.tsx` lines 42–52 & `components/category-management-modal.tsx` lines 84–90:
  ```ts
  const trimmed = editingName.trim();
  const isDuplicate = categories.some(
    (c) => c.id !== id && c.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  ```
  - Tested: Case-insensitive (`"Budi"` vs `"budi"`, `"Makanan"` vs `"makanan"`, `"Meja 01"` vs `"meja 01"`), whitespace padding (`"  budi  "`, `"\tMeja 01\n"`, `"  MAKANAN  "`), empty string rejection, and self-exclusion during editing (`excludeId`). All passed accurately.

### 1.4 Menu Category Nullification (`updateMenu`)
- In `stores/menuStore.ts` lines 150–153:
  ```ts
  if ('category_id' in data) {
    fields.push('category_id = ?');
    values.push(data.category_id ?? null);
  }
  ```
  - In `test/challenger-boundaries-date-json.test.ts` (Test 3.4), setting `category_id = null` updates SQLite column `menus.category_id` strictly to `NULL`.
  - Contrast with anti-pattern: If `UPDATE menus SET category_id = COALESCE(?, category_id)` were used, passing `null` preserved the old category ID (reproduced in test 3.4 assertion). The actual implementation avoids COALESCE and cleanly sets `NULL`.
  - Foreign Key `ON DELETE SET NULL` was also verified: deleting a category sets referencing `menus.category_id` to `NULL`.

### 1.5 Regression Test Suite Results
- Executed `npm test` (`node --test test/**/*.test.ts`):
  ```text
  ℹ tests 104
  ℹ suites 33
  ℹ pass 104
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 1284.9826
  ```
  All 104 test cases across 33 test suites executed successfully with 0 failures.

---

## 2. Logic Chain

1. **Date Mathematics & Leap Year Correctness**:
   - The expression `new Date(yearNum, monthNum, 0).getDate()` relies on JavaScript's standard date rollover where day 0 of month `M` resolves to the last calendar day of month `M - 1`. Because JavaScript months are 0-indexed, passing `monthNum` (1-indexed) as the month argument refers to `monthNum`, so day 0 evaluates to the exact last day of `monthNum`.
   - Empirically observed in Test 1.1: Year 2024 (leap) yields 29, Year 2025 (non-leap) yields 28. Century boundary years (2000 leap = 29, 2100 non-leap = 28) evaluate accurately.
   - Month transitions `new Date(y, m - 2, 1)` and `new Date(y, m, 1)` correctly roll over from December to January and January to December without string concatenation flaws.

2. **Attendance Aggregation Robustness**:
   - The attendance grouping accumulator safely defaults absent dates to empty array `[]` via fallback `attendanceByDate[date] || []`.
   - Calculations for `totalPresent`, `onTime` (`is_late === 0`), and `late` (`is_late === 1`) are purely functional array filters, preventing division by zero or NaN indicators on days with 0 attendance.

3. **Settings JSON Fault Tolerance**:
   - Parsing of `custom_tables` and `bank_accounts` is wrapped in rigorous `try-catch` blocks and explicitly validates `Array.isArray(parsed) && parsed.length > 0`.
   - Any corruption, syntax error, primitive JSON value, or empty array safely cascades to designated fallbacks (16 preset tables for tables, empty array `[]` for bank accounts), shielding both UI rendering and database storage from crashing.

4. **Input Duplicate Validation & White-Space Hygiene**:
   - All input validators enforce `.trim().toLowerCase()` comparison against existing collections.
   - For update operations, excluding the active record's ID (`e.id !== excludeId`) allows renaming or preserving capitalization without false duplicate rejections.

5. **Category Nullification Safety**:
   - The dynamic query builder checks `'category_id' in data` rather than `if (data.category_id)`. This distinction allows explicit passing of `{ category_id: null }`, appending `category_id = ?` with parameter `null`.
   - The absence of `COALESCE(?, category_id)` guarantees that clearing a category persists cleanly in SQLite.

---

## 3. Caveats

- Physical Bluetooth hardware disconnection during receipt printing cannot be tested in Node headless test runners; it is covered by the receipt formatter string simulator in `test/tier5-adversarial.test.ts`.
- In-memory SQLite tests use Node's `DatabaseSync` (`node:sqlite`), which faithfully replicates SQLite 3 schema and constraints (`PRAGMA foreign_keys = ON`). Mobile SQLite behavior on iOS/Android uses `expo-sqlite`, which runs the identical SQLite engine.

---

## 4. Conclusion

All boundary conditions, leap-year calculations, date navigations, attendance grouping edge cases, settings JSON corruption fallbacks, input validation duplications, and null category updates have been empirically verified and found fully robust. The entire test suite of 104 tests across 33 suites passes with 0 regressions.

**Explicit Gate Verdict**: `APPROVE`

---

## 5. Verification Method

To independently verify all findings:
1. Run the test suite:
   ```powershell
   npm test
   ```
2. Inspect the challenger test suite:
   ```text
   test/challenger-boundaries-date-json.test.ts
   ```
3. Invalidation conditions:
   - Any failure among the 104 tests in `npm test`.
   - If `parseCustomTables('{"invalid": true}')` fails to return 16 items.
   - If `updateMenu` fails to persist `category_id = NULL` in `menus`.
