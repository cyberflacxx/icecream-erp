import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { buildCustomerStatement, type CustomerStatementEntry } from '@/lib/red-module-costing';
import { isMissingSalesColumn, isMissingSalesTable, salesErrorMessage, salesService } from '@/lib/sales-server';

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingStatementSource(error: unknown) {
  const message = salesErrorMessage(error);
  return (
    isMissingSalesTable(error) ||
    message.includes('does not exist') ||
    message.includes("Could not find the table 'icecream_erp.")
  );
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.customer.ledger', 'sales.customer.view', 'finance.read')) return forbidden();

  try {
    const service = salesService();
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate') || searchParams.get('from') || null;
    const toDate = searchParams.get('toDate') || searchParams.get('to') || null;

    const { data: customer, error: customerError } = await service
      .from('customers')
      .select('id, code, name, current_balance, outstanding_balance')
      .eq('organization_id', ctx.organizationId)
      .eq('id', params.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return notFound('Customer not found.');

    let invoicesResult = await service
      .from('invoices')
      .select('id, invoice_number, invoice_date, total, total_amount, status')
      .eq('organization_id', ctx.organizationId)
      .eq('customer_id', params.id)
      .is('deleted_at', null);
    if (invoicesResult.error && isMissingSalesColumn(invoicesResult.error, 'invoices', 'deleted_at')) {
      invoicesResult = await service
        .from('invoices')
        .select('id, invoice_number, invoice_date, total, total_amount, status')
        .eq('organization_id', ctx.organizationId)
        .eq('customer_id', params.id);
    }
    if (invoicesResult.error) throw invoicesResult.error;

    let payments: Array<Record<string, unknown>> = [];
    const paymentsResult = await service
      .from('payments')
      .select('id, payment_number, payment_date, amount, payment_method, reference_number, status, invoice_id')
      .eq('organization_id', ctx.organizationId)
      .eq('customer_id', params.id);
    if (paymentsResult.error) {
      if (!isMissingStatementSource(paymentsResult.error)) throw paymentsResult.error;
    } else {
      payments = (paymentsResult.data ?? []) as Array<Record<string, unknown>>;
    }

    let creditNotes: Array<Record<string, unknown>> = [];
    const creditNotesResult = await service
      .from('sales_credit_notes')
      .select('id, credit_note_number, amount, status, created_at, reason')
      .eq('customer_id', params.id);
    if (creditNotesResult.error) {
      if (!isMissingStatementSource(creditNotesResult.error)) throw creditNotesResult.error;
    } else {
      creditNotes = (creditNotesResult.data ?? []) as Array<Record<string, unknown>>;
    }

    let returns: Array<Record<string, unknown>> = [];
    const returnsResult = await service
      .from('customer_returns')
      .select('id, return_number, return_date, total_value, status, reason')
      .eq('customer_id', params.id);
    if (returnsResult.error) {
      if (!isMissingStatementSource(returnsResult.error)) throw returnsResult.error;
    } else {
      returns = (returnsResult.data ?? []) as Array<Record<string, unknown>>;
    }

    const entries: CustomerStatementEntry[] = [
      ...((invoicesResult.data ?? []) as Array<Record<string, unknown>>)
        .filter((invoice) => !['CANCELLED', 'VOIDED', 'DRAFT'].includes(String(invoice.status ?? '').toUpperCase()))
        .map((invoice) => ({
          credit: 0,
          date: invoice.invoice_date ? String(invoice.invoice_date) : null,
          debit: toNumber(invoice.total ?? invoice.total_amount),
          documentId: String(invoice.id),
          documentNumber: String(invoice.invoice_number ?? invoice.id),
          referenceType: 'invoice',
          type: 'INVOICE',
        })),
      ...payments
        .filter((payment) => !['CANCELLED', 'VOIDED', 'FAILED'].includes(String(payment.status ?? '').toUpperCase()))
        .map((payment) => ({
          credit: toNumber(payment.amount),
          date: payment.payment_date ? String(payment.payment_date) : null,
          debit: 0,
          documentId: String(payment.id),
          documentNumber: String(payment.payment_number ?? payment.id),
          paymentMethod: payment.payment_method ? String(payment.payment_method) : null,
          referenceType: 'payment',
          type: 'PAYMENT',
        })),
      ...creditNotes
        .filter((note) => ['APPROVED', 'POSTED'].includes(String(note.status ?? '').toUpperCase()))
        .map((note) => ({
          credit: toNumber(note.amount),
          date: note.created_at ? String(note.created_at).slice(0, 10) : null,
          debit: 0,
          documentId: String(note.id),
          documentNumber: String(note.credit_note_number ?? note.id),
          referenceType: 'credit_note',
          type: 'CREDIT_NOTE',
        })),
      ...returns
        .filter((row) => !['CANCELLED', 'VOIDED'].includes(String(row.status ?? '').toUpperCase()))
        .map((row) => ({
          credit: toNumber(row.total_value),
          date: row.return_date ? String(row.return_date) : null,
          debit: 0,
          documentId: String(row.id),
          documentNumber: String(row.return_number ?? row.id),
          referenceType: 'customer_return',
          type: 'RETURN',
        })),
    ];

    const statement = buildCustomerStatement({ entries, fromDate, toDate });
    return NextResponse.json({
      customer: {
        code: customer.code,
        currentBalance: toNumber(customer.current_balance ?? customer.outstanding_balance),
        id: customer.id,
        name: customer.name,
      },
      filters: { fromDate, toDate },
      limitations: {
        branchCreditSalesIncluded: false,
        branchCreditSalesReason: 'Live branch_sales has no customer_id column, so customer statement cannot safely attach branch credit sales without a relationship.',
      },
      summary: {
        closingBalance: statement.closingBalance,
        openingBalance: statement.openingBalance,
        periodCredits: statement.periodCredits,
        periodDebits: statement.periodDebits,
      },
      entries: statement.periodEntries,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load customer statement.');
  }
}
