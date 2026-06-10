import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

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
         purchase_orders(id, po_number, supplier_id, suppliers(id, name)),
         goods_received_note_items(id)`,
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
    const { data, count, error } = await query.range(from, from + pageSize - 1);

    if (error) return serverError(error.message);

    const mapped = (data ?? []).map((r: Record<string, unknown>) => {
      const po = r.purchase_orders as Record<string, unknown> | null;
      const supplier = po?.suppliers as Record<string, unknown> | null;
      return {
        id: r.id,
        grnNumber: r.grn_number,
        receivedDate: r.received_date,
        status: r.status,
        qualityStatus: r.quality_status,
        purchaseOrder: po ? { id: po.id, poNumber: po.po_number } : null,
        supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
        itemsCount: Array.isArray(r.goods_received_note_items) ? (r.goods_received_note_items as unknown[]).length : 0,
      };
    });

    return NextResponse.json({
      data: mapped,
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

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
      .select('id, status, purchase_order_items(*)')
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
        quality_status: 'pending',
        status: 'draft',
      })
      .select()
      .single();

    if (grnErr) return serverError(grnErr.message);

    const grnId = (grn as Record<string, unknown>).id as string;

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
      const { error: itemsErr } = await service.from('goods_received_note_items').insert(
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
      if (itemsErr) return serverError(itemsErr.message);
    }

    const { data: full } = await service
      .from('goods_received_notes')
      .select('*, goods_received_note_items(*), purchase_orders(id, po_number)')
      .eq('id', grnId)
      .single();

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
