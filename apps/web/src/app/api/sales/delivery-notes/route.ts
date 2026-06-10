import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ─── POST /api/sales/delivery-notes ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = await request.json() as {
    salesOrderId: string;
    deliveryDate?: string;
    notes?: string;
  };

  if (!body.salesOrderId) {
    return NextResponse.json({ error: 'salesOrderId is required' }, { status: 400 });
  }

  // Fetch the order and check status
  const { data: order, error: oErr } = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .select('id, status, branch_id')
    .eq('id', body.salesOrderId)
    .is('deleted_at', null)
    .single();

  if (oErr || !order) {
    return NextResponse.json({ error: 'Sales order not found.' }, { status: 404 });
  }

  const o = order as Record<string, unknown>;

  // Branch access check
  if (ctx.isBranchScoped && ctx.branchId && o.branch_id && o.branch_id !== ctx.branchId) {
    return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
  }

  if (o.status !== 'confirmed' && o.status !== 'picking') {
    return NextResponse.json(
      { error: 'Delivery notes can only be created for confirmed orders.' },
      { status: 400 },
    );
  }

  // Generate delivery number
  const { count } = await service
    .schema('icecream_erp')
    .from('delivery_notes')
    .select('id', { count: 'exact', head: true });

  const deliveryNumber = `DN-${String((count ?? 0) + 1).padStart(5, '0')}`;

  const { data, error } = await service
    .schema('icecream_erp')
    .from('delivery_notes')
    .insert({
      delivery_number: deliveryNumber,
      sales_order_id: body.salesOrderId,
      delivery_date: body.deliveryDate ?? new Date().toISOString().slice(0, 10),
      notes: body.notes ?? null,
      status: 'draft',
      delivered_by: ctx.userId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
