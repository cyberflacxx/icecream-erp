import { ensureNonNegative, ensurePositiveQuantity, toCsv, toNumber } from './inventory';

export type SalesLineInput = {
  discountPercent?: number | null;
  quantity: number;
  taxAmount?: number;
  unitPrice: number;
};

export type CreditLimitSnapshot = {
  availableCredit: number;
  creditAllowed: boolean;
  creditLimit: number;
  currentBalance: number;
  exceeded: boolean;
  projectedBalance: number;
};

export type StockAvailabilityRow = {
  availableQuantity: number;
  itemId: string;
  quantityRequested: number;
  shortageQuantity: number;
  stockAvailable: boolean;
};

export type InvoiceAgeingRow = {
  balanceDue: number;
  customerName: string;
  dueDate: string | null;
  invoiceDate: string | null;
  invoiceNumber: string;
  overdueDays: number;
  paymentStatus: string;
  total: number;
};

export type CreditLimitRow = {
  availableCredit: number;
  creditLimit: number;
  currentBalance: number;
  customerCode: string;
  customerName: string;
  exceeded: boolean;
};

export type SalesPostingLine = {
  accountCode: string;
  creditAmount: number;
  debitAmount: number;
  description: string;
};

export type SalesPostingRole =
  | 'ACCOUNTS_RECEIVABLE'
  | 'SALES_REVENUE'
  | 'VAT_OUTPUT'
  | 'COST_OF_GOODS_SOLD'
  | 'FINISHED_GOODS_INVENTORY'
  | 'CASH_ON_HAND'
  | 'BANK_ACCOUNT'
  | 'MOBILE_MONEY'
  | 'DISCOUNTS_ALLOWED'
  | 'SALES_RETURNS';

export type SalesTenderInput = {
  amount: number;
  paymentMethod: string;
  referenceNumber?: string | null;
};

export type DispatchReportRow = {
  customerName: string;
  dispatchDate: string | null;
  dispatchNoteNumber: string;
  invoiceNumber: string;
  quantityDispatched: number;
  status: string;
};

export type SalesImportValidationResult<T extends Record<string, unknown>> = {
  errors: Array<{ message: string; rowNumber: number }>;
  rows: T[];
};

export function calculateLineTotal(input: SalesLineInput) {
  const quantity = ensurePositiveQuantity(input.quantity, 'quantity');
  const unitPrice = ensureNonNegative(input.unitPrice, 'unitPrice');
  const discountPercent = ensureNonNegative(input.discountPercent ?? 0, 'discountPercent');
  const taxAmount = ensureNonNegative(input.taxAmount ?? 0, 'taxAmount');
  const gross = quantity * unitPrice;
  const discountValue = gross * (discountPercent / 100);
  return gross - discountValue + taxAmount;
}

export function calculateInvoiceTotals(lines: SalesLineInput[]) {
  let grossSales = 0;
  let discountValue = 0;
  let taxValue = 0;
  let total = 0;

  for (const line of lines) {
    const quantity = ensurePositiveQuantity(line.quantity, 'quantity');
    const unitPrice = ensureNonNegative(line.unitPrice, 'unitPrice');
    const discountPercent = ensureNonNegative(line.discountPercent ?? 0, 'discountPercent');
    const taxAmount = ensureNonNegative(line.taxAmount ?? 0, 'taxAmount');
    const gross = quantity * unitPrice;
    const lineDiscountValue = gross * (discountPercent / 100);

    grossSales += gross;
    discountValue += lineDiscountValue;
    taxValue += taxAmount;
    total += gross - lineDiscountValue + taxAmount;
  }

  return {
    discountValue,
    grossSales,
    netSales: grossSales - discountValue,
    taxValue,
    total,
  };
}

export function evaluateCreditLimit(
  currentBalance: number,
  creditLimit: number,
  invoiceTotal: number,
  creditAllowed: boolean,
): CreditLimitSnapshot {
  const normalizedCurrentBalance = ensureNonNegative(currentBalance, 'currentBalance');
  const normalizedCreditLimit = ensureNonNegative(creditLimit, 'creditLimit');
  const normalizedInvoiceTotal = ensureNonNegative(invoiceTotal, 'invoiceTotal');
  const projectedBalance = normalizedCurrentBalance + normalizedInvoiceTotal;
  const availableCredit = Math.max(0, normalizedCreditLimit - normalizedCurrentBalance);

  return {
    availableCredit,
    creditAllowed,
    creditLimit: normalizedCreditLimit,
    currentBalance: normalizedCurrentBalance,
    exceeded: creditAllowed && normalizedCreditLimit > 0 && projectedBalance > normalizedCreditLimit,
    projectedBalance,
  };
}

export function checkStockAvailability(
  lines: Array<{ itemId: string; quantity: number }>,
  stockByItemId: Map<string, number>,
): StockAvailabilityRow[] {
  return lines.map((line) => {
    const quantityRequested = ensurePositiveQuantity(line.quantity, 'quantity');
    const availableQuantity = stockByItemId.get(line.itemId) ?? 0;

    return {
      availableQuantity,
      itemId: line.itemId,
      quantityRequested,
      shortageQuantity: Math.max(0, quantityRequested - availableQuantity),
      stockAvailable: availableQuantity >= quantityRequested,
    };
  });
}

export function buildInvoiceAgeingRows(invoices: Array<Record<string, unknown>>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return invoices.map((invoice) => {
    const dueDate = invoice.due_date ? new Date(String(invoice.due_date)) : null;
    const balanceDue = toNumber(invoice.balance_due ?? invoice.balanceDue);
    const overdueDays =
      dueDate && balanceDue > 0
        ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

    return {
      balanceDue,
      customerName: String(invoice.customer_name ?? invoice.customerName ?? 'Unknown customer'),
      dueDate: invoice.due_date ? String(invoice.due_date) : null,
      invoiceDate: invoice.invoice_date ? String(invoice.invoice_date) : null,
      invoiceNumber: String(invoice.invoice_number ?? ''),
      overdueDays,
      paymentStatus: String(invoice.status ?? 'PENDING'),
      total: toNumber(invoice.total),
    };
  });
}

export function buildCreditLimitRows(customers: Array<Record<string, unknown>>): CreditLimitRow[] {
  return customers.map((customer) => {
    const creditLimit = toNumber(customer.credit_limit);
    const currentBalance = toNumber(customer.current_balance);

    return {
      availableCredit: Math.max(0, creditLimit - currentBalance),
      creditLimit,
      currentBalance,
      customerCode: String(customer.code ?? ''),
      customerName: String(customer.name ?? 'Unknown customer'),
      exceeded: creditLimit > 0 && currentBalance > creditLimit,
    };
  });
}

export function buildDispatchReportRows(dispatches: Array<Record<string, unknown>>): DispatchReportRow[] {
  return dispatches.map((dispatch) => ({
    customerName: String(dispatch.customer_name ?? dispatch.customerName ?? 'Unknown customer'),
    dispatchDate: dispatch.dispatch_date ? String(dispatch.dispatch_date) : null,
    dispatchNoteNumber: String(dispatch.dispatch_note_number ?? dispatch.dispatchNoteNumber ?? ''),
    invoiceNumber: String(dispatch.invoice_number ?? dispatch.invoiceNumber ?? ''),
    quantityDispatched: toNumber(dispatch.quantity_dispatched ?? dispatch.quantityDispatched),
    status: String(dispatch.status ?? ''),
  }));
}

export function validateCustomerCodeUniqueness(existingCodes: string[], nextCode: string) {
  return !existingCodes.map((code) => code.trim().toUpperCase()).includes(nextCode.trim().toUpperCase());
}

export function validateDiscountValue(discountValue: number, maxAllowedDiscount?: number | null) {
  const normalizedDiscountValue = ensureNonNegative(discountValue, 'discountValue');
  if (maxAllowedDiscount === null || maxAllowedDiscount === undefined) return true;
  return normalizedDiscountValue <= ensureNonNegative(maxAllowedDiscount, 'maxAllowedDiscount');
}

export function canRecordPayment(balanceDue: number, attemptedPayment: number) {
  const normalizedBalance = ensureNonNegative(balanceDue, 'balanceDue');
  const normalizedPayment = ensurePositiveQuantity(attemptedPayment, 'attemptedPayment');
  return normalizedPayment <= normalizedBalance;
}

export function normalizeSalesPaymentMethod(value: string) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'BANK_TRANSFER') return 'BANK';
  return normalized || 'CASH';
}

export function resolveSalesPaymentPostingRole(paymentMethod: string): SalesPostingRole {
  const normalized = normalizeSalesPaymentMethod(paymentMethod);
  if (['BANK', 'CARD', 'POS'].includes(normalized)) return 'BANK_ACCOUNT';
  if (['ECOCASH', 'ONEMONEY', 'MUKURU', 'MOBILE_MONEY'].includes(normalized)) return 'MOBILE_MONEY';
  return 'CASH_ON_HAND';
}

export function validateSalesTenderSplit(totalAmount: number, tenders: SalesTenderInput[]) {
  const normalizedTotal = ensurePositiveQuantity(totalAmount, 'totalAmount');
  if (tenders.length === 0) return 'At least one payment tender is required.';

  const tenderTotal = tenders.reduce((sum, tender) => {
    const amount = ensurePositiveQuantity(tender.amount, 'tender.amount');
    if (!String(tender.paymentMethod ?? '').trim()) throw new Error('paymentMethod is required for every tender');
    return sum + amount;
  }, 0);

  return Math.abs(tenderTotal - normalizedTotal) <= 0.01 ? null : 'Tender totals must equal payment amount.';
}

export function buildSalesInvoicePostingLines(input: {
  invoiceNumber?: string | null;
  stockCostTotal?: number | null;
  taxAmount?: number | null;
  total: number;
}): SalesPostingLine[] {
  const total = ensurePositiveQuantity(input.total, 'total');
  const taxAmount = ensureNonNegative(input.taxAmount ?? 0, 'taxAmount');
  const stockCostTotal = ensureNonNegative(input.stockCostTotal ?? 0, 'stockCostTotal');
  const invoiceNumber = input.invoiceNumber || 'sales invoice';
  const netSales = total - taxAmount;
  if (netSales < 0) throw new Error('taxAmount cannot exceed invoice total');

  const lines: SalesPostingLine[] = [
    {
      accountCode: 'ACCOUNTS_RECEIVABLE',
      creditAmount: 0,
      debitAmount: total,
      description: `Accounts receivable for ${invoiceNumber}`,
    },
    {
      accountCode: 'SALES_REVENUE',
      creditAmount: netSales,
      debitAmount: 0,
      description: `Sales revenue for ${invoiceNumber}`,
    },
  ];

  if (taxAmount > 0) {
    lines.push({
      accountCode: 'VAT_OUTPUT',
      creditAmount: taxAmount,
      debitAmount: 0,
      description: `Output VAT for ${invoiceNumber}`,
    });
  }

  if (stockCostTotal > 0) {
    lines.push(
      {
        accountCode: 'COST_OF_GOODS_SOLD',
        creditAmount: 0,
        debitAmount: stockCostTotal,
        description: `Cost of goods sold for ${invoiceNumber}`,
      },
      {
        accountCode: 'FINISHED_GOODS_INVENTORY',
        creditAmount: stockCostTotal,
        debitAmount: 0,
        description: `Inventory issue for ${invoiceNumber}`,
      },
    );
  }

  return lines;
}

export function buildSalesPaymentPostingLines(input: {
  amount: number;
  invoiceNumber?: string | null;
  paymentMethod: string;
}): SalesPostingLine[] {
  const amount = ensurePositiveQuantity(input.amount, 'amount');
  const paymentMethod = normalizeSalesPaymentMethod(input.paymentMethod);
  const invoiceNumber = input.invoiceNumber || 'sales invoice';

  return [
    {
      accountCode: resolveSalesPaymentPostingRole(paymentMethod),
      creditAmount: 0,
      debitAmount: amount,
      description: `Customer payment via ${paymentMethod}`,
    },
    {
      accountCode: 'ACCOUNTS_RECEIVABLE',
      creditAmount: amount,
      debitAmount: 0,
      description: `Reduce accounts receivable for ${invoiceNumber}`,
    },
  ];
}

export function buildSalesReportCsv(rows: Array<Record<string, unknown>>) {
  return toCsv(rows as Array<Record<string, string | number | boolean | null | undefined>>);
}

export function buildSalesImportTemplate(type: 'customers' | 'prices' | 'customer-balances') {
  if (type === 'customers') {
    return toCsv([
      {
        activeStatus: true,
        creditAllowed: false,
        creditLimit: 0,
        customerCode: '',
        customerGroup: '',
        customerName: '',
        customerType: 'DIRECT_CUSTOMER',
        email: '',
        paymentTerms: '',
        phoneNumber: '',
        priceList: '',
      },
    ]);
  }

  if (type === 'prices') {
    return toCsv([
      {
        activeStatus: true,
        effectiveDate: '',
        priceListCode: '',
        productCode: '',
        sellingPrice: 0,
      },
    ]);
  }

  return toCsv([
    {
      customerCode: '',
      openingBalance: 0,
    },
  ]);
}

export function validateCustomerImportRows(
  rows: Array<Record<string, unknown>>,
): SalesImportValidationResult<Record<string, unknown>> {
  const errors: SalesImportValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const customerCode = String(row.customerCode ?? '').trim();
    const customerName = String(row.customerName ?? '').trim();
    const creditLimit = toNumber(row.creditLimit, NaN);

    if (!customerCode) errors.push({ message: 'customerCode is required', rowNumber });
    if (!customerName) errors.push({ message: 'customerName is required', rowNumber });
    if (row.creditLimit !== undefined && (!Number.isFinite(creditLimit) || creditLimit < 0)) {
      errors.push({ message: 'creditLimit must not be negative', rowNumber });
    }

    if (customerCode && customerName && (!row.creditLimit || creditLimit >= 0)) {
      validRows.push(row);
    }
  });

  return { errors, rows: validRows };
}

export function validatePriceImportRows(
  rows: Array<Record<string, unknown>>,
): SalesImportValidationResult<Record<string, unknown>> {
  const errors: SalesImportValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productCode = String(row.productCode ?? '').trim();
    const priceListCode = String(row.priceListCode ?? '').trim();
    const sellingPrice = toNumber(row.sellingPrice, NaN);

    if (!productCode) errors.push({ message: 'productCode is required', rowNumber });
    if (!priceListCode) errors.push({ message: 'priceListCode is required', rowNumber });
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      errors.push({ message: 'sellingPrice must not be negative', rowNumber });
    }

    if (productCode && priceListCode && sellingPrice >= 0) {
      validRows.push(row);
    }
  });

  return { errors, rows: validRows };
}

export function validateCustomerBalanceImportRows(
  rows: Array<Record<string, unknown>>,
): SalesImportValidationResult<Record<string, unknown>> {
  const errors: SalesImportValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const customerCode = String(row.customerCode ?? '').trim();
    const openingBalance = toNumber(row.openingBalance, NaN);

    if (!customerCode) errors.push({ message: 'customerCode is required', rowNumber });
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      errors.push({ message: 'openingBalance must not be negative', rowNumber });
    }

    if (customerCode && openingBalance >= 0) {
      validRows.push(row);
    }
  });

  return { errors, rows: validRows };
}
