import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ─── POST /api/sales/quotations/[id]/convert-to-order ────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  // Fetch quotation with items
  const { data: quotation, error: qErr } = await service
    .schema('icecream_erp')
    .from('quotations')
    .select(`*, quotation_items(*)`)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (qErr || !quotation) return notFound('Quotation not found.');

  const q = quotation as Record<string, unknown>;

  const invalidStatuses = ['cancelled', 'rejected', 'expired'];
  if (invalidStatuses.includes(String(q.status))) {
    return NextResponse.json(
      { error: 'Quotation cannot be converted in its current status.' },
      { status: 400 },
    );
  }

  // Find an available warehouse (branch-scoped if applicable)
  let warehouseQuery = service
    .schema('icecream_erp')
    .from('warehouses')
    .select('id, branch_id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (ctx.isBranchScoped && ctx.branchId) {
    warehouseQuery = warehouseQuery.eq('branch_id', ctx.branchId);
  }

  const { data: warehouses, error: wErr } = await warehouseQuery;
  if (wErr || !warehouses?.length) {
    return NextResponse.json(
      { error: 'No warehouse available for sales order conversion.' },
      { status: 400 },
    );
  }

  const warehouse = warehouses[0] as Record<string, unknown>;

  // Branch access check
  if (ctx.isBranchScoped && ctx.branchId && warehouse.branch_id && warehouse.branch_id !== ctx.branchId) {
    return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
  }

  // Generate order number
  const { count } = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .select('id', { count: 'exact', head: true });

  const orderNumber = `SO-${String((count ?? 0) + 1).padStart(5, '0')}`;

  const { data: order, error: oErr } = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .insert({
      order_number: orderNumber,
      customer_id: q.customer_id,
      quotation_id: q.id,
      warehouse_id: warehouse.id,
      branch_id: warehouse.branch_id ?? null,
      order_date: new Date().toISOString().slice(0, 10),
      required_date: q.valid_until ?? null,
      status: 'draft',
      subtotal: q.subtotal,
      tax_amount: q.tax_amount,
      discount_amount: q.discount_amount,
      total: q.total,
      notes: q.notes ?? null,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (oErr || !order) return serverError(oErr?.message ?? 'Failed to create sales order');

  const o = order as Record<string, unknown>;
  const quotationItems = (q.quotation_items as Array<Record<string, unknown>>) ?? [];

  if (quotationItems.length > 0) {
    const { error: itemsErr } = await service
      .schema('icecream_erp')
      .from('sales_order_items')
      .insert(
        quotationItems.map((item) => ({
          sales_order_id: o.id,
          item_id: item.item_id,
          quantity_ordered: item.quantity,
          quantity_delivered: 0,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent ?? null,
          total_price: item.total_price,
        })),
      );

    if (itemsErr) return serverError(itemsErr.message);
  }

  // Mark quotation as accepted
  await service
    .schema('icecream_erp')
    .from('quotations')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', params.id);

  // Return full order
  const { data: result, error: resultErr } = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .select(`*, customers(*), sales_order_items(*, items(*)), warehouses(*)`)
    .eq('id', o.id as string)
    .single();

  if (resultErr) return serverError(resultErr.message);

  return NextResponse.json(result, { status: 201 });
}
