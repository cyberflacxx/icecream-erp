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

export async function generateSalesReferenceNumber(table: string, prefix: string) {
  const service = salesService();
  const { count, error } = await service.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`;
}

export async function fetchFinishedGoodsStockMap(warehouseId?: string | null, branchId?: string | null) {
  const service = salesService();
  let query = service
    .from('stock_balances')
    .select('item_id, quantity_available, warehouses(branch_id), items(item_type)')
    .gt('quantity_available', 0);

  if (warehouseId) query = query.eq('warehouse_id', warehouseId);

  const { data, error } = await query;
  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const item = Array.isArray(row.items) ? row.items[0] : row.items;
    const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
    if (String(item?.item_type ?? '') !== 'FINISHED_GOOD') continue;
    if (branchId && warehouse?.branch_id && warehouse.branch_id !== branchId) continue;
    map.set(String(row.item_id), Number(row.quantity_available ?? 0));
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
