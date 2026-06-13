import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPayablesRows,
  buildReceivablesRows,
  calculateBranchCostSummary,
  calculateBudgetVariance,
  calculateInventoryValuation,
  calculateJournalBalance,
  calculatePayableBalance,
  calculatePettyCashBalance,
  calculateProductionCostSummary,
  calculateReceivableBalance,
  calculateStraightLineDepreciation,
  summarizeProfitAndLoss,
  summarizeTrialBalance,
  validateBankAccountImportRows,
  validateBudgetImportRows,
  validateChartOfAccountImportRows,
  validateFixedAssetImportRows,
  validateJournalLines,
  validateOpeningBalanceImportRows,
} from '../src/lib/finance';

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
