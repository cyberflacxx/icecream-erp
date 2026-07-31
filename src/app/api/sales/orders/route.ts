import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { resolveRequestedBranchId } from '@/lib/branch-access';
import { isCustomerInactiveStatus } from '@/lib/sales-customers';
import { isMissingSalesColumn, salesErrorMessage } from '@/lib/sales-server';
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
    .select('id, order_number, order_date, delivery_date, required_date, status, total_amount, total, branch_id, customer_id')
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

  let result = await query;
  if (
    result.error &&
    (
      isMissingSalesColumn(result.error, 'sales_orders', 'total_amount') ||
      isMissingSalesColumn(result.error, 'sales_orders', 'delivery_date')
    )
  ) {
    let fallbackQuery = service
      .schema('icecream_erp')
      .from('sales_orders')
      .select('id, order_number, order_date, delivery_date, required_date, status, total, branch_id, customer_id')
      .order('order_date', { ascending: false });

    if (ctx.isBranchScoped && ctx.branchId) {
      fallbackQuery = fallbackQuery.eq('branch_id', ctx.branchId);
    } else if (branchId) {
      fallbackQuery = fallbackQuery.eq('branch_id', branchId);
    }

    if (status) fallbackQuery = fallbackQuery.eq('status', status);
    if (customerId) fallbackQuery = fallbackQuery.eq('customer_id', customerId);
    if (startDate) fallbackQuery = fallbackQuery.gte('order_date', startDate);
    if (endDate) fallbackQuery = fallbackQuery.lte('order_date', endDate);

    result = await fallbackQuery;
  }

  if (result.error) return serverError(result.error.message);

  const rows = (result.data ?? []) as Array<Record<string, unknown>>;
  const customerIds = [...new Set(rows.map((row) => String(row.customer_id ?? '')).filter(Boolean))];
  const orderIds = rows.map((row) => String(row.id));

  const [customersResult, itemsResult] = await Promise.all([
    customerIds.length
      ? service.schema('icecream_erp').from('customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? service.schema('icecream_erp').from('sales_order_items').select('order_id').in('order_id', orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customersResult.error) return serverError(customersResult.error.message);
  if (itemsResult.error) return serverError(itemsResult.error.message);

  const customersById = new Map(
    ((customersResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.id),
      { id: String(row.id), name: String(row.name ?? 'Unknown customer') },
    ]),
  );
  const itemCountByOrderId = new Map<string, number>();
  for (const item of (itemsResult.data ?? []) as Array<Record<string, unknown>>) {
    const orderId = String(item.order_id ?? '');
    if (!orderId) continue;
    itemCountByOrderId.set(orderId, (itemCountByOrderId.get(orderId) ?? 0) + 1);
  }

  const mapped = rows.map((row) => {
    const orderId = String(row.id);
    return {
      id: orderId,
      orderNumber: row.order_number,
      customer: customersById.get(String(row.customer_id ?? '')) ?? null,
      orderDate: row.order_date,
      requiredDate: row.delivery_date ?? row.required_date ?? null,
      status: row.status,
      itemsCount: itemCountByOrderId.get(orderId) ?? 0,
      total: row.total_amount ? Number(row.total_amount) : Number(row.total ?? 0),
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

  const branchRows = body.branchId
    ? await service
        .schema('icecream_erp')
        .from('branches')
        .select('id, organization_id, status')
        .eq('organization_id', ctx.organizationId)
        .eq('id', body.branchId)
    : { data: [], error: null };
  if (branchRows.error) return serverError(branchRows.error.message);

  const branchAuthorization = resolveRequestedBranchId(
    {
      branchAssignments: ctx.branchAssignments,
      branchId: ctx.branchId,
      isBranchScoped: ctx.isBranchScoped,
      organizationId: ctx.organizationId,
      permissions: ctx.permissions,
    },
    body.branchId,
    (branchRows.data ?? []).map((branch) => ({
      id: String(branch.id),
      organizationId: String(branch.organization_id ?? ''),
      status: branch.status ? String(branch.status) : null,
    })),
    { includeInactive: false },
  );
  if (!branchAuthorization.ok && body.branchId) {
    return NextResponse.json({ error: branchAuthorization.message }, { status: branchAuthorization.status });
  }

  // Verify customer
  const { data: customer } = await service
    .schema('icecream_erp')
    .from('customers')
    .select('id, status')
    .eq('id', body.customerId)
    .single();

  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  if (isCustomerInactiveStatus(customer.status)) {
    return NextResponse.json({ error: 'Inactive customers cannot be used on new sales orders.' }, { status: 400 });
  }

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

  const resolvedBranchId = branchAuthorization.ok && branchAuthorization.branchId
    ? branchAuthorization.branchId
    : (wh.branch_id ? String(wh.branch_id) : null);

  if (resolvedBranchId && wh.branch_id && String(wh.branch_id) !== resolvedBranchId) {
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
    .in('id', itemIds);

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

  const orderPayload = {
    order_number: orderNumber,
    customer_id: body.customerId,
    warehouse_id: body.warehouseId,
    branch_id: resolvedBranchId,
    quotation_id: body.quotationId ?? null,
    order_date: body.orderDate ?? new Date().toISOString().slice(0, 10),
    delivery_date: body.requiredDate ?? null,
    status: 'DRAFT',
    subtotal,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total_amount: total,
    notes: body.notes ?? null,
    created_by: ctx.userId,
    organization_id: ctx.organizationId,
  };

  let orderResult = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .insert(orderPayload)
    .select()
    .single();
  if (orderResult.error && salesErrorMessage(orderResult.error).includes('quotation_id')) {
    const { quotation_id: _quotationId, ...fallbackPayload } = orderPayload;
    orderResult = await service
      .schema('icecream_erp')
      .from('sales_orders')
      .insert(fallbackPayload)
      .select()
      .single();
  }
  const { data: order, error: oErr } = orderResult;

  if (oErr || !order) return serverError(oErr?.message ?? 'Failed to create order');

  const o = order as Record<string, unknown>;

  const { error: itemsErr } = await service
    .schema('icecream_erp')
    .from('sales_order_items')
    .insert(
      normalizedItems.map((item) => ({
        order_id: o.id,
        item_id: item.itemId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_pct: item.discountPercent ?? 0,
        line_total: item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100),
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
