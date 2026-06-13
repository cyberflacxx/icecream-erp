import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { canPayInvoice } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('supplier_payments')
    .select('id, payment_date, payment_method, reference_number, amount_paid, status, suppliers(name), supplier_invoices(invoice_number)')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .order('payment_date', { ascending: false });

  if (error) return serverError(error.message);

  return NextResponse.json((data ?? []).map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const invoice = Array.isArray(row.supplier_invoices) ? row.supplier_invoices[0] : row.supplier_invoices;
    return {
      amountPaid: Number(row.amount_paid ?? 0),
      id: row.id,
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
  if (!can(ctx, 'finance.write', 'procurement.write')) return forbidden();

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

  const service = createServiceRoleClient();
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
  return NextResponse.json(data, { status: 201 });
}
