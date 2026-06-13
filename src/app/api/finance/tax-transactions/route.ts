import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const [sales, purchases] = await Promise.all([
      financeService()
        .from('invoices')
        .select('invoice_number, invoice_date, tax_amount, total')
        .eq('organization_id', ctx.organizationId)
        .is('deleted_at', null),
      financeService()
        .from('supplier_invoices')
        .select('invoice_number, invoice_date, tax_amount, invoice_total')
        .eq('organization_id', ctx.organizationId)
        .is('deleted_at', null),
    ]);
    if (sales.error) throw sales.error;
    if (purchases.error) throw purchases.error;

    return NextResponse.json([
      ...(sales.data ?? []).map((row) => ({
        amount: row.total,
        documentNumber: row.invoice_number,
        taxAmount: row.tax_amount,
        transactionDate: row.invoice_date,
        transactionType: 'SALES',
      })),
      ...(purchases.data ?? []).map((row) => ({
        amount: row.invoice_total,
        documentNumber: row.invoice_number,
        taxAmount: row.tax_amount,
        transactionDate: row.invoice_date,
        transactionType: 'PURCHASE',
      })),
    ]);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
