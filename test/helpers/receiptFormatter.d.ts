export interface PrintOrderItem {
  name: string;
  price: number;
  qty: number;
  subtotal: number;
  is_additional?: number;
  notes?: string;
}

export interface PrintReceiptData {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  receiptFooter?: string;
  invoiceNumber: string;
  businessDate: string;
  dateTimeString: string;
  tableNumber: string;
  customerName: string;
  cashierName?: string;
  items: PrintOrderItem[];
  subtotal: number;
  taxAmount?: number;
  discountAmount?: number;
  total: number;
  paymentMethod: string;
  paymentAmount: number;
  changeAmount: number;
  cashReceived?: number;
  qrisReceived?: number;
}

export function formatCustomerReceiptLines(data: PrintReceiptData): string[];
export function formatKitchenTicketLines(data: {
  invoiceNumber: string;
  tableNumber: string;
  dateTimeString: string;
  items: PrintOrderItem[];
}): string[];
export function formatKitchenAdditionalTicketLines(data: {
  invoiceNumber?: string;
  tableNumber: string;
  dateTimeString: string;
  additionalItems: PrintOrderItem[];
}): string[];
export function formatTemporaryBillReceiptLines(data: PrintReceiptData): string[];
