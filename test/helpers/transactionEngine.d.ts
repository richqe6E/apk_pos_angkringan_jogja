import { TestDatabase } from './db.js';

export interface OrderItemInput {
  menu_id: number;
  name: string;
  price: number;
  qty: number;
  is_additional?: number;
}

export interface PendingOrderResult {
  txId: number;
  invoiceNumber: string;
  subtotal: number;
  total: number;
}

export interface CheckoutInput {
  pendingTxId?: number;
  businessDate?: string;
  tableNumber: string;
  customerName?: string;
  customerId?: number;
  items?: OrderItemInput[];
  discountAmount?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  paymentMethod: 'tunai' | 'qris' | 'transfer';
  paymentAmount: number;
}

export interface CheckoutResult {
  txId: number;
  invoiceNumber: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  paymentAmount: number;
  change: number;
}

export function createPendingOrder(
  db: TestDatabase,
  options: {
    businessDate?: string;
    tableNumber: string;
    customerName?: string;
    items: OrderItemInput[];
    discountAmount?: number;
    taxEnabled?: boolean;
    taxRate?: number;
  }
): Promise<PendingOrderResult>;

export function addAdditionalItemsToPendingOrder(
  db: TestDatabase,
  txId: number,
  additionalItems: OrderItemInput[]
): Promise<{ addedCount: number; newTotal: number }>;

export function mergePendingTables(
  db: TestDatabase,
  sourceTxIds: number[],
  targetTableNumber: string,
  taxEnabled?: boolean,
  taxRate?: number
): Promise<{
  primaryId: number;
  newSubtotal: number;
  newTaxAmount: number;
  totalDiscount: number;
  newTotal: number;
  itemCount: number;
}>;

export function checkout(db: TestDatabase, input: CheckoutInput): Promise<CheckoutResult>;
