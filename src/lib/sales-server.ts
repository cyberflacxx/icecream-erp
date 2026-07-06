import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

export function salesService() {
  return createServiceRoleClient().schema('icecream_erp');
}

export function salesErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

export function isMissingSalesTable(error: unknown) {
  const message = salesErrorMessage(error);
  return (
    message.includes("Could not find the table 'icecream_erp.") ||
    message.includes('Could not find a relationship between') ||
    message.includes('does not exist')
  );
}

export function isMissingSalesColumn(error: unknown, table: string, columnName: string) {
  return isMissingColumnError(error, table, columnName);
}

export async function generateSalesReferenceNumber(table: string, prefix: string) {
  const service = salesService();
  const { count, error } = await service.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`;
}

type SalesService = ReturnType<typeof salesService>;

export async function loadSalesOrderById(
  service: SalesService,
  orderId: string,
  organizationId: string,
  selectClause: string,
) {
  const buildQuery = (includeDeletedAt: boolean) => {
    let query = service
      .from('sales_orders')
      .select(selectClause)
      .eq('id', orderId)
      .eq('organization_id', organizationId);

    if (includeDeletedAt) {
      query = query.is('deleted_at', null);
    }

    return query.maybeSingle();
  };

  const primary = await buildQuery(true);
  if (!primary.error) {
    return (primary.data ?? null) as Record<string, unknown> | null;
  }
  if (!isMissingSalesColumn(primary.error, 'sales_orders', 'deleted_at')) {
    throw primary.error;
  }

  const fallback = await buildQuery(false);
  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data ?? null) as Record<string, unknown> | null;
}

export async function loadSalesOrderItems(service: SalesService, orderId: string) {
  const primary = await service
    .from('sales_order_items')
    .select('item_id, quantity_ordered, unit_price, discount_percent')
    .eq('order_id', orderId);

  if (!primary.error) {
    return ((primary.data ?? []) as Array<Record<string, unknown>>).map((item) => ({
      item_id: String(item.item_id),
      quantity_ordered: Number(item.quantity_ordered ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      discount_percent:
        item.discount_percent !== null && item.discount_percent !== undefined
          ? Number(item.discount_percent)
          : null,
    }));
  }

  if (
    !isMissingSalesColumn(primary.error, 'sales_order_items', 'quantity_ordered') &&
    !isMissingSalesColumn(primary.error, 'sales_order_items', 'discount_percent')
  ) {
    throw primary.error;
  }

  const fallback = await service
    .from('sales_order_items')
    .select('item_id, quantity, unit_price, discount_pct')
    .eq('order_id', orderId);

  if (fallback.error) {
    throw fallback.error;
  }

  return ((fallback.data ?? []) as Array<Record<string, unknown>>).map((item) => ({
    item_id: String(item.item_id),
    quantity_ordered: Number(item.quantity ?? 0),
    unit_price: Number(item.unit_price ?? 0),
    discount_percent:
      item.discount_pct !== null && item.discount_pct !== undefined
        ? Number(item.discount_pct)
        : null,
  }));
}

export async function fetchFinishedGoodsStockMap(warehouseId?: string | null, branchId?: string | null) {
  const service = salesService();
  let query = service
    .from('stock_balances')
    .select('item_id, quantity_available, warehouse_id')
    .gt('quantity_available', 0);

  if (warehouseId) query = query.eq('warehouse_id', warehouseId);

  const { data, error } = await query;
  if (error) throw error;

  const { data: itemRows } = await service.from('items').select('*');
  const itemTypeById = new Map(
    (itemRows ?? []).map((item) => [
      String(item.id),
      String((item as Record<string, unknown>).item_type ?? (item as Record<string, unknown>).type ?? ''),
    ]),
  );

  const branchByWarehouseId = new Map<string, string | null>();
  if (branchId) {
    const { data: warehouseRows } = await service.from('warehouses').select('id, branch_id');
    for (const warehouse of warehouseRows ?? []) {
      branchByWarehouseId.set(String(warehouse.id), warehouse.branch_id ? String(warehouse.branch_id) : null);
    }
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const itemId = String(row.item_id);
    const itemType = itemTypeById.get(itemId);
    if (itemType && itemType !== 'FINISHED_GOOD') continue;
    if (branchId && branchByWarehouseId.get(String(row.warehouse_id)) && branchByWarehouseId.get(String(row.warehouse_id)) !== branchId) continue;
    map.set(itemId, (map.get(itemId) ?? 0) + Number(row.quantity_available ?? 0));
  }

  return map;
}

export async function writeSalesAuditLog(
  action: string,
  entityId: string,
  userProfileId: string,
  details: Record<string, unknown>,
  entityType = 'sales',
) {
  const service = salesService();
  await service.from('audit_logs').insert({
    action,
    entity_id: entityId,
    entity_type: entityType,
    new_values: details,
    user_profile_id: userProfileId,
  });
}

export async function reserveInvoiceStock(invoiceId: string, warehouseId: string) {
  const service = salesService();
  const { data: items, error } = await service
    .from('invoice_items')
    .select('item_id, quantity')
    .eq('invoice_id', invoiceId);
  if (error) throw error;

  for (const item of items ?? []) {
    const { data: balance, error: balanceError } = await service
      .from('stock_balances')
      .select('id, quantity_reserved, quantity_available')
      .eq('item_id', item.item_id)
      .eq('warehouse_id', warehouseId)
      .single();
    if (balanceError) throw balanceError;

    const quantity = Number(item.quantity ?? 0);
    if (Number(balance.quantity_available ?? 0) < quantity) {
      throw new Error(`Insufficient stock for item ${item.item_id}.`);
    }

    await service
      .from('stock_balances')
      .update({
        quantity_available: Number(balance.quantity_available) - quantity,
        quantity_reserved: Number(balance.quantity_reserved ?? 0) + quantity,
        last_updated: new Date().toISOString(),
      })
      .eq('id', balance.id);
  }
}
