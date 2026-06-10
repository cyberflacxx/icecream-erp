import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const { branchId } = await params;
  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  const paymentMethod = searchParams.get('paymentMethod') ?? undefined;
  const shift = searchParams.get('shift') ?? undefined;

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== branchId) return forbidden();

    let query = service
      .schema('icecream_erp')
      .from('branch_sales')
      .select('id, sale_number, sale_date, shift, total_amount, payment_method, served_by, branch_sale_items(id)', { count: 'exact' })
      .is('deleted_at', null)
      .eq('branch_id', branchId)
      .order('sale_date', { ascending: false });

    if (paymentMethod) query = query.eq('payment_method', paymentMethod);
    if (shift) query = query.eq('shift', shift);
    if (startDate) query = query.gte('sale_date', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('sale_date', `${endDate}T23:59:59.999Z`);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        saleNumber: row.sale_number,
        saleDate: row.sale_date,
        shift: row.shift,
        itemsCount: Array.isArray(row.branch_sale_items) ? row.branch_sale_items.length : 0,
        totalAmount: Number(row.total_amount ?? 0),
        paymentMethod: row.payment_method,
      })),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const { branchId } = await params;
  const service = createServiceRoleClient();

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== branchId) return forbidden();

    const body = await request.json() as {
      paymentMethod: string;
      shift: string;
      items: Array<{ itemId: string; quantity: number; unitPrice: number; totalPrice: number }>;
      customerId?: string;
      paymentReference?: string;
      saleDate?: string;
    };

    if (!body.paymentMethod || !body.shift || !body.items?.length) {
      return badRequest('paymentMethod, shift, and items are required');
    }

    // Validate branch warehouse
    const { data: warehouse } = await service
      .schema('icecream_erp')
      .from('warehouses')
      .select('id')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .eq('type', 'BRANCH')
      .maybeSingle();
    if (!warehouse) return badRequest('No active branch warehouse found');

    // Validate items
    const itemIds = [...new Set(body.items.map((i) => i.itemId))];
    const { data: items } = await service
      .schema('icecream_erp')
      .from('items')
      .select('id')
      .is('deleted_at', null)
      .eq('is_active', true)
      .eq('item_type', 'FINISHED_GOOD')
      .in('id', itemIds);
    if ((items ?? []).length !== itemIds.length) return badRequest('One or more sale items are invalid');

    // Generate sale number
    const { count } = await service.schema('icecream_erp').from('branch_sales').select('*', { count: 'exact', head: true });
    const saleNumber = `BS-${String((count ?? 0) + 1).padStart(5, '0')}`;
    const totalAmount = body.items.reduce((s, i) => s + i.totalPrice, 0);

    const { data: sale, error: saleErr } = await service
      .schema('icecream_erp')
      .from('branch_sales')
      .insert({
        branch_id: branchId,
        sale_number: saleNumber,
        payment_method: body.paymentMethod,
        shift: body.shift,
        total_amount: totalAmount,
        sale_date: body.saleDate ? new Date(`${body.saleDate}T00:00:00.000Z`).toISOString() : new Date().toISOString(),
        served_by: ctx.userId,
        customer_id: body.customerId ?? null,
        payment_reference: body.paymentReference ?? null,
      })
      .select()
      .single();
    if (saleErr) throw saleErr;

    await service.schema('icecream_erp').from('branch_sale_items').insert(
      body.items.map((i) => ({
        branch_sale_id: sale.id,
        item_id: i.itemId,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        total_price: i.totalPrice,
      }))
    );

    // Issue stock
    for (const item of body.items) {
      const { data: balance } = await service
        .schema('icecream_erp')
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_available')
        .eq('item_id', item.itemId)
        .eq('warehouse_id', warehouse.id)
        .maybeSingle();

      if (balance) {
        await service.schema('icecream_erp').from('stock_balances').update({
          quantity_on_hand: Math.max(0, Number(balance.quantity_on_hand) - item.quantity),
          quantity_available: Math.max(0, Number(balance.quantity_available) - item.quantity),
          last_updated: new Date().toISOString(),
        }).eq('id', balance.id);

        await service.schema('icecream_erp').from('stock_movements').insert({
          item_id: item.itemId,
          warehouse_id: warehouse.id,
          movement_type: 'SALES_ISSUE',
          quantity: item.quantity,
          unit_cost: item.unitPrice,
          total_cost: item.totalPrice,
          reference_id: sale.id,
          reference_type: 'branch_sale',
          created_by: ctx.userId,
        });
      }
    }

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'BRANCH_SALE_CREATED',
      entity_id: sale.id,
      entity_type: 'branch_sale',
      new_values: { branchId, paymentMethod: body.paymentMethod, totalAmount },
      user_profile_id: ctx.userId,
    });

    const { data: full } = await service
      .schema('icecream_erp')
      .from('branch_sales')
      .select('*, branch_sale_items(*, items(id, code, name))')
      .eq('id', sale.id)
      .single();

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
