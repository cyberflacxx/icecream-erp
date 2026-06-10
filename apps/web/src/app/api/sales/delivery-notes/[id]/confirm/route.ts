import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ─── POST /api/sales/delivery-notes/[id]/confirm ─────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  // Fetch delivery note with related order and items
  const { data: note, error: nErr } = await service
    .schema('icecream_erp')
    .from('delivery_notes')
    .select(`
      id, status, delivery_number, delivery_date, sales_order_id,
      sales_orders!inner(
        id, status, branch_id,
        customers(id, name, address),
        sales_order_items(id, item_id, quantity_ordered, items(id, code, name))
      )
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (nErr || !note) return notFound('Delivery note not found.');

  const n = note as Record<string, unknown>;
  const salesOrder = n.sales_orders as Record<string, unknown> | null;

  // Branch access check
  if (ctx.isBranchScoped && ctx.branchId && salesOrder?.branch_id && salesOrder.branch_id !== ctx.branchId) {
    return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
  }

  if (n.status !== 'draft' && n.status !== 'dispatched') {
    return NextResponse.json(
      { error: 'Only draft or dispatched delivery notes can be confirmed.' },
      { status: 400 },
    );
  }

  const orderItems = (salesOrder?.sales_order_items as Array<Record<string, unknown>>) ?? [];

  // Update all order items: set quantity_delivered = quantity_ordered
  for (const item of orderItems) {
    await service
      .schema('icecream_erp')
      .from('sales_order_items')
      .update({ quantity_delivered: item.quantity_ordered, updated_at: new Date().toISOString() })
      .eq('id', item.id as string);
  }

  // Mark delivery note as delivered
  const { data: updatedNote, error: dnErr } = await service
    .schema('icecream_erp')
    .from('delivery_notes')
    .update({ status: 'delivered', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (dnErr) return serverError(dnErr.message);

  // Mark sales order as delivered
  const { error: orderErr } = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .update({ status: 'delivered', updated_at: new Date().toISOString() })
    .eq('id', n.sales_order_id as string);

  if (orderErr) return serverError(orderErr.message);

  return NextResponse.json(updatedNote);
}
