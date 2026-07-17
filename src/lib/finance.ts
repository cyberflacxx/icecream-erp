import { ensureNonNegative, toCsv, toNumber } from './inventory';

export function calculateBudgetVariance(budgetedAmount: number, actualAmount: number) {
  const budgeted = ensureNonNegative(budgetedAmount, 'budgetedAmount');
  const actual = ensureNonNegative(actualAmount, 'actualAmount');
  const variance = actual - budgeted;
  const variancePct = budgeted === 0 ? 0 : (variance / budgeted) * 100;

  return { variance, variancePct };
}

export function calculateJournalBalance(
  lines: Array<{ creditAmount: number; debitAmount: number }>,
) {
  const totalDebit = lines.reduce((sum, line) => sum + ensureNonNegative(Number(line.debitAmount) || 0, 'debitAmount'), 0);
  const totalCredit = lines.reduce((sum, line) => sum + ensureNonNegative(Number(line.creditAmount) || 0, 'creditAmount'), 0);

  return {
    isBalanced: Math.abs(totalDebit - totalCredit) <= 0.01,
    totalCredit,
    totalDebit,
    variance: totalDebit - totalCredit,
  };
}

export function validateJournalLines(
  lines: Array<{ creditAmount: number; debitAmount: number }>,
) {
  if (lines.length < 2) return 'Journal entry must have at least 2 lines';
  for (const line of lines) {
    const debit = Number(line.debitAmount) || 0;
    const credit = Number(line.creditAmount) || 0;
    if (debit <= 0 && credit <= 0) return 'Each line must contain a debit or credit amount greater than zero';
    if (debit > 0 && credit > 0) return 'A journal line cannot contain both debit and credit values';
  }

  const balance = calculateJournalBalance(lines);
  return balance.isBalanced
    ? null
    : `Journal entry is not balanced. Debit: ${balance.totalDebit.toFixed(2)}, Credit: ${balance.totalCredit.toFixed(2)}`;
}

export function calculateStraightLineDepreciation(
  purchaseCost: number,
  residualValue: number,
  usefulLifeYears: number,
  periodsPerYear = 12,
) {
  const cost = ensureNonNegative(purchaseCost, 'purchaseCost');
  const residual = ensureNonNegative(residualValue, 'residualValue');
  const usefulLife = ensureNonNegative(usefulLifeYears, 'usefulLifeYears');
  if (usefulLife === 0 || periodsPerYear <= 0) {
    throw new Error('usefulLifeYears and periodsPerYear must be greater than zero');
  }

  const depreciableBase = Math.max(0, cost - residual);
  const annualDepreciation = depreciableBase / usefulLife;
  const periodicDepreciation = annualDepreciation / periodsPerYear;

  return {
    annualDepreciation,
    depreciableBase,
    periodicDepreciation,
  };
}

export function calculateProductionCostSummary(
  materialCost: number,
  labourCost: number,
  overheadCost: number,
  outputQuantity: number,
) {
  const totalCost =
    ensureNonNegative(materialCost, 'materialCost') +
    ensureNonNegative(labourCost, 'labourCost') +
    ensureNonNegative(overheadCost, 'overheadCost');
  const quantity = ensureNonNegative(outputQuantity, 'outputQuantity');

  return {
    costPerUnit: quantity > 0 ? totalCost / quantity : 0,
    labourCost: ensureNonNegative(labourCost, 'labourCost'),
    materialCost: ensureNonNegative(materialCost, 'materialCost'),
    overheadCost: ensureNonNegative(overheadCost, 'overheadCost'),
    outputQuantity: quantity,
    totalCost,
  };
}

export function calculateBranchCostSummary(
  salesAmount: number,
  costOfGoodsSold: number,
  branchExpenses: number,
  returnsValue = 0,
) {
  const revenue = ensureNonNegative(salesAmount, 'salesAmount');
  const cogs = ensureNonNegative(costOfGoodsSold, 'costOfGoodsSold');
  const expenses = ensureNonNegative(branchExpenses, 'branchExpenses');
  const returns = ensureNonNegative(returnsValue, 'returnsValue');
  const grossProfit = revenue - cogs - returns;
  const netProfit = grossProfit - expenses;

  return { grossProfit, netProfit };
}

export function calculateReceivableBalance(
  invoiceTotal: number,
  amountPaid: number,
  creditNotes = 0,
) {
  const total = ensureNonNegative(invoiceTotal, 'invoiceTotal');
  const paid = ensureNonNegative(amountPaid, 'amountPaid');
  const credits = ensureNonNegative(creditNotes, 'creditNotes');
  return Math.max(0, total - paid - credits);
}

export function calculatePayableBalance(
  invoiceTotal: number,
  amountPaid: number,
  debitNotes = 0,
) {
  const total = ensureNonNegative(invoiceTotal, 'invoiceTotal');
  const paid = ensureNonNegative(amountPaid, 'amountPaid');
  const debits = ensureNonNegative(debitNotes, 'debitNotes');
  return Math.max(0, total - paid - debits);
}

export function calculateInventoryValuation(
  quantityOnHand: number,
  unitCost: number,
) {
  return ensureNonNegative(quantityOnHand, 'quantityOnHand') * ensureNonNegative(unitCost, 'unitCost');
}

export function calculatePettyCashBalance(fundAmount: number, usedAmount: number) {
  return ensureNonNegative(fundAmount, 'fundAmount') - ensureNonNegative(usedAmount, 'usedAmount');
}

export interface NormalizedPettyCashRequest {
  amountApproved: number;
  amountPaid: number;
  amountRequested: number;
  amount_approved: number;
  amount_paid: number;
  amount_requested: number;
  branchId: string | null;
  branch_id: string | null;
  createdAt: string | null;
  created_at: string | null;
  id: string;
  purpose: string | null;
  requestNumber: string | null;
  request_number: string | null;
  requestDate: string | null;
  request_date: string | null;
  requestedBy: string | null;
  requested_by: string | null;
  status: string;
}

export function resolvePettyCashAmount(row: Record<string, unknown>) {
  return toNumber(
    row.amount_requested ??
      row.requested_amount ??
      row.amount ??
      row.total_amount ??
      row.estimated_amount ??
      0,
  );
}

export function normalizePettyCashRequest(row: Record<string, unknown>): NormalizedPettyCashRequest {
  const amountRequested = resolvePettyCashAmount(row);
  const amountApproved = toNumber(row.amount_approved ?? row.approved_amount ?? row.amountApproved ?? 0);
  const amountPaid = toNumber(row.amount_paid ?? row.paid_amount ?? row.amountPaid ?? 0);
  const branchId = row.branch_id ? String(row.branch_id) : row.branchId ? String(row.branchId) : null;
  const createdAt = row.created_at ? String(row.created_at) : row.createdAt ? String(row.createdAt) : null;
  const requestNumber = row.request_number
    ? String(row.request_number)
    : row.requestNumber
      ? String(row.requestNumber)
      : null;
  const requestDate = row.request_date ? String(row.request_date) : row.requestDate ? String(row.requestDate) : null;
  const requestedBy = row.requested_by ? String(row.requested_by) : row.requestedBy ? String(row.requestedBy) : null;
  const status = String(row.status ?? 'PENDING').toUpperCase();

  return {
    amountApproved,
    amountPaid,
    amountRequested,
    amount_approved: amountApproved,
    amount_paid: amountPaid,
    amount_requested: amountRequested,
    branchId,
    branch_id: branchId,
    createdAt,
    created_at: createdAt,
    id: String(row.id ?? ''),
    purpose: row.purpose ? String(row.purpose) : null,
    requestNumber,
    requestDate,
    request_number: requestNumber,
    request_date: requestDate,
    requestedBy,
    requested_by: requestedBy,
    status,
  };
}

export function summarizeTrialBalance(
  lines: Array<{ accountCode: string; accountName: string; creditAmount: number; debitAmount: number }>,
) {
  const grouped = new Map<string, { accountCode: string; accountName: string; credit: number; debit: number }>();

  for (const line of lines) {
    const key = `${line.accountCode}::${line.accountName}`;
    const current = grouped.get(key) ?? {
      accountCode: line.accountCode,
      accountName: line.accountName,
      credit: 0,
      debit: 0,
    };
    current.debit += Number(line.debitAmount) || 0;
    current.credit += Number(line.creditAmount) || 0;
    grouped.set(key, current);
  }

  const rows = [...grouped.values()];
  const totals = rows.reduce(
    (sum, row) => ({ credit: sum.credit + row.credit, debit: sum.debit + row.debit }),
    { credit: 0, debit: 0 },
  );

  return { rows, totals };
}

export function summarizeProfitAndLoss(revenue: number, costOfGoodsSold: number, operatingExpenses: number) {
  const grossProfit = ensureNonNegative(revenue, 'revenue') - ensureNonNegative(costOfGoodsSold, 'costOfGoodsSold');
  const netProfit = grossProfit - ensureNonNegative(operatingExpenses, 'operatingExpenses');
  return { grossProfit, netProfit };
}

export function buildFinanceSourceReference(
  sourceModule: string,
  sourceDocumentType: string,
  sourceDocumentId: string,
) {
  return [sourceModule, sourceDocumentType, sourceDocumentId]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(':');
}

export function parseFinanceSourceReference(reference: string | null | undefined) {
  const normalized = String(reference ?? '').trim();
  if (!normalized) return null;

  const [sourceModule, sourceDocumentType, ...idParts] = normalized.split(':');
  const sourceDocumentId = idParts.join(':').trim();
  if (!sourceModule || !sourceDocumentType || !sourceDocumentId) return null;

  return { sourceModule, sourceDocumentType, sourceDocumentId };
}

export function isPostedJournalStatus(status: string | null | undefined) {
  const normalized = String(status ?? '').trim().toUpperCase();
  return normalized === 'APPROVED' || normalized === 'POSTED';
}

export function normalizeFinanceAccountType(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_');
}

export function isCostOfSalesAccount(input: {
  accountCode?: string | null;
  accountName?: string | null;
  accountType?: string | null;
}) {
  const code = String(input.accountCode ?? '').trim().toUpperCase();
  const name = String(input.accountName ?? '').trim().toUpperCase();
  const type = normalizeFinanceAccountType(input.accountType);

  return (
    type === 'COST_OF_SALES' ||
    name.includes('COST OF GOODS SOLD') ||
    name.includes('COGS') ||
    code.startsWith('5')
  );
}

export function summarizeBalanceSheetFromLedger(
  lines: Array<{ accountType?: string | null; creditAmount: number; debitAmount: number }>,
) {
  const totals = { assets: 0, equity: 0, liabilities: 0 };

  for (const line of lines) {
    const type = normalizeFinanceAccountType(line.accountType);
    const debit = toNumber(line.debitAmount);
    const credit = toNumber(line.creditAmount);
    const net = debit - credit;

    if (type === 'ASSET') totals.assets += net;
    if (type === 'LIABILITY') totals.liabilities += -net;
    if (type === 'EQUITY') totals.equity += -net;
  }

  return totals;
}

export function summarizeProfitAndLossFromLedger(
  lines: Array<{
    accountCode?: string | null;
    accountName?: string | null;
    accountType?: string | null;
    creditAmount: number;
    debitAmount: number;
  }>,
) {
  let revenue = 0;
  let costOfGoodsSold = 0;
  let operatingExpenses = 0;

  for (const line of lines) {
    const type = normalizeFinanceAccountType(line.accountType);
    const debit = toNumber(line.debitAmount);
    const credit = toNumber(line.creditAmount);

    if (type === 'REVENUE') {
      revenue += credit - debit;
      continue;
    }

    if (type === 'EXPENSE' || isCostOfSalesAccount(line)) {
      const amount = debit - credit;
      if (isCostOfSalesAccount(line)) costOfGoodsSold += amount;
      else operatingExpenses += amount;
    }
  }

  return {
    ...summarizeProfitAndLoss(revenue, costOfGoodsSold, operatingExpenses),
    costOfGoodsSold,
    operatingExpenses,
    revenue,
  };
}

export function summarizeCashFlowFromLedger(
  lines: Array<{
    accountCode?: string | null;
    accountName?: string | null;
    creditAmount: number;
    debitAmount: number;
  }>,
) {
  let cashIn = 0;
  let cashOut = 0;

  for (const line of lines) {
    const code = String(line.accountCode ?? '').trim().toUpperCase();
    const name = String(line.accountName ?? '').trim().toUpperCase();
    const isCashLike =
      name.includes('CASH') ||
      name.includes('BANK') ||
      code === '1000' ||
      code === '1010';

    if (!isCashLike) continue;

    cashIn += toNumber(line.debitAmount);
    cashOut += toNumber(line.creditAmount);
  }

  return {
    cashIn,
    cashOut,
    netCashFlow: cashIn - cashOut,
  };
}

export function buildReceivablesRows(invoices: Array<Record<string, unknown>>) {
  return invoices.map((invoice) => ({
    balanceDue: toNumber(invoice.balance_due ?? invoice.balanceDue),
    customerName: String(invoice.customer_name ?? invoice.customerName ?? 'Walk-in'),
    dueDate: String(invoice.due_date ?? invoice.dueDate ?? ''),
    invoiceNumber: String(invoice.invoice_number ?? invoice.invoiceNumber ?? ''),
    status: String(invoice.status ?? ''),
    total: toNumber(invoice.total),
  }));
}

export function buildPayablesRows(invoices: Array<Record<string, unknown>>) {
  return invoices.map((invoice) => ({
    balance: toNumber(invoice.balance ?? invoice.balance_due ?? invoice.amount_due),
    dueDate: String(invoice.due_date ?? invoice.dueDate ?? ''),
    invoiceNumber: String(invoice.invoice_number ?? invoice.invoiceNumber ?? ''),
    status: String(invoice.status ?? ''),
    supplierName: String(invoice.supplier_name ?? invoice.supplierName ?? 'Unknown supplier'),
    total: toNumber(invoice.total_amount ?? invoice.total ?? 0),
  }));
}

export function buildFinanceReportCsv(rows: Array<Record<string, unknown>>) {
  return toCsv(rows as Array<Record<string, string | number | boolean | null | undefined>>);
}

export function buildFinanceImportTemplate(
  type: 'bank-accounts' | 'budgets' | 'chart-of-accounts' | 'fixed-assets' | 'opening-balances',
) {
  if (type === 'chart-of-accounts') {
    return toCsv([
      {
        accountCode: '',
        accountName: '',
        accountType: 'Asset',
        isActive: true,
        normalBalance: 'DEBIT',
        parentAccountCode: '',
      },
    ]);
  }

  if (type === 'budgets') {
    return toCsv([
      {
        accountCode: '',
        annualTotal: 0,
        branchCode: '',
        budgetCode: '',
        budgetName: '',
        budgetType: 'OPERATING',
        budgetYear: new Date().getFullYear(),
        departmentCode: '',
      },
    ]);
  }

  if (type === 'fixed-assets') {
    return toCsv([
      {
        assetCode: '',
        category: '',
        depreciationMethod: 'STRAIGHT_LINE',
        name: '',
        purchaseCost: 0,
        purchaseDate: '',
        residualValue: 0,
        usefulLifeYears: 5,
      },
    ]);
  }

  if (type === 'opening-balances') {
    return toCsv([
      {
        accountCode: '',
        amount: 0,
        balanceType: 'DEBIT',
        effectiveDate: '',
      },
    ]);
  }

  return toCsv([
    {
      accountCode: '',
      accountName: '',
      accountNumber: '',
      bankName: '',
      branchName: '',
      currency: 'USD',
    },
  ]);
}

type FinanceValidationResult<T extends Record<string, unknown>> = {
  errors: Array<{ message: string; rowNumber: number }>;
  rows: T[];
};

export function validateBudgetImportRows(
  rows: Array<Record<string, unknown>>,
): FinanceValidationResult<Record<string, unknown>> {
  const errors: FinanceValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const budgetCode = String(row.budgetCode ?? '').trim();
    const budgetName = String(row.budgetName ?? '').trim();
    const budgetYear = toNumber(row.budgetYear, NaN);
    const annualTotal = toNumber(row.annualTotal, NaN);

    if (!budgetCode) errors.push({ message: 'budgetCode is required', rowNumber });
    if (!budgetName) errors.push({ message: 'budgetName is required', rowNumber });
    if (!Number.isFinite(budgetYear) || budgetYear <= 0) errors.push({ message: 'budgetYear must be valid', rowNumber });
    if (!Number.isFinite(annualTotal) || annualTotal < 0) errors.push({ message: 'annualTotal must not be negative', rowNumber });

    if (budgetCode && budgetName && Number.isFinite(budgetYear) && annualTotal >= 0) validRows.push(row);
  });

  return { errors, rows: validRows };
}

export function validateFixedAssetImportRows(
  rows: Array<Record<string, unknown>>,
): FinanceValidationResult<Record<string, unknown>> {
  const errors: FinanceValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const assetCode = String(row.assetCode ?? '').trim();
    const name = String(row.name ?? '').trim();
    const purchaseCost = toNumber(row.purchaseCost, NaN);
    const usefulLifeYears = toNumber(row.usefulLifeYears, NaN);

    if (!assetCode) errors.push({ message: 'assetCode is required', rowNumber });
    if (!name) errors.push({ message: 'name is required', rowNumber });
    if (!Number.isFinite(purchaseCost) || purchaseCost < 0) errors.push({ message: 'purchaseCost must not be negative', rowNumber });
    if (!Number.isFinite(usefulLifeYears) || usefulLifeYears <= 0) errors.push({ message: 'usefulLifeYears must be greater than zero', rowNumber });

    if (assetCode && name && purchaseCost >= 0 && usefulLifeYears > 0) validRows.push(row);
  });

  return { errors, rows: validRows };
}

export function validateBankAccountImportRows(
  rows: Array<Record<string, unknown>>,
): FinanceValidationResult<Record<string, unknown>> {
  const errors: FinanceValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const accountCode = String(row.accountCode ?? '').trim();
    const accountName = String(row.accountName ?? '').trim();
    const accountNumber = String(row.accountNumber ?? '').trim();
    const bankName = String(row.bankName ?? '').trim();

    if (!accountCode) errors.push({ message: 'accountCode is required', rowNumber });
    if (!accountName) errors.push({ message: 'accountName is required', rowNumber });
    if (!accountNumber) errors.push({ message: 'accountNumber is required', rowNumber });
    if (!bankName) errors.push({ message: 'bankName is required', rowNumber });

    if (accountCode && accountName && accountNumber && bankName) validRows.push(row);
  });

  return { errors, rows: validRows };
}

export function validateChartOfAccountImportRows(
  rows: Array<Record<string, unknown>>,
): FinanceValidationResult<Record<string, unknown>> {
  const errors: FinanceValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];
  const seenCodes = new Set<string>();
  const validTypes = new Set(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'Cost of Sales']);

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const accountCode = String(row.accountCode ?? '').trim();
    const accountName = String(row.accountName ?? '').trim();
    const accountType = String(row.accountType ?? '').trim();

    if (!accountCode) errors.push({ message: 'accountCode is required', rowNumber });
    if (!accountName) errors.push({ message: 'accountName is required', rowNumber });
    if (!validTypes.has(accountType)) errors.push({ message: 'accountType is invalid', rowNumber });
    if (accountCode && seenCodes.has(accountCode)) errors.push({ message: 'duplicate accountCode in import', rowNumber });

    seenCodes.add(accountCode);
    if (accountCode && accountName && validTypes.has(accountType) && !seenCodes.has(`invalid:${rowNumber}`)) {
      validRows.push(row);
    }
  });

  return { errors, rows: validRows };
}

export function validateOpeningBalanceImportRows(
  rows: Array<Record<string, unknown>>,
): FinanceValidationResult<Record<string, unknown>> {
  const errors: FinanceValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const accountCode = String(row.accountCode ?? '').trim();
    const amount = toNumber(row.amount, NaN);
    const balanceType = String(row.balanceType ?? '').trim().toUpperCase();

    if (!accountCode) errors.push({ message: 'accountCode is required', rowNumber });
    if (!Number.isFinite(amount) || amount < 0) errors.push({ message: 'amount must not be negative', rowNumber });
    if (!['DEBIT', 'CREDIT'].includes(balanceType)) errors.push({ message: 'balanceType must be DEBIT or CREDIT', rowNumber });

    if (accountCode && Number.isFinite(amount) && amount >= 0 && ['DEBIT', 'CREDIT'].includes(balanceType)) {
      validRows.push(row);
    }
  });

  return { errors, rows: validRows };
}
