import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ─── GET /api/sales/orders/[id] ───────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const service = createServiceRoleClient();

  const { data, error } = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .select(`*, customers(*), sales_order_items(*, items(*)), warehouses(*)`)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return notFound('Sales order not found.');

  const order = data as Record<string, unknown>;

  // Branch access check
  if (ctx.isBranchScoped && ctx.branchId && order.branch_id && order.branch_id !== ctx.branchId) {
    return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
  }

  return NextResponse.json(data);
}
