import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateBranchProfitability,
  calculateCashVariance,
  calculateExpectedCash,
  calculateExpectedClosingStock,
  calculateStockVariance,
  validateBranchCodeUniqueness,
  validateBranchCustomerCodeUniqueness,
  validateBranchCustomerImportRows,
  validateBranchImportRows,
  validateBranchOpeningBalanceImportRows,
  validateBranchSaleQuantity,
} from '../src/lib/branches';

test('branch stock and cash calculations derive closure metrics', () => {
  const expectedStock = calculateExpectedClosingStock(100, 20, 5, 40, 10, 2);
  const stockVariance = calculateStockVariance(70, expectedStock);
  const expectedCash = calculateExpectedCash(200, 50, 30);
  const cashVariance = calculateCashVariance(240, expectedCash);

  assert.equal(expectedStock, 73);
  assert.equal(stockVariance, -3);
  assert.equal(expectedCash, 220);
  assert.equal(cashVariance, 20);
});

test('branch profitability derives gross and net profit', () => {
  const profitability = calculateBranchProfitability(1000, 400, 50, 200);
  assert.equal(profitability.grossProfit, 600);
  assert.equal(profitability.netProfit, 350);
});

test('branch uniqueness and sale quantity validations block bad inputs', () => {
  assert.equal(validateBranchCodeUniqueness(['br-01', 'BR-02'], 'BR-03'), true);
  assert.equal(validateBranchCodeUniqueness(['br-01', 'BR-02'], 'br-02'), false);
  assert.equal(
    validateBranchCustomerCodeUniqueness(
      [
        { branchId: 'branch-1', customerCode: 'CUS-01' },
        { branchId: 'branch-2', customerCode: 'CUS-01' },
      ],
      'branch-1',
      'cus-02',
    ),
    true,
  );
  assert.equal(
    validateBranchCustomerCodeUniqueness([{ branchId: 'branch-1', customerCode: 'CUS-01' }], 'branch-1', 'cus-01'),
    false,
  );
  assert.equal(validateBranchSaleQuantity(5, 10), true);
  assert.equal(validateBranchSaleQuantity(12, 10), false);
});

test('branch import validators return row level errors', () => {
  const branchRows = validateBranchImportRows([
    { branchCode: '', branchName: '' },
    { branchCode: 'BR-01', branchName: 'Eastlea' },
  ]);
  const customerRows = validateBranchCustomerImportRows([
    { branchCode: '', creditLimit: -1, customerCode: '', customerName: '' },
    { branchCode: 'BR-01', creditLimit: 500, customerCode: 'CUS-01', customerName: 'Walk In' },
  ]);
  const balanceRows = validateBranchOpeningBalanceImportRows([
    { branchCode: '', itemCode: '', openingQuantity: -1 },
    { branchCode: 'BR-01', itemCode: 'FG-001', openingQuantity: 20 },
  ]);

  assert.equal(branchRows.errors.length, 2);
  assert.equal(branchRows.rows.length, 1);
  assert.equal(customerRows.errors.length, 4);
  assert.equal(customerRows.rows.length, 1);
  assert.equal(balanceRows.errors.length, 3);
  assert.equal(balanceRows.rows.length, 1);
});
