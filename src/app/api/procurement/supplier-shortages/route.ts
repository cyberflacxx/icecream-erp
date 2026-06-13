import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildSupplierShortageRows } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const supplierId = searchParams.get('supplierId') ?? '';

  let query = service
    .from('purchase_orders')
    .select(
      `id, po_number, expected_delivery_date, supplier_id, suppliers(name),
       purchase_order_items(quantity_ordered, quantity_received, items(name))`,
    )
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null);

  if (supplierId) query = query.eq('supplier_id', supplierId);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  return NextResponse.json(buildSupplierShortageRows((data ?? []) as Array<Record<string, unknown>>));
}
