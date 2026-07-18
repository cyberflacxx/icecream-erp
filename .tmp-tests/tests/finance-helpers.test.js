"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const finance_1 = require("../src/lib/finance");
(0, node_test_1.default)('budget and costing helpers derive expected finance metrics', () => {
    const budget = (0, finance_1.calculateBudgetVariance)(1000, 1200);
    const depreciation = (0, finance_1.calculateStraightLineDepreciation)(12000, 0, 5);
    const production = (0, finance_1.calculateProductionCostSummary)(500, 200, 100, 100);
    const branch = (0, finance_1.calculateBranchCostSummary)(2000, 900, 300, 100);
    strict_1.default.equal(budget.variance, 200);
    strict_1.default.equal(budget.variancePct, 20);
    strict_1.default.equal(depreciation.annualDepreciation, 2400);
    strict_1.default.equal(production.costPerUnit, 8);
    strict_1.default.equal(branch.grossProfit, 1000);
    strict_1.default.equal(branch.netProfit, 700);
    strict_1.default.equal((0, finance_1.calculateReceivableBalance)(1000, 250, 50), 700);
    strict_1.default.equal((0, finance_1.calculatePayableBalance)(900, 200, 100), 600);
    strict_1.default.equal((0, finance_1.calculateInventoryValuation)(50, 2.5), 125);
    strict_1.default.equal((0, finance_1.calculatePettyCashBalance)(300, 120), 180);
});
(0, node_test_1.default)('journal helpers summarize balances and profit figures', () => {
    const lines = [
        { accountCode: '4000', accountName: 'Sales', creditAmount: 500, debitAmount: 0 },
        { accountCode: '1100', accountName: 'Receivables', creditAmount: 0, debitAmount: 500 },
    ];
    const balance = (0, finance_1.calculateJournalBalance)(lines);
    const summary = (0, finance_1.summarizeTrialBalance)(lines);
    const pnl = (0, finance_1.summarizeProfitAndLoss)(5000, 1900, 1200);
    strict_1.default.equal((0, finance_1.validateJournalLines)(lines), null);
    strict_1.default.equal(balance.isBalanced, true);
    strict_1.default.equal(summary.rows.length, 2);
    strict_1.default.equal(summary.totals.debit, 500);
    strict_1.default.equal(summary.totals.credit, 500);
    strict_1.default.equal(pnl.grossProfit, 3100);
    strict_1.default.equal(pnl.netProfit, 1900);
});
(0, node_test_1.default)('finance source references and posted statuses normalize safely', () => {
    const reference = (0, finance_1.buildFinanceSourceReference)('sales', 'invoice', 'abc-123');
    strict_1.default.equal(reference, 'sales:invoice:abc-123');
    strict_1.default.deepEqual((0, finance_1.parseFinanceSourceReference)(reference), {
        sourceModule: 'sales',
        sourceDocumentType: 'invoice',
        sourceDocumentId: 'abc-123',
    });
    strict_1.default.equal((0, finance_1.parseFinanceSourceReference)('bad-reference'), null);
    strict_1.default.equal((0, finance_1.isPostedJournalStatus)('approved'), true);
    strict_1.default.equal((0, finance_1.isPostedJournalStatus)('posted'), true);
    strict_1.default.equal((0, finance_1.isPostedJournalStatus)('draft'), false);
});
(0, node_test_1.default)('ledger summaries derive balance sheet, pnl, and cash flow totals', () => {
    const ledgerLines = [
        { accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'ASSET', debitAmount: 115, creditAmount: 0 },
        { accountCode: '4000', accountName: 'Sales Revenue', accountType: 'REVENUE', debitAmount: 0, creditAmount: 115 },
        { accountCode: '5000', accountName: 'Cost of Goods Sold', accountType: 'EXPENSE', debitAmount: 40, creditAmount: 0 },
        { accountCode: '1200', accountName: 'Inventory', accountType: 'ASSET', debitAmount: 0, creditAmount: 40 },
        { accountCode: '1010', accountName: 'Cash on Hand', accountType: 'ASSET', debitAmount: 30, creditAmount: 5 },
        { accountCode: '6100', accountName: 'Operating Expenses', accountType: 'EXPENSE', debitAmount: 5, creditAmount: 0 },
    ];
    const balanceSheet = (0, finance_1.summarizeBalanceSheetFromLedger)(ledgerLines);
    const pnl = (0, finance_1.summarizeProfitAndLossFromLedger)(ledgerLines);
    const cashFlow = (0, finance_1.summarizeCashFlowFromLedger)(ledgerLines);
    strict_1.default.equal(balanceSheet.assets, 100);
    strict_1.default.equal(balanceSheet.liabilities, 0);
    strict_1.default.equal(balanceSheet.equity, 0);
    strict_1.default.equal(pnl.revenue, 115);
    strict_1.default.equal(pnl.costOfGoodsSold, 40);
    strict_1.default.equal(pnl.operatingExpenses, 5);
    strict_1.default.equal(pnl.grossProfit, 75);
    strict_1.default.equal(pnl.netProfit, 70);
    strict_1.default.equal(cashFlow.cashIn, 30);
    strict_1.default.equal(cashFlow.cashOut, 5);
    strict_1.default.equal(cashFlow.netCashFlow, 25);
});
(0, node_test_1.default)('receivables and payables builders normalize report rows', () => {
    const receivables = (0, finance_1.buildReceivablesRows)([
        { balance_due: 50, customer_name: 'Eastgate', due_date: '2026-06-12', invoice_number: 'INV-1', status: 'OVERDUE', total: 100 },
    ]);
    const payables = (0, finance_1.buildPayablesRows)([
        { amount_due: 80, due_date: '2026-06-20', invoice_number: 'SUP-1', status: 'OPEN', supplier_name: 'Cold Chain', total_amount: 120 },
    ]);
    strict_1.default.equal(receivables[0]?.customerName, 'Eastgate');
    strict_1.default.equal(receivables[0]?.balanceDue, 50);
    strict_1.default.equal(payables[0]?.supplierName, 'Cold Chain');
    strict_1.default.equal(payables[0]?.balance, 80);
});
(0, node_test_1.default)('petty cash helpers fall back across compatible amount columns safely', () => {
    strict_1.default.equal((0, finance_1.resolvePettyCashAmount)({ amount_requested: 120 }), 120);
    strict_1.default.equal((0, finance_1.resolvePettyCashAmount)({ requested_amount: 95 }), 95);
    strict_1.default.equal((0, finance_1.resolvePettyCashAmount)({ amount: 45 }), 45);
    strict_1.default.equal((0, finance_1.resolvePettyCashAmount)({ total_amount: 33 }), 33);
    strict_1.default.equal((0, finance_1.resolvePettyCashAmount)({ estimated_amount: 12 }), 12);
    strict_1.default.equal((0, finance_1.resolvePettyCashAmount)({}), 0);
});
(0, node_test_1.default)('normalizePettyCashRequest returns canonical and legacy petty cash fields', () => {
    const normalized = (0, finance_1.normalizePettyCashRequest)({
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
    strict_1.default.equal(normalized.amountRequested, 25);
    strict_1.default.equal(normalized.amount_requested, 25);
    strict_1.default.equal(normalized.amountApproved, 10);
    strict_1.default.equal(normalized.amountPaid, 5);
    strict_1.default.equal(normalized.requestNumber, 'PCR-00001');
    strict_1.default.equal(normalized.request_number, 'PCR-00001');
    strict_1.default.equal(normalized.requestDate, '2026-07-17');
    strict_1.default.equal(normalized.requestedBy, 'user-1');
    strict_1.default.equal(normalized.branchId, 'branch-1');
    strict_1.default.equal(normalized.status, 'APPROVED');
});
(0, node_test_1.default)('cash account helpers fall back across compatible balance columns safely', () => {
    strict_1.default.equal((0, finance_1.resolveCashAccountBalance)({ current_balance: 120 }), 120);
    strict_1.default.equal((0, finance_1.resolveCashAccountBalance)({ balance: 95 }), 95);
    strict_1.default.equal((0, finance_1.resolveCashAccountBalance)({ opening_balance: 45 }), 45);
    strict_1.default.equal((0, finance_1.resolveCashAccountBalance)({ amount: 12 }), 12);
    strict_1.default.equal((0, finance_1.resolveCashAccountBalance)({}), 0);
});
(0, node_test_1.default)('normalizeCashAccount returns canonical cash account fields from legacy shapes', () => {
    const normalized = (0, finance_1.normalizeCashAccount)({
        account_name: 'Main Cash',
        account_number: 'CASH-001',
        balance: 50,
        branch_id: 'branch-1',
        branches: { name: 'Harare' },
        created_at: '2026-07-17T09:00:00.000Z',
        id: 'cash-1',
        is_active: true,
    });
    strict_1.default.equal(normalized.id, 'cash-1');
    strict_1.default.equal(normalized.name, 'Main Cash');
    strict_1.default.equal(normalized.accountName, 'Main Cash');
    strict_1.default.equal(normalized.accountNumber, 'CASH-001');
    strict_1.default.equal(normalized.balance, 50);
    strict_1.default.equal(normalized.currentBalance, 50);
    strict_1.default.equal(normalized.branchId, 'branch-1');
    strict_1.default.equal(normalized.branchName, 'Harare');
    strict_1.default.equal(normalized.status, 'ACTIVE');
    strict_1.default.equal(normalized.isActive, true);
});
(0, node_test_1.default)('normalizeFinanceCollectionResponse handles array and wrapped finance payload shapes', () => {
    strict_1.default.deepEqual((0, finance_1.normalizeFinanceCollectionResponse)([{ id: 1 }]), [{ id: 1 }]);
    strict_1.default.deepEqual((0, finance_1.normalizeFinanceCollectionResponse)({ data: [{ id: 2 }] }), [{ id: 2 }]);
    strict_1.default.deepEqual((0, finance_1.normalizeFinanceCollectionResponse)({ success: true, data: [{ id: 3 }] }), [{ id: 3 }]);
    strict_1.default.deepEqual((0, finance_1.normalizeFinanceCollectionResponse)({ success: true, data: null }), []);
    strict_1.default.deepEqual((0, finance_1.normalizeFinanceCollectionResponse)(null), []);
});
(0, node_test_1.default)('finance transaction helpers normalize date, reference, description, and debit-credit aliases safely', () => {
    strict_1.default.equal((0, finance_1.resolveFinanceTransactionDate)({ transaction_date: '2026-07-17T08:30:00Z' }), '2026-07-17');
    strict_1.default.equal((0, finance_1.resolveFinanceTransactionDate)({ entry_date: '2026-07-16' }), '2026-07-16');
    strict_1.default.equal((0, finance_1.resolveFinanceTransactionReference)({ reference_number: 'TXN-1' }), 'TXN-1');
    strict_1.default.equal((0, finance_1.resolveFinanceTransactionReference)({ document_number: 'DOC-2' }), 'DOC-2');
    strict_1.default.equal((0, finance_1.resolveFinanceTransactionDescription)({ narration: 'Bank deposit' }), 'Bank deposit');
    strict_1.default.equal((0, finance_1.resolveFinanceTransactionDescription)({}), 'Finance transaction');
    const normalized = (0, finance_1.normalizeFinanceTransactionRow)({
        code: '1000',
        name: 'Main Cash',
        debit: 55,
        entry_date: '2026-07-17',
        id: 'txn-1',
        narration: 'Opening balance',
        reference: 'OPEN-1',
        status: 'APPROVED',
    });
    strict_1.default.equal(normalized.accountCode, '1000');
    strict_1.default.equal(normalized.accountName, 'Main Cash');
    strict_1.default.equal(normalized.debit, 55);
    strict_1.default.equal(normalized.credit, 0);
    strict_1.default.equal(normalized.amount, 55);
    strict_1.default.equal(normalized.reference, 'OPEN-1');
    strict_1.default.equal(normalized.description, 'Opening balance');
    strict_1.default.equal(normalized.transactionDate, '2026-07-17');
    strict_1.default.equal(normalized.status, 'APPROVED');
});
(0, node_test_1.default)('trial balance helpers resolve debit and credit aliases safely', () => {
    strict_1.default.equal((0, finance_1.resolveLedgerDebit)({ debit_amount: 20 }), 20);
    strict_1.default.equal((0, finance_1.resolveLedgerDebit)({ debit: 18 }), 18);
    strict_1.default.equal((0, finance_1.resolveLedgerDebit)({ amount: 11, debit_credit: 'DEBIT' }), 11);
    strict_1.default.equal((0, finance_1.resolveLedgerDebit)({ amount: 11, side: 'CR' }), 0);
    strict_1.default.equal((0, finance_1.resolveLedgerCredit)({ credit_amount: 15 }), 15);
    strict_1.default.equal((0, finance_1.resolveLedgerCredit)({ credit: 12 }), 12);
    strict_1.default.equal((0, finance_1.resolveLedgerCredit)({ amount: 9, debit_credit: 'CREDIT' }), 9);
    strict_1.default.equal((0, finance_1.resolveLedgerCredit)({ amount: 9, side: 'DR' }), 0);
});
(0, node_test_1.default)('normalizeTrialBalanceRow falls back across account aliases and derives balance', () => {
    const normalized = (0, finance_1.normalizeTrialBalanceRow)({
        credit_value: 25,
        debit_value: 40,
        gl_code: '4000',
        id: 'acct-1',
        title: 'Sales Revenue',
        category: 'revenue',
    });
    strict_1.default.equal(normalized.accountId, 'acct-1');
    strict_1.default.equal(normalized.accountCode, '4000');
    strict_1.default.equal(normalized.accountName, 'Sales Revenue');
    strict_1.default.equal(normalized.accountType, 'REVENUE');
    strict_1.default.equal(normalized.debit, 40);
    strict_1.default.equal(normalized.credit, 25);
    strict_1.default.equal(normalized.balance, 15);
});
(0, node_test_1.default)('buildEmptyFinanceDashboardData returns zero-safe dashboard defaults', () => {
    const data = (0, finance_1.buildEmptyFinanceDashboardData)();
    strict_1.default.equal(data.stats.revenue, 0);
    strict_1.default.equal(data.stats.pettyCashBalance, 0);
    strict_1.default.equal(data.overdueInvoices.length, 0);
    strict_1.default.equal(data.recentEntries.length, 0);
    strict_1.default.equal(data.charts.cashflowLast7Days.length, 0);
});
(0, node_test_1.default)('resolveFinanceSectionResult keeps fulfilled values and falls back with warning on failure', async () => {
    const ok = await Promise.allSettled([Promise.resolve([1, 2, 3])]);
    const failed = await Promise.allSettled([Promise.reject(new Error('missing column'))]);
    const fulfilled = (0, finance_1.resolveFinanceSectionResult)(ok[0], [], 'Some section failed.');
    const rejected = (0, finance_1.resolveFinanceSectionResult)(failed[0], [], 'Some section failed.');
    strict_1.default.deepEqual(fulfilled.value, [1, 2, 3]);
    strict_1.default.equal(fulfilled.warning, null);
    strict_1.default.deepEqual(rejected.value, []);
    strict_1.default.equal(rejected.warning, 'Some section failed.');
});
(0, node_test_1.default)('finance import validators return row level errors', () => {
    const budgets = (0, finance_1.validateBudgetImportRows)([
        { annualTotal: -1, budgetCode: '', budgetName: '', budgetYear: 0 },
        { annualTotal: 5000, budgetCode: 'BGT-1', budgetName: 'Ops', budgetYear: 2026 },
    ]);
    const assets = (0, finance_1.validateFixedAssetImportRows)([
        { assetCode: '', name: '', purchaseCost: -1, usefulLifeYears: 0 },
        { assetCode: 'FA-1', name: 'Freezer', purchaseCost: 1000, usefulLifeYears: 5 },
    ]);
    const bankAccounts = (0, finance_1.validateBankAccountImportRows)([
        { accountCode: '', accountName: '', accountNumber: '', bankName: '' },
        { accountCode: '1010', accountName: 'CBZ Main', accountNumber: '0001', bankName: 'CBZ' },
    ]);
    const accounts = (0, finance_1.validateChartOfAccountImportRows)([
        { accountCode: '', accountName: '', accountType: 'Invalid' },
        { accountCode: '4000', accountName: 'Sales', accountType: 'Revenue' },
    ]);
    const openingBalances = (0, finance_1.validateOpeningBalanceImportRows)([
        { accountCode: '', amount: -1, balanceType: 'OTHER' },
        { accountCode: '1100', amount: 100, balanceType: 'DEBIT' },
    ]);
    strict_1.default.equal(budgets.errors.length, 4);
    strict_1.default.equal(budgets.rows.length, 1);
    strict_1.default.equal(assets.errors.length, 4);
    strict_1.default.equal(assets.rows.length, 1);
    strict_1.default.equal(bankAccounts.errors.length, 4);
    strict_1.default.equal(bankAccounts.rows.length, 1);
    strict_1.default.equal(accounts.errors.length, 3);
    strict_1.default.equal(accounts.rows.length, 1);
    strict_1.default.equal(openingBalances.errors.length, 3);
    strict_1.default.equal(openingBalances.rows.length, 1);
});
