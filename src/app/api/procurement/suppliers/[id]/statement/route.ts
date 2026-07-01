import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.supplier.view', 'supplier.read', 'procurement.read', 'finance.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const { data: supplier, error: supplierError } = await service
    .from('suppliers')
    .select('id, code, name, current_balance, credit_limit')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .eq('id', id)
    .maybeSingle();

  if (supplierError) return serverError(supplierError.message);
  if (!supplier) return notFound('Supplier not found.');

  const [invoices, payments] = await Promise.all([
    service
      .from('supplier_invoices')
      .select('id, invoice_number, invoice_date, due_date, invoice_total, status')
      .eq('organization_id', ctx.organizationId)
      .eq('supplier_id', id)
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false }),
    service
      .from('supplier_payments')
      .select('id, payment_date, amount_paid, payment_method, reference_number, supplier_invoice_id')
      .eq('organization_id', ctx.organizationId)
      .eq('supplier_id', id)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false }),
  ]);

  if (invoices.error && !invoices.error.message.includes("supplier_invoices")) return serverError(invoices.error.message);
  if (payments.error && !payments.error.message.includes("supplier_payments")) return serverError(payments.error.message);

  const invoiceRows = (invoices.data ?? []).map((row) => ({
    amount: Number(row.invoice_total ?? 0),
    documentNumber: row.invoice_number,
    documentType: 'INVOICE',
    dueDate: row.due_date,
    id: row.id,
    postedAt: row.invoice_date,
    status: row.status,
  }));

  const paymentRows = (payments.data ?? []).map((row) => ({
    amount: Number(row.amount_paid ?? 0) * -1,
    documentNumber: row.reference_number ?? row.id,
    documentType: 'PAYMENT',
    dueDate: null,
    id: row.id,
    postedAt: row.payment_date,
    status: row.payment_method,
  }));

  const statementLines = [...invoiceRows, ...paymentRows].sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)));

  return NextResponse.json({
    currentBalance: Number(supplier.current_balance ?? 0),
    lines: statementLines,
    supplier: {
      code: supplier.code,
      creditLimit: Number(supplier.credit_limit ?? 0),
      id: supplier.id,
      name: supplier.name,
    },
  });
}
