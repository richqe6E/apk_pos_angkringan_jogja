/**
 * Transaction engine simulating POS Angkringan Jogja operations.
 * Wraps multi-query writes into atomic transactions (db.withTransactionAsync).
 * Uses 'income' type for cash sales in cash_ledger according to PRD R2 & R5.
 */

async function getNextInvoice(db, businessDate) {
  const counterRow = await db.getFirstAsync(
    'SELECT last_seq FROM daily_counters WHERE business_date = ?',
    [businessDate]
  );
  const nextSeq = (counterRow?.last_seq ?? 0) + 1;
  await db.runAsync(
    `INSERT INTO daily_counters (business_date, last_seq) VALUES (?, ?)
     ON CONFLICT(business_date) DO UPDATE SET last_seq = ?`,
    [businessDate, nextSeq, nextSeq]
  );

  const [y, m, d] = businessDate.split('-');
  return `INV-${d}${m}${y.slice(2)}-${String(nextSeq).padStart(3, '0')}`;
}

export async function createPendingOrder(db, options) {
  const businessDate = options.businessDate || '2026-11-07';
  const tableNumber = options.tableNumber || 'Meja 01';
  const customerName = options.customerName || 'Customer UMUM';
  const items = options.items || [];
  const discountAmount = options.discountAmount || 0;
  const taxEnabled = !!options.taxEnabled;
  const taxRate = options.taxRate || 10;

  return await db.withTransactionAsync(async () => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const taxAmount = taxEnabled ? Math.round((subtotal * taxRate) / 100) : 0;
    const total = Math.max(0, subtotal + taxAmount - discountAmount);

    const invoiceNumber = await getNextInvoice(db, businessDate);

    const res = await db.runAsync(
      `INSERT INTO transactions (
        invoice_number, business_date, table_number, customer_id, customer_name,
        subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
        change_amount, status
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'tunai', 0, 0, 'pending')`,
      [invoiceNumber, businessDate, tableNumber, customerName, subtotal, taxAmount, discountAmount, total]
    );

    const txId = res.lastInsertRowId;

    for (const item of items) {
      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [txId, item.menu_id, item.name, item.price, item.qty, item.price * item.qty, item.is_additional || 0]
      );
    }

    return { txId, invoiceNumber, subtotal, total };
  });
}

export async function addAdditionalItemsToPendingOrder(db, txId, additionalItems) {
  return await db.withTransactionAsync(async () => {
    for (const item of additionalItems) {
      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [txId, item.menu_id, item.name, item.price, item.qty, item.price * item.qty]
      );
    }

    // Recalculate totals
    const sumRow = await db.getFirstAsync(
      `SELECT SUM(subtotal) as new_subtotal FROM transaction_items WHERE transaction_id = ?`,
      [txId]
    );
    const newSubtotal = sumRow?.new_subtotal || 0;

    const txRow = await db.getFirstAsync(
      `SELECT discount_amount, tax_amount FROM transactions WHERE id = ?`,
      [txId]
    );
    const discount = txRow?.discount_amount || 0;
    const tax = txRow?.tax_amount || 0;
    const newTotal = Math.max(0, newSubtotal + tax - discount);

    await db.runAsync(
      `UPDATE transactions SET subtotal = ?, total = ? WHERE id = ?`,
      [newSubtotal, newTotal, txId]
    );

    return { addedCount: additionalItems.length, newTotal };
  });
}

export async function mergePendingTables(db, sourceTxIds, targetTableNumber, taxEnabled = false, taxRate = 10) {
  if (sourceTxIds.length < 2) {
    throw new Error('Pilih minimal 2 meja pending untuk digabung.');
  }

  return await db.withTransactionAsync(async () => {
    const primaryId = sourceTxIds[0];
    const otherIds = sourceTxIds.slice(1);

    // 1. Gather all items across all transactions to merge
    const placeholders = sourceTxIds.map(() => '?').join(',');
    const allItems = await db.getAllAsync(
      `SELECT menu_id, menu_name, price, SUM(qty) as total_qty, SUM(subtotal) as total_subtotal,
              MAX(is_additional) as had_additional
       FROM transaction_items
       WHERE transaction_id IN (${placeholders})
       GROUP BY menu_id, price`,
      sourceTxIds
    );

    // 2. Sum discounts across all transactions
    const discountRow = await db.getFirstAsync(
      `SELECT SUM(discount_amount) as total_discount FROM transactions WHERE id IN (${placeholders})`,
      sourceTxIds
    );
    const totalDiscount = discountRow?.total_discount || 0;

    // 3. Mark other transactions as merged
    for (const otherId of otherIds) {
      await db.runAsync(
        `UPDATE transactions SET status = 'merged', merged_into_tx_id = ? WHERE id = ?`,
        [primaryId, otherId]
      );
    }

    // 4. Delete old items of all source transactions
    await db.runAsync(
      `DELETE FROM transaction_items WHERE transaction_id IN (${placeholders})`,
      sourceTxIds
    );

    // 5. Insert deduplicated items into primary transaction
    let newSubtotal = 0;
    for (const item of allItems) {
      newSubtotal += item.total_subtotal;
      await db.runAsync(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [primaryId, item.menu_id, item.menu_name, item.price, item.total_qty, item.total_subtotal, item.had_additional]
      );
    }

    // 6. Recalculate tax and total
    const newTaxAmount = taxEnabled ? Math.round((newSubtotal * taxRate) / 100) : 0;
    const newTotal = Math.max(0, newSubtotal + newTaxAmount - totalDiscount);

    await db.runAsync(
      `UPDATE transactions
       SET table_number = ?, subtotal = ?, tax_amount = ?, discount_amount = ?, total = ?
       WHERE id = ?`,
      [targetTableNumber, newSubtotal, newTaxAmount, totalDiscount, newTotal, primaryId]
    );

    return {
      primaryId,
      newSubtotal,
      newTaxAmount,
      totalDiscount,
      newTotal,
      itemCount: allItems.length,
    };
  });
}

export async function checkout(db, input) {
  const businessDate = input.businessDate || '2026-11-07';
  const tableNumber = input.tableNumber || 'Meja 01';
  const customerName = input.customerName || 'Customer UMUM';
  const customerId = input.customerId || 1;
  const items = input.items || [];
  const discountAmount = input.discountAmount || 0;
  const taxEnabled = !!input.taxEnabled;
  const taxRate = input.taxRate || 10;
  const paymentMethod = input.paymentMethod || 'tunai';
  const paymentAmount = input.paymentAmount;

  return await db.withTransactionAsync(async () => {
    let finalTxId;
    let finalInvoice;
    let subtotal = 0;
    let taxAmount = 0;
    let total = 0;

    if (input.pendingTxId) {
      // Settle pending transaction
      finalTxId = input.pendingTxId;
      const txRow = await db.getFirstAsync(
        'SELECT invoice_number FROM transactions WHERE id = ?',
        [finalTxId]
      );
      finalInvoice = txRow?.invoice_number || 'INV-UNKNOWN';

      const itemsInDb = await db.getAllAsync(
        'SELECT price, qty FROM transaction_items WHERE transaction_id = ?',
        [finalTxId]
      );
      subtotal = itemsInDb.reduce((s, it) => s + it.price * it.qty, 0);
      taxAmount = taxEnabled ? Math.round((subtotal * taxRate) / 100) : 0;
      total = Math.max(0, subtotal + taxAmount - discountAmount);

      const change = paymentMethod === 'tunai' ? Math.max(0, paymentAmount - total) : 0;

      await db.runAsync(
        `UPDATE transactions
         SET subtotal = ?, tax_amount = ?, discount_amount = ?, total = ?,
             payment_method = ?, payment_amount = ?, change_amount = ?,
             status = 'completed', table_number = ?, customer_name = ?
         WHERE id = ?`,
        [subtotal, taxAmount, discountAmount, total, paymentMethod, paymentAmount, change, tableNumber, customerName, finalTxId]
      );
    } else {
      // Direct checkout
      subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
      taxAmount = taxEnabled ? Math.round((subtotal * taxRate) / 100) : 0;
      total = Math.max(0, subtotal + taxAmount - discountAmount);
      const change = paymentMethod === 'tunai' ? Math.max(0, paymentAmount - total) : 0;

      finalInvoice = await getNextInvoice(db, businessDate);

      const res = await db.runAsync(
        `INSERT INTO transactions (
          invoice_number, business_date, table_number, customer_id, customer_name,
          subtotal, tax_amount, discount_amount, total, payment_method, payment_amount,
          change_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
        [finalInvoice, businessDate, tableNumber, customerId, customerName, subtotal, taxAmount, discountAmount, total, paymentMethod, paymentAmount, change]
      );
      finalTxId = res.lastInsertRowId;

      for (const item of items) {
        await db.runAsync(
          `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, price, qty, subtotal, is_additional)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          [finalTxId, item.menu_id, item.name, item.price, item.qty, item.price * item.qty]
        );
      }
    }

    const change = paymentMethod === 'tunai' ? Math.max(0, paymentAmount - total) : 0;

    // Deduct stock for menus tracking stock
    const cartItems = input.pendingTxId
      ? await db.getAllAsync('SELECT menu_id, qty FROM transaction_items WHERE transaction_id = ?', [finalTxId])
      : items;

    for (const item of cartItems) {
      await db.runAsync(
        `UPDATE menus SET stock = MAX(0, stock - ?) WHERE id = ? AND track_stock = 1`,
        [item.qty, item.menu_id]
      );
    }

    // If payment method is tunai: record into cash_ledger with type = 'income'
    if (paymentMethod === 'tunai') {
      await db.runAsync(
        `INSERT INTO cash_ledger (business_date, type, affects_pnl, category, amount, notes)
         VALUES (?, 'income', 1, 'penjualan_tunai', ?, ?)`,
        [businessDate, total, `Penjualan Nota ${finalInvoice} (${tableNumber})`]
      );
    }

    return {
      txId: finalTxId,
      invoiceNumber: finalInvoice,
      subtotal,
      taxAmount,
      discountAmount,
      total,
      paymentMethod,
      paymentAmount,
      change,
    };
  });
}
