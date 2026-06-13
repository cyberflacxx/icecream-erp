import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildPayablesRows, calculatePayableBalance } from '@/lib/finance';
import { financeService, mapNestedRow } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const [invoiceResult, paymentResult] = await Promise.all([
      financeService()
        .from('supplier_invoices')
        .select('id, invoice_number, invoice_date, due_date, invoice_total, status, suppliers(name)')
        .eq('organization_id', ctx.organizationId)
        .is('deleted_at', null),
      financeService()
        .from('supplier_payments')
        .select('supplier_invoice_id, amount_paid')
        .eq('organization_id', ctx.organizationId)
        .is('deleted_at', null),
    ]);
    if (invoiceResult.error) throw invoiceResult.error;
    if (paymentResult.error) throw paymentResult.error;

    const paymentsByInvoice = new Map<string, number>();
    for (const row of paymentResult.data ?? []) {
      paymentsByInvoice.set(
        String(row.supplier_invoice_id),
        (paymentsByInvoice.get(String(row.supplier_invoice_id)) ?? 0) + Number(row.amount_paid ?? 0),
      );
    }

    const rows = buildPayablesRows((invoiceResult.data ?? []).map((row) => {
      const supplier = mapNestedRow(row.suppliers as Record<string, unknown> | Array<Record<string, unknown>> | null);
      return {
        amount_due: calculatePayableBalance(
          Number(row.invoice_total ?? 0),
          paymentsByInvoice.get(String(row.id)) ?? 0,
        ),
        due_date: row.due_date,
        invoice_number: row.invoice_number,
        status: row.status,
        supplier_name: supplier?.name ?? 'Unknown supplier',
        total_amount: row.invoice_total,
      };
    }));

    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
