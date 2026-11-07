import { BluetoothEscposPrinter, BluetoothManager } from '@vardrz/react-native-bluetooth-escpos-printer';
import { PermissionsAndroid, Platform } from 'react-native';
import { usePrinterStore } from '../stores/printerStore';
import { formatRupiahDisplay } from '../utils/formatRupiah';

export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      return (
        result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
        result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const fineLocation = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return fineLocation === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

const W = 32; // Lebar kertas thermal 58mm = 32 karakter
const DIVIDER_EQUAL = '='.repeat(W);
const DIVIDER_DASH = '-'.repeat(W);

function center(text: string): string {
  const pad = Math.max(0, W - text.length);
  return ' '.repeat(Math.floor(pad / 2)) + text;
}

function formatTotalLine(label: string, value: string): string {
  const gap = W - label.length - value.length;
  return label + ' '.repeat(Math.max(1, gap)) + value;
}

export interface PrintOrderItem {
  name: string;
  price: number;
  qty: number;
  subtotal: number;
  is_additional?: number;
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
}

/**
 * 1. CETAK STRUK CUSTOMER (Lengkap dengan Rincian Harga)
 */
export async function printCustomerReceipt(data: PrintReceiptData): Promise<void> {
  if (Platform.OS !== 'android') return;

  await BluetoothEscposPrinter.printerInit();

  // Header Toko
  await BluetoothEscposPrinter.printerAlign(1); // CENTER
  await BluetoothEscposPrinter.printText(`${data.storeName || 'ANGKRINGAN JOGJA'}\n\r`, {
    encoding: 'GBK',
    codepage: 0,
    widthtimes: 1,
    heigthtimes: 1,
    fonttype: 1,
  });

  if (data.storeAddress) {
    await BluetoothEscposPrinter.printText(`${data.storeAddress}\n\r`, {});
  }
  if (data.storePhone) {
    await BluetoothEscposPrinter.printText(`Telp: ${data.storePhone}\n\r`, {});
  }
  await BluetoothEscposPrinter.printText(`${DIVIDER_EQUAL}\n\r`, {});

  // Identitas Transaksi
  await BluetoothEscposPrinter.printerAlign(0); // LEFT
  await BluetoothEscposPrinter.printText(`No. Nota : ${data.invoiceNumber}\n\r`, {});
  await BluetoothEscposPrinter.printText(`Waktu    : ${data.dateTimeString}\n\r`, {});
  await BluetoothEscposPrinter.printText(`Meja     : ${data.tableNumber}\n\r`, {});
  await BluetoothEscposPrinter.printText(`Customer : ${data.customerName}\n\r`, {});
  await BluetoothEscposPrinter.printText(`Kasir    : ${data.cashierName || 'Kasir'}\n\r`, {});
  await BluetoothEscposPrinter.printText(`${DIVIDER_DASH}\n\r`, {});

  // Daftar Item Menu
  for (const item of data.items) {
    await BluetoothEscposPrinter.printText(`${item.name}\n\r`, {});
    const line = formatTotalLine(
      `  ${item.qty} x ${formatRupiahDisplay(item.price, false)}`,
      formatRupiahDisplay(item.subtotal, false)
    );
    await BluetoothEscposPrinter.printText(`${line}\n\r`, {});
  }

  await BluetoothEscposPrinter.printText(`${DIVIDER_DASH}\n\r`, {});

  // Ringkasan Pembayaran
  await BluetoothEscposPrinter.printText(
    `${formatTotalLine('Subtotal', formatRupiahDisplay(data.subtotal))}\n\r`,
    {}
  );
  if (data.discountAmount && data.discountAmount > 0) {
    await BluetoothEscposPrinter.printText(
      `${formatTotalLine('Diskon', `- ${formatRupiahDisplay(data.discountAmount)}`)}\n\r`,
      {}
    );
  }
  if (data.taxAmount && data.taxAmount > 0) {
    await BluetoothEscposPrinter.printText(
      `${formatTotalLine('Pajak (PB1)', formatRupiahDisplay(data.taxAmount))}\n\r`,
      {}
    );
  }

  await BluetoothEscposPrinter.printText(
    `${formatTotalLine('TOTAL', formatRupiahDisplay(data.total))}\n\r`,
    {
      encoding: 'GBK',
      codepage: 0,
      widthtimes: 1,
      heigthtimes: 0,
      fonttype: 1,
    }
  );

  await BluetoothEscposPrinter.printText(
    `${formatTotalLine('Bayar (' + data.paymentMethod.toUpperCase() + ')', formatRupiahDisplay(data.paymentAmount))}\n\r`,
    {}
  );
  if (data.paymentMethod.toLowerCase() === 'tunai') {
    await BluetoothEscposPrinter.printText(
      `${formatTotalLine('Kembalian', formatRupiahDisplay(data.changeAmount))}\n\r`,
      {}
    );
  }

  await BluetoothEscposPrinter.printText(`${DIVIDER_EQUAL}\n\r`, {});

  // Footer
  await BluetoothEscposPrinter.printerAlign(1); // CENTER
  await BluetoothEscposPrinter.printText(
    `${data.receiptFooter || 'Matur Nuwun Sampun Rawuh!'}\n\r`,
    {}
  );
  await BluetoothEscposPrinter.printText('Simpan struk ini sebagai bukti transaksi\n\r', {});

  // Umpan kertas & potong
  await BluetoothEscposPrinter.printAndFeed(6);
  await BluetoothEscposPrinter.cutOnePoint();
}

/**
 * 2. CETAK TIKET DAPUR / KITCHEN (Khusus Dapur & Bar Wedangan — TANPA HARGA)
 */
export async function printKitchenTicket(data: {
  invoiceNumber: string;
  tableNumber: string;
  dateTimeString: string;
  items: PrintOrderItem[];
}): Promise<void> {
  if (Platform.OS !== 'android') return;

  const hasPermission = await ensureBluetoothPermissions();
  if (!hasPermission) {
    console.warn('Izin Bluetooth belum diberikan.');
    return;
  }

  const { kitchenPrinter } = usePrinterStore.getState();
  if (kitchenPrinter?.address) {
    try {
      await BluetoothManager.connect(kitchenPrinter.address);
    } catch {
      // printer already connected or fallback
    }
  }

  await BluetoothEscposPrinter.printerInit();

  await BluetoothEscposPrinter.printerAlign(1); // CENTER
  await BluetoothEscposPrinter.printText(`*** TIKET DAPUR ***\n\r`, {
    encoding: 'GBK',
    codepage: 0,
    widthtimes: 1,
    heigthtimes: 1,
    fonttype: 1,
  });
  await BluetoothEscposPrinter.printText(`MEJA: ${data.tableNumber}\n\r`, {
    encoding: 'GBK',
    codepage: 0,
    widthtimes: 1,
    heigthtimes: 1,
    fonttype: 1,
  });
  await BluetoothEscposPrinter.printText(`Waktu: ${data.dateTimeString} • ${data.invoiceNumber}\n\r`, {});
  await BluetoothEscposPrinter.printText(`${DIVIDER_EQUAL}\n\r`, {});

  // Daftar Pesanan (Hanya Nama & Qty BESAR)
  await BluetoothEscposPrinter.printerAlign(0); // LEFT
  for (const item of data.items) {
    const qtyPrefix = `[ x${item.qty} ] `;
    await BluetoothEscposPrinter.printText(`${qtyPrefix}${item.name}\n\r`, {
      encoding: 'GBK',
      codepage: 0,
      widthtimes: 0,
      heigthtimes: 1, // Tulisan lebih tinggi agar koki/pembuat wedang mudah membaca
      fonttype: 1,
    });
  }

  await BluetoothEscposPrinter.printText(`${DIVIDER_EQUAL}\n\r`, {});
  await BluetoothEscposPrinter.printerAlign(1); // CENTER
  await BluetoothEscposPrinter.printText(`Segera siapkan & sajikan ke meja!\n\r`, {});

  await BluetoothEscposPrinter.printAndFeed(6);
  await BluetoothEscposPrinter.cutOnePoint();
}

/**
 * 3. CETAK STRUK SAMBUNGAN KITCHEN (Pesanan Tambahan — HANYA Item Baru)
 */
export async function printKitchenAdditionalTicket(data: {
  invoiceNumber: string;
  tableNumber: string;
  dateTimeString: string;
  additionalItems: PrintOrderItem[];
}): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!data.additionalItems || data.additionalItems.length === 0) return;

  const hasPermission = await ensureBluetoothPermissions();
  if (!hasPermission) {
    console.warn('Izin Bluetooth belum diberikan.');
    return;
  }

  const { kitchenPrinter } = usePrinterStore.getState();
  if (kitchenPrinter?.address) {
    try {
      await BluetoothManager.connect(kitchenPrinter.address);
    } catch {
      // printer already connected or fallback
    }
  }

  await BluetoothEscposPrinter.printerInit();

  await BluetoothEscposPrinter.printerAlign(1); // CENTER
  await BluetoothEscposPrinter.printText(`*** PESANAN TAMBAHAN ***\n\r`, {
    encoding: 'GBK',
    codepage: 0,
    widthtimes: 1,
    heigthtimes: 1,
    fonttype: 1,
  });
  await BluetoothEscposPrinter.printText(`MEJA: ${data.tableNumber} (SAMBUNGAN)\n\r`, {
    encoding: 'GBK',
    codepage: 0,
    widthtimes: 1,
    heigthtimes: 1,
    fonttype: 1,
  });
  await BluetoothEscposPrinter.printText(`Waktu: ${data.dateTimeString}\n\r`, {});
  await BluetoothEscposPrinter.printText(`${DIVIDER_EQUAL}\n\r`, {});

  await BluetoothEscposPrinter.printerAlign(0); // LEFT
  for (const item of data.additionalItems) {
    const qtyPrefix = `[ +${item.qty} ] `;
    await BluetoothEscposPrinter.printText(`${qtyPrefix}${item.name} (BARU)\n\r`, {
      encoding: 'GBK',
      codepage: 0,
      widthtimes: 0,
      heigthtimes: 1,
      fonttype: 1,
    });
  }

  await BluetoothEscposPrinter.printText(`${DIVIDER_EQUAL}\n\r`, {});
  await BluetoothEscposPrinter.printerAlign(1); // CENTER
  await BluetoothEscposPrinter.printText(`Pesanan tambahan meja yang sedang makan!\n\r`, {});

  await BluetoothEscposPrinter.printAndFeed(6);
  await BluetoothEscposPrinter.cutOnePoint();
}

/**
 * 4. FORMAT STRUK TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR)
 */
export function formatTemporaryBillReceipt(data: PrintReceiptData): string[] {
  const lines: string[] = [];

  lines.push('*** TAGIHAN SEMENTARA (BUKAN BUKTI BAYAR) ***');
  lines.push(data.storeName || 'ANGKRINGAN JOGJA');
  if (data.storeAddress) lines.push(data.storeAddress);
  if (data.storePhone) lines.push(`Telp: ${data.storePhone}`);
  lines.push(DIVIDER_EQUAL);

  lines.push(`No. Nota : ${data.invoiceNumber}`);
  lines.push(`Waktu    : ${data.dateTimeString}`);
  lines.push(`Meja     : ${data.tableNumber}`);
  lines.push(`Customer : ${data.customerName}`);
  lines.push(`Kasir    : ${data.cashierName || 'Kasir'}`);
  lines.push(`Status   : BELUM LUNAS (SEMENTARA)`);
  lines.push(DIVIDER_DASH);

  for (const item of data.items) {
    lines.push(item.name);
    lines.push(
      formatTotalLine(
        `  ${item.qty} x ${formatRupiahDisplay(item.price, false)}`,
        formatRupiahDisplay(item.subtotal, false)
      )
    );
  }
  lines.push(DIVIDER_DASH);

  lines.push(formatTotalLine('Subtotal', formatRupiahDisplay(data.subtotal)));
  if (data.discountAmount && data.discountAmount > 0) {
    lines.push(formatTotalLine('Diskon', `- ${formatRupiahDisplay(data.discountAmount)}`));
  }
  if (data.taxAmount && data.taxAmount > 0) {
    lines.push(formatTotalLine('Pajak (PB1)', formatRupiahDisplay(data.taxAmount)));
  }
  lines.push(formatTotalLine('TOTAL TAGIHAN', formatRupiahDisplay(data.total)));

  lines.push(DIVIDER_EQUAL);
  lines.push('*** TAGIHAN SEMENTARA ***');
  lines.push('BUKAN BUKTI PEMBAYARAN SAH');
  lines.push('Harap lakukan pembayaran di kasir');
  lines.push(data.receiptFooter || 'Matur Nuwun Sampun Rawuh!');

  return lines;
}

/**
 * 5. CETAK TAGIHAN SEMENTARA / TEMPORARY BILL
 */
export async function printTemporaryBill(data: PrintReceiptData): Promise<void> {
  if (Platform.OS !== 'android') return;

  const hasPermission = await ensureBluetoothPermissions();
  if (!hasPermission) {
    console.warn('Izin Bluetooth belum diberikan.');
    return;
  }

  const { cashierPrinter } = usePrinterStore.getState();
  if (cashierPrinter?.address) {
    try {
      await BluetoothManager.connect(cashierPrinter.address);
    } catch {
      // printer already connected or fallback
    }
  }

  await BluetoothEscposPrinter.printerInit();

  // Watermark Header
  await BluetoothEscposPrinter.printerAlign(1); // CENTER
  await BluetoothEscposPrinter.printText(`*** TAGIHAN SEMENTARA ***\n\r`, {
    encoding: 'GBK',
    codepage: 0,
    widthtimes: 1,
    heigthtimes: 1,
    fonttype: 1,
  });
  await BluetoothEscposPrinter.printText(`(BUKAN BUKTI BAYAR)\n\r`, {});

  // Header Toko
  await BluetoothEscposPrinter.printText(`${data.storeName || 'ANGKRINGAN JOGJA'}\n\r`, {
    encoding: 'GBK',
    codepage: 0,
    widthtimes: 1,
    heigthtimes: 0,
    fonttype: 1,
  });
  if (data.storeAddress) {
    await BluetoothEscposPrinter.printText(`${data.storeAddress}\n\r`, {});
  }
  if (data.storePhone) {
    await BluetoothEscposPrinter.printText(`Telp: ${data.storePhone}\n\r`, {});
  }
  await BluetoothEscposPrinter.printText(`${DIVIDER_EQUAL}\n\r`, {});

  // Meta Transaksi
  await BluetoothEscposPrinter.printerAlign(0); // LEFT
  await BluetoothEscposPrinter.printText(`No. Nota : ${data.invoiceNumber}\n\r`, {});
  await BluetoothEscposPrinter.printText(`Waktu    : ${data.dateTimeString}\n\r`, {});
  await BluetoothEscposPrinter.printText(`Meja     : ${data.tableNumber}\n\r`, {});
  await BluetoothEscposPrinter.printText(`Customer : ${data.customerName}\n\r`, {});
  await BluetoothEscposPrinter.printText(`Kasir    : ${data.cashierName || 'Kasir'}\n\r`, {});
  await BluetoothEscposPrinter.printText(`Status   : BELUM LUNAS\n\r`, {});
  await BluetoothEscposPrinter.printText(`${DIVIDER_DASH}\n\r`, {});

  // Item list
  for (const item of data.items) {
    await BluetoothEscposPrinter.printText(`${item.name}\n\r`, {});
    const line = formatTotalLine(
      `  ${item.qty} x ${formatRupiahDisplay(item.price, false)}`,
      formatRupiahDisplay(item.subtotal, false)
    );
    await BluetoothEscposPrinter.printText(`${line}\n\r`, {});
  }

  await BluetoothEscposPrinter.printText(`${DIVIDER_DASH}\n\r`, {});

  // Ringkasan
  await BluetoothEscposPrinter.printText(
    `${formatTotalLine('Subtotal', formatRupiahDisplay(data.subtotal))}\n\r`,
    {}
  );
  if (data.discountAmount && data.discountAmount > 0) {
    await BluetoothEscposPrinter.printText(
      `${formatTotalLine('Diskon', `- ${formatRupiahDisplay(data.discountAmount)}`)}\n\r`,
      {}
    );
  }
  if (data.taxAmount && data.taxAmount > 0) {
    await BluetoothEscposPrinter.printText(
      `${formatTotalLine('Pajak (PB1)', formatRupiahDisplay(data.taxAmount))}\n\r`,
      {}
    );
  }

  await BluetoothEscposPrinter.printText(
    `${formatTotalLine('TOTAL TAGIHAN', formatRupiahDisplay(data.total))}\n\r`,
    {
      encoding: 'GBK',
      codepage: 0,
      widthtimes: 1,
      heigthtimes: 0,
      fonttype: 1,
    }
  );

  await BluetoothEscposPrinter.printText(`${DIVIDER_EQUAL}\n\r`, {});

  // Footer Watermark Warning
  await BluetoothEscposPrinter.printerAlign(1); // CENTER
  await BluetoothEscposPrinter.printText(`*** BUKAN BUKTI BAYAR ***\n\r`, {});
  await BluetoothEscposPrinter.printText(`Harap lakukan pembayaran di kasir\n\r`, {});
  await BluetoothEscposPrinter.printText(
    `${data.receiptFooter || 'Matur Nuwun Sampun Rawuh!'}\n\r`,
    {}
  );

  await BluetoothEscposPrinter.printAndFeed(6);
  await BluetoothEscposPrinter.cutOnePoint();
}

/**
 * 6. AUTO-ROUTE EXECUTION
 * Mengalirkan pencetakan ke Printer Kasir dan Printer Dapur secara berurutan (Serial Lock)
 */
export async function autoRoutePrint(
  receiptData: PrintReceiptData,
  isAdditional: boolean = false
): Promise<void> {
  if (Platform.OS !== 'android') return;

  const hasPermission = await ensureBluetoothPermissions();
  if (!hasPermission) {
    console.warn('Izin Bluetooth belum diberikan.');
    return;
  }

  const { cashierPrinter, kitchenPrinter, autoPrintCashier, autoPrintKitchen } =
    usePrinterStore.getState();

  // 1. Eksekusi Cetak Printer Kasir (Jika aktif & pembayaran selesai)
  if (autoPrintCashier && cashierPrinter?.address) {
    try {
      await BluetoothManager.connect(cashierPrinter.address);
      await printCustomerReceipt(receiptData);
    } catch (err) {
      console.warn('Gagal cetak ke printer kasir:', err);
    }
  }

  // 2. Eksekusi Cetak Printer Dapur (Jika aktif)
  if (autoPrintKitchen && kitchenPrinter?.address) {
    try {
      // Hubungkan ke printer dapur
      await BluetoothManager.connect(kitchenPrinter.address);

      if (isAdditional) {
        // Hanya cetak item yang is_additional === 1
        const deltaItems = receiptData.items.filter((i) => i.is_additional === 1);
        if (deltaItems.length > 0) {
          await printKitchenAdditionalTicket({
            invoiceNumber: receiptData.invoiceNumber,
            tableNumber: receiptData.tableNumber,
            dateTimeString: receiptData.dateTimeString,
            additionalItems: deltaItems,
          });
        }
      } else {
        // Cetak tiket dapur awal
        await printKitchenTicket({
          invoiceNumber: receiptData.invoiceNumber,
          tableNumber: receiptData.tableNumber,
          dateTimeString: receiptData.dateTimeString,
          items: receiptData.items,
        });
      }
    } catch (err) {
      console.warn('Gagal cetak ke printer dapur:', err);
    }
  }
}

