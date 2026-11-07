import { create } from 'zustand';
import { SQLiteDatabase, withSqliteRetry } from '../services/database';

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category_id: number | null;
  image_path: string;
  barcode: string;
  track_stock: number; // 0: unlimited, 1: track stock
  stock: number;
  is_active?: number;
  created_at: string;
}

interface MenuState {
  categories: Category[];
  menus: MenuItem[];
  selectedCategoryId: number | null; // null = Semua
  searchQuery: string;
  isLoading: boolean;
  barcodeMap: Record<string, MenuItem>;

  // Actions
  loadCategories: (db: SQLiteDatabase) => Promise<void>;
  loadMenus: (db: SQLiteDatabase) => Promise<void>;
  setSelectedCategoryId: (id: number | null) => void;
  setSearchQuery: (query: string) => void;
  addCategory: (db: SQLiteDatabase, name: string) => Promise<number>;
  updateCategory: (db: SQLiteDatabase, id: number, name: string) => Promise<void>;
  deleteCategory: (db: SQLiteDatabase, id: number) => Promise<void>;
  addMenu: (db: SQLiteDatabase, data: Omit<MenuItem, 'id' | 'created_at'>) => Promise<number>;
  updateMenu: (db: SQLiteDatabase, id: number, data: Partial<MenuItem>) => Promise<void>;
  quickEditMenu: (db: SQLiteDatabase, id: number, price: number, stock: number, name?: string) => Promise<void>;
  deleteMenu: (db: SQLiteDatabase, id: number) => Promise<void>;
  findMenuByBarcode: (barcode: string) => MenuItem | undefined;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  categories: [],
  menus: [],
  selectedCategoryId: null,
  searchQuery: '',
  isLoading: false,
  barcodeMap: {},

  loadCategories: async (db: SQLiteDatabase) => {
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<Category>('SELECT * FROM categories ORDER BY id ASC')
      );
      set({ categories: rows || [] });
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  },

  loadMenus: async (db: SQLiteDatabase) => {
    set({ isLoading: true });
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<MenuItem>('SELECT * FROM menus WHERE is_active = 1 ORDER BY name ASC')
      );
      const list = rows || [];
      const map: Record<string, MenuItem> = {};
      list.forEach((item) => {
        if (item.barcode && item.barcode.trim() !== '') {
          map[item.barcode.trim()] = item;
        }
      });
      set({ menus: list, barcodeMap: map, isLoading: false });
    } catch (err) {
      console.error('Error loading menus:', err);
      set({ isLoading: false });
    }
  },

  setSelectedCategoryId: (id: number | null) => {
    set({ selectedCategoryId: id });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  addCategory: async (db: SQLiteDatabase, name: string) => {
    const res = await withSqliteRetry(() =>
      db.runAsync('INSERT INTO categories (name) VALUES (?)', [name.trim()])
    );
    await get().loadCategories(db);
    return res.lastInsertRowId;
  },

  updateCategory: async (db: SQLiteDatabase, id: number, name: string) => {
    await withSqliteRetry(() =>
      db.runAsync('UPDATE categories SET name = ? WHERE id = ?', [name.trim(), id])
    );
    await get().loadCategories(db);
    await get().loadMenus(db);
  },

  deleteCategory: async (db: SQLiteDatabase, id: number) => {
    await withSqliteRetry(async () => {
      await db.runAsync('UPDATE menus SET category_id = NULL WHERE category_id = ?', [id]);
      await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
    });
    await get().loadCategories(db);
    await get().loadMenus(db);
  },

  addMenu: async (db: SQLiteDatabase, data) => {
    const res = await withSqliteRetry(() =>
      db.runAsync(
        `INSERT INTO menus (name, price, category_id, image_path, barcode, track_stock, stock, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          data.name,
          data.price,
          data.category_id,
          data.image_path || '',
          data.barcode || '',
          data.track_stock || 0,
          data.stock || 0,
        ]
      )
    );
    await get().loadMenus(db);
    return res.lastInsertRowId;
  },

  updateMenu: async (db: SQLiteDatabase, id, data) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.price !== undefined) {
      fields.push('price = ?');
      values.push(data.price);
    }
    if ('category_id' in data) {
      fields.push('category_id = ?');
      values.push(data.category_id ?? null);
    }
    if (data.image_path !== undefined) {
      fields.push('image_path = ?');
      values.push(data.image_path);
    }
    if (data.barcode !== undefined) {
      fields.push('barcode = ?');
      values.push(data.barcode);
    }
    if (data.track_stock !== undefined) {
      fields.push('track_stock = ?');
      values.push(data.track_stock);
    }
    if (data.stock !== undefined) {
      fields.push('stock = ?');
      values.push(data.stock);
    }

    if (fields.length > 0) {
      values.push(id);
      await withSqliteRetry(() =>
        db.runAsync(
          `UPDATE menus SET ${fields.join(', ')} WHERE id = ?`,
          values
        )
      );
    }
    await get().loadMenus(db);
  },

  quickEditMenu: async (db: SQLiteDatabase, id, price, stock, name) => {
    if (name) {
      await withSqliteRetry(() =>
        db.runAsync(
          'UPDATE menus SET name = ?, price = ?, stock = ? WHERE id = ?',
          [name, price, stock, id]
        )
      );
    } else {
      await withSqliteRetry(() =>
        db.runAsync(
          'UPDATE menus SET price = ?, stock = ? WHERE id = ?',
          [price, stock, id]
        )
      );
    }
    await get().loadMenus(db);
  },

  deleteMenu: async (db: SQLiteDatabase, id) => {
    await withSqliteRetry(async () => {
      await db.runAsync('UPDATE menus SET is_active = 0 WHERE id = ?', [id]);
    });
    await get().loadMenus(db);
  },

  findMenuByBarcode: (barcode: string) => {
    if (!barcode) return undefined;
    return get().barcodeMap[barcode.trim()];
  },
}));

