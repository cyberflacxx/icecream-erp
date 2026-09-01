import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import {
  financeErrorMessage,
  financeService,
  getSafeFinanceErrorDetails,
  isMissingFinanceColumn,
  isMissingFinanceTable,
  loadLedgerLines,
  loadPettyCashRequestsCompatibility,
  logFinanceRouteError,
  mapNestedRow,
} from '@/lib/finance-server';
import { normalizeFinanceTransactionRow } from '@/lib/finance';

type Row = Record<string, unknown>;

type FinanceTransactionRow = {
  accountCode?: string;
  accountName?: string;
  amount: number;
  counterparty?: string;
  credit?: number;
  date: string;
  debit?: number;
  description: string;
  id: string;
  method?: string;
  reference: string;
  referenceNumber?: string;
  referenceType?: string;
  source: string;
  sourceHref: string;
  status: string;
  transactionDate?: string;
  type?: string;
};

function filterRowsByOrganization(rows: Row[], organizationId: string) {
  return rows.filter((row) => {
    const rowOrganizationId = row.organization_id;
    return !rowOrganizationId || String(rowOrganizationId) === organizationId;
  });
}

function isCompatibilityFailure(error: unknown, table: string, extraPatterns: RegExp[] = []) {
  const message = financeErrorMessage(error);
  return (
    isMissingFinanceTable(error) ||
    message.includes(`Could not find the table 'icecream_erp.${table}'`) ||
    message.includes('Could not find a relationship between') ||
    new RegExp(`column\\s+${table}\\.[a-z_]+\\s+does not exist`, 'i').test(message) ||
    extraPatterns.some((pattern) => pattern.test(message))
  );
}

async function runCompatibilitySelect(
  table: string,
  attempts: Array<{ select: string; step: string }>,
  organizationId: string,
  routeName: string,
) {
  for (const attempt of attempts) {
    const result = await financeService().from(table).select(attempt.select);
    if (!result.error) {
      return filterRowsByOrganization((result.data ?? []) as Row[], organizationId);
    }

    if (!isCompatibilityFailure(result.error, table)) {
      logFinanceRouteError(routeName, attempt.step, result.error);
      throw result.error;
    }

    logFinanceRouteError(routeName, attempt.step, result.error);
  }

  return [] as Row[];
}

async function loadDirectFinanceTransactions(organizationId: string) {
  const rows = await runCompatibilitySelect(
    'finance_transactions',
    [
      {
        select:
          'id, organization_id, transaction_date, reference_number, reference_type, description, debit_amount, credit_amount, amount, status, source, accounts(account_code, account_name)',
        step: 'finance_transactions.modern',
      },
      {
        select:
          'id, organization_id, transaction_date, reference_number, reference_type, narration, debit, credit, amount, status, source',
        step: 'finance_transactions.legacy_amounts',
      },
      {
        select: 'id, organization_id, entry_date, reference, description, debit, credit, amount, status, source',
        step: 'finance_transactions.minimal',
      },
    ],
    organizationId,
    'finance.transactions',
  );

  return rows.map((row) => {
    const account = mapNestedRow(row.accounts as Row | Row[] | null);
    const normalized = normalizeFinanceTransactionRow({
      ...row,
      account_code: account?.account_code ?? row.account_code,
      account_name: account?.account_name ?? row.account_name,
    });

    return {
      accountCode: normalized.accountCode,
      accountName: normalized.accountName,
      amount: normalized.amount,
      credit: normalized.credit,
      date: normalized.date,
      debit: normalized.debit,
      description: normalized.description,
      id: normalized.id,
      reference: normalized.reference,
      referenceNumber: normalized.referenceNumber,
      referenceType: normalized.referenceType,
      source: normalized.source || 'Finance Transaction',
      sourceHref: `/finance/transactions?transaction=${normalized.id}`,
      status: normalized.status,
      transactionDate: normalized.transactionDate,
      type: normalized.referenceType || 'TRANSACTION',
    } satisfies FinanceTransactionRow;
  });
}

async function loadJournalTransactions(organizationId: string) {
  const ledgerLines = await loadLedgerLines(organizationId, true);
  if (ledgerLines.length > 0) {
    return ledgerLines.map((line) => ({
      accountCode: line.accountCode,
      accountName: line.accountName,
      amount: Math.abs(line.debitAmount - line.creditAmount) || line.debitAmount || line.creditAmount || 0,
      counterparty: line.accountName,
      credit: line.creditAmount,
      date: String(line.entryDate ?? '').slice(0, 10),
      debit: line.debitAmount,
      description: line.description ?? 'Finance transaction',
      id: `${line.journalId}:${line.accountId || line.accountCode}`,
      method: 'JOURNAL',
      reference: line.entryNumber ?? line.journalId,
      referenceNumber: line.entryNumber ?? line.journalId,
      referenceType: line.sourceDocumentType ?? 'JOURNAL_ENTRY',
      source: 'Journal Entry',
      sourceHref: `/finance/journals?entry=${line.journalId}`,
      status: line.status || 'POSTED',
      transactionDate: String(line.entryDate ?? '').slice(0, 10),
      type: line.debitAmount > 0 ? 'DEBIT' : line.creditAmount > 0 ? 'CREDIT' : 'ADJUSTMENT',
    }));
  }

  const entryRows = await runCompatibilitySelect(
    'journal_entries',
    [
      {
        select: 'id, organization_id, entry_number, entry_date, posted_at, description, narration, notes, reference_type, reference_id, status, is_posted, total_debit, total_credit, amount',
        step: 'journal_entries.modern',
      },
      {
        select: 'id, organization_id, entry_number, entry_date, date, description, reference, status, total_debit, total_credit, amount',
        step: 'journal_entries.legacy',
      },
      {
        select: 'id, organization_id, created_at, description, reference, status',
        step: 'journal_entries.minimal',
      },
    ],
    organizationId,
    'finance.transactions',
  );

  return entryRows
    .map((row) => normalizeFinanceTransactionRow(row))
    .filter((row) => {
      const upperStatus = row.status.toUpperCase();
      return upperStatus === '' || upperStatus === 'POSTED' || upperStatus === 'APPROVED' || upperStatus === 'COMPLETED';
    })
    .map((row) => ({
      accountCode: row.accountCode,
      accountName: row.accountName,
      amount: row.amount,
      credit: row.credit,
      date: row.date,
      debit: row.debit,
      description: row.description,
      id: row.id,
      method: 'JOURNAL',
      reference: row.reference,
      referenceNumber: row.referenceNumber,
      referenceType: row.referenceType || 'JOURNAL_ENTRY',
      source: 'Journal Entry',
      sourceHref: `/finance/journals?entry=${row.id}`,
      status: row.status || 'POSTED',
      transactionDate: row.transactionDate,
      type: row.debit > 0 ? 'DEBIT' : row.credit > 0 ? 'CREDIT' : 'ADJUSTMENT',
    } satisfies FinanceTransactionRow));
}

async function loadBankTransactions(organizationId: string) {
  const rows = await runCompatibilitySelect(
    'bank_transactions',
    [
      {
        select:
          'id, organization_id, transaction_date, transaction_type, amount, reference_number, description, source_document, status, bank_accounts(account_name, bank_name)',
        step: 'bank_transactions.modern',
      },
      {
        select:
          'id, organization_id, transaction_date, transaction_type, amount, reference_number, description, source_document, status',
        step: 'bank_transactions.minimal',
      },
      {
        select: 'id, organization_id, posted_at, amount, reference, narration, status',
        step: 'bank_transactions.legacy',
      },
    ],
    organizationId,
    'finance.transactions',
  );

  return rows.map((row) => {
    const account = mapNestedRow(row.bank_accounts as Row | Row[] | null);
    const normalized = normalizeFinanceTransactionRow(row);
    return {
      amount: normalized.amount,
      counterparty: String(account?.account_name ?? account?.bank_name ?? 'Bank'),
      date: normalized.date,
      description: normalized.description,
      id: normalized.id,
      method: 'BANK',
      reference: normalized.reference,
      referenceNumber: normalized.referenceNumber,
      referenceType: normalized.referenceType,
      source: 'Bank Transaction',
      sourceHref: `/finance/bank-accounts?transaction=${normalized.id}`,
      status: normalized.status || 'POSTED',
      transactionDate: normalized.transactionDate,
      type: String(row.transaction_type ?? 'BANK'),
    } satisfies FinanceTransactionRow;
  });
}

async function loadCashTransactions(organizationId: string) {
  const rows = await runCompatibilitySelect(
    'cash_transactions',
    [
      {
        select:
          'id, organization_id, transaction_date, transaction_type, amount, source, reference, counterparty, remarks, status, cash_accounts(account_name)',
        step: 'cash_transactions.modern',
      },
      {
        select:
          'id, organization_id, transaction_date, transaction_type, amount, source, reference, counterparty, remarks, status',
        step: 'cash_transactions.minimal',
      },
      {
        select: 'id, organization_id, posted_at, amount, reference, source, counterparty, notes, status',
        step: 'cash_transactions.legacy',
      },
    ],
    organizationId,
    'finance.transactions',
  );

  return rows.map((row) => {
    const account = mapNestedRow(row.cash_accounts as Row | Row[] | null);
    const normalized = normalizeFinanceTransactionRow({
      ...row,
      description: row.remarks ?? row.notes ?? row.description,
    });
    return {
      amount: normalized.amount,
      counterparty: String(row.counterparty ?? account?.account_name ?? 'Cash'),
      date: normalized.date,
      description: normalized.description,
      id: normalized.id,
      method: 'CASH',
      reference: normalized.reference,
      referenceNumber: normalized.referenceNumber,
      referenceType: normalized.referenceType,
      source: 'Cash Transaction',
      sourceHref: `/finance/cash-accounts?transaction=${normalized.id}`,
      status: normalized.status || 'POSTED',
      transactionDate: normalized.transactionDate,
      type: String(row.transaction_type ?? 'CASH'),
    } satisfies FinanceTransactionRow;
  });
}

async function loadSalesPayments(organizationId: string) {
  const rows = await runCompatibilitySelect(
    'payments',
    [
      {
        select:
          'id, organization_id, payment_number, customer_id, invoice_id, payment_date, amount, payment_method, reference_number, status, customers(name), invoices(invoice_number)',
        step: 'payments.modern',
      },
      {
        select:
          'id, organization_id, payment_number, payment_date, amount, payment_method, reference_number, status',
        step: 'payments.minimal',
      },
      {
        select: 'id, organization_id, payment_date, amount, reference, status',
        step: 'payments.legacy',
      },
    ],
    organizationId,
    'finance.transactions',
  );

  return rows.map((row) => {
    const customer = mapNestedRow(row.customers as Row | Row[] | null);
    const invoice = mapNestedRow(row.invoices as Row | Row[] | null);
    const normalized = normalizeFinanceTransactionRow({
      ...row,
      transaction_date: row.payment_date,
      reference_number: row.reference_number ?? row.payment_number,
    });
    return {
      amount: normalized.amount,
      counterparty: String(customer?.name ?? 'Customer'),
      date: normalized.date,
      description: invoice?.invoice_number ? `Invoice ${invoice.invoice_number}` : 'Sales payment',
      id: normalized.id,
      method: String(row.payment_method ?? ''),
      reference: normalized.reference,
      referenceNumber: normalized.referenceNumber,
      referenceType: normalized.referenceType,
      source: 'Sales Payment',
      sourceHref: `/sales/payments?payment=${normalized.id}`,
      status: normalized.status || 'POSTED',
      transactionDate: normalized.transactionDate,
      type: 'RECEIPT',
    } satisfies FinanceTransactionRow;
  });
}

async function loadSupplierPayments(organizationId: string) {
  const rows = await runCompatibilitySelect(
    'supplier_payments',
    [
      {
        select:
          'id, organization_id, payment_date, payment_method, reference_number, amount_paid, status, suppliers(name), supplier_invoices(invoice_number)',
        step: 'supplier_payments.modern',
      },
      {
        select:
          'id, organization_id, payment_date, payment_method, reference_number, amount_paid, status',
        step: 'supplier_payments.minimal',
      },
      {
        select: 'id, organization_id, payment_date, reference, amount, status',
        step: 'supplier_payments.legacy',
      },
    ],
    organizationId,
    'finance.transactions',
  );

  return rows.map((row) => {
    const supplier = mapNestedRow(row.suppliers as Row | Row[] | null);
    const invoice = mapNestedRow(row.supplier_invoices as Row | Row[] | null);
    const normalized = normalizeFinanceTransactionRow({
      ...row,
      amount: row.amount_paid ?? row.amount,
      transaction_date: row.payment_date,
    });
    return {
      amount: normalized.amount,
      counterparty: String(supplier?.name ?? 'Supplier'),
      date: normalized.date,
      description: invoice?.invoice_number ? `Supplier invoice ${invoice.invoice_number}` : 'Supplier payment',
      id: normalized.id,
      method: String(row.payment_method ?? ''),
      reference: normalized.reference,
      referenceNumber: normalized.referenceNumber,
      referenceType: normalized.referenceType,
      source: 'Supplier Payment',
      sourceHref: `/procurement/payments?payment=${normalized.id}`,
      status: normalized.status || 'POSTED',
      transactionDate: normalized.transactionDate,
      type: 'PAYMENT',
    } satisfies FinanceTransactionRow;
  });
}

async function loadBranchSales(organizationId: string) {
  const rows = await runCompatibilitySelect(
    'branch_sales',
    [
      {
        select:
          'id, organization_id, branch_id, sale_number, sale_date, total_amount, payment_method, payment_reference, status, branches(name)',
        step: 'branch_sales.modern',
      },
      {
        select:
          'id, organization_id, branch_id, sale_date, total_amount, payment_method, branches(name)',
        step: 'branch_sales.minimal',
      },
    ],
    organizationId,
    'finance.transactions',
  );

  return rows.map((row) => {
    const branch = mapNestedRow(row.branches as Row | Row[] | null);
    const normalized = normalizeFinanceTransactionRow({
      ...row,
      amount: row.total_amount,
      reference_number: row.payment_reference ?? row.sale_number,
      transaction_date: row.sale_date,
      description: 'Branch sale',
    });
    return {
      amount: normalized.amount,
      counterparty: String(branch?.name ?? 'Branch'),
      date: normalized.date,
      description: normalized.description,
      id: normalized.id,
      method: String(row.payment_method ?? ''),
      reference: normalized.reference,
      referenceNumber: normalized.referenceNumber,
      referenceType: normalized.referenceType,
      source: 'Branch Sale',
      sourceHref: `/branches/${row.branch_id ?? ''}/sales?sale=${normalized.id}`,
      status: normalized.status || 'POSTED',
      transactionDate: normalized.transactionDate,
      type: 'RECEIPT',
    } satisfies FinanceTransactionRow;
  });
}

async function loadBranchExpenses(organizationId: string) {
  const rows = await runCompatibilitySelect(
    'branch_expenses',
    [
      {
        select:
          'id, organization_id, branch_id, expense_date, category, description, amount, payment_method, status, branches(name)',
        step: 'branch_expenses.modern',
      },
      {
        select:
          'id, organization_id, branch_id, expense_date, category, description, amount, payment_method, status',
        step: 'branch_expenses.minimal',
      },
      {
        select: 'id, organization_id, created_at, category, description, amount, status',
        step: 'branch_expenses.legacy',
      },
    ],
    organizationId,
    'finance.transactions',
  );

  return rows.map((row) => {
    const branch = mapNestedRow(row.branches as Row | Row[] | null);
    const normalized = normalizeFinanceTransactionRow({
      ...row,
      transaction_date: row.expense_date ?? row.created_at,
      description: row.description ?? row.category ?? 'Branch expense',
    });
    return {
      amount: normalized.amount,
      counterparty: String(branch?.name ?? 'Branch'),
      date: normalized.date,
      description: normalized.description,
      id: normalized.id,
      method: String(row.payment_method ?? ''),
      reference: normalized.reference || normalized.id,
      referenceNumber: normalized.referenceNumber || normalized.id,
      referenceType: normalized.referenceType,
      source: 'Branch Expense',
      sourceHref: `/branches/${row.branch_id ?? ''}/expenses?expense=${normalized.id}`,
      status: normalized.status || 'POSTED',
      transactionDate: normalized.transactionDate,
      type: 'PAYMENT',
    } satisfies FinanceTransactionRow;
  });
}

async function loadPettyCashTransactions(organizationId: string) {
  const rows = await loadPettyCashRequestsCompatibility(organizationId, { routeName: 'finance.transactions' });
  return rows.map((row) => {
    const branch = mapNestedRow(row.branches as Row | Row[] | null);
    const normalized = normalizeFinanceTransactionRow({
      ...row,
      amount: row.amountRequested ?? row.amount_requested,
      transaction_date: row.requestDate ?? row.request_date,
      reference_number: row.requestNumber ?? row.request_number,
      description: row.purpose,
      source: 'Petty Cash',
    });
    return {
      amount: normalized.amount,
      counterparty: String(branch?.name ?? 'Petty cash'),
      date: normalized.date,
      description: normalized.description,
      id: normalized.id,
      method: 'PETTY_CASH',
      reference: normalized.reference,
      referenceNumber: normalized.referenceNumber,
      referenceType: normalized.referenceType,
      source: 'Petty Cash',
      sourceHref: `/finance/petty-cash?request=${normalized.id}`,
      status: normalized.status || 'PENDING',
      transactionDate: normalized.transactionDate,
      type: 'REQUEST',
    } satisfies FinanceTransactionRow;
  });
}

async function safeSource<T>(section: string, loader: () => Promise<T[]>) {
  try {
    return await loader();
  } catch (error) {
    console.error('Finance transactions source failed.', {
      ...getSafeFinanceErrorDetails(error, 'finance.transactions', section),
      section,
    });
    return [] as T[];
  }
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  const ledgerRows = await safeSource('finance_transactions.direct', async () => {
    const direct = await loadDirectFinanceTransactions(ctx.organizationId);
    if (direct.length > 0) return direct;
    return loadJournalTransactions(ctx.organizationId);
  });

  const [
    bankTransactions,
    cashTransactions,
    pettyCashTransactions,
    salesPayments,
    supplierPayments,
    branchSales,
    branchExpenses,
  ] = await Promise.all([
    safeSource('bank_transactions', () => loadBankTransactions(ctx.organizationId)),
    safeSource('cash_transactions', () => loadCashTransactions(ctx.organizationId)),
    safeSource('petty_cash_requests', () => loadPettyCashTransactions(ctx.organizationId)),
    safeSource('payments', () => loadSalesPayments(ctx.organizationId)),
    safeSource('supplier_payments', () => loadSupplierPayments(ctx.organizationId)),
    safeSource('branch_sales', () => loadBranchSales(ctx.organizationId)),
    safeSource('branch_expenses', () => loadBranchExpenses(ctx.organizationId)),
  ]);

  const rows = [
    ...ledgerRows,
    ...bankTransactions,
    ...cashTransactions,
    ...pettyCashTransactions,
    ...salesPayments,
    ...supplierPayments,
    ...branchSales,
    ...branchExpenses,
  ]
    .filter((row) => row.id && row.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 500);

  return NextResponse.json({
    success: true,
    data: rows,
  });
}
