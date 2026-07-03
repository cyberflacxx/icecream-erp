import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildFinanceSourceReference } from '@/lib/finance';
import { createLinkedFinanceTransaction, postFinanceDocument } from '@/lib/finance-server';
import { canPayInvoice } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

const PAYMENT_SOURCES = new Set(['BANK', 'CASH', 'PETTY_CASH']);

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('supplier_payments')
    .select(
      'id, supplier_invoice_id, payment_date, payment_method, reference_number, amount_paid, status, suppliers(name), supplier_invoices(invoice_number)',
    )
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .order('payment_date', { ascending: false });

  if (error) {
    if (error.message.includes("Could not find the table 'icecream_erp.supplier_payments'")) {
      return NextResponse.json([]);
    }
    return serverError(error.message);
  }

  return NextResponse.json((data ?? []).map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const invoice = Array.isArray(row.supplier_invoices) ? row.supplier_invoices[0] : row.supplier_invoices;
    return {
      amountPaid: Number(row.amount_paid ?? 0),
      id: row.id,
      invoiceId: row.supplier_invoice_id ?? null,
      invoiceNumber: invoice?.invoice_number ?? null,
      method: row.payment_method,
      paymentDate: row.payment_date,
      reference: row.reference_number,
      status: row.status,
      supplierName: supplier?.name ?? 'Unknown supplier',
    };
  }));
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.payment.post', 'finance.write', 'procurement.write')) return forbidden();

  const body = (await request.json().catch(() => ({}))) as {
    amountPaid?: number;
    paymentDate?: string;
    paymentMethod?: string;
    referenceNumber?: string | null;
    remarks?: string | null;
    supplierId?: string;
    supplierInvoiceId?: string;
  };

  if (!body.supplierId || !body.supplierInvoiceId || !body.paymentMethod || !body.amountPaid) {
    return badRequest('supplierId, supplierInvoiceId, paymentMethod, and amountPaid are required.');
  }
  if (!PAYMENT_SOURCES.has(body.paymentMethod)) {
    return badRequest('Payment source must be BANK, CASH, or PETTY_CASH.');
  }

  const service = createServiceRoleClient();
  const tableCheck = await service.from('supplier_payments').select('id', { count: 'exact', head: true });
  if (tableCheck.error?.message.includes("Could not find the table 'icecream_erp.supplier_payments'")) {
    return serverError('Supplier payments table is not deployed in Supabase yet.');
  }
  const [invoiceResult, paymentsResult] = await Promise.all([
    service.from('supplier_invoices').select('id, invoice_total, status').eq('id', body.supplierInvoiceId).single(),
    service.from('supplier_payments').select('amount_paid').eq('supplier_invoice_id', body.supplierInvoiceId),
  ]);

  if (invoiceResult.error || !invoiceResult.data) return badRequest('Supplier invoice not found.');

  const paidAlready = (paymentsResult.data ?? []).reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0);
  const balance = Number(invoiceResult.data.invoice_total ?? 0) - paidAlready;
  if (!canPayInvoice(balance, Number(body.amountPaid))) {
    return badRequest('Payment must be greater than zero and not exceed the invoice balance.');
  }

  const { data, error } = await service
    .from('supplier_payments')
    .insert({
      amount_paid: body.amountPaid,
      created_by: ctx.userId,
      organization_id: ctx.organizationId,
      payment_date: body.paymentDate ?? new Date().toISOString().slice(0, 10),
      payment_method: body.paymentMethod,
      reference_number: body.referenceNumber ?? null,
      remarks: body.remarks ?? null,
      status: 'POSTED',
      supplier_id: body.supplierId,
      supplier_invoice_id: body.supplierInvoiceId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);
  const sourceReference = buildFinanceSourceReference('procurement', 'supplier_payment', String(data.id));

  let journal: { entryNumber: string; id: string } | null = null;
  let linkedTransaction: { id: string; table: string } | null = null;
  try {
    journal = await postFinanceDocument({
      createdBy: ctx.userId,
      description: `Supplier payment ${data.reference_number ?? data.id}`,
      journalDate: String(data.payment_date ?? body.paymentDate ?? new Date().toISOString().slice(0, 10)),
      lines: [
        {
          accountCode: '2000',
          creditAmount: 0,
          debitAmount: Number(body.amountPaid),
          description: `Reduce accounts payable for supplier invoice ${body.supplierInvoiceId}`,
        },
        {
          accountCode: body.paymentMethod === 'BANK' ? '1000' : '1010',
          creditAmount: Number(body.amountPaid),
          debitAmount: 0,
          description: `Supplier payment via ${body.paymentMethod}`,
        },
      ],
      organizationId: ctx.organizationId,
      sourceDocumentId: String(data.id),
      sourceDocumentType: 'supplier_payment',
      sourceModule: 'procurement',
    });

    linkedTransaction = await createLinkedFinanceTransaction({
      amount: Number(body.amountPaid),
      createdBy: ctx.userId,
      description: `Supplier payment ${data.reference_number ?? data.id}`,
      direction: 'OUT',
      organizationId: ctx.organizationId,
      paymentMethod: body.paymentMethod as 'BANK' | 'CASH' | 'PETTY_CASH',
      referenceNumber: body.referenceNumber ?? null,
      sourceDocument: sourceReference,
      transactionDate: String(data.payment_date ?? body.paymentDate ?? new Date().toISOString().slice(0, 10)),
    });
  } catch (postingError) {
    return serverError(postingError instanceof Error ? postingError.message : 'Failed to post supplier payment to finance.');
  }

  await service
    .from('supplier_invoices')
    .update({ status: Number(body.amountPaid) >= balance ? 'PAID' : 'PARTIAL_PAID' })
    .eq('id', body.supplierInvoiceId);

  return NextResponse.json({ ...data, journal, linkedTransaction }, { status: 201 });
}
