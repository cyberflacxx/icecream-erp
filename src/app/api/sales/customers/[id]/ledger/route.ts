import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { salesErrorMessage, salesService } from '@/lib/sales-server';

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareDatesDescending(left: string | null, right: string | null) {
  return String(right ?? '').localeCompare(String(left ?? ''));
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
    const { data: customer, error: customerError } = await service
      .from('customers')
      .select('id, code, name')
      .eq('organization_id', ctx.organizationId)
      .eq('id', params.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return notFound('Customer not found.');

    const invoicesResult = await service
      .from('invoices')
      .select('id, invoice_number, invoice_date, due_date, total, total_amount, amount_paid, paid_amount, balance_due, status')
      .eq('customer_id', params.id)
      .is('deleted_at', null);
    if (invoicesResult.error) throw invoicesResult.error;

    let payments: Array<Record<string, unknown>> = [];
    try {
      const paymentsResult = await service
        .from('payments')
        .select('id, payment_number, payment_date, amount, payment_method, reference_number, notes, invoice_id')
        .eq('customer_id', params.id);
      if (paymentsResult.error) throw paymentsResult.error;
      payments = (paymentsResult.data ?? []) as Array<Record<string, unknown>>;
    } catch (error) {
      const message = salesErrorMessage(error);
      if (!message.includes('column payments.invoice_id does not exist')) {
        throw error;
      }

      const fallbackPaymentsResult = await service
        .from('payments')
        .select('id, payment_number, payment_date, amount, payment_method, reference_number, notes')
        .eq('customer_id', params.id);
      if (fallbackPaymentsResult.error) throw fallbackPaymentsResult.error;
      payments = (fallbackPaymentsResult.data ?? []) as Array<Record<string, unknown>>;
    }

    let creditNotes: Array<Record<string, unknown>> = [];
    try {
      const creditNotesResult = await service
        .from('credit_notes')
        .select('id, credit_note_number, amount, status, created_at, reason')
        .eq('customer_id', params.id);
      if (creditNotesResult.error) throw creditNotesResult.error;
      creditNotes = (creditNotesResult.data ?? []) as Array<Record<string, unknown>>;
    } catch (error) {
      const message = salesErrorMessage(error);
      if (
        !message.includes("Could not find the table 'icecream_erp.credit_notes'") &&
        !message.includes('does not exist')
      ) {
        throw error;
      }
    }

    const ledger = [
      ...((invoicesResult.data ?? []) as Array<Record<string, unknown>>).map((invoice) => ({
        balance: toNumber(invoice.balance_due ?? invoice.total ?? invoice.total_amount),
        credit: 0,
        date: invoice.invoice_date ? String(invoice.invoice_date) : null,
        debit: toNumber(invoice.total ?? invoice.total_amount),
        documentId: String(invoice.id),
        documentNumber: String(invoice.invoice_number ?? invoice.id),
        dueDate: invoice.due_date ? String(invoice.due_date) : null,
        referenceId: String(invoice.id),
        referenceType: 'invoice',
        status: String(invoice.status ?? ''),
        type: 'INVOICE',
      })),
      ...payments.map((payment) => ({
        balance: 0,
        credit: toNumber(payment.amount),
        date: payment.payment_date ? String(payment.payment_date) : null,
        debit: 0,
        documentId: String(payment.id),
        documentNumber: String(payment.payment_number ?? payment.id),
        dueDate: null,
        paymentMethod: payment.payment_method ? String(payment.payment_method) : null,
        referenceId: payment.invoice_id ? String(payment.invoice_id) : String(payment.id),
        referenceNumber: payment.reference_number ? String(payment.reference_number) : null,
        referenceType: payment.invoice_id ? 'invoice' : 'payment',
        status: 'POSTED',
        type: 'PAYMENT',
      })),
      ...creditNotes
        .filter((note) => ['APPROVED', 'POSTED'].includes(String(note.status ?? '').toUpperCase()))
        .map((note) => ({
          balance: 0,
          credit: toNumber(note.amount),
          date: note.created_at ? String(note.created_at).slice(0, 10) : null,
          debit: 0,
          documentId: String(note.id),
          documentNumber: String(note.credit_note_number ?? note.id),
          dueDate: null,
          reason: note.reason ? String(note.reason) : null,
          referenceId: String(note.id),
          referenceType: 'credit_note',
          status: String(note.status ?? ''),
          type: 'CREDIT_NOTE',
        })),
    ].sort((left, right) => String(left.date ?? '').localeCompare(String(right.date ?? '')));

    let runningBalance = 0;
    const withRunningBalance = ledger.map((entry) => {
      runningBalance += entry.debit - entry.credit;
      return {
        ...entry,
        runningBalance,
      };
    }).sort((left, right) => compareDatesDescending(left.date, right.date));

    return NextResponse.json({
      customer: {
        code: customer.code,
        id: customer.id,
        name: customer.name,
      },
      entries: withRunningBalance,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load customer ledger.');
  }
}
