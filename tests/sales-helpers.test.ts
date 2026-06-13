import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCreditLimitRows,
  calculateInvoiceTotals,
  canRecordPayment,
  checkStockAvailability,
  evaluateCreditLimit,
  validateCustomerBalanceImportRows,
  validateCustomerCodeUniqueness,
  validateCustomerImportRows,
  validatePriceImportRows,
} from '../src/lib/sales';

test('calculateInvoiceTotals derives gross, discounts, tax, and total', () => {
  const totals = calculateInvoiceTotals([
    { discountPercent: 10, quantity: 2, taxAmount: 1, unitPrice: 5 },
    { quantity: 1, taxAmount: 0.5, unitPrice: 20 },
  ]);

  assert.equal(totals.grossSales, 30);
  assert.equal(totals.discountValue, 1);
  assert.equal(totals.taxValue, 1.5);
  assert.equal(totals.total, 30.5);
});

test('credit exposure and stock availability reflect approval controls', () => {
  const credit = evaluateCreditLimit(90, 100, 20, true);
  const stock = checkStockAvailability(
    [
      { itemId: 'fg-1', quantity: 6 },
      { itemId: 'fg-2', quantity: 2 },
    ],
    new Map([
      ['fg-1', 4],
      ['fg-2', 3],
    ]),
  );

  assert.equal(credit.exceeded, true);
  assert.equal(credit.availableCredit, 10);
  assert.equal(stock[0]?.stockAvailable, false);
  assert.equal(stock[0]?.shortageQuantity, 2);
  assert.equal(stock[1]?.stockAvailable, true);
});

test('customer code uniqueness and payment validation guard transactions', () => {
  assert.equal(validateCustomerCodeUniqueness(['cus-001', 'CUS-002'], 'cus-003'), true);
  assert.equal(validateCustomerCodeUniqueness(['cus-001', 'CUS-002'], 'cus-002'), false);
  assert.equal(canRecordPayment(150, 100), true);
  assert.equal(canRecordPayment(150, 151), false);
});

test('credit limit report rows expose exceeded accounts', () => {
  const rows = buildCreditLimitRows([
    { code: 'CUS-001', credit_limit: 1000, current_balance: 1200, name: 'Eastgate Supermart' },
  ]);

  assert.equal(rows[0]?.exceeded, true);
  assert.equal(rows[0]?.availableCredit, 0);
});

test('sales import validators reject incomplete rows and keep valid ones', () => {
  const customerRows = validateCustomerImportRows([
    { creditLimit: -1, customerCode: '', customerName: '' },
    { creditLimit: 500, customerCode: 'CUS-001', customerName: 'Eastgate Supermart' },
  ]);
  const priceRows = validatePriceImportRows([
    { priceListCode: '', productCode: '', sellingPrice: -1 },
    { priceListCode: 'WHOLESALE', productCode: 'FG-001', sellingPrice: 12.5 },
  ]);
  const balanceRows = validateCustomerBalanceImportRows([
    { customerCode: '', openingBalance: -10 },
    { customerCode: 'CUS-001', openingBalance: 250 },
  ]);

  assert.equal(customerRows.errors.length, 3);
  assert.equal(customerRows.rows.length, 1);
  assert.equal(priceRows.errors.length, 3);
  assert.equal(priceRows.rows.length, 1);
  assert.equal(balanceRows.errors.length, 2);
  assert.equal(balanceRows.rows.length, 1);
});
