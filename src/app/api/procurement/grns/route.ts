import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { resolveInventoryValue } from '@/lib/inventory';
import {
  normalizeGoodsReceivedItemId,
  normalizeGoodsReceivedPurchaseOrderId,
  normalizeGoodsReceivedSupplierId,
  normalizeGoodsReceivedWarehouseId,
  normalizeGoodsReceivedUnitOfMeasureId,
} from '@/lib/procurement-goods-received';
import { isPurchaseOrderSentLike } from '@/lib/procurement-purchase-orders';
import { createServiceRoleClient } from '@/lib/supabase/server';

function isMissingColumnError(error: unknown, table: string, columnName: string) {
  return error instanceof Error && error.message.includes(`column ${table}.${columnName} does not exist`);
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.view', 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const status = searchParams.get('status');
  const purchaseOrderId = searchParams.get('purchaseOrderId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let query = service
      .from('goods_received_notes')
      .select(
        `id, grn_number, received_date, status, quality_status, warehouse_id, supplier_id, entry_mode, stock_posted, inventory_value_posted,
         purchase_orders(id, po_number, supplier_id, suppliers(id, name))`,
        { count: 'exact' },
      )
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .order('received_date', { ascending: false });

    if (status) query = query.eq('status', status);
    if (purchaseOrderId) query = query.eq('purchase_order_id', purchaseOrderId);
    if (startDate) query = query.gte('received_date', startDate);
    if (endDate) query = query.lte('received_date', endDate);

    // Branch scope: filter by warehouse branch
    if (ctx.isBranchScoped && ctx.branchId) {
      // Join through warehouses - filter via warehouse_id in subquery
      const { data: warehouseIds } = await service
        .from('warehouses')
        .select('id')
        .eq('branch_id', ctx.branchId)
        .eq('is_active', true);
      const ids = (warehouseIds ?? []).map((w: { id: string }) => w.id);
      if (ids.length === 0) {
        return NextResponse.json({ data: [], pagination: { page, pageSize, total: 0 } });
      }
      query = query.in('warehouse_id', ids);
    }

    const from = (page - 1) * pageSize;
    const primary = await query.range(from, from + pageSize - 1);

    if (primary.error) {
      const compatibleLegacy =
        isMissingColumnError(primary.error, 'goods_received_notes', 'purchase_order_id') ||
        isMissingColumnError(primary.error, 'goods_received_notes', 'quality_status') ||
        isMissingColumnError(primary.error, 'goods_received_notes', 'goods_received_note_items') ||
        isMissingColumnError(primary.error, 'goods_received_notes', 'deleted_at');

      if (!compatibleLegacy) return serverError(primary.error.message);

      let fallbackQuery = service
        .from('goods_received_notes')
        .select(
          `id, grn_number, received_date, status, warehouse_id, stock_posted, inventory_value_posted,
           purchase_orders:purchase_orders!goods_received_notes_po_id_fkey(id, po_number, supplier_id, suppliers(id, name))`,
          { count: 'exact' },
        )
        .eq('organization_id', ctx.organizationId)
        .order('received_date', { ascending: false });

      if (status) fallbackQuery = fallbackQuery.eq('status', status);
      if (startDate) fallbackQuery = fallbackQuery.gte('received_date', startDate);
      if (endDate) fallbackQuery = fallbackQuery.lte('received_date', endDate);
      if (purchaseOrderId) fallbackQuery = fallbackQuery.eq('po_id', purchaseOrderId);
      if (ctx.isBranchScoped && ctx.branchId) {
        const { data: warehouseIds } = await service.from('warehouses').select('id').eq('branch_id', ctx.branchId).eq('is_active', true);
        const ids = (warehouseIds ?? []).map((w: { id: string }) => w.id);
        if (ids.length === 0) {
          return NextResponse.json({ data: [], pagination: { page, pageSize, total: 0 } });
        }
        fallbackQuery = fallbackQuery.in('warehouse_id', ids);
      }

      const fallback = await fallbackQuery.range(from, from + pageSize - 1);
      if (fallback.error) return serverError(fallback.error.message);

      const warehouseIds = [
        ...new Set(
          (fallback.data ?? [])
            .map((row: Record<string, unknown>) => String(row.warehouse_id ?? ''))
            .filter(Boolean),
        ),
      ];
      const warehouseLookup = warehouseIds.length
        ? await service.from('warehouses').select('id, name').in('id', warehouseIds)
        : { data: [], error: null };
      if (warehouseLookup.error) return serverError(warehouseLookup.error.message);
      const warehousesById = new Map((warehouseLookup.data ?? []).map((row) => [String(row.id), String(row.name ?? 'Unknown warehouse')]));

      const mappedFallback = (fallback.data ?? []).map((r: Record<string, unknown>) => {
        const po = r.purchase_orders as Record<string, unknown> | null;
        const supplier = po?.suppliers as Record<string, unknown> | null;
        const warehouseId = String(r.warehouse_id ?? '').trim();
        return {
          id: r.id,
          grnNumber: r.grn_number,
          receivedDate: r.received_date,
          status: String(r.status ?? '').toUpperCase(),
          qualityStatus: null,
          stockPosted: r.stock_posted === true || String(r.status ?? '').toUpperCase() === 'POSTED',
          inventoryValue: resolveInventoryValue(r, 0),
          warehouse: warehouseId
            ? {
                id: warehouseId,
                name: warehousesById.get(warehouseId) ?? 'Unknown warehouse',
              }
            : null,
          purchaseOrder: po ? { id: po.id, poNumber: po.po_number } : null,
          supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
          itemsCount: 0,
        };
      });

      return NextResponse.json({
        data: mappedFallback,
        pagination: { page, pageSize, total: fallback.count ?? 0 },
      });
    }

    const grnIds = (primary.data ?? []).map((row: Record<string, unknown>) => String(row.id));
    const itemCounts = new Map<string, number>();
    if (grnIds.length) {
      const itemsResult = await service
        .from('goods_received_note_items')
        .select('grn_id')
        .in('grn_id', grnIds);

      if (!itemsResult.error) {
        for (const item of itemsResult.data ?? []) {
          const key = String(item.grn_id);
          itemCounts.set(key, (itemCounts.get(key) ?? 0) + 1);
        }
      }
    }

    const supplierIds = [
      ...new Set(
        (primary.data ?? [])
          .flatMap((row) => [row.supplier_id, ((row.purchase_orders as unknown) as Record<string, unknown> | null)?.supplier_id])
          .map((value) => String(value ?? ''))
          .filter(Boolean),
      ),
    ];
    const supplierLookup = supplierIds.length
      ? await service.from('suppliers').select('id, name').in('id', supplierIds)
      : { data: [], error: null };
    if (supplierLookup.error) return serverError(supplierLookup.error.message);
    const suppliersById = new Map((supplierLookup.data ?? []).map((row) => [String(row.id), String(row.name ?? 'Unknown supplier')]));
    const warehouseIds = [
      ...new Set(
        (primary.data ?? [])
          .map((row: Record<string, unknown>) => String(row.warehouse_id ?? ''))
          .filter(Boolean),
      ),
    ];
    const warehouseLookup = warehouseIds.length
      ? await service.from('warehouses').select('id, name').in('id', warehouseIds)
      : { data: [], error: null };
    if (warehouseLookup.error) return serverError(warehouseLookup.error.message);
    const warehousesById = new Map((warehouseLookup.data ?? []).map((row) => [String(row.id), String(row.name ?? 'Unknown warehouse')]));

    const mapped = (primary.data ?? []).map((r: Record<string, unknown>) => {
      const po = r.purchase_orders as Record<string, unknown> | null;
      const supplierId = String(r.supplier_id ?? po?.supplier_id ?? '');
      const warehouseId = String(r.warehouse_id ?? '').trim();
      const supplier = supplierId
        ? {
            id: supplierId,
            name: suppliersById.get(supplierId) ?? 'Unknown supplier',
          }
        : null;
      return {
        entryMode: String(r.entry_mode ?? (po ? 'po_linked' : 'manual')).toUpperCase(),
        id: r.id,
        grnNumber: r.grn_number,
        receivedDate: r.received_date,
        status: String(r.status ?? '').toUpperCase(),
        qualityStatus: r.quality_status ? String(r.quality_status).toUpperCase() : null,
        stockPosted: r.stock_posted === true || String(r.status ?? '').toUpperCase() === 'POSTED',
        inventoryValue: resolveInventoryValue(r, 0),
        warehouse: warehouseId
          ? {
              id: warehouseId,
              name: warehousesById.get(warehouseId) ?? 'Unknown warehouse',
            }
          : null,
        purchaseOrder: po ? { id: po.id, poNumber: po.po_number } : null,
        supplier,
        itemsCount: itemCounts.get(String(r.id)) ?? 0,
      };
    });

    return NextResponse.json({
      data: mapped,
      pagination: { page, pageSize, total: primary.count ?? 0 },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.create', 'procurement.write')) return forbidden();

  const service = createServiceRoleClient();

  let body: {
    purchase_order_id?: string | null;
    purchaseOrderId?: string | null;
    po_id?: string | null;
    poId?: string | null;
    supplier_id?: string | null;
    supplierId?: string | null;
    warehouse_id?: string | null;
    warehouseId?: string | null;
    receiving_warehouse_id?: string | null;
    receivingWarehouseId?: string | null;
    destination_warehouse_id?: string | null;
    destinationWarehouseId?: string | null;
    receivedDate?: string | null;
    notes?: string | null;
    qualityNotes?: string | null;
    entryMode?: string | null;
    items?: Array<{
      itemId?: string | null;
      item_id?: string | null;
      product_id?: string | null;
      productId?: string | null;
      raw_material_id?: string | null;
      rawMaterialId?: string | null;
      poItemId?: string | null;
      po_item_id?: string | null;
      quantityExpected: number;
      quantityReceived: number;
      quantityRejected: number;
      unitCost: number;
      unitOfMeasureId?: string | null;
      unit_of_measure_id?: string | null;
      uom_id?: string | null;
      uomId?: string | null;
      batchNumber?: string | null;
      expiryDate?: string | null;
      qualityNotes?: string | null;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const purchaseOrderId = normalizeGoodsReceivedPurchaseOrderId(body);
  const supplierId = normalizeGoodsReceivedSupplierId(body);
  const warehouseId = normalizeGoodsReceivedWarehouseId(body);
  const normalizedItems =
    body.items?.map((item) => {
      const itemId = normalizeGoodsReceivedItemId(item);
      const unitOfMeasureId = normalizeGoodsReceivedUnitOfMeasureId(item);
      const poItemId = String(item.po_item_id ?? item.poItemId ?? '').trim();

      return {
        ...item,
        itemId,
        poItemId: poItemId || null,
        unitOfMeasureId,
      };
    }) ?? [];
  const isManualEntry = String(body.entryMode ?? '').toLowerCase() === 'manual' || !purchaseOrderId;

  if (!warehouseId) {
    return badRequest('Please select a receiving warehouse.');
  }
  if (!isManualEntry && !purchaseOrderId) {
    return badRequest('purchaseOrderId is required for PO-linked receipts.');
  }
  if (isManualEntry && !supplierId) {
    return badRequest('supplierId is required for manual GRNs.');
  }
  if (normalizedItems.some((item) => !item.itemId)) {
    return badRequest('Selected item is no longer available. Please refresh and try again.');
  }

  try {
    let order: Record<string, unknown> | null = null;
    if (!isManualEntry && purchaseOrderId) {
      const { data: purchaseOrder, error: orderErr } = await service
        .from('purchase_orders')
        .select('id, supplier_id, status, purchase_order_items(*)')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('id', purchaseOrderId)
        .single();

      if (orderErr || !purchaseOrder) {
        return badRequest('Selected purchase order is no longer available. Please refresh and try again.');
      }

      order = purchaseOrder as Record<string, unknown>;
      if (!isPurchaseOrderSentLike(order.status)) {
        return badRequest('GRN can only be created for sent or partially received purchase orders.');
      }
    }

    if (supplierId) {
      const { data: supplier, error: supplierError } = await service
        .from('suppliers')
        .select('id')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('id', supplierId)
        .single();
      if (supplierError || !supplier) {
        return badRequest('Selected supplier is no longer available. Please refresh and try again.');
      }
    }

    if (normalizedItems.length) {
      const itemIds = [...new Set(normalizedItems.map((item) => item.itemId).filter(Boolean))];
      const unitIds = [...new Set(normalizedItems.map((item) => item.unitOfMeasureId).filter(Boolean))];
      const [itemsPrimary, unitsRes] = await Promise.all([
        service
          .from('items')
          .select('id')
          .is('deleted_at', null)
          .eq('organization_id', ctx.organizationId)
          .in('id', itemIds),
        unitIds.length
          ? service.from('units_of_measure').select('id').eq('organization_id', ctx.organizationId).in('id', unitIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const itemsRes =
        itemsPrimary.error && isMissingColumnError(itemsPrimary.error, 'items', 'deleted_at')
          ? await service.from('items').select('id').eq('organization_id', ctx.organizationId).in('id', itemIds)
          : itemsPrimary;

      if (itemsRes.error) return serverError(itemsRes.error.message);
      if (unitsRes.error) return serverError(unitsRes.error.message);
      if ((itemsRes.data?.length ?? 0) !== itemIds.length) {
        return badRequest('Selected item is no longer available. Please refresh and try again.');
      }
      if ((unitsRes.data?.length ?? 0) !== unitIds.length) {
        return badRequest('Selected unit of measurement is no longer available. Please refresh and try again.');
      }
    }

    // Validate warehouse. Central warehouses have no branch_id and are valid
    // for store receiving; branch-scoped users are only blocked from another
    // branch's warehouse unless explicitly assigned.
    const { data: warehouse, error: whErr } = await service
      .from('warehouses')
      .select('id, branch_id, type, warehouse_type')
      .eq('id', warehouseId)
      .eq('is_active', true)
      .eq('organization_id', ctx.organizationId)
      .single();
    if (whErr || !warehouse) return badRequest('Warehouse not found or out of scope.');
    const warehouseBranchId = warehouse.branch_id ? String(warehouse.branch_id) : null;
    const hasWarehouseAssignment = ctx.warehouseAssignments.includes(warehouseId);
    if (
      ctx.isBranchScoped &&
      ctx.branchId &&
      warehouseBranchId &&
      warehouseBranchId !== ctx.branchId &&
      !hasWarehouseAssignment
    ) {
      return badRequest('Warehouse not found or out of scope.');
    }

    // Generate GRN number
    const { count: grnCount } = await service
      .from('goods_received_notes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId);

    const grnNumber = `GRN-${String((grnCount ?? 0) + 1).padStart(5, '0')}`;

    const { data: grn, error: grnErr } = await service
      .from('goods_received_notes')
      .insert({
        grn_number: grnNumber,
        purchase_order_id: purchaseOrderId || null,
        supplier_id: supplierId || (order?.supplier_id as string | null) || null,
        entry_mode: isManualEntry ? 'manual' : 'po_linked',
        warehouse_id: warehouseId,
        organization_id: ctx.organizationId,
        received_by: ctx.userId,
        received_date: body.receivedDate ?? new Date().toISOString(),
        notes: body.notes ?? null,
        quality_notes: body.qualityNotes ?? null,
        quality_status: 'PENDING',
        status: 'DRAFT',
      })
      .select()
      .single();

    let grnRow = grn;
    let grnError = grnErr;

    if (
      grnError &&
      (
        isMissingColumnError(grnError, 'goods_received_notes', 'purchase_order_id') ||
        isMissingColumnError(grnError, 'goods_received_notes', 'quality_notes') ||
        isMissingColumnError(grnError, 'goods_received_notes', 'quality_status')
      )
    ) {
      const fallback = await service
        .from('goods_received_notes')
        .insert({
          grn_number: grnNumber,
          po_id: purchaseOrderId || null,
          warehouse_id: warehouseId,
          organization_id: ctx.organizationId,
          supplier_id: supplierId || (order?.supplier_id as string | null) || null,
          received_date: (body.receivedDate ?? new Date().toISOString()).slice(0, 10),
          notes: body.notes ?? null,
          invoice_ref: body.qualityNotes ?? null,
          status: 'DRAFT',
        })
        .select()
        .single();
      grnRow = fallback.data;
      grnError = fallback.error;
    }

    if (grnError || !grnRow) return serverError(grnError?.message ?? 'Failed to create GRN');

    const grnId = (grnRow as Record<string, unknown>).id as string;

    // Build items: use provided or derive from PO items
    const poItems = ((order?.purchase_order_items as Record<string, unknown>[]) ?? []);
    const itemsToInsert = normalizedItems.length
      ? normalizedItems
      : poItems.map((pi) => ({
          itemId: pi.item_id as string,
          poItemId: pi.id as string,
          quantityExpected: Number(pi.quantity_ordered ?? 0) - Number(pi.quantity_received ?? 0),
          quantityReceived: 0,
          quantityRejected: 0,
          unitCost: Number(pi.unit_cost ?? 0),
          batchNumber: null,
          expiryDate: null,
          qualityNotes: null,
        }));

    if (itemsToInsert.length > 0) {
      const primaryItems = await service.from('goods_received_note_items').insert(
        itemsToInsert.map((item) => ({
          grn_id: grnId,
          item_id: item.itemId,
          po_item_id: item.poItemId ?? null,
          quantity_expected: item.quantityExpected,
          quantity_received: item.quantityReceived,
          quantity_rejected: item.quantityRejected,
          unit_cost: item.unitCost,
          batch_number: item.batchNumber ?? null,
          expiry_date: item.expiryDate ?? null,
          quality_notes: item.qualityNotes ?? null,
        })),
      );
      if (primaryItems.error) {
        if (!primaryItems.error.message.includes('goods_received_note_items')) return serverError(primaryItems.error.message);
        const fallbackItems = await service.from('grn_items').insert(
          itemsToInsert.map((item) => ({
            grn_id: grnId,
            item_id: item.itemId,
            po_item_id: item.poItemId,
            ordered_qty: item.quantityExpected,
            received_qty: item.quantityReceived,
            rejected_qty: item.quantityRejected,
            unit_cost: item.unitCost,
            batch_number: item.batchNumber ?? null,
            expiry_date: item.expiryDate ?? null,
            quality_status: 'PENDING',
            quality_notes: item.qualityNotes ?? null,
          })),
        );
        if (fallbackItems.error) return serverError(fallbackItems.error.message);
      }
    }

    const primaryFull = await service
      .from('goods_received_notes')
      .select('*, purchase_orders(id, po_number)')
      .eq('id', grnId)
      .single();
    if (!primaryFull.error) return NextResponse.json(primaryFull.data, { status: 201 });

    const fallbackFull = await service
      .from('goods_received_notes')
      .select('*, purchase_orders:purchase_orders!goods_received_notes_po_id_fkey(id, po_number)')
      .eq('id', grnId)
      .single();
    if (fallbackFull.error) return serverError(fallbackFull.error.message);

    return NextResponse.json(fallbackFull.data, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
