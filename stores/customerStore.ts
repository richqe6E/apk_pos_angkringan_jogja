import { create } from 'zustand';
import { SQLiteDatabase, withSqliteRetry } from '../services/database';

export interface RewardTier {
  id: number;
  tier_name: string;
  min_spend: number;
  reward_description: string;
}

export interface RewardClaim {
  id: number;
  customer_id: number;
  reward_id: number | null;
  tier_name: string;
  reward_description: string;
  claimed_at: string;
  claimed_by: string;
  notes?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  total_spent: number;
  total_visits: number;
  created_at: string;
  current_tier?: RewardTier | null;
  next_tier?: RewardTier | null;
  spend_to_next?: number;
  top_favorite_item?: { menu_name: string; total_qty: number } | null;
  is_reward_claimed?: boolean;
  last_claimed_at?: string | null;
  claim_history?: RewardClaim[];
}

export interface CustomerFavoriteItem {
  menu_name: string;
  total_qty: number;
  total_amount: number;
}

export interface CustomerTransactionHistory {
  id: number;
  invoice_number: string;
  business_date: string;
  table_number: string;
  total: number;
  payment_method: string;
  created_at: string;
}

interface CustomerState {
  customers: Customer[];
  rewardTiers: RewardTier[];
  isLoading: boolean;

  loadRewardTiers: (db: SQLiteDatabase) => Promise<RewardTier[]>;
  loadCustomers: (db: SQLiteDatabase) => Promise<void>;
  addCustomer: (db: SQLiteDatabase, name: string, phone?: string) => Promise<number>;
  updateCustomer: (db: SQLiteDatabase, id: number, name: string, phone?: string) => Promise<void>;
  deleteCustomer: (db: SQLiteDatabase, id: number) => Promise<void>;

  addRewardTier: (
    db: SQLiteDatabase,
    tierName: string,
    minSpend: number,
    rewardDescription: string
  ) => Promise<number>;
  updateRewardTier: (
    db: SQLiteDatabase,
    id: number,
    tierName: string,
    minSpend: number,
    rewardDescription: string
  ) => Promise<void>;
  deleteRewardTier: (db: SQLiteDatabase, id: number) => Promise<void>;

  getCustomerFavorites: (db: SQLiteDatabase, customerId: number) => Promise<CustomerFavoriteItem[]>;
  getCustomerHistory: (db: SQLiteDatabase, customerId: number) => Promise<CustomerTransactionHistory[]>;
  claimReward: (
    db: SQLiteDatabase,
    customerId: number,
    tier: RewardTier,
    claimedBy?: string,
    notes?: string
  ) => Promise<number>;
  undoClaimReward: (db: SQLiteDatabase, claimId: number) => Promise<void>;
  getCustomerClaims: (db: SQLiteDatabase, customerId: number) => Promise<RewardClaim[]>;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  rewardTiers: [],
  isLoading: false,

  loadRewardTiers: async (db: SQLiteDatabase) => {
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<RewardTier>('SELECT * FROM rewards ORDER BY min_spend ASC')
      );
      const tiers = rows || [];
      set({ rewardTiers: tiers });
      return tiers;
    } catch (err) {
      console.error('Error loading reward tiers:', err);
      return [];
    }
  },

  loadCustomers: async (db: SQLiteDatabase) => {
    set({ isLoading: true });
    try {
      const tiers = await get().loadRewardTiers(db);
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<Customer>('SELECT * FROM customers ORDER BY total_spent DESC, id ASC')
      );

      // Ambil seluruh klaim reward
      let claims: RewardClaim[] = [];
      try {
        const claimRows = await withSqliteRetry(() =>
          db.getAllAsync<RewardClaim>(
            'SELECT * FROM customer_reward_claims ORDER BY claimed_at DESC, id DESC'
          )
        );
        claims = claimRows || [];
      } catch (e) {
        console.warn('Notice loading customer_reward_claims:', e);
      }

      // Ambil makanan paling sering dibeli untuk masing-masing customer
      const topFavMap = new Map<number, { menu_name: string; total_qty: number }>();
      try {
        const topFavRows = await withSqliteRetry(() =>
          db.getAllAsync<{ customer_id: number; menu_name: string; total_qty: number }>(
            `SELECT customer_id, menu_name, total_qty
             FROM (
               SELECT t.customer_id, ti.menu_name, SUM(ti.qty) AS total_qty,
                      ROW_NUMBER() OVER (PARTITION BY t.customer_id ORDER BY SUM(ti.qty) DESC, ti.menu_name ASC) as rn
               FROM transaction_items ti
               JOIN transactions t ON ti.transaction_id = t.id
               WHERE t.status = 'completed' AND t.customer_id > 1
               GROUP BY t.customer_id, ti.menu_name
             )
             WHERE rn = 1`
          )
        );
        (topFavRows || []).forEach((r) => {
          topFavMap.set(r.customer_id, { menu_name: r.menu_name, total_qty: r.total_qty });
        });
      } catch (favErr) {
        console.warn('Notice loading top favorite menu:', favErr);
      }

      // Urutkan tier descending untuk evaluasi tier tertinggi
      const descTiers = [...tiers].sort((a, b) => b.min_spend - a.min_spend);
      const ascTiers = [...tiers].sort((a, b) => a.min_spend - b.min_spend);

      const mapped: Customer[] = (rows || []).map((c) => {
        if (c.id === 1) {
          // Customer UMUM tidak memiliki reward tier
          return {
            ...c,
            current_tier: null,
            next_tier: null,
            spend_to_next: 0,
            top_favorite_item: null,
            is_reward_claimed: false,
            last_claimed_at: null,
            claim_history: [],
          };
        }

        const currentTier = descTiers.find((t) => c.total_spent >= t.min_spend) || null;
        const nextTier = ascTiers.find((t) => t.min_spend > c.total_spent) || null;
        const spendToNext = nextTier ? Math.max(0, nextTier.min_spend - c.total_spent) : 0;

        const custClaims = claims.filter((cl) => cl.customer_id === c.id);
        const matchedClaim = currentTier
          ? custClaims.find((cl) => cl.reward_id === currentTier.id || cl.tier_name === currentTier.tier_name)
          : null;

        return {
          ...c,
          current_tier: currentTier,
          next_tier: nextTier,
          spend_to_next: spendToNext,
          top_favorite_item: topFavMap.get(c.id) || null,
          is_reward_claimed: !!matchedClaim,
          last_claimed_at: matchedClaim ? matchedClaim.claimed_at : null,
          claim_history: custClaims,
        };
      });

      set({ customers: mapped, isLoading: false });
    } catch (err) {
      console.error('Error loading customers:', err);
      set({ isLoading: false });
    }
  },

  addCustomer: async (db: SQLiteDatabase, name: string, phone = '') => {
    const res = await withSqliteRetry(() =>
      db.runAsync(
        'INSERT INTO customers (name, phone, total_spent, total_visits) VALUES (?, ?, 0, 0)',
        [name.trim(), phone.trim()]
      )
    );
    await get().loadCustomers(db);
    return res.lastInsertRowId;
  },

  updateCustomer: async (db: SQLiteDatabase, id: number, name: string, phone = '') => {
    if (id === 1) {
      throw new Error('Profil Customer UMUM sistem tidak dapat diubah.');
    }
    await withSqliteRetry(() =>
      db.runAsync('UPDATE customers SET name = ?, phone = ? WHERE id = ?', [
        name.trim(),
        phone.trim(),
        id,
      ])
    );
    await get().loadCustomers(db);
  },

  deleteCustomer: async (db: SQLiteDatabase, id: number) => {
    if (id === 1) {
      throw new Error('Customer UMUM adalah akun bawaan sistem dan tidak dapat dihapus.');
    }
    await withSqliteRetry(() =>
      db.runAsync('DELETE FROM customers WHERE id = ?', [id])
    );
    await get().loadCustomers(db);
  },

  addRewardTier: async (db, tierName, minSpend, rewardDescription) => {
    const res = await withSqliteRetry(() =>
      db.runAsync(
        'INSERT INTO rewards (tier_name, min_spend, reward_description) VALUES (?, ?, ?)',
        [tierName.trim(), minSpend, rewardDescription.trim()]
      )
    );
    await get().loadCustomers(db);
    return res.lastInsertRowId;
  },

  updateRewardTier: async (db, id, tierName, minSpend, rewardDescription) => {
    await withSqliteRetry(() =>
      db.runAsync(
        'UPDATE rewards SET tier_name = ?, min_spend = ?, reward_description = ? WHERE id = ?',
        [tierName.trim(), minSpend, rewardDescription.trim(), id]
      )
    );
    await get().loadCustomers(db);
  },

  deleteRewardTier: async (db, id) => {
    await withSqliteRetry(() =>
      db.runAsync('DELETE FROM rewards WHERE id = ?', [id])
    );
    await get().loadCustomers(db);
  },

  getCustomerFavorites: async (db: SQLiteDatabase, customerId: number) => {
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<CustomerFavoriteItem>(
          `SELECT ti.menu_name, SUM(ti.qty) as total_qty, SUM(ti.subtotal) as total_amount
           FROM transaction_items ti
           JOIN transactions t ON ti.transaction_id = t.id
           WHERE t.customer_id = ? AND t.status = 'completed'
           GROUP BY ti.menu_name
           ORDER BY total_qty DESC
           LIMIT 5`,
          [customerId]
        )
      );
      return rows || [];
    } catch (err) {
      console.error('Error getting customer favorites:', err);
      return [];
    }
  },

  getCustomerHistory: async (db: SQLiteDatabase, customerId: number) => {
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<CustomerTransactionHistory>(
          `SELECT id, invoice_number, business_date, table_number, total, payment_method, created_at
           FROM transactions
           WHERE customer_id = ? AND status = 'completed'
           ORDER BY id DESC
           LIMIT 20`,
          [customerId]
        )
      );
      return rows || [];
    } catch (err) {
      console.error('Error getting customer history:', err);
      return [];
    }
  },

  claimReward: async (db, customerId, tier, claimedBy = 'Kasir', notes = '') => {
    const res = await withSqliteRetry(() =>
      db.runAsync(
        `INSERT INTO customer_reward_claims (customer_id, reward_id, tier_name, reward_description, claimed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [customerId, tier.id, tier.tier_name, tier.reward_description, claimedBy, notes]
      )
    );
    await get().loadCustomers(db);
    return res.lastInsertRowId;
  },

  undoClaimReward: async (db, claimId) => {
    await withSqliteRetry(() =>
      db.runAsync('DELETE FROM customer_reward_claims WHERE id = ?', [claimId])
    );
    await get().loadCustomers(db);
  },

  getCustomerClaims: async (db, customerId) => {
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<RewardClaim>(
          'SELECT * FROM customer_reward_claims WHERE customer_id = ? ORDER BY claimed_at DESC, id DESC',
          [customerId]
        )
      );
      return rows || [];
    } catch (err) {
      console.error('Error getting customer claims:', err);
      return [];
    }
  },
}));

