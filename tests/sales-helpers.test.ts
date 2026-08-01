import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildCreditLimitRows,
  buildSalesInvoicePostingLines,
  buildSalesPaymentPostingLines,
  calculateInvoiceTotals,
  canRecordPayment,
  checkStockAvailability,
  evaluateCreditLimit,
  normalizeSalesPaymentMethod,
  resolveSalesPaymentPostingRole,
  validateSalesTenderSplit,
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

test('sales finance posting helpers produce balanced GL lines', () => {
  const invoiceLines = buildSalesInvoicePostingLines({
    invoiceNumber: 'INV-00001',
    stockCostTotal: 45,
    taxAmount: 15,
    total: 115,
  });
  const paymentLines = buildSalesPaymentPostingLines({
    amount: 50,
    invoiceNumber: 'INV-00001',
    paymentMethod: 'bank_transfer',
  });

  assert.equal(normalizeSalesPaymentMethod('bank_transfer'), 'BANK');
  assert.deepEqual(invoiceLines.map((line) => line.accountCode), [
    'ACCOUNTS_RECEIVABLE',
    'SALES_REVENUE',
    'VAT_OUTPUT',
    'COST_OF_GOODS_SOLD',
    'FINISHED_GOODS_INVENTORY',
  ]);
  assert.equal(invoiceLines.reduce((sum, line) => sum + line.debitAmount, 0), 160);
  assert.equal(invoiceLines.reduce((sum, line) => sum + line.creditAmount, 0), 160);
  assert.deepEqual(paymentLines.map((line) => line.accountCode), ['BANK_ACCOUNT', 'ACCOUNTS_RECEIVABLE']);
  assert.equal(paymentLines.reduce((sum, line) => sum + line.debitAmount, 0), 50);
  assert.equal(paymentLines.reduce((sum, line) => sum + line.creditAmount, 0), 50);
});

test('sales payment tender helpers validate split totals and posting roles', () => {
  assert.equal(resolveSalesPaymentPostingRole('cash'), 'CASH_ON_HAND');
  assert.equal(resolveSalesPaymentPostingRole('ecocash'), 'MOBILE_MONEY');
  assert.equal(resolveSalesPaymentPostingRole('pos'), 'BANK_ACCOUNT');
  assert.equal(
    validateSalesTenderSplit(100, [
      { amount: 40, paymentMethod: 'cash' },
      { amount: 60, paymentMethod: 'ecocash' },
    ]),
    null,
  );
  assert.equal(
    validateSalesTenderSplit(100, [
      { amount: 40, paymentMethod: 'cash' },
      { amount: 30, paymentMethod: 'ecocash' },
    ]),
    'Tender totals must equal payment amount.',
  );
});

test('sales finance transaction migration stays schema-local and RPC gated', () => {
  const root = process.cwd();
  const migration = readFileSync(join(root, 'migrations', '040_sales_finance_transaction_engine.sql'), 'utf8');
  const invoiceRoute = readFileSync(join(root, 'src', 'app', 'api', 'sales', 'invoices', 'route.ts'), 'utf8');
  const paymentsRoute = readFileSync(join(root, 'src', 'app', 'api', 'sales', 'payments', 'route.ts'), 'utf8');

  assert.match(migration, /create table if not exists icecream_erp\.sales_posting_account_mappings/);
  assert.match(migration, /create or replace function icecream_erp\.post_sales_invoice_transaction/);
  assert.match(migration, /create or replace function icecream_erp\.post_sales_payment_transaction/);
  assert.match(migration, /sales_assert_open_period/);
  assert.match(migration, /idempotency_key/);
  assert.match(migration, /sales_payment_tenders/);
  assert.match(migration, /sales_payment_allocations/);
  assert.match(migration, /revoke all on table icecream_erp\.sales_posting_account_mappings from anon, authenticated/);
  assert.doesNotMatch(migration.replace(/public\.digest/g, ''), /public\./);
  assert.doesNotMatch(migration, /grant\s+.+\s+to\s+(anon|authenticated)/i);
  assert.doesNotMatch(migration, /alter\s+role|authenticator|pgrst\.db_schemas|db-extra-search-path/i);
  assert.match(invoiceRoute, /shouldRequireSalesTransactionRpc/);
  assert.match(paymentsRoute, /shouldRequireSalesTransactionRpc/);
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

test('sales quotations, orders, and invoices use the shared searchable item selector', () => {
  const quotationsPage = readFileSync(join('src', 'app', '(dashboard)', 'sales', 'quotations', 'page.tsx'), 'utf8');
  const ordersPage = readFileSync(join('src', 'app', '(dashboard)', 'sales', 'orders', 'page.tsx'), 'utf8');
  const invoicesPage = readFileSync(join('src', 'app', '(dashboard)', 'sales', 'invoices', 'page.tsx'), 'utf8');
  const lineEditor = readFileSync(join('src', 'components', 'sales', 'sales-line-items-editor.tsx'), 'utf8');

  for (const page of [quotationsPage, ordersPage, invoicesPage]) {
    assert.match(page, /useItemSelectorOptions/);
  }

  assert.match(lineEditor, /ItemSelectorField/);
  assert.match(lineEditor, /No saleable items are available\./);
});
