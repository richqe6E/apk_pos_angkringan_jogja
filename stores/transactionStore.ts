import { create } from 'zustand';
import { SQLiteDatabase, withSqliteRetry } from '../services/database';
import { getBusinessDate } from '../utils/sessionHelper';
import { MenuItem } from './menuStore';

export interface CartItem {
  id: string; // unique cart entry key
  menu_id: number;
  name: string;
  price: number;
  qty: number;
  subtotal: number;
  is_additional: number; // 0 = pesanan awal, 1 = pesanan sambungan
}

export interface PendingOrderSummary {
  id: number;
  invoice_number: string;
  table_number: string;
  customer_name: string;
  subtotal: number;
  total: number;
  created_at: string;
  item_count: number;
}

interface TransactionState {
  cart: CartItem[];
  tableNumber: string;
  activePendingTransactionId: number | null; // null jika transaksi baru
  customerId: number | null;
  customerName: string;
  customerTotalSpent: number;
  eligibleReward: string | null;
  taxEnabled: boolean;
  taxRate: number;
  discountAmount: number;
  isCheckingOut: boolean;
  pendingOrders: PendingOrderSummary[];

  // Getters
  getSubtotal: () => number;
  getTaxAmount: () => number;
  getTotal: () => number;

  // Actions Keranjang
  addToCart: (menu: MenuItem, qty?: number) => void;
  updateCartQty: (menuId: number, qty: number) => void;
  removeFromCart: (menuId: number) => void;
  clearCart: () => void;
  setTableNumber: (table: string) => void;
  setCustomer: (id: number | null, name: string, totalSpent?: number, eligibleReward?: string | null) => void;
  setDiscountAmount: (amount: number) => void;
  setTaxSettings: (enabled: boolean, rate: number) => void;

  // Pending & Meja
  loadPendingOrders: (db: SQLiteDatabase) => Promise<void>;
  openPendingOrder: (db: SQLiteDatabase, txId: number) => Promise<void>;
  saveAsPendingOrder: (db: SQLiteDatabase) => Promise<{ txId: number; invoiceNumber: string; isNew: boolean }>;
  mergeTables: (db: SQLiteDatabase, sourceTxIds: number[], targetTableNumber: string) => Promise<number>;

  // Checkout Pembayaran (Dua Tahap)
  checkout: (
    db: SQLiteDatabase,
    paymentMethod: 'tunai' | 'qris' | 'transfer',
    paymentAmount: number
  ) => Promise<{
    txId: number;
    invoiceNumber: string;
    total: number;
    paymentAmount: number;
    change: number;
    dailySeq: number;
  }>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  cart: [],
  tableNumber: 'Meja 01',
  activePendingTransactionId: null,
  customerId: 1,
  customerName: 'Customer UMUM',
  customerTotalSpent: 0,
  eligibleReward: null,
  taxEnabled: false,
  taxRate: 10,
  discountAmount: 0,
  isCheckingOut: false,
  pendingOrders: [],

  getSubtotal: () => {
    return get().cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  },

  getTaxAmount: () => {
    const { taxEnabled, taxRate } = get();
    if (!taxEnabled) return 0;
    const subtotal = get().getSubtotal();
    return Math.round((subtotal * taxRate) / 100);
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const tax = get().getTaxAmount();
    const discount = get().discountAmount;
    return Math.max(0, subtotal + tax - discount);
  },

  addToCart: (menu: MenuItem, qty = 1) => {
    const { cart, activePendingTransactionId } = get();
    const existingIndex = cart.findIndex((item) => item.menu_id === menu.id);

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const newQty = updatedCart[existingIndex].qty + qty;
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        qty: newQty,
        subtotal: newQty * updatedCart[existingIndex].price,
      };
      set({ cart: updatedCart });
    } else {
      // Jika sedang mengedit pending order yang sudah ada, item baru ditandai sebagai pesanan tambahan (is_additional = 1)
      const isAdditional = activePendingTransactionId ? 1 : 0;
      const newItem: CartItem = {
        id: `${menu.id}-${Date.now()}`,
        menu_id: menu.id,
        name: menu.name,
        price: menu.price,
        qty,
        subtotal: menu.price * qty,
        is_additional: isAdditional,
      };
      set({ cart: [...cart, newItem] });
    }
  },

  updateCartQty: (menuId: number, qty: number) => {
    const { cart } = get();
    if (qty <= 0) {
      get().removeFromCart(menuId);
      return;
    }

    const updated = cart.map((item) => {
      if (item.menu_id === menuId) {
        return {
          ...item,
          qty,
          subtotal: qty * item.price,
        };
      }
      return item;
    });
    set({ cart: updated });
  },

  removeFromCart: (menuId: number) => {
    set({ cart: get().cart.filter((item) => item.menu_id !== menuId) });
  },

  clearCart: () => {
    set({
      cart: [],
      activePendingTransactionId: null,
      tableNumber: 'Meja 01',
      customerId: 1,
      customerName: 'Customer UMUM',
      customerTotalSpent: 0,
      eligibleReward: null,
      discountAmount: 0,
    });
  },

  setTableNumber: (table: string) => {
    set({ tableNumber: table });
  },

  setCustomer: (id, name, totalSpent = 0, eligibleReward = null) => {
    set({
      customerId: id,
      customerName: name,
      customerTotalSpent: totalSpent,
      eligibleReward,
    });
  },

  setDiscountAmount: (amount: number) => {
    set({ discountAmount: Math.max(0, amount) });
  },

  setTaxSettings: (enabled: boolean, rate: number) => {
    set({ taxEnabled: enabled, taxRate: rate });
  },

  loadPendingOrders: async (db: SQLiteDatabase) => {
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<any>(`
          SELECT 
            t.id,
            t.invoice_number,
            t.table_number,
            t.customer_name,
            t.subtotal,
            t.total,
            t.created_at,
            (SELECT COUNT(*) FROM transaction_items WHERE transaction_id = t.id) as item_count
          FROM transactions t
          WHERE t.status = 'pending'
          ORDER BY t.id DESC
        `)
      );

      const mapped: PendingOrderSummary[] = (rows || []).map((r) => ({
        id: r.id,
        invoice_number: r.invoice_number,
        table_number: r.table_number,
        customer_name: r.customer_name,
        subtotal: r.subtotal,
        total: r.total,
        created_at: r.created_at,
        item_count: r.item_count,
      }));

      set({ pendingOrders: mapped });
    } catch (err) {
      console.error('Error loading pending orders:', err);
    }
  },

  openPendingOrder: async (db: SQLiteDatabase, txId: number) => {
    try {
      const tx = await withSqliteRetry(() =>
        db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?', [txId])
      );
      if (!tx) return;

      const items = await withSqliteRetry(() =>
        db.getAllAsync<any>(
          'SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id ASC',
          [txId]
        )
      );

      const cartItems: CartItem[] = (items || []).map((i) => ({
        id: `${i.menu_id}-${i.id}`,
        menu_id: i.menu_id,
        name: i.menu_name,
        price: i.price,
        qty: i.qty,
        subtotal: i.subtotal,
        is_additional: 0, // pesanan yang sudah tersimpan
      }));

      // Ambil data customer jika ada
      let totalSpent = 0;
      let eligibleReward: string | null = null;
      if (tx.customer_id && tx.customer_id > 1) {
        const cust = await db.getFirstAsync<any>(
          'SELECT * FROM customers WHERE id = ?',
          [tx.customer_id]
        );
        if (cust) {
          totalSpent = cust.total_spent || 0;
          // Cek reward
          const reward = await db.getFirstAsync<any>(
            'SELECT * FROM rewards WHERE min_spend <= ? ORDER BY min_spend DESC LIMIT 1',
            [totalSpent]
          );
          if (reward) eligibleReward = reward.tier_name;
        }
      }

      set({
        activePendingTransactionId: tx.id,
        tableNumber: tx.table_number,
        customerId: tx.customer_id,
        customerName: tx.customer_name,
        customerTotalSpent: totalSpent,
        eligibleReward,
        discountAmount: tx.discount_amount || 0,
        cart: cartItems,
      });
    } catch (err) {
      console.error('Error opening pending order:', err);
    }
  },

  saveAsPendingOrder: async (db: SQLiteDatabase) => {
    const {
      cart,
      tableNumber,
      customerId,
      customerName,
      discountAmount,
      activePendingTransactionId,
      getSubtotal,
      getTaxAmount,
      getTotal,
    } = get();

    if (cart.length === 0) {
      throw new Error('Keranjang belanja kosong');
    }

    const businessDate = getBusinessDate();
    const subtotal = getSubtotal();
    const taxAmount = getTaxAmount();
    const total = getTotal();

    if (activePendingTransactionId) {
      // UPDATE transaksi pending yang sudah ada (tambahkan item baru / perbarui kuantitas)
      await withSqliteRetry(() =>
        db.runAsync(
          `UPDATE transactions
           SET subtotal = ?, tax_amount = ?, discount_amount = ?, total = ?, table_number = ?, customer_name = ?
           WHERE id = ?`,
          [subtotal, taxAmount, discountAmount, total, tableNumber, customerName, activePendingTransactionId]
        )
      );

      // Hapus item lama lalu tulis ulang seluruh item
      await withSqliteRetry(() =>
        db.runAsync('DELETE FROM transaction_items WHERE transaction_id = ?', [activePendingTransactionId])
      );

      for (const item of cart) {
        await withSqliteRetry(() =>
          db.runAsync(
            `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [activePendingTransactionId, item.menu_id, item.name, item.price, item.qty, item.subtotal, item.is_additional]
          )
        );
      }

      const txRow = await db.getFirstAsync<{ invoice_number: string }>(
        'SELECT invoice_number FROM transactions WHERE id = ?',
        [activePendingTransactionId]
      );

      await get().loadPendingOrders(db);
      return { txId: activePendingTransactionId, invoiceNumber: txRow?.invoice_number || '', isNew: false };
    }

    // TRANSAKSI PENDING BARU: Buat nomor nota atomik
    const counterRow = await withSqliteRetry(() =>
      db.getFirstAsync<{ last_seq: number }>(
        'SELECT last_seq FROM daily_counters WHERE business_date = ?',
        [businessDate]
      )
    );
    const nextSeq = (counterRow?.last_seq ?? 0) + 1;
    await withSqliteRetry(() =>
      db.runAsync(
        `INSERT INTO daily_counters (business_date, last_seq) VALUES (?, ?)
         ON CONFLICT(business_date) DO UPDATE SET last_seq = ?`,
        [businessDate, nextSeq, nextSeq]
      )
    );

    const [y, m, d] = businessDate.split('-');
    const invoiceNumber = `INV-${d}${m}${y.slice(2)}-${String(nextSeq).padStart(3, '0')}`;

    const res = await withSqliteRetry(() =>
      db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
          change_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'tunai', 0, 0, 'pending')`,
        [invoiceNumber, businessDate, tableNumber, customerId, customerName, subtotal, taxAmount, discountAmount, total]
      )
    );

    const newTxId = res.lastInsertRowId;

    for (const item of cart) {
      await withSqliteRetry(() =>
        db.runAsync(
          `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          [newTxId, item.menu_id, item.name, item.price, item.qty, item.subtotal]
        )
      );
    }

    set({ activePendingTransactionId: newTxId });
    await get().loadPendingOrders(db);
    return { txId: newTxId, invoiceNumber, isNew: true };
  },

  mergeTables: async (db: SQLiteDatabase, sourceTxIds: number[], targetTableNumber: string) => {
    if (sourceTxIds.length < 2) {
      throw new Error('Pilih minimal 2 meja pending untuk digabung.');
    }

    // Ambil meja pertama sebagai target transaksi induk
    const primaryId = sourceTxIds[0];
    const otherIds = sourceTxIds.slice(1);

    // Ambil semua item dari transaksi-transaksi yang digabung
    for (const otherId of otherIds) {
      await withSqliteRetry(() =>
        db.runAsync(
          `UPDATE transaction_items SET transaction_id = ?, is_additional = 1 WHERE transaction_id = ?`,
          [primaryId, otherId]
        )
      );

      // Tandai transaksi lain sebagai merged
      await withSqliteRetry(() =>
        db.runAsync(
          `UPDATE transactions SET status = 'merged', merged_into_tx_id = ? WHERE id = ?`,
          [primaryId, otherId]
        )
      );
    }

    // Hitung ulang total di primary transaksi
    const sumRow = await withSqliteRetry(() =>
      db.getFirstAsync<{ new_subtotal: number }>(
        `SELECT SUM(subtotal) as new_subtotal FROM transaction_items WHERE transaction_id = ?`,
        [primaryId]
      )
    );

    const newSubtotal = sumRow?.new_subtotal || 0;
    await withSqliteRetry(() =>
      db.runAsync(
        `UPDATE transactions SET table_number = ?, subtotal = ?, total = ? WHERE id = ?`,
        [targetTableNumber, newSubtotal, newSubtotal, primaryId]
      )
    );

    await get().loadPendingOrders(db);
    return primaryId;
  },

  checkout: async (db: SQLiteDatabase, paymentMethod, paymentAmount) => {
    const {
      cart,
      tableNumber,
      customerId,
      customerName,
      discountAmount,
      activePendingTransactionId,
      getSubtotal,
      getTaxAmount,
      getTotal,
      isCheckingOut,
    } = get();

    if (isCheckingOut) {
      throw new Error('Transaksi sedang diproses...');
    }

    if (cart.length === 0) {
      throw new Error('Keranjang pesanan masih kosong.');
    }

    const total = getTotal();
    if (paymentMethod === 'tunai' && paymentAmount < total) {
      throw new Error(`Uang pembayaran tunai kurang dari total tagihan (Rp ${total.toLocaleString('id-ID')}).`);
    }

    set({ isCheckingOut: true });

    try {
      const businessDate = getBusinessDate();
      const subtotal = getSubtotal();
      const taxAmount = getTaxAmount();
      const change = paymentMethod === 'tunai' ? Math.max(0, paymentAmount - total) : 0;

      let finalTxId: number;
      let finalInvoice: string;
      let dailySeq = 1;

      if (activePendingTransactionId) {
        // Melunasi transaksi pending yang sudah ada
        finalTxId = activePendingTransactionId;
        const txRow = await withSqliteRetry(() =>
          db.getFirstAsync<{ invoice_number: string }>(
            'SELECT invoice_number FROM transactions WHERE id = ?',
            [finalTxId]
          )
        );
        finalInvoice = txRow?.invoice_number || 'INV-PENDING';

        await withSqliteRetry(() =>
          db.runAsync(
            `UPDATE transactions
             SET subtotal = ?, tax_amount = ?, discount_amount = ?, total = ?,
                 payment_method = ?, payment_amount = ?, change_amount = ?,
                 status = 'completed', table_number = ?, customer_name = ?
             WHERE id = ?`,
            [
              subtotal,
              taxAmount,
              discountAmount,
              total,
              paymentMethod,
              paymentAmount,
              change,
              tableNumber,
              customerName,
              finalTxId,
            ]
          )
        );

        // Perbarui item jika ada perubahan di keranjang
        await withSqliteRetry(() =>
          db.runAsync('DELETE FROM transaction_items WHERE transaction_id = ?', [finalTxId])
        );

        for (const item of cart) {
          await withSqliteRetry(() =>
            db.runAsync(
              `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [finalTxId, item.menu_id, item.name, item.price, item.qty, item.subtotal, item.is_additional]
            )
          );
        }
      } else {
        // Transaksi Baru Langsung Bayar (Direct Checkout)
        const counterRow = await withSqliteRetry(() =>
          db.getFirstAsync<{ last_seq: number }>(
            'SELECT last_seq FROM daily_counters WHERE business_date = ?',
            [businessDate]
          )
        );
        dailySeq = (counterRow?.last_seq ?? 0) + 1;
        await withSqliteRetry(() =>
          db.runAsync(
            `INSERT INTO daily_counters (business_date, last_seq) VALUES (?, ?)
             ON CONFLICT(business_date) DO UPDATE SET last_seq = ?`,
            [businessDate, dailySeq, dailySeq]
          )
        );

        const [y, m, d] = businessDate.split('-');
        finalInvoice = `INV-${d}${m}${y.slice(2)}-${String(dailySeq).padStart(3, '0')}`;

        const res = await withSqliteRetry(() =>
          db.runAsync(
            `INSERT INTO transactions (
              invoice_number, business_date, table_number, customer_id, customer_name,
              subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
              change_amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
            [
              finalInvoice,
              businessDate,
              tableNumber,
              customerId,
              customerName,
              subtotal,
              taxAmount,
              discountAmount,
              total,
              paymentMethod,
              paymentAmount,
              change,
            ]
          )
        );

        finalTxId = res.lastInsertRowId;

        for (const item of cart) {
          await withSqliteRetry(() =>
            db.runAsync(
              `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
               VALUES (?, ?, ?, ?, ?, ?, 0)`,
              [finalTxId, item.menu_id, item.name, item.price, item.qty, item.subtotal]
            )
          );
        }
      }

      // Potong stok jika menu melacak stok (track_stock = 1)
      for (const item of cart) {
        await withSqliteRetry(() =>
          db.runAsync(
            `UPDATE menus SET stock = MAX(0, stock - ?) WHERE id = ? AND track_stock = 1`,
            [item.qty, item.menu_id]
          )
        );
      }

      // Update akumulasi belanja customer (jika bukan Customer UMUM atau jika customer terdaftar)
      if (customerId && customerId > 1) {
        await withSqliteRetry(() =>
          db.runAsync(
            `UPDATE customers 
             SET total_spent = total_spent + ?, total_visits = total_visits + 1
             WHERE id = ?`,
            [total, customerId]
          )
        );
      }

      // Jika Tunai: Otomatis masuk ke Buku Kas Masuk (Penjualan Bersih)
      if (paymentMethod === 'tunai') {
        await withSqliteRetry(() =>
          db.runAsync(
            `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
             VALUES (?, 'in', 1, 'penjualan_tunai', ?, ?)`,
            [businessDate, total, `Penjualan Nota ${finalInvoice} (${tableNumber})`]
          )
        );
      }

      // Bersihkan keranjang dan muat ulang pending orders
      get().clearCart();
      await get().loadPendingOrders(db);
      set({ isCheckingOut: false });

      return {
        txId: finalTxId,
        invoiceNumber: finalInvoice,
        total,
        paymentAmount,
        change,
        dailySeq,
      };
    } catch (err) {
      set({ isCheckingOut: false });
      throw err;
    }
  },
}));

