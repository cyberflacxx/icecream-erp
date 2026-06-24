import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildSupplierShortageRows } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const supplierId = searchParams.get('supplierId') ?? '';

  let query = service
    .from('purchase_orders')
    .select('id, po_number, expected_date, supplier_id')
    .eq('organization_id', ctx.organizationId);

  if (supplierId) query = query.eq('supplier_id', supplierId);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const orderIds = (data ?? []).map((row) => String(row.id));
  const supplierIds = [...new Set((data ?? []).map((row) => String(row.supplier_id ?? '')).filter(Boolean))];
  const [orderItems, suppliersResult] = await Promise.all([
    orderIds.length ? service.from('purchase_order_items').select('po_id, quantity, received_qty, item_id').in('po_id', orderIds) : Promise.resolve({ data: [], error: null }),
    supplierIds.length ? service.from('suppliers').select('id, name').in('id', supplierIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (orderItems.error) return serverError(orderItems.error.message);
  if (suppliersResult.error) return serverError(suppliersResult.error.message);

  const itemIds = [...new Set((orderItems.data ?? []).map((row) => String(row.item_id ?? '')).filter(Boolean))];
  const itemsResult = itemIds.length ? await service.from('items').select('id, name').in('id', itemIds) : { data: [], error: null };
  if (itemsResult.error) return serverError(itemsResult.error.message);

  const suppliers = new Map((suppliersResult.data ?? []).map((row) => [String(row.id), row]));
  const items = new Map((itemsResult.data ?? []).map((row) => [String(row.id), row]));
  const itemsByOrder = new Map<string, Array<Record<string, unknown>>>();
  for (const item of orderItems.data ?? []) {
    const key = String(item.po_id);
    itemsByOrder.set(key, [...(itemsByOrder.get(key) ?? []), {
      quantity_ordered: item.quantity,
      quantity_received: item.received_qty,
      items: items.get(String(item.item_id)) ?? null,
    }]);
  }

  const rows = (data ?? []).map((row) => ({
    ...row,
    expected_delivery_date: row.expected_date,
    suppliers: suppliers.get(String(row.supplier_id)) ?? null,
    purchase_order_items: itemsByOrder.get(String(row.id)) ?? [],
  })) as Array<Record<string, unknown>>;

  return NextResponse.json(buildSupplierShortageRows(rows));
}
