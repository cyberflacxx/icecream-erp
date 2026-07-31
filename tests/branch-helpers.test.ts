import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
import {
  filterAuthorizedBranches,
  resolveRequestedBranchId,
} from '../src/lib/branch-access';

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

test('branch authorization helper auto-applies a single assigned branch and blocks overrides', () => {
  const ctx = {
    branchAssignments: ['branch-1'],
    branchId: 'branch-1',
    isBranchScoped: true,
    organizationId: 'org-1',
    permissions: [],
  };
  const branches = [
    { id: 'branch-1', organizationId: 'org-1', status: 'ACTIVE' },
    { id: 'branch-2', organizationId: 'org-1', status: 'ACTIVE' },
  ];

  assert.deepEqual(
    filterAuthorizedBranches(ctx, branches),
    [{ id: 'branch-1', organizationId: 'org-1', status: 'ACTIVE' }],
  );
  assert.deepEqual(resolveRequestedBranchId(ctx, null, branches), { branchId: 'branch-1', ok: true });
  assert.deepEqual(resolveRequestedBranchId(ctx, 'branch-2', branches), {
    message: 'This role is limited to its assigned branch.',
    ok: false,
    status: 403,
  });
});

test('global branch access can select any active branch in the organization', () => {
  const ctx = {
    branchAssignments: [],
    branchId: null,
    isBranchScoped: false,
    organizationId: 'org-1',
    permissions: ['view_all_branches'],
  };
  const branches = [
    { id: 'branch-1', organizationId: 'org-1', status: 'ACTIVE' },
    { id: 'branch-2', organizationId: 'org-1', status: 'INACTIVE' },
  ];

  assert.deepEqual(resolveRequestedBranchId(ctx, 'branch-1', branches), { branchId: 'branch-1', ok: true });
  assert.deepEqual(resolveRequestedBranchId(ctx, 'branch-2', branches), {
    message: 'Selected branch is not available.',
    ok: false,
    status: 400,
  });
});

test('branch-scoped users with no assigned branch receive a clear authorization error', () => {
  const result = resolveRequestedBranchId({
    branchAssignments: [],
    branchId: null,
    isBranchScoped: true,
    organizationId: 'org-1',
    permissions: [],
  }, null, []);

  assert.deepEqual(result, {
    message: 'No branch assignment is available for this user.',
    ok: false,
    status: 403,
  });
});

test('inactive branches are excluded from selector results by default', () => {
  const result = filterAuthorizedBranches({
    branchAssignments: ['branch-1', 'branch-2'],
    branchId: 'branch-1',
    isBranchScoped: true,
    organizationId: 'org-1',
    permissions: [],
  }, [
    { id: 'branch-1', organizationId: 'org-1', status: 'ACTIVE' },
    { id: 'branch-2', organizationId: 'org-1', status: 'INACTIVE' },
  ]);

  assert.deepEqual(result, [{ id: 'branch-1', organizationId: 'org-1', status: 'ACTIVE' }]);
});

test('branch selector and sales order routes use shared authorization-aware branch validation', () => {
  const branchesRoute = fs.readFileSync('src/app/api/branches/route.ts', 'utf8');
  const salesOrdersRoute = fs.readFileSync('src/app/api/sales/orders/route.ts', 'utf8');

  assert.match(branchesRoute, /filterAuthorizedBranches/);
  assert.match(branchesRoute, /organization_id/);
  assert.match(branchesRoute, /selector/);
  assert.match(salesOrdersRoute, /resolveRequestedBranchId/);
  assert.match(salesOrdersRoute, /Selected warehouse does not belong to the selected branch/);
});
