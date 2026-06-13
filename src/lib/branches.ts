import { ensureNonNegative, ensurePositiveQuantity, toCsv, toNumber } from './inventory';

export function calculateExpectedClosingStock(
  openingStock: number,
  stockReceived: number,
  approvedReturns: number,
  salesQuantity: number,
  transfersOut: number,
  approvedAdjustments: number,
) {
  return (
    ensureNonNegative(openingStock, 'openingStock') +
    ensureNonNegative(stockReceived, 'stockReceived') +
    ensureNonNegative(approvedReturns, 'approvedReturns') -
    ensureNonNegative(salesQuantity, 'salesQuantity') -
    ensureNonNegative(transfersOut, 'transfersOut') -
    ensureNonNegative(approvedAdjustments, 'approvedAdjustments')
  );
}

export function calculateStockVariance(physicalClosingStock: number, expectedClosingStock: number) {
  return ensureNonNegative(physicalClosingStock, 'physicalClosingStock') - ensureNonNegative(expectedClosingStock, 'expectedClosingStock');
}

export function calculateExpectedCash(cashSales: number, cashPaymentsReceived: number, cashExpenses: number) {
  return (
    ensureNonNegative(cashSales, 'cashSales') +
    ensureNonNegative(cashPaymentsReceived, 'cashPaymentsReceived') -
    ensureNonNegative(cashExpenses, 'cashExpenses')
  );
}

export function calculateCashVariance(physicalCash: number, expectedCash: number) {
  return ensureNonNegative(physicalCash, 'physicalCash') - ensureNonNegative(expectedCash, 'expectedCash');
}

export function calculateBranchProfitability(netSales: number, costOfGoodsSold: number, returnsValue: number, branchExpenses: number) {
  const grossProfit = ensureNonNegative(netSales, 'netSales') - ensureNonNegative(costOfGoodsSold, 'costOfGoodsSold');
  const adjustedGrossProfit = grossProfit - ensureNonNegative(returnsValue, 'returnsValue');
  const netProfit = adjustedGrossProfit - ensureNonNegative(branchExpenses, 'branchExpenses');

  return {
    grossProfit,
    netProfit,
  };
}

export function validateBranchCodeUniqueness(existingCodes: string[], nextCode: string) {
  return !existingCodes.map((code) => code.trim().toUpperCase()).includes(nextCode.trim().toUpperCase());
}

export function validateBranchCustomerCodeUniqueness(
  existingRows: Array<{ branchId: string; customerCode: string }>,
  branchId: string,
  customerCode: string,
) {
  const normalizedBranchId = branchId.trim();
  const normalizedCode = customerCode.trim().toUpperCase();

  return !existingRows.some((row) => row.branchId.trim() === normalizedBranchId && row.customerCode.trim().toUpperCase() === normalizedCode);
}

export function validateBranchSaleQuantity(quantity: number, availableQuantity: number) {
  return ensurePositiveQuantity(quantity, 'quantity') <= ensureNonNegative(availableQuantity, 'availableQuantity');
}

export function buildBranchReportCsv(rows: Array<Record<string, unknown>>) {
  return toCsv(rows as Array<Record<string, string | number | boolean | null | undefined>>);
}

export function buildBranchImportTemplate(type: 'branches' | 'customers' | 'opening-balances') {
  if (type === 'branches') {
    return toCsv([
      {
        activeStatus: true,
        branchCode: '',
        branchName: '',
        defaultWarehouseCode: '',
        location: '',
        managerWorkId: '',
        phoneNumber: '',
      },
    ]);
  }

  if (type === 'customers') {
    return toCsv([
      {
        activeStatus: true,
        branchCode: '',
        creditAllowed: false,
        creditLimit: 0,
        customerCode: '',
        customerName: '',
        customerType: 'WALK_IN',
        phoneNumber: '',
      },
    ]);
  }

  return toCsv([
    {
      branchCode: '',
      itemCode: '',
      openingQuantity: 0,
    },
  ]);
}

type ValidationResult<T extends Record<string, unknown>> = {
  errors: Array<{ message: string; rowNumber: number }>;
  rows: T[];
};

export function validateBranchImportRows(rows: Array<Record<string, unknown>>): ValidationResult<Record<string, unknown>> {
  const errors: ValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const branchCode = String(row.branchCode ?? '').trim();
    const branchName = String(row.branchName ?? '').trim();

    if (!branchCode) errors.push({ message: 'branchCode is required', rowNumber });
    if (!branchName) errors.push({ message: 'branchName is required', rowNumber });

    if (branchCode && branchName) validRows.push(row);
  });

  return { errors, rows: validRows };
}

export function validateBranchCustomerImportRows(rows: Array<Record<string, unknown>>): ValidationResult<Record<string, unknown>> {
  const errors: ValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const branchCode = String(row.branchCode ?? '').trim();
    const customerCode = String(row.customerCode ?? '').trim();
    const customerName = String(row.customerName ?? '').trim();
    const creditLimit = toNumber(row.creditLimit, NaN);

    if (!branchCode) errors.push({ message: 'branchCode is required', rowNumber });
    if (!customerCode) errors.push({ message: 'customerCode is required', rowNumber });
    if (!customerName) errors.push({ message: 'customerName is required', rowNumber });
    if (row.creditLimit !== undefined && (!Number.isFinite(creditLimit) || creditLimit < 0)) {
      errors.push({ message: 'creditLimit must not be negative', rowNumber });
    }

    if (branchCode && customerCode && customerName && (!row.creditLimit || creditLimit >= 0)) validRows.push(row);
  });

  return { errors, rows: validRows };
}

export function validateBranchOpeningBalanceImportRows(rows: Array<Record<string, unknown>>): ValidationResult<Record<string, unknown>> {
  const errors: ValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const branchCode = String(row.branchCode ?? '').trim();
    const itemCode = String(row.itemCode ?? '').trim();
    const openingQuantity = toNumber(row.openingQuantity, NaN);

    if (!branchCode) errors.push({ message: 'branchCode is required', rowNumber });
    if (!itemCode) errors.push({ message: 'itemCode is required', rowNumber });
    if (!Number.isFinite(openingQuantity) || openingQuantity < 0) {
      errors.push({ message: 'openingQuantity must not be negative', rowNumber });
    }

    if (branchCode && itemCode && openingQuantity >= 0) validRows.push(row);
  });

  return { errors, rows: validRows };
}
