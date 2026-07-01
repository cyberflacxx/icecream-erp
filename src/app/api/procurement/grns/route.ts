import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
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
        `id, grn_number, received_date, status, quality_status, warehouse_id,
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
          `id, grn_number, received_date, status, warehouse_id,
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

      const mappedFallback = (fallback.data ?? []).map((r: Record<string, unknown>) => {
        const po = r.purchase_orders as Record<string, unknown> | null;
        const supplier = po?.suppliers as Record<string, unknown> | null;
        return {
          id: r.id,
          grnNumber: r.grn_number,
          receivedDate: r.received_date,
          status: String(r.status ?? '').toUpperCase(),
          qualityStatus: null,
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

    const mapped = (primary.data ?? []).map((r: Record<string, unknown>) => {
      const po = r.purchase_orders as Record<string, unknown> | null;
      const supplier = po?.suppliers as Record<string, unknown> | null;
      return {
        id: r.id,
        grnNumber: r.grn_number,
        receivedDate: r.received_date,
        status: String(r.status ?? '').toUpperCase(),
        qualityStatus: r.quality_status ? String(r.quality_status).toUpperCase() : null,
        purchaseOrder: po ? { id: po.id, poNumber: po.po_number } : null,
        supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
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
    purchaseOrderId: string;
    warehouseId: string;
    receivedDate?: string | null;
    notes?: string | null;
    qualityNotes?: string | null;
    items?: Array<{
      itemId: string;
      poItemId: string;
      quantityExpected: number;
      quantityReceived: number;
      quantityRejected: number;
      unitCost: number;
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

  if (!body.purchaseOrderId || !body.warehouseId) {
    return badRequest('purchaseOrderId and warehouseId are required');
  }

  try {
    // Validate purchase order
    const { data: order, error: orderErr } = await service
      .from('purchase_orders')
      .select('id, supplier_id, status, purchase_order_items(*)')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', body.purchaseOrderId)
      .single();

    if (orderErr || !order) return badRequest('Purchase order not found.');

    const o = order as Record<string, unknown>;
    if (o.status !== 'sent_to_supplier' && o.status !== 'partial_received') {
      return badRequest('GRN can only be created for sent or partially received purchase orders.');
    }

    // Validate warehouse
    let warehouseQuery = service
      .from('warehouses')
      .select('id, branch_id')
      .eq('id', body.warehouseId)
      .eq('is_active', true)
      .eq('organization_id', ctx.organizationId);

    if (ctx.isBranchScoped && ctx.branchId) {
      warehouseQuery = warehouseQuery.eq('branch_id', ctx.branchId);
    }

    const { data: warehouse, error: whErr } = await warehouseQuery.single();
    if (whErr || !warehouse) return badRequest('Warehouse not found or out of scope.');

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
        purchase_order_id: body.purchaseOrderId,
        warehouse_id: body.warehouseId,
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
          po_id: body.purchaseOrderId,
          warehouse_id: body.warehouseId,
          organization_id: ctx.organizationId,
          supplier_id: (order as Record<string, unknown>).supplier_id ?? null,
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
    const poItems = (o.purchase_order_items as Record<string, unknown>[]) ?? [];
    const itemsToInsert = body.items?.length
      ? body.items
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
          po_item_id: item.poItemId,
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
