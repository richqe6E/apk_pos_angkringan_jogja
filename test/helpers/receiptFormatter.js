const W = 32;
const DIVIDER_EQUAL = '='.repeat(W);
const DIVIDER_DASH = '-'.repeat(W);

function formatRupiah(val, withSymbol = true) {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return withSymbol ? 'Rp 0' : '0';
  }
  const formatted = Math.floor(val).toLocaleString('id-ID');
  return withSymbol ? `Rp ${formatted}` : formatted;
}

function formatTotalLine(label, value) {
  const gap = W - label.length - value.length;
  return label + ' '.repeat(Math.max(1, gap)) + value;
}

export function formatCustomerReceiptLines(data) {
  const lines = [];

  // Store Header
  lines.push(data.storeName || 'ANGKRINGAN JOGJA');
  if (data.storeAddress) lines.push(data.storeAddress);
  if (data.storePhone) lines.push(`Telp: ${data.storePhone}`);
  lines.push(DIVIDER_EQUAL);

  // Metadata
  lines.push(`No. Nota : ${data.invoiceNumber}`);
  lines.push(`Waktu    : ${data.dateTimeString}`);
  lines.push(`Meja     : ${data.tableNumber}`);
  lines.push(`Customer : ${data.customerName}`);
  lines.push(`Kasir    : ${data.cashierName || 'Kasir'}`);
  lines.push(DIVIDER_DASH);

  // Items
  for (const item of data.items) {
    lines.push(item.name);
    lines.push(
      formatTotalLine(
        `  ${item.qty} x ${formatRupiah(item.price, false)}`,
        formatRupiah(item.subtotal, false)
      )
    );
  }
  lines.push(DIVIDER_DASH);

  // Totals
  lines.push(formatTotalLine('Subtotal', formatRupiah(data.subtotal)));
  if (data.discountAmount && data.discountAmount > 0) {
    lines.push(formatTotalLine('Diskon', `- ${formatRupiah(data.discountAmount)}`));
  }
  if (data.taxAmount && data.taxAmount > 0) {
    lines.push(formatTotalLine('Pajak (PB1)', formatRupiah(data.taxAmount)));
  }
  lines.push(formatTotalLine('TOTAL', formatRupiah(data.total)));

  const methodUpper = String(data.paymentMethod || 'TUNAI').toUpperCase();
  lines.push(formatTotalLine(`Bayar (${methodUpper})`, formatRupiah(data.paymentAmount)));

  if (methodUpper === 'TUNAI') {
    lines.push(formatTotalLine('Kembalian', formatRupiah(data.changeAmount)));
  }

  lines.push(DIVIDER_EQUAL);
  lines.push(data.receiptFooter || 'Matur Nuwun Sampun Rawuh!');
  lines.push('Simpan struk ini sebagai bukti transaksi');

  return lines;
}

export function formatKitchenTicketLines(data) {
  const lines = [];
  lines.push('*** TIKET DAPUR ***');
  lines.push(`MEJA: ${data.tableNumber}`);
  lines.push(`Waktu: ${data.dateTimeString} • ${data.invoiceNumber}`);
  lines.push(DIVIDER_EQUAL);

  for (const item of data.items) {
    lines.push(`[ x${item.qty} ] ${item.name}`);
  }

  lines.push(DIVIDER_EQUAL);
  lines.push('Segera siapkan & sajikan ke meja!');
  return lines;
}

export function formatKitchenAdditionalTicketLines(data) {
  const lines = [];
  lines.push('*** PESANAN TAMBAHAN ***');
  lines.push(`MEJA: ${data.tableNumber} (SAMBUNGAN)`);
  lines.push(`Waktu: ${data.dateTimeString}`);
  lines.push(DIVIDER_EQUAL);

  for (const item of data.additionalItems) {
    lines.push(`[ +${item.qty} ] ${item.name} (BARU)`);
  }

  lines.push(DIVIDER_EQUAL);
  lines.push('Pesanan tambahan meja yang sedang makan!');
  return lines;
}

export function formatTemporaryBillReceiptLines(data) {
  const lines = [];
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
        `  ${item.qty} x ${formatRupiah(item.price, false)}`,
        formatRupiah(item.subtotal, false)
      )
    );
  }
  lines.push(DIVIDER_DASH);

  lines.push(formatTotalLine('Subtotal', formatRupiah(data.subtotal)));
  if (data.discountAmount && data.discountAmount > 0) {
    lines.push(formatTotalLine('Diskon', `- ${formatRupiah(data.discountAmount)}`));
  }
  if (data.taxAmount && data.taxAmount > 0) {
    lines.push(formatTotalLine('Pajak (PB1)', formatRupiah(data.taxAmount)));
  }
  lines.push(formatTotalLine('TOTAL TAGIHAN', formatRupiah(data.total)));

  lines.push(DIVIDER_EQUAL);
  lines.push('*** TAGIHAN SEMENTARA ***');
  lines.push('BUKAN BUKTI PEMBAYARAN SAH');
  lines.push('Harap lakukan pembayaran di kasir');
  lines.push(data.receiptFooter || 'Matur Nuwun Sampun Rawuh!');
  return lines;
}
