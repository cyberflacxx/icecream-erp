import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildCostVarianceRows } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read', 'finance.read', 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('supplier_invoices')
    .select('invoice_number, suppliers(name), purchase_orders(po_number), supplier_invoice_items(quantity_invoiced, unit_cost, po_unit_cost, unit_cost_reference, items(name))')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null);

  if (error) return serverError(error.message);

  const rows = buildCostVarianceRows((data ?? []) as Array<Record<string, unknown>>);
  return NextResponse.json({
    data: rows,
    summary: {
      totalVariance: rows.reduce((sum, row) => sum + row.priceVariance * row.quantity, 0),
    },
  });
}
