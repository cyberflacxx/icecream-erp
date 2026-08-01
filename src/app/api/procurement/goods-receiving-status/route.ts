import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  derivePurchaseOrderStatus,
  getPurchaseOrderReceivingLines,
  isPurchaseOrderEligibleForGoodsReceived,
} from '@/lib/procurement-purchase-orders';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? '';

  const purchaseOrdersResult = await service
    .from('purchase_orders')
    .select('id, po_number, status, approval_status, approved_at, approved_by, sent_at, rejected_at, supplier_id')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null);
  if (purchaseOrdersResult.error) return serverError(purchaseOrdersResult.error.message);

  const poIds = [...new Set((purchaseOrdersResult.data ?? []).map((row) => String(row.id ?? '')).filter(Boolean))];
  const itemsQuery = poIds.length
    ? await service
        .from('purchase_order_items')
        .select('id, po_id, purchase_order_id, item_id, quantity, quantity_ordered, received_qty, quantity_received, unit_price, unit_cost, total_cost, total_ex_vat, line_total')
        .in('purchase_order_id', poIds)
    : { data: [], error: null };
  const dataResult =
    itemsQuery.error && itemsQuery.error.message.includes('purchase_order_id')
      ? await service
          .from('purchase_order_items')
          .select('id, po_id, item_id, quantity, quantity_ordered, received_qty, quantity_received, unit_price, unit_cost, total_cost, total_ex_vat, line_total')
          .in('po_id', poIds)
      : itemsQuery;
  if (dataResult.error) return serverError(dataResult.error.message);

  const data = dataResult.data ?? [];
  const itemIds = [...new Set(data.map((row) => String(row.item_id ?? '')).filter(Boolean))];
  const [ordersSnapshot, itemsResult] = await Promise.all([
    Promise.resolve({ data: purchaseOrdersResult.data ?? [], error: null }),
    itemIds.length ? service.from('items').select('id, name').in('id', itemIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (ordersSnapshot.error) return serverError(ordersSnapshot.error.message);
  if (itemsResult.error) return serverError(itemsResult.error.message);

  const supplierIds = [...new Set((ordersSnapshot.data ?? []).map((row) => String(row.supplier_id ?? '')).filter(Boolean))];
  const suppliersResult = supplierIds.length ? await service.from('suppliers').select('id, name').in('id', supplierIds) : { data: [], error: null };
  if (suppliersResult.error) return serverError(suppliersResult.error.message);

  const orders = new Map((ordersSnapshot.data ?? []).map((row) => [String(row.id), row]));
  const items = new Map((itemsResult.data ?? []).map((row) => [String(row.id), row]));
  const suppliers = new Map((suppliersResult.data ?? []).map((row) => [String(row.id), row]));

  return NextResponse.json(
    (data ?? [])
      .filter((row) => {
        const order = orders.get(String(row.po_id));
        const derivedStatus = derivePurchaseOrderStatus({
          approvalStatus: order?.approval_status,
          approvedAt: order?.approved_at,
          approvedBy: order?.approved_by,
          rejectedAt: order?.rejected_at,
          sentAt: order?.sent_at,
          status: order?.status,
        });
        if (!order) return false;
        if (
          !isPurchaseOrderEligibleForGoodsReceived({
            approvalStatus: order.approval_status,
            approvedAt: order.approved_at,
            approvedBy: order.approved_by,
            lines: data.filter((candidate) => String(candidate.po_id ?? candidate.purchase_order_id ?? '') === String(order.id)),
            rejectedAt: order.rejected_at,
            sentAt: order.sent_at,
            status: order.status,
            supplierActive: Boolean(order.supplier_id),
          })
        ) {
          return false;
        }
        return !status || derivedStatus === status;
      })
      .map((row) => {
      const order = orders.get(String(row.po_id ?? row.purchase_order_id));
      const supplier = suppliers.get(String(order?.supplier_id ?? ''));
      const item = items.get(String(row.item_id ?? ''));
      const line = getPurchaseOrderReceivingLines([row])[0];
      const ordered = line?.orderedQuantity ?? Number(row.quantity_ordered ?? row.quantity ?? 0);
      const received = line?.previouslyPostedReceivedQuantity ?? Number(row.quantity_received ?? row.received_qty ?? 0);
      const remaining = line?.remainingQuantity ?? Math.max(0, ordered - received);
      const derivedStatus = derivePurchaseOrderStatus({
        approvalStatus: order?.approval_status,
        approvedAt: order?.approved_at,
        approvedBy: order?.approved_by,
        rejectedAt: order?.rejected_at,
        sentAt: order?.sent_at,
        status: order?.status,
      });
      return {
        id: row.id,
        item: item?.name ?? 'Unknown item',
        orderedQuantity: ordered,
        purchaseOrderNumber: order?.po_number ?? '',
        receivedQuantity: received,
        rejectedQuantity: 0,
        shortageQuantity: remaining,
        status: derivedStatus,
        supplier: supplier?.name ?? 'Unknown supplier',
      };
    }),
  );
}
