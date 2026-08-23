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
  filterAuthorizedWarehouses,
  isWarehouseAvailableToContext,
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

test('warehouse authorization helper allows assigned-branch warehouses and explicit warehouse assignments only', () => {
  const ctx = {
    branchAssignments: ['branch-1'],
    branchId: 'branch-1',
    isBranchScoped: true,
    organizationId: 'org-1',
    permissions: [],
    warehouseAssignments: ['wh-central'],
  };
  const warehouses = [
    { branchId: 'branch-1', id: 'wh-1', isActive: true, organizationId: 'org-1' },
    { branchId: 'branch-2', id: 'wh-2', isActive: true, organizationId: 'org-1' },
    { branchId: null, id: 'wh-central', isActive: true, organizationId: 'org-1' },
    { branchId: null, id: 'wh-unassigned', isActive: true, organizationId: 'org-1' },
  ];

  assert.equal(isWarehouseAvailableToContext(ctx, warehouses[0]), true);
  assert.equal(isWarehouseAvailableToContext(ctx, warehouses[1]), false);
  assert.equal(isWarehouseAvailableToContext(ctx, warehouses[2]), true);
  assert.equal(isWarehouseAvailableToContext(ctx, warehouses[3]), false);
  assert.deepEqual(filterAuthorizedWarehouses(ctx, warehouses), [warehouses[0], warehouses[2]]);
});

test('branch selector and sales order routes use shared authorization-aware branch validation', () => {
  const branchesRoute = fs.readFileSync('src/app/api/branches/route.ts', 'utf8');
  const salesOrdersRoute = fs.readFileSync('src/app/api/sales/orders/route.ts', 'utf8');
  const invoicePaymentRoute = fs.readFileSync('src/app/api/sales/invoices/[id]/payment/route.ts', 'utf8');
  const grnCreateRoute = fs.readFileSync('src/app/api/procurement/grns/route.ts', 'utf8');
  const grnApproveRoute = fs.readFileSync('src/app/api/procurement/grns/[id]/approve/route.ts', 'utf8');
  const goodsReceivingStatusRoute = fs.readFileSync('src/app/api/procurement/goods-receiving-status/route.ts', 'utf8');
  const dashboardOverview = fs.readFileSync('src/components/dashboard/dashboard-overview.tsx', 'utf8');
  const dashboardShortcuts = fs.readFileSync('src/lib/dashboard-shortcuts.ts', 'utf8');
  const sidebar = fs.readFileSync('src/components/dashboard/sidebar.tsx', 'utf8');

  assert.match(branchesRoute, /filterAuthorizedBranches/);
  assert.match(branchesRoute, /organization_id/);
  assert.match(branchesRoute, /selector/);
  assert.match(branchesRoute, /bootstrapBranchOperations/);
  assert.match(branchesRoute, /syncBranchCostCentres/);
  assert.match(branchesRoute, /from\('warehouses'\)\s*\.insert/);
  assert.match(branchesRoute, /from\('cash_accounts'\)\s*\.insert/);
  assert.match(salesOrdersRoute, /resolveRequestedBranchId/);
  assert.match(salesOrdersRoute, /isWarehouseAvailableToContext/);
  assert.match(salesOrdersRoute, /Selected warehouse does not belong to the selected branch/);
  assert.match(invoicePaymentRoute, /branch_id/);
  assert.match(invoicePaymentRoute, /organization_id/);
  assert.match(grnCreateRoute, /isWarehouseAvailableToContext/);
  assert.match(grnApproveRoute, /isWarehouseAvailableToContext/);
  assert.match(goodsReceivingStatusRoute, /organization_id/);
  assert.match(dashboardShortcuts, /label: 'New Sale'/);
  assert.match(dashboardShortcuts, /label: 'Receive Stock Transfer'/);
  assert.match(dashboardShortcuts, /label: 'Chart of Accounts'/);
  assert.match(dashboardShortcuts, /label: 'Users'/);
  assert.match(dashboardShortcuts, /shortcut\.personas\.includes\(persona\)/);
  assert.match(dashboardOverview, /resolveDashboardShortcuts/);
  assert.match(dashboardOverview, /Operational shortcuts/);
  assert.match(sidebar, /'Dashboard', 'Operations', 'Finance', 'Reports', 'Administration'/);
  assert.match(sidebar, /aria-current=\{isActive \? 'page' : undefined\}/);
});

test('branch expense route validates finance setup and falls back across legacy branch expense columns', () => {
  const branchExpenseRoute = fs.readFileSync('src/app/api/branch-operations/[branchId]/expenses/route.ts', 'utf8');

  assert.match(branchExpenseRoute, /resolveFinanceCostCentreCode/);
  assert.match(branchExpenseRoute, /resolveFinancePostingAccount/);
  assert.match(branchExpenseRoute, /findOpenFiscalPeriod/);
  assert.match(branchExpenseRoute, /The branch cost centre has not been configured\./);
  assert.match(branchExpenseRoute, /No payment account is linked to this branch\./);
  assert.match(branchExpenseRoute, /The selected financial period is closed\./);
  assert.match(branchExpenseRoute, /isMissingColumnError/);
  assert.match(branchExpenseRoute, /receipt_url/);
  assert.match(branchExpenseRoute, /shift_close_id/);
  assert.match(branchExpenseRoute, /apiServerError/);
});

test('branch sale route aligns header insert with live legacy schema', () => {
  const branchSaleRoute = fs.readFileSync('src/app/api/branch-operations/[branchId]/sales/route.ts', 'utf8');

  assert.match(branchSaleRoute, /const saleInsert = \{/);
  assert.match(branchSaleRoute, /item_id: primaryLine\.itemId/);
  assert.match(branchSaleRoute, /quantity: primaryLine\.quantity/);
  assert.match(branchSaleRoute, /unit_price: primaryLine\.unitPrice/);
  assert.match(branchSaleRoute, /payment_status: body\.paymentStatus/);
  assert.match(branchSaleRoute, /shift_close_id: openShift\.id/);
  assert.match(branchSaleRoute, /sale_date: saleDateIso/);
  assert.match(branchSaleRoute, /posted_by: ctx\.userId/);
  assert.match(branchSaleRoute, /served_by: ctx\.userId/);
  assert.doesNotMatch(branchSaleRoute, /customer_id:\s*body\.customerId/);
  assert.match(branchSaleRoute, /organization_id: ctx\.organizationId/);
  assert.match(branchSaleRoute, /posting_status: 'POSTED'/);
  assert.match(branchSaleRoute, /running_balance: nextQuantityOnHand/);
  assert.match(branchSaleRoute, /total_value: lineInventoryCost/);
  assert.match(branchSaleRoute, /transaction_date: saleDateIso/);
});

test('shared dashboard and form layout primitives use the widened navigation and roomier form spacing', () => {
  const shell = fs.readFileSync('src/components/dashboard/dashboard-shell.tsx', 'utf8');
  const sidebar = fs.readFileSync('src/components/dashboard/sidebar.tsx', 'utf8');
  const drawer = fs.readFileSync('src/components/ui-library/form-drawer.tsx', 'utf8');
  const table = fs.readFileSync('src/components/ui-library/data-table.tsx', 'utf8');
  const globals = fs.readFileSync('src/app/globals.css', 'utf8');

  assert.match(shell, /grid-cols-\[248px_1fr\]/);
  assert.match(shell, /xl:grid-cols-\[256px_1fr\]/);
  assert.match(shell, /overflow-x-clip/);
  assert.match(shell, /w-\[248px\] max-w-\[82vw\]/);
  assert.match(sidebar, /gap-3 rounded-xl px-3 py-2\.5 text-sm leading-5/);
  assert.match(drawer, /max-w-4xl/);
  assert.match(drawer, /rounded-t-3xl/);
  assert.match(table, /px-5 py-4 align-top text-sm leading-6/);
  assert.match(globals, /\.surface-card \{\s*@apply rounded-xl border p-5 shadow-sm;/);
  assert.match(globals, /\.surface-input \{\s*@apply h-11 w-full rounded-xl border px-4 text-sm leading-5/);
  assert.match(globals, /min-height: 2\.5rem;/);
  assert.match(globals, /white-space: nowrap;/);
});

test('controlled operational reset script requires explicit confirmation and organization scoping', () => {
  const resetScript = fs.readFileSync('scripts/reset-operational-data.mjs', 'utf8');
  const packageJson = fs.readFileSync('package.json', 'utf8');

  assert.match(resetScript, /RESET ICECREAM ERP OPERATIONAL DATA/);
  assert.match(resetScript, /--organization-id=/);
  assert.match(resetScript, /--dry-run/);
  assert.match(resetScript, /journal_entries/);
  assert.match(resetScript, /cash_transactions/);
  assert.match(packageJson, /"reset:operational-data": "node scripts\/reset-operational-data\.mjs"/);
});
