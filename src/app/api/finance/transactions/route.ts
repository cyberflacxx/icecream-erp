import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, isMissingFinanceTable, mapNestedRow } from '@/lib/finance-server';

type Row = Record<string, unknown>;

interface FinanceTransactionRow {
  amount: number;
  counterparty: string;
  date: string;
  description: string;
  id: string;
  method: string;
  reference: string;
  source: string;
  sourceHref: string;
  status: string;
  type: string;
}

async function optionalRows(table: string, select: string, organizationId: string) {
  const result = await financeService().from(table).select(select);
  if (result.error) {
    if (isMissingFinanceTable(result.error)) return [] as Row[];
    throw result.error;
  }

  return ((result.data ?? []) as unknown as Row[]).filter((row) => {
    const rowOrganizationId = row.organization_id;
    return !rowOrganizationId || String(rowOrganizationId) === organizationId;
  });
}

function safeDate(value: unknown) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function tx(row: FinanceTransactionRow) {
  return row;
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const [
      journals,
      bankTransactions,
      cashTransactions,
      pettyCashRequests,
      salesPayments,
      supplierPayments,
      branchSales,
      branchExpenses,
    ] = await Promise.all([
      optionalRows(
        'journal_entries',
        'id, organization_id, entry_number, entry_date, description, total_debit, total_credit, status, is_posted',
        ctx.organizationId,
      ),
      optionalRows(
        'bank_transactions',
        'id, organization_id, transaction_date, transaction_type, amount, reference_number, description, source_document, status, bank_accounts(account_name, bank_name)',
        ctx.organizationId,
      ),
      optionalRows(
        'cash_transactions',
        'id, organization_id, transaction_date, transaction_type, amount, source, reference, counterparty, remarks, status, cash_accounts(name)',
        ctx.organizationId,
      ),
      optionalRows(
        'petty_cash_requests',
        'id, organization_id, request_number, branch_id, request_date, amount_requested, purpose, status, branches(name)',
        ctx.organizationId,
      ),
      optionalRows(
        'payments',
        'id, organization_id, payment_number, customer_id, invoice_id, payment_date, amount, payment_method, reference_number, status, customers(name), invoices(invoice_number)',
        ctx.organizationId,
      ),
      optionalRows(
        'supplier_payments',
        'id, organization_id, payment_date, payment_method, reference_number, amount_paid, status, suppliers(name), supplier_invoices(invoice_number)',
        ctx.organizationId,
      ),
      optionalRows(
        'branch_sales',
        'id, organization_id, branch_id, sale_number, sale_date, total_amount, payment_method, payment_reference, status, branches(name)',
        ctx.organizationId,
      ),
      optionalRows(
        'branch_expenses',
        'id, organization_id, branch_id, expense_date, category, description, amount, payment_method, status, branches(name)',
        ctx.organizationId,
      ),
    ]);

    const rows: FinanceTransactionRow[] = [
      ...journals.map((row) =>
        tx({
          amount: Number(row.total_debit ?? row.total_credit ?? 0),
          counterparty: 'Journal adjustment',
          date: safeDate(row.entry_date),
          description: String(row.description ?? ''),
          id: String(row.id),
          method: 'JOURNAL',
          reference: String(row.entry_number ?? row.id),
          source: 'Journal Entry',
          sourceHref: `/finance/journals?entry=${row.id}`,
          status: String(row.status ?? (row.is_posted ? 'POSTED' : 'DRAFT')),
          type: 'ADJUSTMENT',
        }),
      ),
      ...bankTransactions.map((row) => {
        const account = mapNestedRow(row.bank_accounts as Row | Row[] | null);
        return tx({
          amount: Number(row.amount ?? 0),
          counterparty: String(account?.account_name ?? account?.bank_name ?? 'Bank'),
          date: safeDate(row.transaction_date),
          description: String(row.description ?? row.source_document ?? ''),
          id: String(row.id),
          method: 'BANK',
          reference: String(row.reference_number ?? row.id),
          source: 'Bank Transaction',
          sourceHref: `/finance/bank-accounts?transaction=${row.id}`,
          status: String(row.status ?? 'POSTED'),
          type: String(row.transaction_type ?? 'BANK'),
        });
      }),
      ...cashTransactions.map((row) => {
        const account = mapNestedRow(row.cash_accounts as Row | Row[] | null);
        return tx({
          amount: Number(row.amount ?? 0),
          counterparty: String(row.counterparty ?? account?.name ?? 'Cash'),
          date: safeDate(row.transaction_date),
          description: String(row.remarks ?? row.source ?? ''),
          id: String(row.id),
          method: 'CASH',
          reference: String(row.reference ?? row.id),
          source: 'Cash Transaction',
          sourceHref: `/finance/cash-accounts?transaction=${row.id}`,
          status: String(row.status ?? 'POSTED'),
          type: String(row.transaction_type ?? 'CASH'),
        });
      }),
      ...pettyCashRequests.map((row) => {
        const branch = mapNestedRow(row.branches as Row | Row[] | null);
        return tx({
          amount: Number(row.amount_requested ?? 0),
          counterparty: String(branch?.name ?? 'Petty cash'),
          date: safeDate(row.request_date),
          description: String(row.purpose ?? ''),
          id: String(row.id),
          method: 'PETTY_CASH',
          reference: String(row.request_number ?? row.id),
          source: 'Petty Cash',
          sourceHref: `/finance/petty-cash?request=${row.id}`,
          status: String(row.status ?? 'PENDING'),
          type: 'REQUEST',
        });
      }),
      ...salesPayments.map((row) => {
        const customer = mapNestedRow(row.customers as Row | Row[] | null);
        const invoice = mapNestedRow(row.invoices as Row | Row[] | null);
        return tx({
          amount: Number(row.amount ?? 0),
          counterparty: String(customer?.name ?? 'Customer'),
          date: safeDate(row.payment_date),
          description: invoice?.invoice_number ? `Invoice ${invoice.invoice_number}` : 'Sales payment',
          id: String(row.id),
          method: String(row.payment_method ?? ''),
          reference: String(row.reference_number ?? row.payment_number ?? row.id),
          source: 'Sales Payment',
          sourceHref: `/sales/payments?payment=${row.id}`,
          status: String(row.status ?? 'POSTED'),
          type: 'RECEIPT',
        });
      }),
      ...supplierPayments.map((row) => {
        const supplier = mapNestedRow(row.suppliers as Row | Row[] | null);
        const invoice = mapNestedRow(row.supplier_invoices as Row | Row[] | null);
        return tx({
          amount: Number(row.amount_paid ?? 0),
          counterparty: String(supplier?.name ?? 'Supplier'),
          date: safeDate(row.payment_date),
          description: invoice?.invoice_number ? `Supplier invoice ${invoice.invoice_number}` : 'Supplier payment',
          id: String(row.id),
          method: String(row.payment_method ?? ''),
          reference: String(row.reference_number ?? row.id),
          source: 'Supplier Payment',
          sourceHref: `/procurement/payments?payment=${row.id}`,
          status: String(row.status ?? 'POSTED'),
          type: 'PAYMENT',
        });
      }),
      ...branchSales.map((row) => {
        const branch = mapNestedRow(row.branches as Row | Row[] | null);
        return tx({
          amount: Number(row.total_amount ?? 0),
          counterparty: String(branch?.name ?? 'Branch'),
          date: safeDate(row.sale_date),
          description: 'Branch sale',
          id: String(row.id),
          method: String(row.payment_method ?? ''),
          reference: String(row.payment_reference ?? row.sale_number ?? row.id),
          source: 'Branch Sale',
          sourceHref: `/branches/${row.branch_id ?? ''}/sales?sale=${row.id}`,
          status: String(row.status ?? 'POSTED'),
          type: 'RECEIPT',
        });
      }),
      ...branchExpenses.map((row) => {
        const branch = mapNestedRow(row.branches as Row | Row[] | null);
        return tx({
          amount: Number(row.amount ?? 0),
          counterparty: String(branch?.name ?? 'Branch'),
          date: safeDate(row.expense_date),
          description: String(row.description ?? row.category ?? 'Branch expense'),
          id: String(row.id),
          method: String(row.payment_method ?? ''),
          reference: String(row.id),
          source: 'Branch Expense',
          sourceHref: `/branches/${row.branch_id ?? ''}/expenses?expense=${row.id}`,
          status: String(row.status ?? 'POSTED'),
          type: 'PAYMENT',
        });
      }),
    ];

    return NextResponse.json(
      rows.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 500),
    );
  } catch (error) {
    return serverError(financeErrorMessage(error) || 'Failed to load finance transactions.');
  }
}
