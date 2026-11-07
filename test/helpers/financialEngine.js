/**
 * Financial calculation engine following PRD R2 & R5.
 * Strictly enforces that cash sales ('penjualan_tunai') are NOT double-counted in operIncome.
 */
export async function loadFinancialSummary(db, targetMonth) {
  // 1. Gross Sales from completed transactions
  const salesRow = await db.getFirstAsync(
    `SELECT COALESCE(SUM(total), 0) as total_sales, COUNT(id) as tx_count
     FROM transactions
     WHERE status = 'completed' AND business_date LIKE ?`,
    [`${targetMonth}%`]
  );
  const grossSales = salesRow?.total_sales || 0;
  const txCount = salesRow?.tx_count || 0;

  // 2. Cash ledger entries
  const entries = (await db.getAllAsync(
    `SELECT * FROM cash_ledger
     WHERE business_date LIKE ?
     ORDER BY id DESC`,
    [`${targetMonth}%`]
  )) || [];

  let operExpenses = 0;
  let nonPnlExpenses = 0;
  let operIncome = 0;
  let nonPnlIncome = 0;
  const catMap = {};

  for (const e of entries) {
    if (e.type === 'expense') {
      if (e.affects_pnl === 1) {
        operExpenses += e.amount;
        catMap[e.category] = (catMap[e.category] || 0) + e.amount;
      } else {
        nonPnlExpenses += e.amount;
      }
    } else {
      // type === 'income'
      if (e.affects_pnl === 1) {
        // CRITICAL: Cash sales ('penjualan_tunai') are already counted in grossSales!
        // Do not add them again into operIncome to prevent double counting.
        if (e.category !== 'penjualan_tunai') {
          operIncome += e.amount;
        }
      } else {
        nonPnlIncome += e.amount;
      }
    }
  }

  const expenseByCategory = Object.entries(catMap)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  // 3. Monthly COGS / HPP
  const cogsRow = await db.getFirstAsync(
    'SELECT * FROM monthly_cogs WHERE period_month = ?',
    [targetMonth]
  );
  const monthlyCogs = cogsRow?.total_cogs_amount || 0;
  const monthlyCogsNotes = cogsRow?.notes || '';

  // 4. Laba / Rugi
  const grossProfit = grossSales - monthlyCogs;
  const netOperatingProfit = grossSales + operIncome - operExpenses - monthlyCogs;

  return {
    summary: {
      periodMonth: targetMonth,
      totalGrossSales: grossSales,
      totalTxCount: txCount,
      totalOperationalExpenses: operExpenses,
      totalNonPnlExpenses: nonPnlExpenses,
      totalOperationalIncome: operIncome,
      totalNonPnlIncome: nonPnlIncome,
      monthlyCogs,
      monthlyCogsNotes,
      grossProfit,
      netOperatingProfit,
      expenseByCategory,
    },
    entries,
  };
}

export async function addCashEntry(db, input) {
  const bizDate = input.business_date || '2026-11-07';
  const res = await db.runAsync(
    `INSERT INTO cash_ledger (
      business_date, type, affects_pnl, category, amount, notes
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      bizDate,
      input.type,
      input.affects_pnl ? 1 : 0,
      input.category.trim(),
      input.amount,
      input.notes?.trim() || '',
    ]
  );
  return res.lastInsertRowId;
}

export async function saveMonthlyCogs(db, periodMonth, cogsAmount, notes = '') {
  await db.runAsync(
    `INSERT INTO monthly_cogs (period_month, total_cogs_amount, notes)
     VALUES (?, ?, ?)
     ON CONFLICT(period_month) DO UPDATE SET
       total_cogs_amount = excluded.total_cogs_amount,
       notes = excluded.notes,
       inputted_at = datetime('now','localtime')`,
    [periodMonth, cogsAmount, notes.trim()]
  );
}
