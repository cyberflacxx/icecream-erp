import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
  return { page, pageSize };
}

function paginate<T>(data: T[], page: number, pageSize: number) {
  const total = data.length;
  const start = (page - 1) * pageSize;
  return { data: data.slice(start, start + pageSize), pagination: { page, pageSize, total } };
}

function mapLineTotals(items: Array<{ discountPercent?: number | null; quantity: number; unitPrice: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lineDiscountTotal = items.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice * ((item.discountPercent ?? 0) / 100);
  }, 0);
  return { subtotal, lineDiscountTotal };
}

// ─── GET /api/sales/orders ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePagination(searchParams);
  const status = searchParams.get('status') ?? '';
  const customerId = searchParams.get('customerId') ?? '';
  const branchId = searchParams.get('branchId') ?? '';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';

  let query = service
    .schema('icecream_erp')
    .from('sales_orders')
    .select(`
      id, order_number, order_date, required_date, status, total, branch_id,
      customers!inner(id, name),
      sales_order_items(id)
    `)
    .is('deleted_at', null)
    .order('order_date', { ascending: false });

  // Branch scoping
  if (ctx.isBranchScoped && ctx.branchId) {
    query = query.eq('branch_id', ctx.branchId);
  } else if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  if (status) query = query.eq('status', status);
  if (customerId) query = query.eq('customer_id', customerId);
  if (startDate) query = query.gte('order_date', startDate);
  if (endDate) query = query.lte('order_date', endDate);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const mapped = (data ?? []).map((row: Record<string, unknown>) => {
    const customer = row.customers as { id: string; name: string } | null;
    const items = (row.sales_order_items as unknown[]) ?? [];
    return {
      id: row.id,
      orderNumber: row.order_number,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      orderDate: row.order_date,
      requiredDate: row.required_date,
      status: row.status,
      itemsCount: items.length,
      total: row.total ? Number(row.total) : 0,
    };
  });

  return NextResponse.json(paginate(mapped, page, pageSize));
}

// ─── POST /api/sales/orders ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = await request.json() as {
    customerId: string;
    warehouseId: string;
    branchId?: string;
    quotationId?: string;
    orderDate?: string;
    requiredDate?: string;
    notes?: string;
    discountAmount: number;
    taxAmount: number;
    items: Array<{
      itemId: string;
      quantityOrdered: number;
      unitPrice: number;
      discountPercent?: number;
    }>;
  };

  if (!body.customerId || !body.warehouseId || !body.items?.length) {
    return NextResponse.json(
      { error: 'customerId, warehouseId, and items are required' },
      { status: 400 },
    );
  }

  // Branch access check
  if (ctx.isBranchScoped && ctx.branchId && body.branchId && ctx.branchId !== body.branchId) {
    return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
  }

  // Verify customer
  const { data: customer } = await service
    .schema('icecream_erp')
    .from('customers')
    .select('id')
    .eq('id', body.customerId)
    .is('deleted_at', null)
    .single();

  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });

  // Verify warehouse
  const { data: warehouse } = await service
    .schema('icecream_erp')
    .from('warehouses')
    .select('id, branch_id')
    .eq('id', body.warehouseId)
    .eq('is_active', true)
    .single();

  if (!warehouse) return NextResponse.json({ error: 'Warehouse not found.' }, { status: 404 });

  const wh = warehouse as Record<string, unknown>;

  // Warehouse branch access
  if (ctx.isBranchScoped && ctx.branchId && wh.branch_id && wh.branch_id !== ctx.branchId) {
    return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
  }

  if (body.branchId && wh.branch_id !== body.branchId) {
    return NextResponse.json(
      { error: 'Selected warehouse does not belong to the selected branch.' },
      { status: 400 },
    );
  }

  // Validate items
  const itemIds = [...new Set(body.items.map((i) => i.itemId))];
  const { data: validItems } = await service
    .schema('icecream_erp')
    .from('items')
    .select('id')
    .in('id', itemIds)
    .is('deleted_at', null);

  if ((validItems?.length ?? 0) !== itemIds.length) {
    return NextResponse.json({ error: 'One or more sales order items are invalid.' }, { status: 400 });
  }

  const normalizedItems = body.items.map((item) => ({
    discountPercent: item.discountPercent,
    quantity: item.quantityOrdered,
    unitPrice: item.unitPrice,
    itemId: item.itemId,
  }));
  const { subtotal, lineDiscountTotal } = mapLineTotals(normalizedItems);
  const discountAmount = body.discountAmount ?? 0;
  const taxAmount = body.taxAmount ?? 0;
  const total = subtotal + taxAmount - discountAmount - lineDiscountTotal;

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
      customer_id: body.customerId,
      warehouse_id: body.warehouseId,
      branch_id: body.branchId ?? wh.branch_id ?? null,
      quotation_id: body.quotationId ?? null,
      order_date: body.orderDate ?? new Date().toISOString().slice(0, 10),
      required_date: body.requiredDate ?? null,
      status: 'draft',
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      notes: body.notes ?? null,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (oErr || !order) return serverError(oErr?.message ?? 'Failed to create order');

  const o = order as Record<string, unknown>;

  const { error: itemsErr } = await service
    .schema('icecream_erp')
    .from('sales_order_items')
    .insert(
      normalizedItems.map((item) => ({
        sales_order_id: o.id,
        item_id: item.itemId,
        quantity_ordered: item.quantity,
        quantity_delivered: 0,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent ?? null,
        total_price: item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100),
      })),
    );

  if (itemsErr) return serverError(itemsErr.message);

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
