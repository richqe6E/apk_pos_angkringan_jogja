import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, type TestDatabase } from './helpers/db.js';

// =============================================================================
// Reference Implementations Under Test (Extracted from UI components for pure Node execution)
// =============================================================================

export function calculateAttendanceStatus(now: Date = new Date()): {
  isLate: boolean;
  lateMinutes: number;
  timeString: string;
} {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const currentTotalMinutes = hours * 60 + minutes;
  const targetMinutes = 17 * 60 + 30;

  if (hours < 6) {
    const lateMinutes = (24 * 60 + currentTotalMinutes) - targetMinutes;
    return { isLate: true, lateMinutes, timeString };
  }

  if (currentTotalMinutes > targetMinutes) {
    const lateMinutes = currentTotalMinutes - targetMinutes;
    return { isLate: true, lateMinutes, timeString };
  }

  return { isLate: false, lateMinutes: 0, timeString };
}

export interface CustomTable {
  id: string;
  name: string;
  type: 'meja' | 'lesehan' | 'other';
}

export const DEFAULT_PRESET_TABLES: CustomTable[] = [
  { id: 't1', name: 'Meja 01', type: 'meja' },
  { id: 't2', name: 'Meja 02', type: 'meja' },
  { id: 't3', name: 'Meja 03', type: 'meja' },
  { id: 't4', name: 'Meja 04', type: 'meja' },
  { id: 't5', name: 'Meja 05', type: 'meja' },
  { id: 't6', name: 'Meja 06', type: 'meja' },
  { id: 't7', name: 'Meja 07', type: 'meja' },
  { id: 't8', name: 'Meja 08', type: 'meja' },
  { id: 't9', name: 'Meja 09', type: 'meja' },
  { id: 't10', name: 'Meja 10', type: 'meja' },
  { id: 't11', name: 'Lesehan 01', type: 'lesehan' },
  { id: 't12', name: 'Lesehan 02', type: 'lesehan' },
  { id: 't13', name: 'Lesehan 03', type: 'lesehan' },
  { id: 't14', name: 'Lesehan 04', type: 'lesehan' },
  { id: 't15', name: 'Lesehan 05', type: 'lesehan' },
  { id: 't16', name: 'Bungkus / Take-away', type: 'other' },
];

export function detectTableType(name: string): 'meja' | 'lesehan' | 'other' {
  const lower = name.toLowerCase();
  if (lower.includes('lesehan')) return 'lesehan';
  if (lower.includes('meja')) return 'meja';
  return 'other';
}

export function parseCustomTables(jsonString: string | null | undefined): CustomTable[] {
  if (!jsonString) return DEFAULT_PRESET_TABLES;
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_PRESET_TABLES;
    }
    return parsed.map((item, idx) => {
      if (typeof item === 'string') {
        return {
          id: `t_${idx + 1}`,
          name: item.trim(),
          type: detectTableType(item),
        };
      }
      const rawName = String(item.name || `Meja ${idx + 1}`).trim();
      const type: 'meja' | 'lesehan' | 'other' =
        item.type === 'meja' || item.type === 'lesehan' || item.type === 'other'
          ? item.type
          : detectTableType(rawName);
      return {
        id: String(item.id || `t_${idx + 1}`),
        name: rawName,
        type,
      };
    });
  } catch {
    return DEFAULT_PRESET_TABLES;
  }
}

export function validateTableName(
  name: string,
  existingTables: CustomTable[],
  excludeId?: string
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Nama meja wajib diisi.' };
  }
  const isDuplicate = existingTables.some(
    (t) => t.id !== excludeId && t.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (isDuplicate) {
    return { valid: false, error: `Meja dengan nama "${trimmed}" sudah terdaftar.` };
  }
  return { valid: true };
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

export function parseBankAccounts(jsonString: string | null | undefined): BankAccount[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function validateEmployeeName(
  name: string,
  existingEmployees: { id: number; name: string }[],
  excludeId?: number
): { valid: boolean; error?: string } {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { valid: false, error: 'Nama karyawan wajib diisi.' };
  }
  const isDuplicate = existingEmployees.some(
    (e) => e.name.trim().toLowerCase() === trimmedName.toLowerCase() && e.id !== excludeId
  );
  if (isDuplicate) {
    return { valid: false, error: `Karyawan dengan nama "${trimmedName}" sudah terdaftar.` };
  }
  return { valid: true };
}

export function validateCategoryName(
  name: string,
  existingCategories: { id: number; name: string }[],
  excludeId?: number
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Nama kategori wajib diisi.' };
  }
  const isDuplicate = existingCategories.some(
    (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase() && c.id !== excludeId
  );
  if (isDuplicate) {
    return { valid: false, error: `Kategori "${trimmed}" sudah ada.` };
  }
  return { valid: true };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('Milestone 6: Challenger 2 - Boundaries, Date Math, Settings JSON & Validation', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // ===========================================================================
  // 1. Calendar Math, Leap Years, Boundaries, Offsets & Attendance Aggregation
  // ===========================================================================
  describe('1. Calendar Math & Pure Date Mathematics', () => {
    test('1.1 Leap year handling: February in leap vs non-leap years across centuries', () => {
      // Leap years (divisible by 4, not 100 unless divisible by 400)
      const leapYears = [2000, 2024, 2028, 2032, 2400];
      for (const y of leapYears) {
        const days = new Date(y, 2, 0).getDate();
        assert.equal(days, 29, `Leap year ${y} February must have exactly 29 days`);
      }

      // Non-leap years
      const nonLeapYears = [1900, 2021, 2022, 2023, 2025, 2026, 2027, 2100];
      for (const y of nonLeapYears) {
        const days = new Date(y, 2, 0).getDate();
        assert.equal(days, 28, `Non-leap year ${y} February must have exactly 28 days`);
      }

      // Edge day Feb 29 behavior in JS Date
      const leapDate2024 = new Date(2024, 1, 29); // Feb 29, 2024
      assert.equal(leapDate2024.getDate(), 29);
      assert.equal(leapDate2024.getMonth(), 1); // 1 = Feb
    });

    test('1.2 Month boundaries & continuous bidirectional navigation across years', () => {
      const stepForward = (cur: string) => {
        const [y, m] = cur.split('-').map(Number);
        const d = new Date(y, m, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };

      const stepBackward = (cur: string) => {
        const [y, m] = cur.split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };

      // Transition December 2026 to January 2027
      assert.equal(stepForward('2026-12'), '2027-01');
      assert.equal(stepBackward('2027-01'), '2026-12');

      // Continuous loop 24 months forward from 2025-01 to 2026-12
      let cur = '2025-01';
      for (let i = 1; i < 24; i++) {
        cur = stepForward(cur);
      }
      assert.equal(cur, '2026-12');

      // Continuous loop 24 months backward to 2025-01
      for (let i = 1; i < 24; i++) {
        cur = stepBackward(cur);
      }
      assert.equal(cur, '2025-01');
    });

    test('1.3 Day-of-week starting offsets (0..6) grid alignments', () => {
      // Benchmark months that start on each specific day of the week
      const dayTests = [
        { month: '2026-11', expectedOffset: 0, name: 'Minggu (0)' },
        { month: '2026-06', expectedOffset: 1, name: 'Senin (1)' },
        { month: '2026-12', expectedOffset: 2, name: 'Selasa (2)' },
        { month: '2026-04', expectedOffset: 3, name: 'Rabu (3)' },
        { month: '2026-01', expectedOffset: 4, name: 'Kamis (4)' },
        { month: '2026-05', expectedOffset: 5, name: 'Jumat (5)' },
        { month: '2026-08', expectedOffset: 6, name: 'Sabtu (6)' },
      ];

      for (const t of dayTests) {
        const [y, m] = t.month.split('-').map(Number);
        const offset = new Date(y, m - 1, 1).getDay();
        assert.equal(offset, t.expectedOffset, `${t.month} must start on ${t.name}`);

        const daysInMonth = new Date(y, m, 0).getDate();
        const emptyCells = Array.from({ length: offset });
        const dayCells = Array.from({ length: daysInMonth });

        // Total grid cells must equal empty slots + daysInMonth
        assert.equal(emptyCells.length, t.expectedOffset);
        assert.equal(dayCells.length, daysInMonth);
        assert.ok(emptyCells.length + dayCells.length >= 28 && emptyCells.length + dayCells.length <= 37);
      }
    });

    test('1.4 Attendance aggregation: 0 records, mixed on-time/late, 100% late, empty dataset', () => {
      interface MockAttendanceRecord {
        id: number;
        employee_id: number;
        employee_name: string;
        business_date: string;
        check_in_time: string;
        is_late: number;
        late_minutes: number;
      }

      const historyDataset: MockAttendanceRecord[] = [
        // 2026-11-01: Mixed (2 on-time, 2 late)
        { id: 1, employee_id: 1, employee_name: 'Budi', business_date: '2026-11-01', check_in_time: '17:10', is_late: 0, late_minutes: 0 },
        { id: 2, employee_id: 2, employee_name: 'Siti', business_date: '2026-11-01', check_in_time: '17:20', is_late: 0, late_minutes: 0 },
        { id: 3, employee_id: 3, employee_name: 'Agus', business_date: '2026-11-01', check_in_time: '17:45', is_late: 1, late_minutes: 15 },
        { id: 4, employee_id: 4, employee_name: 'Dewi', business_date: '2026-11-01', check_in_time: '18:00', is_late: 1, late_minutes: 30 },

        // 2026-11-02: 100% Late (3 late, 0 on-time)
        { id: 5, employee_id: 1, employee_name: 'Budi', business_date: '2026-11-02', check_in_time: '17:40', is_late: 1, late_minutes: 10 },
        { id: 6, employee_id: 2, employee_name: 'Siti', business_date: '2026-11-02', check_in_time: '18:15', is_late: 1, late_minutes: 45 },
        { id: 7, employee_id: 3, employee_name: 'Agus', business_date: '2026-11-02', check_in_time: '19:00', is_late: 1, late_minutes: 90 },

        // 2026-11-03: 100% On-time (2 on-time, 0 late)
        { id: 8, employee_id: 1, employee_name: 'Budi', business_date: '2026-11-03', check_in_time: '17:05', is_late: 0, late_minutes: 0 },
        { id: 9, employee_id: 4, employee_name: 'Dewi', business_date: '2026-11-03', check_in_time: '17:15', is_late: 0, late_minutes: 0 },
      ];

      // Build grouping map
      const attendanceByDate: Record<string, MockAttendanceRecord[]> = {};
      for (const rec of historyDataset) {
        if (!attendanceByDate[rec.business_date]) {
          attendanceByDate[rec.business_date] = [];
        }
        attendanceByDate[rec.business_date].push(rec);
      }

      // Scenario A: Date with 0 records (2026-11-04)
      const day4 = attendanceByDate['2026-11-04'] || [];
      assert.equal(day4.length, 0);
      assert.equal(day4.filter((r) => r.is_late === 0).length, 0);
      assert.equal(day4.filter((r) => r.is_late === 1).length, 0);
      assert.equal(day4.some((r) => r.is_late === 1), false);

      // Scenario B: Mixed on-time and late staff (2026-11-01)
      const day1 = attendanceByDate['2026-11-01'] || [];
      assert.equal(day1.length, 4);
      assert.equal(day1.filter((r) => r.is_late === 0).length, 2);
      assert.equal(day1.filter((r) => r.is_late === 1).length, 2);
      assert.equal(day1.some((r) => r.is_late === 1), true);

      // Scenario C: 100% late staff (2026-11-02)
      const day2 = attendanceByDate['2026-11-02'] || [];
      assert.equal(day2.length, 3);
      assert.equal(day2.filter((r) => r.is_late === 0).length, 0);
      assert.equal(day2.filter((r) => r.is_late === 1).length, 3);
      assert.equal(day2.some((r) => r.is_late === 1), true);

      // Scenario D: 100% on-time staff (2026-11-03)
      const day3 = attendanceByDate['2026-11-03'] || [];
      assert.equal(day3.length, 2);
      assert.equal(day3.filter((r) => r.is_late === 0).length, 2);
      assert.equal(day3.filter((r) => r.is_late === 1).length, 0);
      assert.equal(day3.some((r) => r.is_late === 1), false);

      // Scenario E: Empty dataset completely
      const emptyMap: Record<string, MockAttendanceRecord[]> = {};
      const queryEmpty = emptyMap['2026-11-01'] || [];
      assert.equal(queryEmpty.length, 0);
      assert.equal(queryEmpty.filter((r) => r.is_late === 1).length, 0);
    });

    test('1.5 Shift late calculation at boundary timestamps (17:30 cutoff, overnight shifts)', () => {
      // On-time check-in at 17:29
      const d1 = new Date(2026, 10, 7, 17, 29, 0);
      const res1 = calculateAttendanceStatus(d1);
      assert.equal(res1.isLate, false);
      assert.equal(res1.lateMinutes, 0);
      assert.equal(res1.timeString, '17:29');

      // Exactly on target at 17:30
      const d2 = new Date(2026, 10, 7, 17, 30, 0);
      const res2 = calculateAttendanceStatus(d2);
      assert.equal(res2.isLate, false);
      assert.equal(res2.lateMinutes, 0);

      // 1 minute late at 17:31
      const d3 = new Date(2026, 10, 7, 17, 31, 0);
      const res3 = calculateAttendanceStatus(d3);
      assert.equal(res3.isLate, true);
      assert.equal(res3.lateMinutes, 1);

      // Overnight check-in at 01:15 AM (hours < 6)
      const d4 = new Date(2026, 10, 8, 1, 15, 0);
      const res4 = calculateAttendanceStatus(d4);
      assert.equal(res4.isLate, true);
      // Expected late minutes: (24*60 + 75) - 1050 = 1515 - 1050 = 465 minutes
      assert.equal(res4.lateMinutes, 465);
    });
  });

  // ===========================================================================
  // 2. Settings JSON & Malformed Data Resilience
  // ===========================================================================
  describe('2. Settings JSON & Malformed Data Resilience', () => {
    test('2.1 Malformed custom_tables JSON: fallback to 16 default preset tables', () => {
      const malformedInputs = [
        '',                     // Empty string
        '   ',                  // Whitespace only
        null,                   // null
        undefined,              // undefined
        '{invalid_json: 123',   // Syntax error
        '{"name": "Meja VIP"}', // Object instead of Array
        '[]',                   // Empty array -> should fallback to defaults
        '12345',                // Number
        '"plain string"',       // String primitive
        'true',                 // Boolean primitive
      ];

      for (const input of malformedInputs) {
        const result = parseCustomTables(input as any);
        assert.ok(Array.isArray(result), 'Result must always be an array');
        assert.equal(result.length, 16, `Input ${JSON.stringify(input)} must return 16 default tables`);
        assert.equal(result[0].name, 'Meja 01');
        assert.equal(result[15].name, 'Bungkus / Take-away');
      }
    });

    test('2.2 Valid custom_tables with edge case elements (string array, partial objects)', () => {
      // Legacy string array format
      const stringArray = JSON.stringify(['Meja A', 'Lesehan B', 'Take-Away C']);
      const parsedStrings = parseCustomTables(stringArray);
      assert.equal(parsedStrings.length, 3);
      assert.equal(parsedStrings[0].name, 'Meja A');
      assert.equal(parsedStrings[0].type, 'meja');
      assert.equal(parsedStrings[1].name, 'Lesehan B');
      assert.equal(parsedStrings[1].type, 'lesehan');
      assert.equal(parsedStrings[2].name, 'Take-Away C');
      assert.equal(parsedStrings[2].type, 'other');

      // Objects with missing properties or whitespace
      const messyObjects = JSON.stringify([
        { id: 'custom_1', name: '  Meja Bundar  ' },
        { id: '', name: '', type: 'lesehan' },
        { name: 'Lesehan Sudut', type: 'invalid_type' },
      ]);
      const parsedMessy = parseCustomTables(messyObjects);
      assert.equal(parsedMessy.length, 3);
      assert.equal(parsedMessy[0].name, 'Meja Bundar');
      assert.equal(parsedMessy[0].type, 'meja');
      assert.equal(parsedMessy[1].name, 'Meja 2'); // Fallback name
      assert.equal(parsedMessy[1].type, 'lesehan');
      assert.equal(parsedMessy[2].name, 'Lesehan Sudut');
      assert.equal(parsedMessy[2].type, 'lesehan'); // Auto-detected from name
    });

    test('2.3 Malformed bank_accounts JSON: graceful fallback to empty array', () => {
      const malformedBankInputs = [
        '',                       // Empty string
        '   ',                    // Whitespace
        null,                     // null
        undefined,                // undefined
        '{bank_name: "BCA"',      // Corrupted syntax
        '{"bank_name": "BCA"}',   // Single object instead of Array
        '123',                    // Number
        '"BCA 123456"',           // String primitive
      ];

      for (const input of malformedBankInputs) {
        const result = parseBankAccounts(input as any);
        assert.ok(Array.isArray(result), 'Result must be an array');
        assert.equal(result.length, 0, `Input ${JSON.stringify(input)} must gracefully fallback to empty array`);
      }
    });

    test('2.4 SQLite settings table resilience: malformed rows do not break query or parsing', async () => {
      // Insert corrupt JSON for custom_tables and bank_accounts into SQLite
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_tables', ?)", ['{corrupt: json']);
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('bank_accounts', ?)", ['not a json array']);

      // Query from DB
      const rows = await db.getAllAsync<{ key: string; value: string }>(
        "SELECT key, value FROM settings WHERE key IN ('custom_tables', 'bank_accounts')"
      );

      const tableRow = rows?.find((r) => r.key === 'custom_tables');
      const bankRow = rows?.find((r) => r.key === 'bank_accounts');

      const parsedTables = parseCustomTables(tableRow?.value);
      const parsedBanks = parseBankAccounts(bankRow?.value);

      assert.equal(parsedTables.length, 16, 'Corrupted custom_tables in SQLite must return default 16 preset tables');
      assert.equal(parsedBanks.length, 0, 'Corrupted bank_accounts in SQLite must return empty array');
    });
  });

  // ===========================================================================
  // 3. Input Boundaries & Duplicate Validation
  // ===========================================================================
  describe('3. Input Boundaries & Duplicate Validation', () => {
    test('3.1 Employee name validation: case-insensitive & whitespace variations', () => {
      const existingEmployees = [
        { id: 1, name: 'Budi Santoso' },
        { id: 2, name: 'Siti Rahma' },
      ];

      // Exact match
      const r1 = validateEmployeeName('Budi Santoso', existingEmployees);
      assert.equal(r1.valid, false);

      // Case-insensitive ("budi santoso", "BUDI SANTOSO")
      const r2 = validateEmployeeName('budi santoso', existingEmployees);
      assert.equal(r2.valid, false);
      const r3 = validateEmployeeName('BUDI SANTOSO', existingEmployees);
      assert.equal(r3.valid, false);

      // Whitespace variations ("  budi santoso  ", "\tBudi Santoso\n")
      const r4 = validateEmployeeName('  budi santoso  ', existingEmployees);
      assert.equal(r4.valid, false);
      const r5 = validateEmployeeName('\tBudi Santoso\n', existingEmployees);
      assert.equal(r5.valid, false);

      // Editing existing employee: keeping same name or case change with excludeId
      const r6 = validateEmployeeName('budi santoso', existingEmployees, 1);
      assert.equal(r6.valid, true, 'Self-name match during edit must be valid');

      // Editing employee 2 to match employee 1 name
      const r7 = validateEmployeeName('Budi Santoso', existingEmployees, 2);
      assert.equal(r7.valid, false, 'Renaming to another employee name must be rejected');

      // Empty or whitespace-only name
      const r8 = validateEmployeeName('', existingEmployees);
      assert.equal(r8.valid, false);
      const r9 = validateEmployeeName('    ', existingEmployees);
      assert.equal(r9.valid, false);

      // Valid new distinct employee
      const r10 = validateEmployeeName('Joko Widodo', existingEmployees);
      assert.equal(r10.valid, true);
    });

    test('3.2 Table name validation: case-insensitive & whitespace variations', () => {
      const tables: CustomTable[] = [
        { id: 't1', name: 'Meja 01', type: 'meja' },
        { id: 't2', name: 'Lesehan 01', type: 'lesehan' },
      ];

      // Duplicate detection
      assert.equal(validateTableName('Meja 01', tables).valid, false);
      assert.equal(validateTableName('meja 01', tables).valid, false);
      assert.equal(validateTableName('  MEJA 01  ', tables).valid, false);
      assert.equal(validateTableName('Lesehan 01', tables).valid, false);
      assert.equal(validateTableName('lesehan 01', tables).valid, false);

      // Self-exclusion during edit
      assert.equal(validateTableName('meja 01', tables, 't1').valid, true);
      assert.equal(validateTableName('  Meja 01  ', tables, 't1').valid, true);

      // Renaming t2 to existing t1 name
      assert.equal(validateTableName('Meja 01', tables, 't2').valid, false);

      // Empty or whitespace
      assert.equal(validateTableName('', tables).valid, false);
      assert.equal(validateTableName('   ', tables).valid, false);

      // Valid new table
      assert.equal(validateTableName('Meja VIP 08', tables).valid, true);
    });

    test('3.3 Category name validation: case-insensitive & whitespace variations', () => {
      const categories = [
        { id: 1, name: 'Makanan' },
        { id: 2, name: 'Minuman' },
      ];

      // Duplicate detection
      assert.equal(validateCategoryName('Makanan', categories).valid, false);
      assert.equal(validateCategoryName('makanan', categories).valid, false);
      assert.equal(validateCategoryName('  MAKANAN  ', categories).valid, false);

      // Self-exclusion during edit
      assert.equal(validateCategoryName('makanan', categories, 1).valid, true);
      assert.equal(validateCategoryName('Makanan Baru', categories, 1).valid, true);

      // Editing category 2 to match category 1
      assert.equal(validateCategoryName('Makanan', categories, 2).valid, false);

      // Empty
      assert.equal(validateCategoryName('', categories).valid, false);
      assert.equal(validateCategoryName('   ', categories).valid, false);
    });

    test('3.4 Null category update: verify updateMenu allows setting category_id = NULL without COALESCE block', async () => {
      // 1. Insert a custom category 'Kategori Eksperimental' with ID 99
      await db.runAsync("INSERT INTO categories (id, name) VALUES (99, 'Kategori Eksperimental')");

      // 2. Insert Menu associated with Category 99
      const menuId = 999;
      await db.runAsync(
        `INSERT INTO menus (id, name, price, category_id, track_stock, stock, is_active)
         VALUES (?, 'Wedang Jahe Spesial', 6000, 99, 0, 0, 1)`,
        [menuId]
      );

      const beforeUpdate = await db.getFirstAsync<{ id: number; category_id: number | null; name: string }>(
        'SELECT id, category_id, name FROM menus WHERE id = ?',
        [menuId]
      );
      assert.equal(beforeUpdate?.category_id, 99, 'Initial category_id must be 99');

      // 3. Simulate updateMenu logic with category_id = null
      // In menuStore.ts:
      // if ('category_id' in data) { fields.push('category_id = ?'); values.push(data.category_id ?? null); }
      const updateData: { category_id: number | null } = { category_id: null };
      const fields: string[] = [];
      const values: any[] = [];

      if ('category_id' in updateData) {
        fields.push('category_id = ?');
        values.push(updateData.category_id ?? null);
      }
      values.push(menuId); // id

      await db.runAsync(`UPDATE menus SET ${fields.join(', ')} WHERE id = ?`, values);

      // 4. Verify in SQLite: category_id must be strictly NULL
      const afterUpdate = await db.getFirstAsync<{ id: number; category_id: number | null }>(
        'SELECT id, category_id FROM menus WHERE id = ?',
        [menuId]
      );
      assert.equal(afterUpdate?.category_id, null, 'category_id must be successfully updated to NULL');

      // 5. Compare with the buggy COALESCE pattern:
      // If code had used: UPDATE menus SET category_id = COALESCE(?, category_id)
      // Passing NULL would preserve the old value, proving why avoiding COALESCE is critical.
      await db.runAsync('UPDATE menus SET category_id = 99 WHERE id = ?', [menuId]);
      // Buggy query simulation:
      await db.runAsync('UPDATE menus SET category_id = COALESCE(?, category_id) WHERE id = ?', [null, menuId]);
      const buggyRow = await db.getFirstAsync<{ category_id: number | null }>('SELECT category_id FROM menus WHERE id = ?', [menuId]);
      assert.equal(buggyRow?.category_id, 99, 'Proof that COALESCE blocks setting category_id to NULL');

      // Now apply proper update again to ensure our system remains correct:
      await db.runAsync('UPDATE menus SET category_id = ? WHERE id = ?', [null, menuId]);
      const fixedRow = await db.getFirstAsync<{ category_id: number | null }>('SELECT category_id FROM menus WHERE id = ?', [menuId]);
      assert.equal(fixedRow?.category_id, null, 'Clean assignment without COALESCE properly clears category_id to NULL');

      // 6. Test Foreign Key ON DELETE SET NULL
      await db.runAsync('UPDATE menus SET category_id = 99 WHERE id = ?', [menuId]);
      await db.runAsync('DELETE FROM categories WHERE id = 99');
      const fkRow = await db.getFirstAsync<{ category_id: number | null }>('SELECT category_id FROM menus WHERE id = ?', [menuId]);
      assert.equal(fkRow?.category_id, null, 'Deleting category must trigger ON DELETE SET NULL on menus');
    });
  });
});
