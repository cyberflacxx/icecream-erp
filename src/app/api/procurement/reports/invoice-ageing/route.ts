import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildInvoiceAgeingRows } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read', 'finance.read', 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  const [invoices, payments] = await Promise.all([
    service.from('supplier_invoices').select('id, invoice_number, invoice_date, due_date, invoice_total, status, suppliers(name)').eq('organization_id', ctx.organizationId).is('deleted_at', null),
    service.from('supplier_payments').select('supplier_invoice_id, amount_paid').eq('organization_id', ctx.organizationId).is('deleted_at', null),
  ]);

  if (invoices.error) return serverError(invoices.error.message);
  if (payments.error) return serverError(payments.error.message);

  const paymentsByInvoiceId = new Map<string, number>();
  for (const payment of payments.data ?? []) {
    const key = String(payment.supplier_invoice_id);
    paymentsByInvoiceId.set(key, (paymentsByInvoiceId.get(key) ?? 0) + Number(payment.amount_paid ?? 0));
  }

  const data = buildInvoiceAgeingRows((invoices.data ?? []) as Array<Record<string, unknown>>, paymentsByInvoiceId);
  return NextResponse.json({
    data,
    summary: {
      overdueInvoices: data.filter((row) => row.overdueDays > 0 && row.balance > 0).length,
      totalOutstanding: data.reduce((sum, row) => sum + row.balance, 0),
    },
  });
}
