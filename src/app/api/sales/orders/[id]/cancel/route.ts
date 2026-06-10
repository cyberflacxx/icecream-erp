import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ─── POST /api/sales/orders/[id]/cancel ──────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  const { data: order, error: fetchErr } = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .select('id, status, branch_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !order) return notFound('Sales order not found.');

  const o = order as Record<string, unknown>;

  // Branch access check
  if (ctx.isBranchScoped && ctx.branchId && o.branch_id && o.branch_id !== ctx.branchId) {
    return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
  }

  if (o.status === 'delivered' || o.status === 'invoiced') {
    return NextResponse.json(
      { error: 'Delivered or invoiced orders cannot be cancelled.' },
      { status: 400 },
    );
  }

  const { data, error } = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
