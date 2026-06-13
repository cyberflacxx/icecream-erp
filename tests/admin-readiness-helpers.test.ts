import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMigrationBatchNumber,
  buildTemplateDownloadDefinition,
  computeHealthStatus,
  computeReadinessStatus,
  normalizeMigrationType,
  summarizeValidationResult,
  validateMigrationRows,
  validateOpeningAccountBalanceRows,
  validateUploadPayload,
} from '../src/lib/admin-readiness';

test('migration helpers normalize types and build padded batch numbers', () => {
  assert.equal(normalizeMigrationType('Opening Stock Balances'), 'opening-stock-balances');
  assert.equal(buildMigrationBatchNumber(42), 'MIG-00042');
});

test('upload payload validation requires a type, file, and rows', () => {
  assert.equal(validateUploadPayload({ migrationType: 'suppliers', fileName: '', rows: [] }), 'upload file is required.');
  assert.equal(
    validateUploadPayload({ migrationType: 'suppliers', fileName: 'suppliers.xlsx', rows: [{ code: 'SUP-001', name: 'Milk Co' }] }),
    null,
  );
});

test('opening account balances must balance before posting', () => {
  assert.equal(
    validateOpeningAccountBalanceRows([
      { account_code: '1000', debit_amount: 100, credit_amount: 0 },
      { account_code: '2000', debit_amount: 0, credit_amount: 90 },
    ]),
    'account opening balances must balance before posting.',
  );
  assert.equal(
    validateOpeningAccountBalanceRows([
      { account_code: '1000', debit_amount: 100, credit_amount: 0 },
      { account_code: '2000', debit_amount: 0, credit_amount: 100 },
    ]),
    null,
  );
});

test('migration row validation flags duplicate codes, invalid foreign keys, and negative balances', () => {
  const result = validateMigrationRows(
    'opening-customer-balances',
    [
      { customer_code: 'CUS-001', opening_invoice_reference: 'INV-001', opening_balance: 50 },
      { customer_code: 'CUS-001', opening_invoice_reference: 'INV-002', opening_balance: -10 },
      { customer_code: 'CUS-999', opening_invoice_reference: 'INV-003', opening_balance: 25 },
    ],
    {
      validForeignKeys: { customer_code: ['CUS-001'] },
    },
  );

  assert.equal(result.errors.some((error) => error.field === 'code' || error.field === 'customer_code'), true);
  assert.equal(result.errors.some((error) => error.message.includes('opening balance must not be negative.')), true);

  const summary = summarizeValidationResult(result);
  assert.equal(summary.totalRows, 3);
  assert.equal(summary.failedRows, 2);
  assert.equal(summary.successfulRows, 1);
});

test('template downloads and readiness summaries reflect configured state', () => {
  const template = buildTemplateDownloadDefinition('opening-stock-balances');
  assert.deepEqual(template.columns, ['warehouse_code', 'item_code', 'opening_quantity', 'unit_cost']);
  assert.equal(template.templateType, 'opening-stock-balances');

  assert.equal(computeHealthStatus([{ status: 'HEALTHY' }, { status: 'WARNING' }]), 'WARNING');
  assert.equal(computeHealthStatus([{ status: 'HEALTHY' }]), 'HEALTHY');
  assert.equal(computeReadinessStatus({ blockers: 1, readyChecks: 4, totalChecks: 10 }), 'BLOCKED');
  assert.equal(computeReadinessStatus({ blockers: 0, readyChecks: 10, totalChecks: 10 }), 'READY');
});
