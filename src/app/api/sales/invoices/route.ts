import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isCustomerInactiveStatus } from '@/lib/sales-customers';
import {
  isMissingSalesColumn,
  isMissingSalesTable,
  logSalesRouteError,
  loadSalesOrderById,
  loadSalesOrderItems,
} from '@/lib/sales-server';
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

// ─── GET /api/sales/invoices ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePagination(searchParams);
  const status = searchParams.get('status') ?? '';
  const customerId = searchParams.get('customerId') ?? '';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';
  let scopedOrderIds: string[] | null = null;
  if (ctx.isBranchScoped && ctx.branchId) {
    const scopedOrders = await service
      .schema('icecream_erp')
      .from('sales_orders')
      .select('id')
      .eq('branch_id', ctx.branchId);

    if (scopedOrders.error) {
      logSalesRouteError('invoices', 'load branch-scoped sales orders', scopedOrders.error);
      return serverError('Sales invoices could not be loaded.');
    }

    scopedOrderIds = (scopedOrders.data ?? []).map((row) => String(row.id));
  }

  const applyFilters = (
    query: {
      eq: (column: string, value: string) => any;
      gte: (column: string, value: string) => any;
      lte: (column: string, value: string) => any;
      in: (column: string, values: string[]) => any;
    },
    orderColumn = 'sales_order_id',
  ) => {
    let next = query;
    if (status) next = next.eq('status', status);
    if (customerId) next = next.eq('customer_id', customerId);
    if (startDate) next = next.gte('invoice_date', startDate);
    if (endDate) next = next.lte('invoice_date', endDate);
    if (scopedOrderIds) {
      next = scopedOrderIds.length
        ? next.in(orderColumn, scopedOrderIds)
        : next.in(orderColumn, ['00000000-0000-0000-0000-000000000000']);
    }
    return next;
  };

  let invoicesResult = await applyFilters(
    service
      .schema('icecream_erp')
      .from('invoices')
      .select('id, invoice_number, invoice_date, due_date, status, total, amount_paid, balance_due, customer_id, sales_order_id')
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false }),
  );

  if (
    invoicesResult.error &&
    (
      isMissingSalesColumn(invoicesResult.error, 'invoices', 'deleted_at') ||
      isMissingSalesColumn(invoicesResult.error, 'invoices', 'sales_order_id') ||
      isMissingSalesColumn(invoicesResult.error, 'invoices', 'total') ||
      isMissingSalesColumn(invoicesResult.error, 'invoices', 'amount_paid')
    )
  ) {
    invoicesResult = await applyFilters(
      service
        .schema('icecream_erp')
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, status, total_amount, paid_amount, balance_due, customer_id, order_id')
        .order('invoice_date', { ascending: false }),
      'order_id',
    );
  }

  if (invoicesResult.error) {
    logSalesRouteError('invoices', 'load invoice list', invoicesResult.error);
    return serverError('Sales invoices could not be loaded.');
  }

  const rows = (invoicesResult.data ?? []) as Array<Record<string, unknown>>;
  const customerIds = [...new Set(rows.map((row) => String(row.customer_id ?? '')).filter(Boolean))];
  const invoiceIds = rows.map((row) => String(row.id));

  const [customersResult, invoiceItemsResult] = await Promise.all([
    customerIds.length
      ? service.schema('icecream_erp').from('customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
    invoiceIds.length
      ? service.schema('icecream_erp').from('invoice_items').select('invoice_id').in('invoice_id', invoiceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customersResult.error) {
    logSalesRouteError('invoices', 'load invoice customers', customersResult.error);
    return serverError('Sales invoices could not be loaded.');
  }
  if (invoiceItemsResult.error && !isMissingSalesTable(invoiceItemsResult.error)) {
    logSalesRouteError('invoices', 'load invoice items', invoiceItemsResult.error);
    return serverError('Sales invoices could not be loaded.');
  }

  const customersById = new Map(
    ((customersResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.id),
      { id: String(row.id), name: String(row.name ?? 'Unknown customer') },
    ]),
  );
  const itemsCountByInvoiceId = new Map<string, number>();
  for (const item of (invoiceItemsResult.data ?? []) as Array<Record<string, unknown>>) {
    const invoiceId = String(item.invoice_id ?? '');
    if (!invoiceId) continue;
    itemsCountByInvoiceId.set(invoiceId, (itemsCountByInvoiceId.get(invoiceId) ?? 0) + 1);
  }

  return NextResponse.json(
    paginate(
      rows.map((row) => ({
        amountPaid: Number(row.amount_paid ?? row.paid_amount ?? 0),
        balanceDue: Number(row.balance_due ?? 0),
        customer: customersById.get(String(row.customer_id ?? '')) ?? null,
        dueDate: row.due_date ? String(row.due_date) : null,
        id: String(row.id),
        invoiceDate: row.invoice_date ? String(row.invoice_date) : null,
        invoiceNumber: String(row.invoice_number ?? row.id ?? ''),
        itemsCount: itemsCountByInvoiceId.get(String(row.id)) ?? 0,
        status: String(row.status ?? ''),
        total: Number(row.total ?? row.total_amount ?? 0),
      })),
      page,
      pageSize,
    ),
  );
}

// ─── POST /api/sales/invoices ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = await request.json() as {
    customerId: string;
    salesOrderId?: string;
    warehouseId?: string;
    invoiceDate?: string;
    dueDate?: string;
    notes?: string;
    discountAmount: number;
    taxAmount: number;
    items?: Array<{
      itemId: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
    }>;
  };

  if (!body.customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  }

  // Verify customer
  let customerResult = await service
    .schema('icecream_erp')
    .from('customers')
    .select('id, current_balance, status')
    .eq('id', body.customerId)
    .single();
  if (customerResult.error && isMissingSalesColumn(customerResult.error, 'customers', 'current_balance')) {
    customerResult = await service
      .schema('icecream_erp')
      .from('customers')
      .select('id, outstanding_balance, status')
      .eq('id', body.customerId)
      .single();
  }
  const { data: customer } = customerResult;

  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  if (isCustomerInactiveStatus(customer.status)) {
    return NextResponse.json({ error: 'Inactive customers cannot be used on new invoices.' }, { status: 400 });
  }

  const cust = customer as Record<string, unknown>;

  let orderItems: Array<{
    item_id: string;
    quantity_ordered: number;
    unit_price: number;
    discount_percent: number | null;
  }> = [];
  let branchId: string | null = null;
  let warehouseId: string | null = body.warehouseId ?? null;

  // If linked to a sales order, pull its items
  if (body.salesOrderId) {
    let order: Record<string, unknown> | null = null;
    try {
      order = await loadSalesOrderById(
        service.schema('icecream_erp'),
        body.salesOrderId,
        ctx.organizationId,
        'id, branch_id, warehouse_id, status',
      );
    } catch (error) {
      return serverError(error instanceof Error ? error.message : 'Failed to load sales order.');
    }

    if (!order) {
      const directOrder = await service
        .schema('icecream_erp')
        .from('sales_orders')
        .select('id, branch_id, warehouse_id, status, organization_id')
        .eq('id', body.salesOrderId)
        .maybeSingle();

      if (directOrder.error) {
        return serverError(directOrder.error.message);
      }

      order = (directOrder.data ?? null) as Record<string, unknown> | null;
    }

    if (!order) {
      const orderByNumber = await service
        .schema('icecream_erp')
        .from('sales_orders')
        .select('id, branch_id, warehouse_id, status, organization_id')
        .eq('order_number', body.salesOrderId)
        .maybeSingle();

      if (orderByNumber.error) {
        return serverError(orderByNumber.error.message);
      }

      order = (orderByNumber.data ?? null) as Record<string, unknown> | null;
    }

    if (!order) return NextResponse.json({ error: 'Sales order not found.' }, { status: 404 });

    const ord = order;
    branchId = (ord.branch_id as string) ?? null;
    warehouseId = (ord.warehouse_id as string) ?? warehouseId;

    if (ctx.isBranchScoped && ctx.branchId && branchId && ctx.branchId !== branchId) {
      return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
    }

    try {
      orderItems = await loadSalesOrderItems(service.schema('icecream_erp'), String(ord.id ?? body.salesOrderId));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : 'Failed to load sales order items.');
    }
  }

  // Resolve items: explicit body.items > orderItems
  const resolvedItems = body.items?.length
    ? body.items.map((i) => ({
        itemId: i.itemId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountPercent: i.discountPercent,
      }))
    : orderItems.map((i) => ({
        itemId: i.item_id,
        quantity: i.quantity_ordered,
        unitPrice: i.unit_price,
        discountPercent: i.discount_percent ?? undefined,
      }));

  if (!resolvedItems.length) {
    return NextResponse.json({ error: 'Invoice requires at least one line item.' }, { status: 400 });
  }

  // Validate items
  const itemIds = [...new Set(resolvedItems.map((i) => i.itemId))];
  const { data: validItems } = await service
    .schema('icecream_erp')
    .from('items')
    .select('id')
    .in('id', itemIds);

  if ((validItems?.length ?? 0) !== itemIds.length) {
    return NextResponse.json({ error: 'One or more invoice items are invalid.' }, { status: 400 });
  }

  const { subtotal, lineDiscountTotal } = mapLineTotals(
    resolvedItems.map((i) => ({ discountPercent: i.discountPercent, quantity: i.quantity, unitPrice: i.unitPrice })),
  );
  const discountAmount = body.discountAmount ?? 0;
  const taxAmount = body.taxAmount ?? 0;
  const total = subtotal + taxAmount - discountAmount - lineDiscountTotal;

  // Generate invoice number
  const { count } = await service
    .schema('icecream_erp')
    .from('invoices')
    .select('id', { count: 'exact', head: true });

  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(5, '0')}`;

    const invoicePayload: Record<string, unknown> = {
      invoice_number: invoiceNumber,
      customer_id: body.customerId,
      sales_order_id: body.salesOrderId ?? null,
      invoice_date: body.invoiceDate ?? new Date().toISOString().slice(0, 10),
      due_date: body.dueDate ?? null,
      status: 'SENT',
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      amount_paid: 0,
      balance_due: total,
      notes: body.notes ?? null,
      created_by: ctx.userId,
    };
    if (warehouseId) invoicePayload.warehouse_id = warehouseId;

    const primaryInsert = await service
      .schema('icecream_erp')
      .from('invoices')
      .insert(invoicePayload)
      .select()
      .single();
    let invoice = primaryInsert.data;
    let iErr = primaryInsert.error;

    if (
      iErr &&
      (
        isMissingSalesColumn(iErr, 'invoices', 'sales_order_id') ||
        isMissingSalesColumn(iErr, 'invoices', 'warehouse_id') ||
        isMissingSalesColumn(iErr, 'invoices', 'discount_amount') ||
        isMissingSalesColumn(iErr, 'invoices', 'total') ||
        isMissingSalesColumn(iErr, 'invoices', 'amount_paid')
      )
    ) {
      const fallbackInsert = await service
        .schema('icecream_erp')
        .from('invoices')
        .insert({
          organization_id: ctx.organizationId,
          invoice_number: invoiceNumber,
          order_id: body.salesOrderId ?? null,
          customer_id: body.customerId,
          invoice_date: body.invoiceDate ?? new Date().toISOString().slice(0, 10),
          due_date: body.dueDate ?? null,
          status: 'SENT',
          subtotal,
          tax_amount: taxAmount,
          total_amount: total,
          paid_amount: 0,
          balance_due: total,
          notes: body.notes ?? null,
        })
        .select()
        .single();
      invoice = fallbackInsert.data;
      iErr = fallbackInsert.error;
    }

  if (iErr || !invoice) return serverError(iErr?.message ?? 'Failed to create invoice');

  const inv = invoice as Record<string, unknown>;

  const itemsInsert = await service
    .schema('icecream_erp')
    .from('invoice_items')
    .insert(
      resolvedItems.map((item) => ({
        invoice_id: inv.id,
        item_id: item.itemId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent ?? null,
        total_price: item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100),
      })),
    );

  if (itemsInsert.error) {
    if (!itemsInsert.error.message.includes('invoice_items')) return serverError(itemsInsert.error.message);
  }

  // Update customer balance
  const currentBalance = Number(cust.current_balance ?? cust.outstanding_balance ?? 0);
  const customerUpdate = await service
    .schema('icecream_erp')
    .from('customers')
    .update({
      current_balance: currentBalance + total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.customerId);
  if (customerUpdate.error && isMissingSalesColumn(customerUpdate.error, 'customers', 'current_balance')) {
    await service
      .schema('icecream_erp')
      .from('customers')
      .update({
        outstanding_balance: currentBalance + total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.customerId);
  }

  // If tied to a sales order, mark it invoiced
  if (body.salesOrderId) {
    await service
      .schema('icecream_erp')
      .from('sales_orders')
      .update({ status: 'INVOICED', updated_at: new Date().toISOString() })
      .eq('id', body.salesOrderId);
  }

  const resultQuery = await service
    .schema('icecream_erp')
    .from('invoices')
    .select(`*, customers(*), invoice_items(*, items(*))`)
    .eq('id', inv.id as string)
    .single();
  if (!resultQuery.error) return NextResponse.json(resultQuery.data, { status: 201 });

  const legacyResult = await service
    .schema('icecream_erp')
    .from('invoices')
    .select('*, customers(*)')
    .eq('id', inv.id as string)
    .single();

  if (legacyResult.error) return serverError(legacyResult.error.message);
  return NextResponse.json(legacyResult.data, { status: 201 });
}


