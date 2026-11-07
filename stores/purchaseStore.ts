import { create } from 'zustand';
import { SQLiteDatabase, withSqliteRetry } from '../services/database';
import { getBusinessDate } from '../utils/sessionHelper';
import { saveImageLocally } from '../utils/imageStorage';

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  created_at: string;
  unpaid_debt?: number;
}

export interface PurchaseRecord {
  id: number;
  supplier_id: number | null;
  supplier_name: string;
  business_date: string;
  total_amount: number;
  payment_type: 'cash' | 'tempo';
  due_date: string | null;
  payment_status: 'paid' | 'unpaid';
  paid_at: string | null;
  receipt_photo_path: string;
  notes: string;
  created_at: string;
}

export interface CreatePurchaseInput {
  supplier_id: number | null;
  supplier_name: string;
  total_amount: number;
  payment_type: 'cash' | 'tempo';
  has_due_date: boolean;
  due_date: string | null;
  receipt_photo_uri?: string;
  notes?: string;
}

interface PurchaseState {
  suppliers: Supplier[];
  purchases: PurchaseRecord[];
  totalUnpaidDebt: number;
  isLoading: boolean;

  loadSuppliers: (db: SQLiteDatabase) => Promise<void>;
  addSupplier: (db: SQLiteDatabase, name: string, phone?: string) => Promise<number>;
  updateSupplier: (db: SQLiteDatabase, id: number, name: string, phone?: string) => Promise<void>;
  deleteSupplier: (db: SQLiteDatabase, id: number) => Promise<void>;

  loadPurchases: (db: SQLiteDatabase) => Promise<void>;
  recordPurchase: (db: SQLiteDatabase, input: CreatePurchaseInput) => Promise<number>;
  settleTempoDebt: (db: SQLiteDatabase, purchaseId: number) => Promise<void>;
  deletePurchase: (db: SQLiteDatabase, purchaseId: number) => Promise<void>;
}

export const usePurchaseStore = create<PurchaseState>((set, get) => ({
  suppliers: [],
  purchases: [],
  totalUnpaidDebt: 0,
  isLoading: false,

  loadSuppliers: async (db: SQLiteDatabase) => {
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<Supplier>('SELECT * FROM suppliers ORDER BY name ASC')
      );

      // Hitung hutang tempo belum lunas per supplier
      const debts = await withSqliteRetry(() =>
        db.getAllAsync<{ supplier_id: number; debt: number }>(
          `SELECT supplier_id, SUM(total_amount) as debt
           FROM purchases
           WHERE payment_type = 'tempo' AND payment_status = 'unpaid'
           GROUP BY supplier_id`
        )
      );

      const debtMap: Record<number, number> = {};
      (debts || []).forEach((d) => {
        debtMap[d.supplier_id] = d.debt;
      });

      const mapped = (rows || []).map((s) => ({
        ...s,
        unpaid_debt: debtMap[s.id] || 0,
      }));

      set({ suppliers: mapped });
    } catch (err) {
      console.error('Error loading suppliers:', err);
    }
  },

  loadPurchases: async (db: SQLiteDatabase) => {
    set({ isLoading: true });
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<PurchaseRecord>(
          'SELECT * FROM purchases ORDER BY id DESC'
        )
      );

      const records = rows || [];
      const unpaid = records
        .filter((p) => p.payment_type === 'tempo' && p.payment_status === 'unpaid')
        .reduce((sum, p) => sum + p.total_amount, 0);

      set({ purchases: records, totalUnpaidDebt: unpaid, isLoading: false });
    } catch (err) {
      console.error('Error loading purchases:', err);
      set({ isLoading: false });
    }
  },

  addSupplier: async (db, name, phone = '') => {
    const res = await withSqliteRetry(() =>
      db.runAsync('INSERT INTO suppliers (name, phone) VALUES (?, ?)', [
        name.trim(),
        phone.trim(),
      ])
    );
    await get().loadSuppliers(db);
    return res.lastInsertRowId;
  },

  updateSupplier: async (db, id, name, phone = '') => {
    await withSqliteRetry(() =>
      db.runAsync('UPDATE suppliers SET name = ?, phone = ? WHERE id = ?', [
        name.trim(),
        phone.trim(),
        id,
      ])
    );
    await get().loadSuppliers(db);
  },

  deleteSupplier: async (db, id) => {
    await withSqliteRetry(() =>
      db.runAsync('DELETE FROM suppliers WHERE id = ?', [id])
    );
    await get().loadSuppliers(db);
  },

  recordPurchase: async (db, input) => {
    const businessDate = getBusinessDate();
    let savedPhotoPath = '';

    if (input.receipt_photo_uri) {
      savedPhotoPath = await saveImageLocally(input.receipt_photo_uri, 'purchases');
    }

    const isCash = input.payment_type === 'cash';
    const paymentStatus = isCash ? 'paid' : 'unpaid';
    const finalDueDate = input.has_due_date && input.due_date ? input.due_date : null;

    let newPurchaseId = 0;

    await withSqliteRetry(() =>
      db.withTransactionAsync(async () => {
        // 1. Simpan data pembelian ke tabel purchases
        const res = await db.runAsync(
          `INSERT INTO purchases (
            supplier_id, supplier_name, business_date, total_amount,
            payment_type, due_date, payment_status, receipt_photo_path, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.supplier_id,
            input.supplier_name.trim(),
            businessDate,
            input.total_amount,
            input.payment_type,
            finalDueDate,
            paymentStatus,
            savedPhotoPath,
            input.notes?.trim() || '',
          ]
        );
        newPurchaseId = res.lastInsertRowId;

        // 2. Jika pembelian tunai (CASH), otomatis potong kas / catat ke cash_ledger sebagai pengeluaran operasional (PnL)
        if (isCash) {
          await db.runAsync(
            `INSERT INTO cash_ledger (
              business_date, type, affects_pnl, category, amount, notes
            ) VALUES (?, 'expense', 1, 'Pembelian Bahan/Kulakan', ?, ?)`,
            [
              businessDate,
              input.total_amount,
              `Kulakan tunai dari ${input.supplier_name} (ID Pembelian: #${newPurchaseId})`,
            ]
          );
        }
      })
    );

    await get().loadPurchases(db);
    await get().loadSuppliers(db);
    return newPurchaseId;
  },

  settleTempoDebt: async (db, purchaseId) => {
    const businessDate = getBusinessDate();
    const purchase = get().purchases.find((p) => p.id === purchaseId);
    if (!purchase) throw new Error('Data pembelian tempo tidak ditemukan.');

    if (purchase.payment_status === 'paid') {
      throw new Error('Hutang pembelian ini sudah lunas.');
    }

    await withSqliteRetry(() =>
      db.withTransactionAsync(async () => {
        // 1. Tandai lunas di tabel purchases
        await db.runAsync(
          "UPDATE purchases SET payment_status = 'paid', paid_at = datetime('now','localtime') WHERE id = ?",
          [purchaseId]
        );

        // 2. Otomatis potong kas operasional di cash_ledger
        await db.runAsync(
          `INSERT INTO cash_ledger (
            business_date, type, affects_pnl, category, amount, notes
          ) VALUES (?, 'expense', 1, 'Pelunasan Hutang Supplier', ?, ?)`,
          [
            businessDate,
            purchase.total_amount,
            `Pelunasan hutang nota #${purchase.id} kepada ${purchase.supplier_name}`,
          ]
        );
      })
    );

    await get().loadPurchases(db);
    await get().loadSuppliers(db);
  },

  deletePurchase: async (db, purchaseId) => {
    await withSqliteRetry(() =>
      db.runAsync('DELETE FROM purchases WHERE id = ?', [purchaseId])
    );
    await get().loadPurchases(db);
    await get().loadSuppliers(db);
  },
}));

