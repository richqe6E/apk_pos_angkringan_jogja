# Handoff Report: Investigation of Menu Management & Modal Forms (R1 & R2 Part 1)

**Agent**: `explorer_survey_op_1` (Menu & Modals Explorer)  
**Date**: 2026-11-07  
**Scope**: 
1. Requirement R1: Perbaikan Bug Pengelolaan Menu (Default Menu Deletion, Tambah Menu Form, Edit Menu Form, Quick Edit Menu pada Layar Kasir).
2. Requirement R2 (Part 1): Tombol Bagian Kanan Atas dan Modal Form (Modul Menu: Tombol Kategori, Modul Riwayat: Tombol Unduh PDF & CSV, Modul Absensi: Tombol Tambah Karyawan).

---

## 1. Observation

### 1.1 Default Menu Deletion & Reappearance Across Reloads
- **File**: `services/database.ts`
  - **Lines 59–65**:
    ```typescript
    const DATABASE_VERSION = 1;
    const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const currentVersion = versionRow?.user_version ?? 0;

    if (currentVersion >= DATABASE_VERSION) {
      return;
    }
    ```
  - **Lines 276–292**: Initial seed data inserts 16 sample angkringan items with hardcoded IDs:
    ```sql
    INSERT OR IGNORE INTO menus (id, name, price, category_id, track_stock, stock) VALUES
      (1, 'Nasi Kucing Sambal Teri', 5000, 1, 0, 0),
      (2, 'Nasi Kucing Oseng Tempe', 5000, 1, 0, 0),
      ...
      (16, 'Jadah Bakar Manis Gurih', 4000, 5, 0, 0);
    ```
  - **Line 301**: `PRAGMA user_version = 1;` is embedded at the tail end of a long multi-statement raw SQL string inside `await db.execAsync(...)`.
  - **Lines 48 & 136–137**:
    ```sql
    PRAGMA foreign_keys = ON;
    ...
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      menu_id INTEGER NOT NULL REFERENCES menus(id),
      menu_name TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      is_additional INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    ```
- **File**: `stores/menuStore.ts`
  - **Lines 173–178**:
    ```typescript
    deleteMenu: async (db: SQLiteDatabase, id) => {
      await withSqliteRetry(() =>
        db.runAsync('DELETE FROM menus WHERE id = ?', [id])
      );
      await get().loadMenus(db);
    },
    ```
- **File**: `app/_layout.tsx`
  - **Lines 30–37**: `handleDatabaseInit` executes `await migrateDbIfNeeded(db)` on every app cold start.

### 1.2 Tambah Menu Form
- **File**: `components/menu-form-modal.tsx`
  - **Lines 33–42**: Form state tracks `name`, `priceText`, `selectedCatId`, `trackStock`, `stockText`, `barcode`, `photoUri`, and `categoryModalVisible`.
  - **Lines 43–61**:
    ```typescript
    useEffect(() => {
      if (menuItem) {
        setName(menuItem.name);
        setPriceText(formatRupiahInput(menuItem.price));
        setSelectedCatId(menuItem.category_id);
        setTrackStock(menuItem.track_stock === 1);
        setStockText(menuItem.stock.toString());
        setBarcode(menuItem.barcode || '');
        setPhotoUri(menuItem.image_path || null);
      } else {
        setName('');
        setPriceText('');
        setSelectedCatId(categories.length > 0 ? categories[0].id : null);
        setTrackStock(false);
        setStockText('0');
        setBarcode('');
        setPhotoUri(null);
      }
    }, [menuItem, visible, categories]);
    ```
    *Note*: `categories` is listed in the dependency array.
  - **Lines 265–267 & 393–397**: The user can open `<CategoryFormModal>` from within `<MenuFormModal>` to create a new category.
  - **Missing Field**: There is no COGS/HPP (Harga Pokok Penjualan) input in the form. (The database currently uses global monthly COGS in table `monthly_cogs`).

### 1.3 Edit Menu Form
- **File**: `stores/menuStore.ts`
  - **Lines 127–150**:
    ```typescript
    updateMenu: async (db: SQLiteDatabase, id, data) => {
      await withSqliteRetry(() =>
        db.runAsync(
          `UPDATE menus
           SET name = COALESCE(?, name),
               price = COALESCE(?, price),
               category_id = COALESCE(?, category_id),
               image_path = COALESCE(?, image_path),
               barcode = COALESCE(?, barcode),
               track_stock = COALESCE(?, track_stock),
               stock = COALESCE(?, stock)
           WHERE id = ?`,
          [
            data.name ?? null,
            data.price ?? null,
            data.category_id ?? null,
            data.image_path ?? null,
            data.barcode ?? null,
            data.track_stock ?? null,
            data.stock ?? null,
            id,
          ]
        )
      );
      await get().loadMenus(db);
    },
    ```
  - *Note*: `COALESCE(?, category_id)` means passing `category_id: null` evaluates to `category_id` (unchanged); SQLite cannot set `category_id` to NULL.
- **File**: `components/menu-form-modal.tsx`
  - **Lines 151–154**:
    ```typescript
    let finalPhotoPath = '';
    if (photoUri) {
      finalPhotoPath = await saveImageLocally(photoUri, 'menus');
    }
    ```
    If `photoUri` is an existing stored path, re-saving can cause duplicated files if path string formats differ.

### 1.4 Quick Edit Menu on Cashier Screen
- **File**: `app/transaksi.tsx`
  - **Lines 332–337**:
    ```typescript
    onLongPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setSelectedMenuForEdit(item);
      setMenuModalVisible(true);
    }}
    delayLongPress={200}
    ```
  - **Lines 582–589**:
    ```typescript
    <MenuFormModal
      visible={menuModalVisible}
      menuItem={selectedMenuForEdit}
      onClose={() => {
        setMenuModalVisible(false);
        setSelectedMenuForEdit(null);
      }}
    />
    ```
- **File**: `components/menu-form-modal.tsx`
  - **Lines 410–417 & 444–450**:
    ```typescript
    modalBox: {
      backgroundColor: '#ffffff',
      borderRadius: 8,
      width: '100%',
      maxWidth: 540,
      maxHeight: '90%',
      display: 'flex',
    },
    body: {
      flex: 1,
    },
    bodyContent: {
      padding: 18,
      gap: 14,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    ```
    *Note*: In React Native Yoga flex layout, a container with `maxHeight: '90%'` and no explicit `height` causes an internal child with `style={{ flex: 1 }}` (`body`) to collapse to 0 height. The user only sees the fixed header and the fixed footer (with buttons "Hapus Menu", "Batal", and "Simpan Perubahan"), giving the appearance that fields are missing.

### 1.5 Modul Menu: Tombol Kategori
- **File**: `app/(tabs)/explore.tsx`
  - **Lines 92–98**:
    ```typescript
    <Button
      title="+ Kategori"
      variant="outline"
      size="sm"
      onPress={() => setCategoryModalVisible(true)}
      style={styles.headerBtn}
    />
    ```
  - **Line 37**: `deleteCategory` is imported from `useMenuStore`, but never used anywhere in `explore.tsx`.
- **File**: `components/category-form-modal.tsx`
  - **Lines 22–113**: The modal only contains an input for adding a single new category name. It does NOT display existing categories, does NOT support deleting categories, and does NOT support editing/renaming categories.
- **File**: `stores/menuStore.ts`
  - `useMenuStore` has `addCategory` and `deleteCategory`, but no `updateCategory` function.

### 1.6 Modul Riwayat: Tombol Unduh PDF dan Tombol Unduh CSV
- **File**: `app/(tabs)/history.tsx`
  - **Lines 244–296 (`handleExportPdf`)** & **Lines 298–315 (`handleExportCsv`)**:
    - Calls `exportTableToPdf(...)` from `services/export.ts` and `exportTransactionsCsv(...)` from `services/backup.ts`.
    - Neither function provides an Alert/toast confirmation upon completion.
    - If `filteredTransactions.length === 0`, it does not warn the user before running export.
- **File**: `services/export.ts` & `services/backup.ts`
  - If `Sharing.isAvailableAsync()` returns `false` (e.g. web, emulator, or restricted device), the file is written to local storage, but nothing is presented to the user.
  - If the user cancels the native share sheet, `Sharing.shareAsync` can throw an error, causing `history.tsx` to display `Alert.alert('Export Gagal', err.message)` even though the file was created successfully.

### 1.7 Modul Absensi: Tombol Tambah Karyawan
- **File**: `app/(tabs)/attendance.tsx`
  - **Lines 475–485**:
    ```typescript
    <Button
      title="+ Karyawan"
      size="sm"
      variant="outline"
      onPress={() => {
        setEditingEmployee(null);
        setEmployeeModalVisible(true);
      }}
      style={styles.addEmpBtnHeader}
    />
    ```
- **File**: `components/employee-modal.tsx`
  - **Lines 27–40**: Inputs for `name` and `phone`.
  - **Lines 41–60**:
    ```typescript
    const handleSave = async () => {
      if (!name.trim()) {
        Alert.alert('Perhatian', 'Nama karyawan wajib diisi.');
        return;
      }
      setIsSubmitting(true);
      try {
        if (employee) {
          await updateEmployee(db, employee.id, name.trim(), phone.trim());
        } else {
          await addEmployee(db, name.trim(), phone.trim());
        }
        setIsSubmitting(false);
        onClose();
      } catch (err: any) {
        setIsSubmitting(false);
        Alert.alert('Gagal', err?.message || 'Gagal menyimpan data karyawan.');
      }
    };
    ```
  - *Note*: If a duplicate employee name is submitted, SQLite throws `UNIQUE constraint failed: employees.name` directly.
  - Missing success notification upon saving (modal simply closes).
  - No `KeyboardAvoidingView`, which can cause inputs/buttons to be obscured by the on-screen keyboard on smaller devices.

---

## 2. Logic Chain

### 2.1 Why Default Menus Reappear or Cannot be Permanently Deleted
1. **Reappearance Root Cause**:
   - `services/database.ts` seeds default menus using:
     `INSERT OR IGNORE INTO menus (id, name, price, category_id, track_stock, stock) VALUES (1, ...)`
   - The versioning command `PRAGMA user_version = 1;` is placed at the end of a long multi-query SQL string executed via `db.execAsync(...)`. In certain SQLite environments and connection pools, `PRAGMA user_version = 1;` within multi-statement blocks is either not committed or defaults to 0 on subsequent re-openings.
   - On app reload, `migrateDbIfNeeded` checks `currentVersion >= DATABASE_VERSION`. If `currentVersion` reads 0, the migration runs again.
   - If the user had deleted default menu `id = 1`, `INSERT OR IGNORE` sees that `id = 1` no longer exists in `menus`, so it re-inserts it.
   - Furthermore, there is no persistent flag (e.g. `seed_menus_completed` in `settings` table) ensuring that sample data seeding only ever executes once in the lifecycle of the database.
2. **Permanent Deletion Failure Root Cause**:
   - `services/database.ts` lines 48 & 136–137 enable foreign keys (`PRAGMA foreign_keys = ON;`) and define:
     `transaction_items.menu_id INTEGER NOT NULL REFERENCES menus(id)` with NO `ON DELETE` action (which defaults to `RESTRICT` in SQLite).
   - If a default menu item was ever part of any recorded transaction (test transaction or real order), running `DELETE FROM menus WHERE id = ?` fails immediately with `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`.

### 2.2 Why Tambah Menu Wipes Out Filled Data
1. In `components/menu-form-modal.tsx`, `useEffect` resets form state when `menuItem` is null:
   `setName(''); setPriceText(''); setSelectedCatId(...); setStockText('0'); ...`
2. The dependency array includes `[menuItem, visible, categories]`.
3. When the user is typing in a new menu and clicks "+ Kategori Baru" to create a category, `CategoryFormModal` adds the category and calls `loadCategories(db)`.
4. Updating `categories` in Zustand triggers `useEffect` in `MenuFormModal`.
5. Because `menuItem` is null, the `else` branch executes and erases all fields the user just filled in.

### 2.3 Why Edit Menu Cannot Unset Category and Risks Photo Duplication
1. In `stores/menuStore.ts`, `updateMenu` uses `category_id = COALESCE(?, category_id)`.
2. When the user attempts to set a menu to "Tanpa Kategori" (`category_id: null`), `COALESCE(NULL, category_id)` evaluates to the existing `category_id`. The change is ignored by SQLite.
3. In `menu-form-modal.tsx`, `finalPhotoPath = await saveImageLocally(photoUri, 'menus')` executes even if `photoUri` was already a saved local file, creating duplicate files in internal storage if URI prefixes vary.

### 2.4 Why Quick Edit on Cashier Screen Appears to Only Show Action Buttons
1. In `app/transaksi.tsx`, the long-press event on a menu card sets `selectedMenuForEdit(item)` and opens `MenuFormModal`.
2. In `components/menu-form-modal.tsx`, the container `modalBox` has `maxHeight: '90%'` and `display: 'flex'`, but lacks an explicit `height`.
3. The child `<ScrollView style={styles.body}>` has `flex: 1`.
4. Under React Native flexbox layout rules, a child with `flex: 1` inside an ancestor that has only `maxHeight` (and no definite height) collapses to 0 height.
5. As a result, the form body collapses completely. The user only sees the fixed header and the fixed footer containing `Hapus Menu`, `Batal`, and `Simpan Perubahan`.

### 2.5 Why Category Management is Missing from the Menu Screen
1. `app/(tabs)/explore.tsx` has a button titled `"+ Kategori"`, which opens `CategoryFormModal`.
2. `CategoryFormModal` is strictly an add-category modal (a single input field for category name).
3. The application lacks a Category Management modal where existing categories can be viewed in a list, renamed, or deleted (with confirmation).
4. `deleteCategory` was imported into `explore.tsx` but left completely unreferenced.

### 2.6 Why Riwayat Unduh PDF and CSV Cause Confusion
1. `history.tsx` executes `handleExportPdf` and `handleExportCsv` without notifying the user when export completes successfully.
2. In environments where `Sharing.isAvailableAsync()` is false (web, emulators), the file is saved silently without any alert showing the file path.
3. When a user dismisses the native share dialog, `Sharing.shareAsync` rejection triggers an "Export Gagal" error alert even though file generation was successful.
4. Exporting with 0 records proceeds without validation or warning.

### 2.7 Why Tambah Karyawan Has Validation & UX Gaps
1. In `app/(tabs)/attendance.tsx`, the button is labeled `"+ Karyawan"` instead of `"Tambah Karyawan"`.
2. `components/employee-modal.tsx` only validates that `name` is not blank. It does not validate phone numbers or check for duplicate names prior to database insertion.
3. If a duplicate name is inserted, raw SQLite error `UNIQUE constraint failed: employees.name` is surfaced.
4. Saving does not display any success feedback alert to confirm the action.
5. The modal lacks `KeyboardAvoidingView`, leading to obscured inputs on smaller devices.

---

## 3. Caveats

- **Per-Menu COGS Schema**: The current database schema stores COGS globally per month in `monthly_cogs` (Opsi A). If the user requires per-menu COGS/HPP in `menus`, an `ALTER TABLE menus ADD COLUMN cogs REAL DEFAULT 0;` migration will be required.
- **Foreign Key Migration**: Modifying `transaction_items.menu_id` to `REFERENCES menus(id) ON DELETE SET NULL` in an existing SQLite table requires creating a replacement table or executing soft-deletes (`is_active = 0` on `menus`). If hard deletion is required, existing transactions referencing the menu must have their `menu_id` unlinked (or `menu_id` set to null) while preserving `menu_name` and `price`.
- **Operating Environment**: Tested on Node.js test environment; mobile device layout was analyzed based on React Native 0.81 / Yoga flexbox layout specifications.

---

## 4. Conclusion & Actionable Recommendations

### R1.1 Default Menu Deletion
1. In `services/database.ts`:
   - Add a persistent setting check: `SELECT value FROM settings WHERE key = 'seed_menus_applied'`.
   - Only execute initial sample menu insertion if `seed_menus_applied` is not `'1'`.
   - After seeding, run `INSERT INTO settings (key, value) VALUES ('seed_menus_applied', '1')`.
   - Explicitly run `PRAGMA user_version = 1;` via `db.runAsync(...)` outside the multi-statement string.
2. In `stores/menuStore.ts` / `services/database.ts`:
   - In `deleteMenu(db, id)`: Before executing `DELETE FROM menus WHERE id = ?`, check if `transaction_items` references `id`. If so, update `transaction_items SET menu_id = NULL WHERE menu_id = ?` (or alter schema to `ON DELETE SET NULL`) so that historical sales records preserve item name and price while allowing the menu item to be deleted permanently.

### R1.2 Tambah Menu Form
1. In `components/menu-form-modal.tsx`:
   - Fix `useEffect` dependency array: Change `[menuItem, visible, categories]` to `[menuItem, visible]`.
   - Initialize category using an internal flag or only when modal opens (`visible` transitions from false to true).
   - Ensure adding a new category from `CategoryFormModal` updates `selectedCatId` without wiping user input in `name`, `priceText`, `stockText`, `barcode`, or `photoUri`.
   - Add COGS/HPP input field (optional/default 0) if per-product HPP is requested.

### R1.3 Edit Menu Form
1. In `stores/menuStore.ts`:
   - Refactor `updateMenu` so that `category_id` can be updated to `NULL` (e.g. use conditional SQL update or parameterized values without `COALESCE` blocking nulls).
2. In `components/menu-form-modal.tsx`:
   - Prevent re-copying existing local images in `saveImageLocally`.

### R1.4 Quick Edit Menu on Cashier Screen
1. In `components/menu-form-modal.tsx`:
   - Fix the modal layout collapse: Give `modalBox` a concrete height (e.g. `height: 520` or `height: '85%'`, with `maxHeight: '90%'`), or give `<ScrollView style={{ maxHeight: 380 }}>` a fixed max-height instead of `flex: 1` inside an unconstrained parent.
   - Wrap in `KeyboardAvoidingView` so inputs remain visible when the keyboard is open.
   - This ensures all form fields (name, price, category, stock stepper, barcode, photo) are clearly visible and scrollable when triggered from Cashier screen long-press.

### R2.1 Modul Menu: Tombol Kategori
1. In `app/(tabs)/explore.tsx`:
   - Update header button title to `"Kategori"` or `"Kelola Kategori"`.
   - Open a full `CategoryManagementModal` instead of a simple add-only dialog.
2. Create/Refactor `CategoryManagementModal`:
   - Displays list of categories with product counts.
   - Allows adding a new category with duplicate-name validation.
   - Allows renaming an existing category (add `updateCategory` to `menuStore`).
   - Allows deleting a category (calling `deleteCategory` from `menuStore`), showing confirmation.

### R2.2 Modul Riwayat: Tombol Unduh PDF & CSV
1. In `app/(tabs)/history.tsx`:
   - Validate if `filteredTransactions.length === 0` (or `filteredCash.length === 0`). If empty, alert: `"Tidak ada data transaksi untuk diexport pada periode ini."`
   - On successful export, display `Alert.alert('Export Berhasil', 'Berkas PDF/CSV berhasil dibuat dan siap dibagikan.')`.
   - Catch sharing dismissal gracefully without alerting failure if the user simply closed the share sheet.
   - Provide file location display if `Sharing.isAvailableAsync()` is false.

### R2.3 Modul Absensi: Tombol Tambah Karyawan
1. In `app/(tabs)/attendance.tsx`:
   - Rename header button from `"+ Karyawan"` to `"Tambah Karyawan"`.
2. In `components/employee-modal.tsx`:
   - Add duplicate name check before inserting.
   - Show success alert: `Alert.alert('Sukses', 'Karyawan baru berhasil didaftarkan.')`.
   - Wrap modal in `KeyboardAvoidingView`.

---

## 5. Verification Method

1. **Automated Test Suite**:
   Run the full test suite to verify no regressions on existing transaction and financial logic:
   ```bash
   npm test
   ```
2. **Database Seeding Verification**:
   - Inspect database after deletion: Delete default menu `id = 1`, restart/reload app, execute `SELECT * FROM menus WHERE id = 1;` to verify it does not reappear.
3. **Form Persistence Verification**:
   - Open Tambah Menu, enter `"Wedang Spesial"`, click `+ Kategori Baru`, add `"Kategori Baru"`, and verify `"Wedang Spesial"` text remains in the name input.
4. **Modal Rendering Verification**:
   - Open Kasir (`transaksi.tsx`), long-press any menu item. Verify that the modal renders the complete form (Name, Price, Category pills, Stock stepper, Barcode, Photo) and is fully scrollable above the action buttons.
5. **Export Verification**:
   - Go to Riwayat, click `Unduh PDF` and `Unduh CSV`. Verify that alert confirmation displays and share sheet triggers properly.
