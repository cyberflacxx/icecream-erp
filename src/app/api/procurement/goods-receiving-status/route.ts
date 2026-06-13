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

  let query = service
    .from('purchase_order_items')
    .select(
      `id, quantity_ordered, quantity_received, purchase_orders!purchase_order_id(po_number, status, suppliers(name)),
       items!item_id(name)`,
    )
    .order('created_at', { ascending: false });

  if (status) query = query.eq('purchase_orders.status', status);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  return NextResponse.json(
    (data ?? []).map((row) => {
      const order = Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders;
      const supplier = Array.isArray(order?.suppliers) ? order.suppliers[0] : order?.suppliers;
      const item = Array.isArray(row.items) ? row.items[0] : row.items;
      const ordered = Number(row.quantity_ordered ?? 0);
      const received = Number(row.quantity_received ?? 0);
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
