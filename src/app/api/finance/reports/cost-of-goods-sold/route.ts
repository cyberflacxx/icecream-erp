import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, mapNestedRow } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { data, error } = await financeService()
      .from('invoice_items')
      .select('quantity, total_price, items(name, unit_cost), invoices!inner(invoice_number, invoice_date, organization_id)')
      .eq('invoices.organization_id', ctx.organizationId);
    if (error) throw error;

    return NextResponse.json((data ?? []).map((row) => {
      const item = mapNestedRow(row.items as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const invoice = mapNestedRow(row.invoices as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const quantity = Number(row.quantity ?? 0);
      const unitCost = Number(item?.unit_cost ?? 0);
      return {
        costOfGoodsSold: quantity * unitCost,
        invoiceDate: invoice?.invoice_date ?? null,
        invoiceNumber: invoice?.invoice_number ?? null,
        item: item?.name ?? 'Unknown item',
        quantity,
        unitCost,
      };
    }));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
