import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? '';

  const query = service
    .from('purchase_order_items')
    .select('id, po_id, item_id, quantity, received_qty');

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const poIds = [...new Set((data ?? []).map((row) => String(row.po_id ?? '')).filter(Boolean))];
  const itemIds = [...new Set((data ?? []).map((row) => String(row.item_id ?? '')).filter(Boolean))];
  const [ordersResult, itemsResult] = await Promise.all([
    poIds.length ? service.from('purchase_orders').select('id, po_number, status, supplier_id').in('id', poIds) : Promise.resolve({ data: [], error: null }),
    itemIds.length ? service.from('items').select('id, name').in('id', itemIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (ordersResult.error) return serverError(ordersResult.error.message);
  if (itemsResult.error) return serverError(itemsResult.error.message);

  const supplierIds = [...new Set((ordersResult.data ?? []).map((row) => String(row.supplier_id ?? '')).filter(Boolean))];
  const suppliersResult = supplierIds.length ? await service.from('suppliers').select('id, name').in('id', supplierIds) : { data: [], error: null };
  if (suppliersResult.error) return serverError(suppliersResult.error.message);

  const orders = new Map((ordersResult.data ?? []).map((row) => [String(row.id), row]));
  const items = new Map((itemsResult.data ?? []).map((row) => [String(row.id), row]));
  const suppliers = new Map((suppliersResult.data ?? []).map((row) => [String(row.id), row]));

  return NextResponse.json(
    (data ?? [])
      .filter((row) => {
        const order = orders.get(String(row.po_id));
        return !status || String(order?.status ?? '') === status;
      })
      .map((row) => {
      const order = orders.get(String(row.po_id));
      const supplier = suppliers.get(String(order?.supplier_id ?? ''));
      const item = items.get(String(row.item_id ?? ''));
      const ordered = Number(row.quantity ?? 0);
      const received = Number(row.received_qty ?? 0);
      return {
        id: row.id,
        item: item?.name ?? 'Unknown item',
        orderedQuantity: ordered,
        purchaseOrderNumber: order?.po_number ?? '',
        receivedQuantity: received,
        rejectedQuantity: 0,
        shortageQuantity: Math.max(0, ordered - received),
        status: order?.status ?? 'UNKNOWN',
        supplier: supplier?.name ?? 'Unknown supplier',
      };
    }),
  );
}
