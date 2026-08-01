import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isWarehouseAvailableToContext, resolveRequestedBranchId } from '@/lib/branch-access';
import { loadResolvedSalesItemPricing, loadSalesCustomerPricingContext } from '@/lib/sales-pricing';
import { isCustomerInactiveStatus } from '@/lib/sales-customers';
import {
  isMissingSalesColumn,
  isMissingSalesTable,
  logSalesRouteError,
  loadSalesOrderById,
  loadSalesOrderItems,
  salesErrorMessage,
} from '@/lib/sales-server';
import {
  isSalesTransactionRpcUnavailable,
  postSalesInvoiceTransaction,
  shouldRequireSalesTransactionRpc,
} from '@/lib/sales-transactions-server';
import { deriveSalesInvoiceStatus, isSalesOrderInvoiceable } from '@/lib/sales-workflow';
import { createServiceRoleClient } from '@/lib/supabase/server';

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
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
  return { lineDiscountTotal, subtotal };
}

async function loadScopedOrderIds(service: ReturnType<typeof createServiceRoleClient>, organizationId: string, branchId: string) {
  const scopedOrders = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId);

  if (scopedOrders.error) {
    throw scopedOrders.error;
  }

  return (scopedOrders.data ?? []).map((row) => String(row.id));
}

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

  try {
    const scopedOrderIds = ctx.isBranchScoped && ctx.branchId
      ? await loadScopedOrderIds(service, ctx.organizationId, ctx.branchId)
      : null;

    const applyFilters = (query: any, orderColumn = 'sales_order_id') => {
      let next = query.eq('organization_id', ctx.organizationId);
      if (status) next = next.eq('status', status);
      if (customerId) next = next.eq('customer_id', customerId);
      if (startDate) next = next.gte('invoice_date', startDate);
      if (endDate) next = next.lte('invoice_date', endDate);
      if (scopedOrderIds) {
        next = scopedOrderIds.length
          ? next.or(`branch_id.eq.${ctx.branchId},${orderColumn}.in.(${scopedOrderIds.join(',')})`)
          : next.eq('branch_id', ctx.branchId);
      }
      return next;
    };

    let invoicesResult = await applyFilters(
      service
        .schema('icecream_erp')
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, status, total, amount_paid, balance_due, customer_id, sales_order_id, branch_id, approved_at, approved_by, posted_at, posted_by')
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false }),
    );

    if (
      invoicesResult.error &&
      (
        isMissingSalesColumn(invoicesResult.error, 'invoices', 'deleted_at') ||
        isMissingSalesColumn(invoicesResult.error, 'invoices', 'sales_order_id') ||
        isMissingSalesColumn(invoicesResult.error, 'invoices', 'total') ||
        isMissingSalesColumn(invoicesResult.error, 'invoices', 'amount_paid') ||
        isMissingSalesColumn(invoicesResult.error, 'invoices', 'posted_at')
      )
    ) {
      invoicesResult = await applyFilters(
        service
          .schema('icecream_erp')
          .from('invoices')
          .select('id, invoice_number, invoice_date, due_date, status, total_amount, paid_amount, balance_due, customer_id, order_id, branch_id, approved_at, approved_by, posted_at, posted_by')
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
          branchId: row.branch_id ? String(row.branch_id) : null,
          customer: customersById.get(String(row.customer_id ?? '')) ?? null,
          dueDate: row.due_date ? String(row.due_date) : null,
          id: String(row.id),
          invoiceDate: row.invoice_date ? String(row.invoice_date) : null,
          invoiceNumber: String(row.invoice_number ?? row.id ?? ''),
          itemsCount: itemsCountByInvoiceId.get(String(row.id)) ?? 0,
          status: deriveSalesInvoiceStatus({
            amountPaid: row.amount_paid ?? row.paid_amount,
            approvedAt: row.approved_at,
            approvedBy: row.approved_by,
            balanceDue: row.balance_due,
            postedAt: row.posted_at,
            postedBy: row.posted_by,
            status: row.status,
            total: row.total ?? row.total_amount,
          }),
          total: Number(row.total ?? row.total_amount ?? 0),
        })),
        page,
        pageSize,
      ),
    );
  } catch (error) {
    logSalesRouteError('invoices', 'load invoice list', error);
    return serverError('Sales invoices could not be loaded.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();

  const service = createServiceRoleClient();
  const salesService = service.schema('icecream_erp');

  const body = await request.json() as {
    allowCreditOverride?: boolean;
    branchId?: string;
    costCenterCode?: string;
    currencyCode?: string;
    customerId: string;
    departmentId?: string;
    discountAmount?: number;
    dueDate?: string;
    exchangeRate?: number;
    idempotencyKey?: string;
    invoiceDate?: string;
    items?: Array<{
      discountPercent?: number;
      itemId: string;
      quantity: number;
      unitPrice: number;
    }>;
    notes?: string;
    payment?: {
      amount?: number;
      idempotencyKey?: string;
      notes?: string;
      paymentDate?: string;
      paymentMethod?: string;
      referenceNumber?: string;
      tenders?: Array<{
        amount: number;
        paymentMethod: string;
        referenceNumber?: string;
      }>;
    };
    postInventory?: boolean;
    salesOrderId?: string;
    taxAmount: number;
    warehouseId?: string;
  };

  if (!body.customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  }

  const pricingCustomer = await loadSalesCustomerPricingContext(salesService, ctx.organizationId, body.customerId);
  if (!pricingCustomer) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }
  if (pricingCustomer.organizationId !== ctx.organizationId) {
    return NextResponse.json({ error: 'Customer organization mismatch.' }, { status: 403 });
  }
  if (isCustomerInactiveStatus(pricingCustomer.status)) {
    return NextResponse.json({ error: 'Inactive customers cannot be used on new invoices.' }, { status: 400 });
  }

  const invoiceDate = body.invoiceDate ?? new Date().toISOString().slice(0, 10);
  const postInventory = body.postInventory !== false;

  let orderItems: Array<{
    discount_percent: number | null;
    item_id: string;
    quantity_ordered: number;
    unit_price: number;
  }> = [];
  let branchId: string | null = null;
  let warehouseId: string | null = body.warehouseId ?? null;

  if (body.salesOrderId) {
    let order: Record<string, unknown> | null = null;
    try {
      order = await loadSalesOrderById(
        salesService,
        body.salesOrderId,
        ctx.organizationId,
        'id, branch_id, warehouse_id, status, organization_id',
      );
    } catch (error) {
      return serverError(error instanceof Error ? error.message : 'Failed to load sales order.');
    }

    if (!order) {
      const orderByNumber = await salesService
        .from('sales_orders')
        .select('id, branch_id, warehouse_id, status, organization_id')
        .eq('organization_id', ctx.organizationId)
        .eq('order_number', body.salesOrderId)
        .maybeSingle();
      if (orderByNumber.error) {
        return serverError(orderByNumber.error.message);
      }
      order = (orderByNumber.data ?? null) as Record<string, unknown> | null;
    }

    if (!order) {
      return NextResponse.json({ error: 'Sales order not found.' }, { status: 404 });
    }

    branchId = order.branch_id ? String(order.branch_id) : null;
    warehouseId = order.warehouse_id ? String(order.warehouse_id) : warehouseId;

    if (ctx.isBranchScoped && ctx.branchId && branchId && ctx.branchId !== branchId) {
      return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
    }
    if (!isSalesOrderInvoiceable(order.status)) {
      return NextResponse.json({ error: 'Only confirmed or approved sales orders can be invoiced.' }, { status: 400 });
    }

    try {
      orderItems = await loadSalesOrderItems(salesService, String(order.id ?? body.salesOrderId));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : 'Failed to load sales order items.');
    }
  }

  let branchLookup = salesService
    .from('branches')
    .select('id, organization_id, status')
    .eq('organization_id', ctx.organizationId);
  if (body.branchId ?? branchId) {
    branchLookup = branchLookup.eq('id', body.branchId ?? branchId);
  }
  const branchRows = await branchLookup;
  if (branchRows.error) {
    return serverError(branchRows.error.message);
  }

  const branchAuthorization = resolveRequestedBranchId(
    {
      branchAssignments: ctx.branchAssignments,
      branchId: ctx.branchId,
      isBranchScoped: ctx.isBranchScoped,
      organizationId: ctx.organizationId,
      permissions: ctx.permissions,
      warehouseAssignments: ctx.warehouseAssignments,
    },
    body.branchId ?? branchId,
    (branchRows.data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id ?? ''),
      status: row.status ? String(row.status) : null,
    })),
  );
  if (!branchAuthorization.ok) {
    return NextResponse.json({ error: branchAuthorization.message }, { status: branchAuthorization.status });
  }

  if (warehouseId) {
    const warehouseResult = await salesService
      .from('warehouses')
      .select('id, branch_id, organization_id, is_active')
      .eq('organization_id', ctx.organizationId)
      .eq('id', warehouseId)
      .eq('is_active', true)
      .maybeSingle();
    if (warehouseResult.error) {
      return serverError(warehouseResult.error.message);
    }
    if (!warehouseResult.data) {
      return NextResponse.json({ error: 'Warehouse not found.' }, { status: 404 });
    }
    if (!isWarehouseAvailableToContext(
      {
        branchAssignments: ctx.branchAssignments,
        branchId: ctx.branchId,
        isBranchScoped: ctx.isBranchScoped,
        organizationId: ctx.organizationId,
        permissions: ctx.permissions,
        warehouseAssignments: ctx.warehouseAssignments,
      },
      {
        branchId: warehouseResult.data.branch_id ? String(warehouseResult.data.branch_id) : null,
        id: String(warehouseResult.data.id),
        isActive: warehouseResult.data.is_active === true,
        organizationId: String(warehouseResult.data.organization_id ?? ''),
      },
    )) {
      return NextResponse.json({ error: 'Selected warehouse is not available for this user.' }, { status: 403 });
    }
    if (branchAuthorization.branchId && warehouseResult.data.branch_id && String(warehouseResult.data.branch_id) !== branchAuthorization.branchId) {
      return NextResponse.json({ error: 'Selected warehouse does not belong to the selected branch.' }, { status: 400 });
    }
    branchId = branchAuthorization.branchId ?? (warehouseResult.data.branch_id ? String(warehouseResult.data.branch_id) : null);
  } else {
    branchId = branchAuthorization.branchId ?? branchId;
  }

  const resolvedItems = body.items?.length
    ? body.items.map((item) => ({
        discountPercent: item.discountPercent,
        itemId: item.itemId,
        quantity: item.quantity,
      }))
    : orderItems.map((item) => ({
        discountPercent: item.discount_percent ?? undefined,
        itemId: item.item_id,
        quantity: item.quantity_ordered,
      }));

  if (!resolvedItems.length) {
    return NextResponse.json({ error: 'Invoice requires at least one line item.' }, { status: 400 });
  }
  if (resolvedItems.some((item) => !item.itemId || Number(item.quantity) <= 0)) {
    return NextResponse.json({ error: 'Invoice quantities must be greater than zero.' }, { status: 400 });
  }
  if (!warehouseId && postInventory) {
    return NextResponse.json({ error: 'A warehouse is required to post the invoice.' }, { status: 400 });
  }

  const resolvedPricing = await loadResolvedSalesItemPricing({
    branchId,
    customer: pricingCustomer,
    documentDate: invoiceDate,
    itemIds: [...new Set(resolvedItems.map((item) => item.itemId))],
    organizationId: ctx.organizationId,
    service: salesService,
    warehouseId,
  });

  const pricedItems = [];
  for (const item of resolvedItems) {
    const resolved = resolvedPricing.get(item.itemId);
    if (!resolved || !resolved.isActive) {
      return NextResponse.json({ error: `The selected item ${item.itemId} is inactive or unavailable.` }, { status: 400 });
    }
    if (resolved.sellingPrice === null || resolved.sellingPrice <= 0) {
      return NextResponse.json({ error: `The selected item ${resolved.code || item.itemId} has no active selling price.` }, { status: 400 });
    }
    if (postInventory && (resolved.currentInventoryCost === null || resolved.currentInventoryCost <= 0)) {
      return NextResponse.json({ error: `The selected item ${resolved.code || item.itemId} has no inventory cost configured.` }, { status: 400 });
    }
    pricedItems.push({
      discountPercent: item.discountPercent,
      itemId: item.itemId,
      quantity: item.quantity,
      unitPrice: resolved.sellingPrice,
    });
  }

  const { lineDiscountTotal, subtotal } = mapLineTotals(pricedItems);
  const discountAmount = body.discountAmount ?? 0;
  const taxAmount = body.taxAmount ?? 0;
  const total = subtotal + taxAmount - discountAmount - lineDiscountTotal;
  const allowCreditOverride =
    body.allowCreditOverride === true && can(ctx, 'sales.credit.override', 'sales.approve', 'finance.approve');

  try {
    const transaction = await postSalesInvoiceTransaction(
      {
        allowCreditOverride,
        branchId,
        costCenterCode: body.costCenterCode ?? null,
        currencyCode: body.currencyCode ?? null,
        customerId: body.customerId,
        departmentId: body.departmentId ?? null,
        discountAmount,
        dueDate: body.dueDate ?? null,
        exchangeRate: body.exchangeRate ?? null,
        idempotencyKey: body.idempotencyKey ?? null,
        invoiceDate,
        items: pricedItems,
        notes: body.notes ?? null,
        payment: body.payment ?? null,
        postInventory,
        salesOrderId: body.salesOrderId ?? null,
        taxAmount,
        warehouseId,
      },
      ctx,
    );
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    if (postInventory) {
      return serverError('The sales transaction engine is required to complete invoice posting.');
    }
    if (shouldRequireSalesTransactionRpc() || !isSalesTransactionRpcUnavailable(error)) {
      return serverError(salesErrorMessage(error) || 'Failed to post sales invoice transaction.');
    }
  }

  const { count } = await salesService.from('invoices').select('id', { count: 'exact', head: true });
  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(5, '0')}`;

  const invoicePayload: Record<string, unknown> = {
    amount_paid: 0,
    balance_due: total,
    branch_id: branchId,
    created_by: ctx.userId,
    customer_id: body.customerId,
    discount_amount: discountAmount,
    due_date: body.dueDate ?? null,
    invoice_date: invoiceDate,
    invoice_number: invoiceNumber,
    notes: body.notes ?? null,
    sales_order_id: body.salesOrderId ?? null,
    status: 'DRAFT',
    subtotal,
    tax_amount: taxAmount,
    total,
  };
  if (warehouseId) invoicePayload.warehouse_id = warehouseId;

  const primaryInsert = await salesService.from('invoices').insert(invoicePayload).select().single();
  let invoice = primaryInsert.data;
  let invoiceError = primaryInsert.error;

  if (
    invoiceError &&
    (
      isMissingSalesColumn(invoiceError, 'invoices', 'sales_order_id') ||
      isMissingSalesColumn(invoiceError, 'invoices', 'warehouse_id') ||
      isMissingSalesColumn(invoiceError, 'invoices', 'discount_amount') ||
      isMissingSalesColumn(invoiceError, 'invoices', 'total') ||
      isMissingSalesColumn(invoiceError, 'invoices', 'amount_paid')
    )
  ) {
    const fallbackInsert = await salesService
      .from('invoices')
      .insert({
        balance_due: total,
        branch_id: branchId,
        customer_id: body.customerId,
        due_date: body.dueDate ?? null,
        invoice_date: invoiceDate,
        invoice_number: invoiceNumber,
        notes: body.notes ?? null,
        order_id: body.salesOrderId ?? null,
        organization_id: ctx.organizationId,
        paid_amount: 0,
        status: 'DRAFT',
        subtotal,
        tax_amount: taxAmount,
        total_amount: total,
      })
      .select()
      .single();
    invoice = fallbackInsert.data;
    invoiceError = fallbackInsert.error;
  }

  if (invoiceError || !invoice) {
    return serverError(invoiceError?.message ?? 'Failed to create invoice.');
  }

  const inv = invoice as Record<string, unknown>;
  const itemsInsert = await salesService.from('invoice_items').insert(
    pricedItems.map((item) => ({
      discount_percent: item.discountPercent ?? null,
      invoice_id: inv.id,
      item_id: item.itemId,
      quantity: item.quantity,
      total_price: item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100),
      unit_price: item.unitPrice,
    })),
  );

  if (itemsInsert.error && !salesErrorMessage(itemsInsert.error).includes('invoice_items')) {
    return serverError(itemsInsert.error.message);
  }

  const resultQuery = await salesService
    .from('invoices')
    .select('*, customers(*), invoice_items(*, items(*))')
    .eq('id', String(inv.id))
    .single();
  if (!resultQuery.error) {
    return NextResponse.json(resultQuery.data, { status: 201 });
  }

  const legacyResult = await salesService.from('invoices').select('*, customers(*)').eq('id', String(inv.id)).single();
  if (legacyResult.error) {
    return serverError(legacyResult.error.message);
  }

  return NextResponse.json(legacyResult.data, { status: 201 });
}
