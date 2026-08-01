import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildEmptyFinanceDashboardData,
  calculateDetailedProductionCostSummary,
  buildFinanceSourceReference,
  buildPayablesRows,
  buildReceivablesRows,
  calculateBranchCostSummary,
  calculateBudgetVariance,
  calculateInventoryValuation,
  calculateJournalBalance,
  isPostedJournalStatus,
  parseFinanceSourceReference,
  calculatePayableBalance,
  calculatePettyCashBalance,
  calculateProductionCostSummary,
  calculateReceivableBalance,
  calculateStraightLineDepreciation,
  normalizeCashAccount,
  normalizeFinanceCollectionResponse,
  normalizeFinanceTransactionRow,
  normalizePettyCashRequest,
  normalizeTrialBalanceRow,
  resolveCashAccountBalance,
  resolveFinanceTransactionDate,
  resolveFinanceTransactionDescription,
  resolveFinanceTransactionReference,
  resolveLedgerCredit,
  resolveLedgerDebit,
  resolveFinanceSectionResult,
  resolvePettyCashAmount,
  summarizeBalanceSheetFromLedger,
  summarizeBranchProfitAndLossFromLedger,
  summarizeCostCentreProfitAndLossFromLedger,
  summarizeDetailedTrialBalance,
  summarizeCashFlowFromLedger,
  summarizeProfitAndLossFromLedger,
  summarizeProfitAndLoss,
  summarizeTrialBalance,
  validateBankAccountImportRows,
  validateBudgetImportRows,
  validateChartOfAccountImportRows,
  validateFixedAssetImportRows,
  validateJournalLines,
  validateOpeningBalanceImportRows,
} from '../src/lib/finance';
import {
  buildBranchCostCentreDefinitions,
  buildFinanceAccountTree,
  canFinanceAccountReceivePosting,
  countHeaderAccounts,
  countPostingAccounts,
  DEFAULT_FINANCE_TRANSACTION_MAPPINGS,
  OFFICIAL_CHART_OF_ACCOUNTS,
  validateOpeningBalanceDraftLines,
} from '../src/lib/finance-foundation';
import {
  collapseFinancePostingLines,
  resolveInventoryPostingMappingKey,
  resolveProductionCostCentrePriority,
} from '../src/lib/finance-integration';

test('budget and costing helpers derive expected finance metrics', () => {
  const budget = calculateBudgetVariance(1000, 1200);
  const depreciation = calculateStraightLineDepreciation(12000, 0, 5);
  const production = calculateProductionCostSummary(500, 200, 100, 100);
  const branch = calculateBranchCostSummary(2000, 900, 300, 100);

  assert.equal(budget.variance, 200);
  assert.equal(budget.variancePct, 20);
  assert.equal(depreciation.annualDepreciation, 2400);
  assert.equal(production.costPerUnit, 8);
  assert.equal(branch.grossProfit, 1000);
  assert.equal(branch.netProfit, 700);
  assert.equal(calculateReceivableBalance(1000, 250, 50), 700);
  assert.equal(calculatePayableBalance(900, 200, 100), 600);
  assert.equal(calculateInventoryValuation(50, 2.5), 125);
  assert.equal(calculatePettyCashBalance(300, 120), 180);
});

test('detailed production costing includes wastage and variance in unit cost', () => {
  const summary = calculateDetailedProductionCostSummary({
    acceptedFinishedQuantity: 10,
    labourCost: 20,
    overheadCost: 10,
    packagingCost: 15,
    rawMaterialCost: 55,
    varianceCost: 5,
    wastageCost: 5,
  });

  assert.equal(summary.totalProductionCost, 110);
  assert.equal(summary.costPerAcceptedUnit, 11);
});

test('journal helpers summarize balances and profit figures', () => {
  const lines = [
    { accountCode: '4000', accountName: 'Sales', creditAmount: 500, debitAmount: 0 },
    { accountCode: '1100', accountName: 'Receivables', creditAmount: 0, debitAmount: 500 },
  ];

  const balance = calculateJournalBalance(lines);
  const summary = summarizeTrialBalance(lines);
  const pnl = summarizeProfitAndLoss(5000, 1900, 1200);

  assert.equal(validateJournalLines(lines), null);
  assert.equal(balance.isBalanced, true);
  assert.equal(summary.rows.length, 2);
  assert.equal(summary.totals.debit, 500);
  assert.equal(summary.totals.credit, 500);
  assert.equal(pnl.grossProfit, 3100);
  assert.equal(pnl.netProfit, 1900);
});

test('finance source references and posted statuses normalize safely', () => {
  const reference = buildFinanceSourceReference('sales', 'invoice', 'abc-123');

  assert.equal(reference, 'sales:invoice:abc-123');
  assert.deepEqual(parseFinanceSourceReference(reference), {
    sourceModule: 'sales',
    sourceDocumentType: 'invoice',
    sourceDocumentId: 'abc-123',
  });
  assert.equal(parseFinanceSourceReference('bad-reference'), null);
  assert.equal(isPostedJournalStatus('approved'), true);
  assert.equal(isPostedJournalStatus('posted'), true);
  assert.equal(isPostedJournalStatus('draft'), false);
});

test('ledger summaries derive balance sheet, pnl, and cash flow totals', () => {
  const ledgerLines = [
    { accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'ASSET', debitAmount: 115, creditAmount: 0 },
    { accountCode: '4000', accountName: 'Sales Revenue', accountType: 'REVENUE', debitAmount: 0, creditAmount: 115 },
    { accountCode: '5000', accountName: 'Cost of Goods Sold', accountType: 'EXPENSE', debitAmount: 40, creditAmount: 0 },
    { accountCode: '1200', accountName: 'Inventory', accountType: 'ASSET', debitAmount: 0, creditAmount: 40 },
    { accountCode: '1010', accountName: 'Cash on Hand', accountType: 'ASSET', debitAmount: 30, creditAmount: 5 },
    { accountCode: '6100', accountName: 'Operating Expenses', accountType: 'EXPENSE', debitAmount: 5, creditAmount: 0 },
  ];

  const balanceSheet = summarizeBalanceSheetFromLedger(ledgerLines);
  const pnl = summarizeProfitAndLossFromLedger(ledgerLines);
  const cashFlow = summarizeCashFlowFromLedger(ledgerLines);

  assert.equal(balanceSheet.assets, 100);
  assert.equal(balanceSheet.liabilities, 0);
  assert.equal(balanceSheet.equity, 0);
  assert.equal(pnl.revenue, 115);
  assert.equal(pnl.costOfGoodsSold, 40);
  assert.equal(pnl.operatingExpenses, 5);
  assert.equal(pnl.grossProfit, 75);
  assert.equal(pnl.netProfit, 70);
  assert.equal(cashFlow.cashIn, 30);
  assert.equal(cashFlow.cashOut, 5);
  assert.equal(cashFlow.netCashFlow, 25);
});

test('detailed trial balance, branch pnl, and cost centre pnl summarize filtered ledger lines', () => {
  const detailedTrialBalance = summarizeDetailedTrialBalance({
    openingLines: [
      { accountCode: '1140', accountName: 'Accounts Receivable', debitAmount: 100, creditAmount: 0 },
    ],
    periodLines: [
      { accountCode: '4000', accountName: 'Sales Revenue', debitAmount: 0, creditAmount: 150 },
      { accountCode: '1140', accountName: 'Accounts Receivable', debitAmount: 150, creditAmount: 0 },
    ],
  });
  const branchPnl = summarizeBranchProfitAndLossFromLedger([
    { accountCode: '4000', accountName: 'Sales', accountType: 'REVENUE', branchId: 'branch-1', debitAmount: 0, creditAmount: 150 },
    { accountCode: '5110', accountName: 'Cost of Goods Sold', accountType: 'EXPENSE', branchId: 'branch-1', debitAmount: 60, creditAmount: 0 },
    { accountCode: '6100', accountName: 'Operating Expenses', accountType: 'EXPENSE', branchId: 'branch-1', debitAmount: 20, creditAmount: 0 },
  ]);
  const costCentrePnl = summarizeCostCentreProfitAndLossFromLedger([
    { accountCode: '4000', accountName: 'Sales', accountType: 'REVENUE', costCenterCode: 'SALES', debitAmount: 0, creditAmount: 150 },
    { accountCode: '5110', accountName: 'Cost of Goods Sold', accountType: 'EXPENSE', costCenterCode: 'SALES', debitAmount: 60, creditAmount: 0 },
  ]);

  assert.equal(detailedTrialBalance.rows[0]?.closingDebit, 250);
  assert.equal(detailedTrialBalance.totals.periodCredit, 150);
  assert.equal(branchPnl[0]?.grossProfit, 90);
  assert.equal(branchPnl[0]?.netProfit, 70);
  assert.equal(costCentrePnl[0]?.netResult, 90);
});

test('finance integration helpers collapse lines and resolve inventory mappings', () => {
  const collapsed = collapseFinancePostingLines([
    { accountId: 'acct-1', branchId: 'branch-1', costCenterCode: 'STORES', debitAmount: 10, creditAmount: 0, description: 'same' },
    { accountId: 'acct-1', branchId: 'branch-1', costCenterCode: 'STORES', debitAmount: 5, creditAmount: 0, description: 'same' },
  ]);

  assert.equal(collapsed[0]?.debitAmount, 15);
  assert.equal(resolveInventoryPostingMappingKey({ itemCategoryName: 'Packaging', itemType: 'RAW_MATERIAL' }), 'PACKAGING_INVENTORY');
  assert.equal(resolveInventoryPostingMappingKey({ itemCategoryName: 'Chocolate', itemType: 'RAW_MATERIAL' }), 'RAW_MATERIAL_INVENTORY');
  assert.deepEqual(resolveProductionCostCentrePriority('night shift'), ['PRODUCTION_NIGHT', 'FACTORY']);
});

test('receivables and payables builders normalize report rows', () => {
  const receivables = buildReceivablesRows([
    { balance_due: 50, customer_name: 'Eastgate', due_date: '2026-06-12', invoice_number: 'INV-1', status: 'OVERDUE', total: 100 },
  ]);
  const payables = buildPayablesRows([
    { amount_due: 80, due_date: '2026-06-20', invoice_number: 'SUP-1', status: 'OPEN', supplier_name: 'Cold Chain', total_amount: 120 },
  ]);

  assert.equal(receivables[0]?.customerName, 'Eastgate');
  assert.equal(receivables[0]?.balanceDue, 50);
  assert.equal(payables[0]?.supplierName, 'Cold Chain');
  assert.equal(payables[0]?.balance, 80);
});

test('petty cash helpers fall back across compatible amount columns safely', () => {
  assert.equal(resolvePettyCashAmount({ amount_requested: 120 }), 120);
  assert.equal(resolvePettyCashAmount({ requested_amount: 95 }), 95);
  assert.equal(resolvePettyCashAmount({ amount: 45 }), 45);
  assert.equal(resolvePettyCashAmount({ total_amount: 33 }), 33);
  assert.equal(resolvePettyCashAmount({ estimated_amount: 12 }), 12);
  assert.equal(resolvePettyCashAmount({}), 0);
});

test('normalizePettyCashRequest returns canonical and legacy petty cash fields', () => {
  const normalized = normalizePettyCashRequest({
    amount_paid: 5,
    approved_amount: 10,
    branch_id: 'branch-1',
    created_at: '2026-07-17T09:00:00.000Z',
    id: 'pc-1',
    purpose: 'Office supplies',
    request_date: '2026-07-17',
    request_number: 'PCR-00001',
    requested_amount: 25,
    requested_by: 'user-1',
    status: 'approved',
  });

  assert.equal(normalized.amountRequested, 25);
  assert.equal(normalized.amount_requested, 25);
  assert.equal(normalized.amountApproved, 10);
  assert.equal(normalized.amountPaid, 5);
  assert.equal(normalized.requestNumber, 'PCR-00001');
  assert.equal(normalized.request_number, 'PCR-00001');
  assert.equal(normalized.requestDate, '2026-07-17');
  assert.equal(normalized.requestedBy, 'user-1');
  assert.equal(normalized.branchId, 'branch-1');
  assert.equal(normalized.status, 'APPROVED');
});

test('cash account helpers fall back across compatible balance columns safely', () => {
  assert.equal(resolveCashAccountBalance({ current_balance: 120 }), 120);
  assert.equal(resolveCashAccountBalance({ balance: 95 }), 95);
  assert.equal(resolveCashAccountBalance({ opening_balance: 45 }), 45);
  assert.equal(resolveCashAccountBalance({ amount: 12 }), 12);
  assert.equal(resolveCashAccountBalance({}), 0);
});

test('normalizeCashAccount returns canonical cash account fields from legacy shapes', () => {
  const normalized = normalizeCashAccount({
    account_name: 'Main Cash',
    account_number: 'CASH-001',
    balance: 50,
    branch_id: 'branch-1',
    branches: { name: 'Harare' },
    created_at: '2026-07-17T09:00:00.000Z',
    id: 'cash-1',
    is_active: true,
  });

  assert.equal(normalized.id, 'cash-1');
  assert.equal(normalized.name, 'Main Cash');
  assert.equal(normalized.accountName, 'Main Cash');
  assert.equal(normalized.accountNumber, 'CASH-001');
  assert.equal(normalized.balance, 50);
  assert.equal(normalized.currentBalance, 50);
  assert.equal(normalized.branchId, 'branch-1');
  assert.equal(normalized.branchName, 'Harare');
  assert.equal(normalized.status, 'ACTIVE');
  assert.equal(normalized.isActive, true);
});

test('normalizeFinanceCollectionResponse handles array and wrapped finance payload shapes', () => {
  assert.deepEqual(normalizeFinanceCollectionResponse([{ id: 1 }]), [{ id: 1 }]);
  assert.deepEqual(normalizeFinanceCollectionResponse({ data: [{ id: 2 }] }), [{ id: 2 }]);
  assert.deepEqual(normalizeFinanceCollectionResponse({ success: true, data: [{ id: 3 }] }), [{ id: 3 }]);
  assert.deepEqual(normalizeFinanceCollectionResponse({ success: true, data: null }), []);
  assert.deepEqual(normalizeFinanceCollectionResponse(null), []);
});

test('finance transaction helpers normalize date, reference, description, and debit-credit aliases safely', () => {
  assert.equal(resolveFinanceTransactionDate({ transaction_date: '2026-07-17T08:30:00Z' }), '2026-07-17');
  assert.equal(resolveFinanceTransactionDate({ entry_date: '2026-07-16' }), '2026-07-16');
  assert.equal(resolveFinanceTransactionReference({ reference_number: 'TXN-1' }), 'TXN-1');
  assert.equal(resolveFinanceTransactionReference({ document_number: 'DOC-2' }), 'DOC-2');
  assert.equal(resolveFinanceTransactionDescription({ narration: 'Bank deposit' }), 'Bank deposit');
  assert.equal(resolveFinanceTransactionDescription({}), 'Finance transaction');

  const normalized = normalizeFinanceTransactionRow({
    code: '1000',
    name: 'Main Cash',
    debit: 55,
    entry_date: '2026-07-17',
    id: 'txn-1',
    narration: 'Opening balance',
    reference: 'OPEN-1',
    status: 'APPROVED',
  });

  assert.equal(normalized.accountCode, '1000');
  assert.equal(normalized.accountName, 'Main Cash');
  assert.equal(normalized.debit, 55);
  assert.equal(normalized.credit, 0);
  assert.equal(normalized.amount, 55);
  assert.equal(normalized.reference, 'OPEN-1');
  assert.equal(normalized.description, 'Opening balance');
  assert.equal(normalized.transactionDate, '2026-07-17');
  assert.equal(normalized.status, 'APPROVED');
});

test('trial balance helpers resolve debit and credit aliases safely', () => {
  assert.equal(resolveLedgerDebit({ debit_amount: 20 }), 20);
  assert.equal(resolveLedgerDebit({ debit: 18 }), 18);
  assert.equal(resolveLedgerDebit({ amount: 11, debit_credit: 'DEBIT' }), 11);
  assert.equal(resolveLedgerDebit({ amount: 11, side: 'CR' }), 0);

  assert.equal(resolveLedgerCredit({ credit_amount: 15 }), 15);
  assert.equal(resolveLedgerCredit({ credit: 12 }), 12);
  assert.equal(resolveLedgerCredit({ amount: 9, debit_credit: 'CREDIT' }), 9);
  assert.equal(resolveLedgerCredit({ amount: 9, side: 'DR' }), 0);
});

test('normalizeTrialBalanceRow falls back across account aliases and derives balance', () => {
  const normalized = normalizeTrialBalanceRow({
    credit_value: 25,
    debit_value: 40,
    gl_code: '4000',
    id: 'acct-1',
    title: 'Sales Revenue',
    category: 'revenue',
  });

  assert.equal(normalized.accountId, 'acct-1');
  assert.equal(normalized.accountCode, '4000');
  assert.equal(normalized.accountName, 'Sales Revenue');
  assert.equal(normalized.accountType, 'REVENUE');
  assert.equal(normalized.debit, 40);
  assert.equal(normalized.credit, 25);
  assert.equal(normalized.balance, 15);
});

test('buildEmptyFinanceDashboardData returns zero-safe dashboard defaults', () => {
  const data = buildEmptyFinanceDashboardData();

  assert.equal(data.stats.revenue, 0);
  assert.equal(data.stats.pettyCashBalance, 0);
  assert.equal(data.overdueInvoices.length, 0);
  assert.equal(data.recentEntries.length, 0);
  assert.equal(data.charts.cashflowLast7Days.length, 0);
});

test('resolveFinanceSectionResult keeps fulfilled values and falls back with warning on failure', async () => {
  const ok = await Promise.allSettled([Promise.resolve([1, 2, 3])]);
  const failed = await Promise.allSettled([Promise.reject(new Error('missing column'))]);

  const fulfilled = resolveFinanceSectionResult(ok[0]!, [] as number[], 'Some section failed.');
  const rejected = resolveFinanceSectionResult(failed[0]!, [] as number[], 'Some section failed.');

  assert.deepEqual(fulfilled.value, [1, 2, 3]);
  assert.equal(fulfilled.warning, null);
  assert.deepEqual(rejected.value, []);
  assert.equal(rejected.warning, 'Some section failed.');
});

test('finance import validators return row level errors', () => {
  const budgets = validateBudgetImportRows([
    { annualTotal: -1, budgetCode: '', budgetName: '', budgetYear: 0 },
    { annualTotal: 5000, budgetCode: 'BGT-1', budgetName: 'Ops', budgetYear: 2026 },
  ]);
  const assets = validateFixedAssetImportRows([
    { assetCode: '', name: '', purchaseCost: -1, usefulLifeYears: 0 },
    { assetCode: 'FA-1', name: 'Freezer', purchaseCost: 1000, usefulLifeYears: 5 },
  ]);
  const bankAccounts = validateBankAccountImportRows([
    { accountCode: '', accountName: '', accountNumber: '', bankName: '' },
    { accountCode: '1010', accountName: 'CBZ Main', accountNumber: '0001', bankName: 'CBZ' },
  ]);
  const accounts = validateChartOfAccountImportRows([
    { accountCode: '', accountName: '', accountType: 'Invalid' },
    { accountCode: '4000', accountName: 'Sales', accountType: 'Revenue' },
  ]);
  const openingBalances = validateOpeningBalanceImportRows([
    { accountCode: '', amount: -1, balanceType: 'OTHER' },
    { accountCode: '1100', amount: 100, balanceType: 'DEBIT' },
  ]);

  assert.equal(budgets.errors.length, 4);
  assert.equal(budgets.rows.length, 1);
  assert.equal(assets.errors.length, 4);
  assert.equal(assets.rows.length, 1);
  assert.equal(bankAccounts.errors.length, 4);
  assert.equal(bankAccounts.rows.length, 1);
  assert.equal(accounts.errors.length, 3);
  assert.equal(accounts.rows.length, 1);
  assert.equal(openingBalances.errors.length, 3);
  assert.equal(openingBalances.rows.length, 1);
});

test('official chart definitions keep unique codes and posting-header counts', () => {
  const codes = OFFICIAL_CHART_OF_ACCOUNTS.map((account) => account.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(countHeaderAccounts() > 0, true);
  assert.equal(countPostingAccounts() > countHeaderAccounts(), true);
  assert.equal(DEFAULT_FINANCE_TRANSACTION_MAPPINGS.some((mapping) => mapping.key === 'DEFAULT_SALES_REVENUE' && mapping.fallbackAccountCode === '4120'), true);
  assert.equal(DEFAULT_FINANCE_TRANSACTION_MAPPINGS.some((mapping) => mapping.key === 'COST_OF_GOODS_SOLD' && mapping.fallbackAccountCode === '5110'), true);
});

test('chart hierarchy builder preserves parent-child structure', () => {
  const rows = [
    {
      id: '1',
      organization_id: 'org-1',
      code: '1000',
      name: 'Assets',
      type: 'HEADER',
      is_active: true,
      allow_posting: false,
      balance: 0,
      parent_id: null,
    },
    {
      id: '2',
      organization_id: 'org-1',
      code: '1100',
      name: 'Current Assets',
      type: 'HEADER',
      is_active: true,
      allow_posting: false,
      balance: 0,
      parent_id: '1',
    },
    {
      id: '3',
      organization_id: 'org-1',
      code: '1110',
      name: 'Cash on Hand',
      type: 'ASSET',
      is_active: true,
      allow_posting: true,
      balance: 0,
      parent_id: '2',
    },
  ].map((row) => ({
    accountCode: String(row.code),
    accountName: String(row.name),
    accountType: row.type as 'HEADER' | 'ASSET',
    allowPosting: Boolean(row.allow_posting),
    currentBalance: Number(row.balance),
    description: null,
    id: String(row.id),
    isActive: true,
    normalBalance: row.type === 'ASSET' ? ('DEBIT' as const) : null,
    organizationId: 'org-1',
    parentAccountCode: null,
    parentAccountId: row.parent_id ? String(row.parent_id) : null,
  }));

  const tree = buildFinanceAccountTree(rows);
  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.children[0]?.accountCode, '1100');
  assert.equal(tree[0]?.children[0]?.children[0]?.accountCode, '1110');
});

test('posting validation blocks header and inactive accounts', () => {
  assert.equal(
    canFinanceAccountReceivePosting({
      accountCode: '1000',
      accountType: 'HEADER',
      allowPosting: false,
      isActive: true,
    }),
    '1000 is a header account and cannot receive postings.',
  );
  assert.equal(
    canFinanceAccountReceivePosting({
      accountCode: '1110',
      accountType: 'ASSET',
      allowPosting: true,
      isActive: false,
    }),
    '1110 is inactive.',
  );
  assert.equal(
    canFinanceAccountReceivePosting({
      accountCode: '1140',
      accountType: 'ASSET',
      allowPosting: true,
      isActive: true,
    }),
    null,
  );
});

test('branch cost centre definitions synchronize by branch code and remain branch-specific', () => {
  const definitions = buildBranchCostCentreDefinitions([
    { code: 'BTA', id: 'branch-1', name: 'Borrowdale' },
    { code: null, id: 'branch-2', name: 'Eastgate Mall' },
  ]);

  assert.equal(definitions[0]?.code, 'BRANCH_BTA');
  assert.equal(definitions[1]?.code, 'BRANCH_EASTGATE_MALL');
  assert.equal(definitions.every((definition) => definition.parentCode === 'SALES'), true);
});

test('opening balance draft validation requires a balanced multi-line batch', () => {
  assert.equal(
    validateOpeningBalanceDraftLines([
      { accountId: '1', debitAmount: 100, creditAmount: 0 },
      { accountId: '2', debitAmount: 0, creditAmount: 90 },
    ]),
    'Opening balances must balance before posting.',
  );
  assert.equal(
    validateOpeningBalanceDraftLines([
      { accountId: '1', debitAmount: 100, creditAmount: 0 },
      { accountId: '2', debitAmount: 0, creditAmount: 100 },
    ]),
    null,
  );
});

test('phase 1d migration and finance routes stay schema-local and enforce posting controls', () => {
  const root = process.cwd();
  const migration = readFileSync(join(root, 'migrations', '043_finance_chart_of_accounts_foundation.sql'), 'utf8');
  const rollback = readFileSync(join(root, 'migrations', 'manual', '043_finance_chart_of_accounts_foundation.rollback.sql'), 'utf8');
  const verify = readFileSync(join(root, 'migrations', 'manual', '043_finance_chart_of_accounts_foundation.verify.sql'), 'utf8');
  const chartRoute = readFileSync(join(root, 'src', 'app', 'api', 'finance', 'chart-of-accounts', 'route.ts'), 'utf8');
  const chartDetailRoute = readFileSync(join(root, 'src', 'app', 'api', 'finance', 'chart-of-accounts', '[id]', 'route.ts'), 'utf8');
  const journalRoute = readFileSync(join(root, 'src', 'app', 'api', 'finance', 'journal-entries', 'route.ts'), 'utf8');
  const openingBalancesRoute = readFileSync(join(root, 'src', 'app', 'api', 'finance', 'opening-balances', 'route.ts'), 'utf8');
  const openingBalancesPostRoute = readFileSync(join(root, 'src', 'app', 'api', 'finance', 'opening-balances', 'post', 'route.ts'), 'utf8');
  const financePage = readFileSync(join(root, 'src', 'app', '(dashboard)', 'finance', 'page.tsx'), 'utf8');
  const chartPage = readFileSync(join(root, 'src', 'app', '(dashboard)', 'finance', 'chart-of-accounts', 'page.tsx'), 'utf8');

  assert.match(migration, /create table if not exists icecream_erp\.cost_centres/);
  assert.match(migration, /create table if not exists icecream_erp\.erp_account_mappings/);
  assert.match(migration, /idx_accounts_org_code_unique/);
  assert.match(migration, /on conflict \(organization_id, code\) do update/);
  assert.doesNotMatch(migration, /alter\s+role|authenticator|pgrst\.db_schemas|search_path\s+to/i);
  assert.doesNotMatch(migration.replace(/public\.digest/g, ''), /public\./);
  assert.match(rollback, /drop table if exists icecream_erp\.erp_account_mappings/);
  assert.match(verify, /total_accounts/);
  assert.match(chartRoute, /view === 'tree'/);
  assert.match(chartRoute, /accountType/);
  assert.match(chartDetailRoute, /ACCOUNT_DELETED/);
  assert.match(journalRoute, /canFinanceAccountReceivePosting/);
  assert.match(openingBalancesRoute, /createFinanceOpeningBalanceDraft/);
  assert.match(openingBalancesPostRoute, /postFinanceOpeningBalanceDrafts/);
  assert.match(financePage, /Opening Balances/);
  assert.match(chartPage, /Account Tree/);
});
