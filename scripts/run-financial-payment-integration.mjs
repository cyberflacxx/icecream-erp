#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const REQUIRED_MIGRATIONS = ['040', '065', '069'];
const REQUIRED_TABLES = [
  'accounts', 'bank_accounts', 'bank_transactions', 'cash_accounts', 'cash_transactions',
  'invoices', 'journal_entries', 'journal_entry_lines', 'payments', 'sales_payment_allocations',
  'supplier_invoices', 'supplier_payments', 'system_settings',
];

class BlockedError extends Error {}

function requireEnvironment(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new BlockedError(`missing ${name}`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function projectRef(url) {
  try {
    return new URL(url).hostname.split('.')[0] ?? '';
  } catch {
    return '';
  }
}

function record(value, name) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value;
}

function text(value, name) {
  const result = String(value ?? '').trim();
  assert(Boolean(result), `${name} is required from the fixture RPC`);
  return result;
}

async function one(client, table, columns, filters) {
  let query = client.from(table).select(columns);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { data, error } = await query.single();
  if (error) throw new Error(`${table} read failed: ${error.message}`);
  return record(data, `${table} row`);
}

async function count(client, table, filters) {
  let query = client.from(table).select('id', { count: 'exact', head: true });
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { count: result, error } = await query;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return result ?? 0;
}

async function journalIsBalanced(client, journalId, expectedDebitAccount, expectedCreditAccount, amount) {
  const journal = await one(client, 'journal_entries', 'id, organization_id, total_debit, total_credit, reference, reference_type, reference_id', { id: journalId });
  assert(Number(journal.total_debit) === Number(journal.total_credit), `journal ${journalId} header is unbalanced`);
  assert(Number(journal.total_debit) === amount, `journal ${journalId} has an unexpected total`);
  const { data, error } = await client.from('journal_entry_lines')
    .select('account_id, debit_amount, credit_amount')
    .eq('journal_entry_id', journalId);
  if (error) throw new Error(`journal ${journalId} lines failed: ${error.message}`);
  const lines = Array.isArray(data) ? data.map((row) => record(row, 'journal line')) : [];
  const debits = lines.reduce((sum, line) => sum + Number(line.debit_amount ?? 0), 0);
  const credits = lines.reduce((sum, line) => sum + Number(line.credit_amount ?? 0), 0);
  assert(debits === credits && debits === amount, `journal ${journalId} lines are unbalanced`);
  assert(lines.some((line) => line.account_id === expectedDebitAccount && Number(line.debit_amount ?? 0) === amount), 'expected debit line is absent');
  assert(lines.some((line) => line.account_id === expectedCreditAccount && Number(line.credit_amount ?? 0) === amount), 'expected credit line is absent');
  return journal;
}

async function rpc(client, name, arguments_) {
  const { data, error } = await client.rpc(name, arguments_);
  if (error) throw new Error(`${name} failed: ${error.message}`);
  return record(data, `${name} result`);
}

async function preflight() {
  if (String(process.env.ERP_FINANCIAL_INTEGRATION ?? '') !== '1') throw new BlockedError('ERP_FINANCIAL_INTEGRATION must equal 1');
  const url = requireEnvironment('FINANCIAL_TEST_SUPABASE_URL');
  const key = requireEnvironment('FINANCIAL_TEST_SUPABASE_SERVICE_ROLE_KEY');
  const expectedProject = requireEnvironment('FINANCIAL_TEST_PROJECT_REF');
  const isolationToken = requireEnvironment('FINANCIAL_TEST_ISOLATION_TOKEN');
  const productionRefs = requireEnvironment('FINANCIAL_TEST_KNOWN_PRODUCTION_PROJECT_REFS').split(',').map((value) => value.trim()).filter(Boolean);
  const actualProject = projectRef(url);
  assert(actualProject === expectedProject, 'test URL project reference does not match FINANCIAL_TEST_PROJECT_REF');
  assert(!productionRefs.includes(actualProject), 'test URL matches a declared production project reference');

  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: 'icecream_erp' } });
  const identity = await rpc(client, 'financial_integration_test_identity', { p_isolation_token: isolationToken });
  assert(identity.environment === 'isolated-financial-integration-test', 'database identity is not the required isolated environment');
  assert(identity.projectRef === actualProject, 'database identity project reference does not match the URL');
  assert(identity.isolationTokenVerified === true, 'database isolation token was not verified');
  assert(identity.schema === 'icecream_erp', 'database identity schema is not icecream_erp');
  assert(identity.containsOnlySyntheticData === true, 'database identity does not attest to synthetic-only data');
  const installed = Array.isArray(identity.migrationVersions) ? identity.migrationVersions.map(String) : [];
  for (const version of REQUIRED_MIGRATIONS) assert(installed.includes(version), `required migration ${version} is not attested by the database identity`);
  for (const table of REQUIRED_TABLES) await count(client, table, {});
  return { client, isolationToken };
}

async function prepareFixture(client, isolationToken, runId) {
  const fixture = await rpc(client, 'financial_integration_test_fixture', {
    p_action: 'setup', p_isolation_token: isolationToken, p_run_id: runId,
  });
  return record(fixture, 'financial integration fixture');
}

async function cleanupFixture(client, isolationToken, runId) {
  await rpc(client, 'financial_integration_test_fixture', {
    p_action: 'cleanup', p_isolation_token: isolationToken, p_run_id: runId,
  });
}

function fixtureContracts(fixture) {
  const customer = record(fixture.customer, 'fixture.customer');
  const supplier = record(fixture.supplier, 'fixture.supplier');
  const accounts = record(fixture.accounts, 'fixture.accounts');
  return {
    actorUserProfileId: text(fixture.actorUserProfileId, 'fixture.actorUserProfileId'),
    organizationId: text(fixture.organizationId, 'fixture.organizationId'),
    foreignOrganizationId: text(fixture.foreignOrganizationId, 'fixture.foreignOrganizationId'),
    branchId: text(fixture.branchId, 'fixture.branchId'),
    customerId: text(customer.id, 'fixture.customer.id'),
    supplierId: text(supplier.id, 'fixture.supplier.id'),
    cashAccountId: text(fixture.cashAccountId, 'fixture.cashAccountId'),
    bankAccountId: text(fixture.bankAccountId, 'fixture.bankAccountId'),
    receivableAccountId: text(accounts.receivableId, 'fixture.accounts.receivableId'),
    payableAccountId: text(accounts.payableId, 'fixture.accounts.payableId'),
    cashLedgerAccountId: text(accounts.cashId, 'fixture.accounts.cashId'),
    bankLedgerAccountId: text(accounts.bankId, 'fixture.accounts.bankId'),
    customerPartial: record(fixture.customerPartialInvoice, 'fixture.customerPartialInvoice'),
    customerFull: record(fixture.customerFullInvoice, 'fixture.customerFullInvoice'),
    supplierPartial: record(fixture.supplierPartialInvoice, 'fixture.supplierPartialInvoice'),
    supplierFull: record(fixture.supplierFullInvoice, 'fixture.supplierFullInvoice'),
  };
}

function paymentAmount(invoice, name) {
  const value = Number(invoice.paymentAmount);
  assert(Number.isFinite(value) && value > 0, `${name}.paymentAmount must be positive`);
  return value;
}

async function customerPaymentCase(client, fixture, invoice, method, accountId, accountColumn, expectedDebitAccount, suffix) {
  const amount = paymentAmount(invoice, `customer ${suffix}`);
  const invoiceId = text(invoice.id, `customer ${suffix}.id`);
  const idempotencyKey = `phase8-customer-${suffix}-${randomUUID()}`;
  const payload = {
    amount, bankAccountId: method === 'BANK' ? accountId : null, branchId: fixture.branchId,
    cashAccountId: method === 'BANK' ? null : accountId, customerId: fixture.customerId,
    idempotencyKey, invoiceId, paymentDate: '2026-01-15', paymentMethod: method,
    referenceNumber: `PHASE8-${suffix}`,
  };
  const result = await rpc(client, 'post_sales_payment_transaction_v2', {
    p_actor_user_profile_id: fixture.actorUserProfileId, p_organization_id: fixture.organizationId, p_payment_payload: payload,
  });
  const paymentId = text(result.paymentId, 'customer payment result.paymentId');
  const journalId = text(result.journalId, 'customer payment result.journalId');
  const payment = await one(client, 'payments', 'id, organization_id, invoice_id, amount, journal_entry_id, cash_account_id, bank_account_id', { id: paymentId });
  assert(payment.organization_id === fixture.organizationId && payment.invoice_id === invoiceId, 'customer payment references are incorrect');
  assert(Number(payment.amount) === amount && payment[accountColumn] === accountId, 'customer payment tender account is incorrect');
  assert(await count(client, 'sales_payment_allocations', { payment_id: paymentId, invoice_id: invoiceId }) === 1, 'customer allocation is missing');
  const invoiceRow = await one(client, 'invoices', 'id, balance_due', { id: invoiceId });
  assert(Number(invoiceRow.balance_due) === Number(invoice.expectedBalanceAfter), 'customer invoice balance was not updated');
  await journalIsBalanced(client, journalId, expectedDebitAccount, fixture.receivableAccountId, amount);
  const replay = await rpc(client, 'post_sales_payment_transaction_v2', {
    p_actor_user_profile_id: fixture.actorUserProfileId, p_organization_id: fixture.organizationId, p_payment_payload: payload,
  });
  assert(text(replay.paymentId, 'customer replay.paymentId') === paymentId, 'customer idempotency replay created a different payment');
  assert(await count(client, 'payments', { organization_id: fixture.organizationId, idempotency_key: idempotencyKey }) === 1, 'customer idempotency created duplicate payments');
}

async function supplierPaymentCase(client, fixture, invoice, method, accountId, expectedCreditAccount, suffix) {
  const amount = paymentAmount(invoice, `supplier ${suffix}`);
  const invoiceId = text(invoice.id, `supplier ${suffix}.id`);
  const idempotencyKey = `phase8-supplier-${suffix}-${randomUUID()}`;
  const payload = {
    amountPaid: amount, bankAccountId: method === 'BANK' ? accountId : null, branchId: fixture.branchId,
    cashAccountId: method === 'BANK' ? null : accountId, idempotencyKey, paymentDate: '2026-01-15',
    paymentMethod: method, referenceNumber: `PHASE8-${suffix}`, supplierId: fixture.supplierId, supplierInvoiceId: invoiceId,
  };
  const result = await rpc(client, 'post_supplier_payment_transaction', {
    p_actor_user_profile_id: fixture.actorUserProfileId, p_organization_id: fixture.organizationId, p_payment_payload: payload,
  });
  const paymentId = text(result.paymentId, 'supplier payment result.paymentId');
  const journalId = text(result.journalId, 'supplier payment result.journalId');
  const payment = await one(client, 'supplier_payments', 'id, organization_id, supplier_invoice_id, amount_paid, journal_entry_id', { id: paymentId });
  assert(payment.organization_id === fixture.organizationId && payment.supplier_invoice_id === invoiceId, 'supplier payment references are incorrect');
  assert(Number(payment.amount_paid) === amount, 'supplier payment amount is incorrect');
  const invoiceRow = await one(client, 'supplier_invoices', 'id, outstanding_amount', { id: invoiceId });
  assert(Number(invoiceRow.outstanding_amount) === Number(invoice.expectedBalanceAfter), 'supplier invoice balance was not updated');
  await journalIsBalanced(client, journalId, fixture.payableAccountId, expectedCreditAccount, amount);
  const replay = await rpc(client, 'post_supplier_payment_transaction', {
    p_actor_user_profile_id: fixture.actorUserProfileId, p_organization_id: fixture.organizationId, p_payment_payload: payload,
  });
  assert(replay.idempotentReplay === true && text(replay.paymentId, 'supplier replay.paymentId') === paymentId, 'supplier idempotency replay was not preserved');
  assert(await count(client, 'supplier_payments', { organization_id: fixture.organizationId, idempotency_key: idempotencyKey }) === 1, 'supplier idempotency created duplicate payments');
}

async function expectFailureWithoutWrites(client, fixture) {
  const before = await Promise.all([
    count(client, 'payments', { organization_id: fixture.organizationId }),
    count(client, 'supplier_payments', { organization_id: fixture.organizationId }),
    count(client, 'journal_entries', { organization_id: fixture.organizationId }),
  ]);
  const invalid = await client.rpc('post_supplier_payment_transaction', {
    p_actor_user_profile_id: fixture.actorUserProfileId,
    p_organization_id: fixture.organizationId,
    p_payment_payload: { amountPaid: Number(fixture.supplierPartial.paymentAmount) * 100, idempotencyKey: `phase8-failure-${randomUUID()}`, paymentMethod: 'CASH', cashAccountId: fixture.cashAccountId, supplierId: fixture.supplierId, supplierInvoiceId: fixture.supplierPartial.id },
  });
  assert(invalid.error, 'overpayment was unexpectedly accepted');
  const after = await Promise.all([
    count(client, 'payments', { organization_id: fixture.organizationId }),
    count(client, 'supplier_payments', { organization_id: fixture.organizationId }),
    count(client, 'journal_entries', { organization_id: fixture.organizationId }),
  ]);
  assert(JSON.stringify(before) === JSON.stringify(after), 'failed supplier payment left partial records');
}

async function expectCustomerFailureAndIsolation(client, fixture) {
  const before = await Promise.all([
    count(client, 'payments', { organization_id: fixture.organizationId }),
    count(client, 'sales_payment_allocations', { organization_id: fixture.organizationId }),
    count(client, 'journal_entries', { organization_id: fixture.organizationId }),
  ]);
  const invalid = await client.rpc('post_sales_payment_transaction_v2', {
    p_actor_user_profile_id: fixture.actorUserProfileId,
    p_organization_id: fixture.organizationId,
    p_payment_payload: { amount: Number(fixture.customerPartial.paymentAmount) * 100, cashAccountId: fixture.cashAccountId, customerId: fixture.customerId, idempotencyKey: `phase8-customer-failure-${randomUUID()}`, invoiceId: fixture.customerPartial.id, paymentMethod: 'CASH' },
  });
  assert(invalid.error, 'overpayment customer receipt was unexpectedly accepted');
  const isolation = await client.rpc('post_sales_payment_transaction_v2', {
    p_actor_user_profile_id: fixture.actorUserProfileId,
    p_organization_id: fixture.foreignOrganizationId,
    p_payment_payload: { amount: paymentAmount(fixture.customerFull, 'customer isolation'), cashAccountId: fixture.cashAccountId, customerId: fixture.customerId, idempotencyKey: `phase8-customer-isolation-${randomUUID()}`, invoiceId: fixture.customerFull.id, paymentMethod: 'CASH' },
  });
  assert(isolation.error, 'cross-organization customer receipt was unexpectedly accepted');
  const after = await Promise.all([
    count(client, 'payments', { organization_id: fixture.organizationId }),
    count(client, 'sales_payment_allocations', { organization_id: fixture.organizationId }),
    count(client, 'journal_entries', { organization_id: fixture.organizationId }),
  ]);
  assert(JSON.stringify(before) === JSON.stringify(after), 'failed customer receipt left partial records');
}

async function expectOrganizationIsolation(client, fixture) {
  const result = await client.rpc('post_supplier_payment_transaction', {
    p_actor_user_profile_id: fixture.actorUserProfileId,
    p_organization_id: fixture.foreignOrganizationId,
    p_payment_payload: { amountPaid: paymentAmount(fixture.supplierFull, 'supplier isolation'), idempotencyKey: `phase8-isolation-${randomUUID()}`, paymentMethod: 'CASH', cashAccountId: fixture.cashAccountId, supplierId: fixture.supplierId, supplierInvoiceId: fixture.supplierFull.id },
  });
  assert(result.error, 'cross-organization supplier payment was unexpectedly accepted');
}

async function main() {
  const { client, isolationToken } = await preflight();
  const runId = `phase8-financial-${randomUUID()}`;
  let prepared = false;
  try {
    const fixture = fixtureContracts(await prepareFixture(client, isolationToken, runId));
    prepared = true;
    await customerPaymentCase(client, fixture, fixture.customerPartial, 'CASH', fixture.cashAccountId, 'cash_account_id', fixture.cashLedgerAccountId, 'cash-partial');
    await customerPaymentCase(client, fixture, fixture.customerFull, 'BANK', fixture.bankAccountId, 'bank_account_id', fixture.bankLedgerAccountId, 'bank-full');
    await supplierPaymentCase(client, fixture, fixture.supplierPartial, 'CASH', fixture.cashAccountId, fixture.cashLedgerAccountId, 'cash-partial');
    await supplierPaymentCase(client, fixture, fixture.supplierFull, 'BANK', fixture.bankAccountId, fixture.bankLedgerAccountId, 'bank-full');
    await expectCustomerFailureAndIsolation(client, fixture);
    await expectFailureWithoutWrites(client, fixture);
    await expectOrganizationIsolation(client, fixture);
    console.log('DATABASE INTEGRATION TESTS: PASS');
  } finally {
    if (prepared) await cleanupFixture(client, isolationToken, runId);
  }
}

main().catch((error) => {
  const prefix = error instanceof BlockedError ? 'DATABASE INTEGRATION TESTS: BLOCKED' : 'DATABASE INTEGRATION TESTS: FAIL';
  console.error(`${prefix} — ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = error instanceof BlockedError ? 2 : 1;
});
