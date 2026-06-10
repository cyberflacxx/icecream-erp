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
  const supplierId = searchParams.get('supplierId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let query = service
      .from('purchase_orders')
      .select(
        `id, po_number, order_date, expected_delivery_date, status, total,
         suppliers(id, name),
         purchase_order_items(id)`,
        { count: 'exact' },
      )
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (supplierId) query = query.eq('supplier_id', supplierId);
    if (startDate) query = query.gte('order_date', startDate);
    if (endDate) query = query.lte('order_date', endDate);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);

    if (error) return serverError(error.message);

    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      poNumber: r.po_number,
      orderDate: r.order_date,
      expectedDeliveryDate: r.expected_delivery_date,
      status: r.status,
      total: Number(r.total ?? 0),
      supplier: r.suppliers
        ? { id: (r.suppliers as Record<string, unknown>).id, name: (r.suppliers as Record<string, unknown>).name }
        : null,
      itemsCount: Array.isArray(r.purchase_order_items) ? (r.purchase_order_items as unknown[]).length : 0,
    }));

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
    supplierId: string;
    requisitionId?: string | null;
    orderDate?: string | null;
    expectedDeliveryDate?: string | null;
    notes?: string | null;
    taxAmount?: number;
    discountAmount?: number;
    items: Array<{
      itemId: string;
      unitOfMeasureId: string;
      quantityOrdered: number;
      unitCost: number;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.supplierId || !body.items?.length) {
    return badRequest('supplierId and items are required');
  }

  try {
    // Validate supplier
    const { data: supplier, error: supErr } = await service
      .from('suppliers')
      .select('id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', body.supplierId)
      .single();

    if (supErr || !supplier) return badRequest('Supplier not found.');

    // Validate requisition if provided
    if (body.requisitionId) {
      const { data: req, error: reqErr } = await service
        .from('purchase_requisitions')
        .select('id, status')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('id', body.requisitionId)
        .single();

      if (reqErr || !req) return badRequest('Purchase requisition not found.');
      if ((req as Record<string, unknown>).status !== 'level1_approved') {
        return badRequest('Purchase order can only be created from approved requisitions.');
      }
    }

    // Validate items
    const itemIds = [...new Set(body.items.map((i) => i.itemId))];
    const unitIds = [...new Set(body.items.map((i) => i.unitOfMeasureId))];
    const [itemsCheck, unitsCheck] = await Promise.all([
      service.from('items').select('id').is('deleted_at', null).eq('organization_id', ctx.organizationId).in('id', itemIds),
      service.from('units_of_measure').select('id').eq('organization_id', ctx.organizationId).in('id', unitIds),
    ]);

    if ((itemsCheck.data?.length ?? 0) !== itemIds.length || (unitsCheck.data?.length ?? 0) !== unitIds.length) {
      return badRequest('One or more purchase order items are invalid.');
    }

    // Generate PO number
    const { count: poCount } = await service
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId);

    const poNumber = `PO-${String((poCount ?? 0) + 1).padStart(5, '0')}`;
    const taxAmount = body.taxAmount ?? 0;
    const discountAmount = body.discountAmount ?? 0;
    const subtotal = body.items.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0);
    const total = subtotal + taxAmount - discountAmount;

    const { data: order, error: orderErr } = await service
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        supplier_id: body.supplierId,
        requisition_id: body.requisitionId ?? null,
        order_date: body.orderDate ?? new Date().toISOString(),
        expected_delivery_date: body.expectedDeliveryDate ?? null,
        notes: body.notes ?? null,
        organization_id: ctx.organizationId,
        created_by: ctx.userId,
        status: 'draft',
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        approved_at: null,
        approved_by: null,
      })
      .select()
      .single();

    if (orderErr) return serverError(orderErr.message);

    const orderId = (order as Record<string, unknown>).id as string;

    const { error: itemsErr } = await service.from('purchase_order_items').insert(
      body.items.map((item) => ({
        purchase_order_id: orderId,
        item_id: item.itemId,
        unit_of_measure_id: item.unitOfMeasureId,
        quantity_ordered: item.quantityOrdered,
        quantity_received: 0,
        unit_cost: item.unitCost,
        total_cost: item.quantityOrdered * item.unitCost,
      })),
    );

    if (itemsErr) return serverError(itemsErr.message);

    // Update requisition status if linked
    if (body.requisitionId) {
      await service
        .from('purchase_requisitions')
        .update({ status: 'po_created' })
        .eq('id', body.requisitionId);
    }

    const { data: full } = await service
      .from('purchase_orders')
      .select('*, purchase_order_items(*), suppliers(id, name)')
      .eq('id', orderId)
      .single();

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
