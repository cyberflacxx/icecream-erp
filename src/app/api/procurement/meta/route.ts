import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { getSafeSupplierErrorDetails, listSupplierOptionRecords } from '@/lib/procurement-suppliers';
import { createServiceRoleClient } from '@/lib/supabase/server';

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const poStatusFilter = new Set(['approved', 'partial_received', 'sent_to_supplier']);
    let warehouseQuery = service
      .from('warehouses')
      .select('id, code, name, type, warehouse_type, branch_id')
      .eq('is_active', true)
      .eq('organization_id', ctx.organizationId);

    if (ctx.isBranchScoped && ctx.branchId) {
      warehouseQuery = warehouseQuery.or(`branch_id.eq.${ctx.branchId},branch_id.is.null`);
    }

    const [
      itemsPrimary,
      unitsRes,
      warehousesRes,
      purchaseOrdersRes,
      purchaseOrderItemsRes,
      stockBalancesRes,
      goodsReceivedNotesRes,
      grnItemsRes,
      approversPrimary,
    ] = await Promise.all([
      listSupplierOptionRecords(service, ctx.organizationId),
      service
        .from('items')
        .select('id, code, name, description, item_type, unit_of_measure_id')
        .is('deleted_at', null)
        .eq('is_active', true)
        .eq('organization_id', ctx.organizationId)
        .order('name'),
      service
        .from('units_of_measure')
        .select('id, name, abbreviation')
        .eq('organization_id', ctx.organizationId)
        .order('name'),
      warehouseQuery,
      service
        .from('purchase_orders')
        .select('id, po_number, status, supplier_id, suppliers(id, name)')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .order('created_at', { ascending: false }),
      service
        .from('purchase_order_items')
        .select('po_id, item_id, quantity, quantity_ordered, received_qty, quantity_received'),
      service
        .from('stock_balances')
        .select('item_id, warehouse_id, quantity_on_hand, quantity_available, quantity'),
      service
        .from('goods_received_notes')
        .select('id, received_date, status')
        .eq('organization_id', ctx.organizationId)
        .order('received_date', { ascending: false }),
      service
        .from('grn_items')
        .select('grn_id, item_id, received_qty, accepted_qty'),
      service
        .from('users')
        .select('id, full_name, role')
        .eq('status', 'active')
        .eq('organization_id', ctx.organizationId)
        .order('full_name'),
    ]);

    const itemsRes =
      itemsPrimary.error && isMissingColumnError(itemsPrimary.error, 'items', 'deleted_at')
        ? await service
            .from('items')
            .select('id, code, name, description, item_type, unit_of_measure_id')
            .eq('is_active', true)
            .eq('organization_id', ctx.organizationId)
            .order('name')
        : itemsPrimary;

    if (itemsRes.error) return serverError(itemsRes.error.message);
    if (unitsRes.error) return serverError(unitsRes.error.message);
    if (warehousesRes.error) return serverError(warehousesRes.error.message);
    if (purchaseOrdersRes.error) return serverError(purchaseOrdersRes.error.message);
    if (purchaseOrderItemsRes.error) return serverError(purchaseOrderItemsRes.error.message);
    if (stockBalancesRes.error) return serverError(stockBalancesRes.error.message);
    if (goodsReceivedNotesRes.error) return serverError(goodsReceivedNotesRes.error.message);
    if (grnItemsRes.error) return serverError(grnItemsRes.error.message);

    const departmentsRes = await service
      .from('purchase_requisitions')
      .select('department')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .order('department');

    const uniqueDepartments = [
      ...new Set((departmentsRes.data ?? []).map((r: { department: string }) => r.department).filter(Boolean)),
    ];

    const accessibleWarehouses = (warehousesRes.data ?? []).map((warehouse) => ({
      branchId: warehouse.branch_id ? String(warehouse.branch_id) : null,
      code: String(warehouse.code ?? ''),
      id: String(warehouse.id),
      name: String(warehouse.name ?? ''),
      type: warehouse.type ? String(warehouse.type) : null,
      warehouseType: warehouse.warehouse_type ? String(warehouse.warehouse_type) : null,
    }));
    const warehouseById = new Map(accessibleWarehouses.map((warehouse) => [warehouse.id, warehouse]));
    const poStatusById = new Map(
      (purchaseOrdersRes.data ?? []).map((order) => [String(order.id), String(order.status ?? '').toLowerCase()]),
    );
    const openPurchaseOrderIds = new Set(
      Array.from(poStatusById.entries())
        .filter(([, status]) => poStatusFilter.has(status))
        .map(([id]) => id),
    );

    const receivedNoteById = new Map(
      (goodsReceivedNotesRes.data ?? []).map((row) => [
        String(row.id),
        {
          receivedDate: row.received_date ? String(row.received_date) : null,
          status: row.status ? String(row.status) : null,
        },
      ]),
    );
    const todayKey = new Date().toISOString().slice(0, 10);
    const itemInventory = new Map<
      string,
      {
        currentStock: number;
        lastReceivedDate: string | null;
        quantityOnOrder: number;
        quantityReceivedToday: number;
        warehouses: Array<{ id: string; code: string; name: string; quantity: number }>;
      }
    >();

    for (const row of stockBalancesRes.data ?? []) {
      const itemId = String(row.item_id ?? '');
      const warehouseId = String(row.warehouse_id ?? '');
      if (!itemId || !warehouseId || !warehouseById.has(warehouseId)) continue;

      const quantity = toNumber(row.quantity_available ?? row.quantity_on_hand ?? row.quantity);
      const current = itemInventory.get(itemId) ?? {
        currentStock: 0,
        lastReceivedDate: null,
        quantityOnOrder: 0,
        quantityReceivedToday: 0,
        warehouses: [],
      };

      current.currentStock += quantity;
      current.warehouses.push({
        id: warehouseId,
        code: warehouseById.get(warehouseId)?.code ?? '',
        name: warehouseById.get(warehouseId)?.name ?? 'Unknown warehouse',
        quantity,
      });
      itemInventory.set(itemId, current);
    }

    for (const row of purchaseOrderItemsRes.data ?? []) {
      const poId = String(row.po_id ?? '');
      const itemId = String(row.item_id ?? '');
      if (!poId || !itemId || !openPurchaseOrderIds.has(poId)) continue;

      const quantityOrdered = toNumber(row.quantity_ordered ?? row.quantity);
      const quantityReceived = toNumber(row.quantity_received ?? row.received_qty);
      const outstanding = Math.max(0, quantityOrdered - quantityReceived);
      if (outstanding <= 0) continue;

      const current = itemInventory.get(itemId) ?? {
        currentStock: 0,
        lastReceivedDate: null,
        quantityOnOrder: 0,
        quantityReceivedToday: 0,
        warehouses: [],
      };
      current.quantityOnOrder += outstanding;
      itemInventory.set(itemId, current);
    }

    for (const row of grnItemsRes.data ?? []) {
      const grnId = String(row.grn_id ?? '');
      const itemId = String(row.item_id ?? '');
      if (!grnId || !itemId) continue;

      const note = receivedNoteById.get(grnId);
      const receivedDate = note?.receivedDate?.slice(0, 10) ?? null;
      const receivedQuantity = toNumber(row.accepted_qty ?? row.received_qty);
      const current = itemInventory.get(itemId) ?? {
        currentStock: 0,
        lastReceivedDate: null,
        quantityOnOrder: 0,
        quantityReceivedToday: 0,
        warehouses: [],
      };

      if (receivedDate && (!current.lastReceivedDate || receivedDate > current.lastReceivedDate)) {
        current.lastReceivedDate = receivedDate;
      }
      if (receivedDate === todayKey) {
        current.quantityReceivedToday += receivedQuantity;
      }

      itemInventory.set(itemId, current);
    }

    return NextResponse.json({
      approvers: ((approversPrimary.error ? [] : approversPrimary.data) ?? [])
        .filter((user) =>
          ['super_admin', 'branch_manager', 'manager', 'operations_manager', 'procurement_lead', 'procurement_manager'].includes(
            String(user.role ?? ''),
          ),
        )
        .map((user) => ({
          id: String(user.id),
          fullName: String(user.full_name ?? 'Unknown'),
          role: user.role ? String(user.role) : null,
        })),
      suppliers: suppliersPrimary,
      items: (itemsRes.data ?? []).map((item) => ({
        code: String(item.code ?? ''),
        description: item.description ? String(item.description) : null,
        id: String(item.id),
        itemType: item.item_type ? String(item.item_type) : null,
        inventory: (() => {
          const summary = itemInventory.get(String(item.id));
          const reorderLevel = toNumber((item as Record<string, unknown>).reorder_level);
          const warehouses = (summary?.warehouses ?? [])
            .sort((left, right) => right.quantity - left.quantity)
            .slice(0, 3);

          return {
            currentStock: summary?.currentStock ?? 0,
            isLowStock: reorderLevel > 0 && (summary?.currentStock ?? 0) <= reorderLevel,
            lastReceivedDate: summary?.lastReceivedDate ?? null,
            primaryWarehouseName: warehouses[0]?.name ?? null,
            quantityOnOrder: summary?.quantityOnOrder ?? 0,
            quantityReceivedToday: summary?.quantityReceivedToday ?? 0,
            reorderLevel,
            warehouses,
          };
        })(),
        name: String(item.name ?? item.code ?? 'Unnamed item'),
        unitOfMeasureId: item.unit_of_measure_id ? String(item.unit_of_measure_id) : null,
      })),
      units: unitsRes.data ?? [],
      warehouses: accessibleWarehouses,
      purchaseOrders: (purchaseOrdersRes.data ?? [])
        .filter((o) => poStatusFilter.has(String(o.status ?? '').toLowerCase()))
        .map((o: Record<string, unknown>) => ({
          id: o.id,
          poNumber: o.po_number,
          status: o.status,
          supplier: o.suppliers
            ? { id: (o.suppliers as Record<string, unknown>).id, name: (o.suppliers as Record<string, unknown>).name }
            : null,
        })),
      departments: uniqueDepartments,
    });
  } catch (err) {
    console.error('Procurement meta request failed.', getSafeSupplierErrorDetails(err, 'procurement_meta'));
    return serverError('Unable to load procurement form options right now.');
  }
}
