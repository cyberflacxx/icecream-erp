import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

type PaginatedResult<T> = {
  data: T[];
  pagination: { page: number; pageSize: number; total: number };
};

function paginate<T>(rows: T[], page: number, pageSize: number): PaginatedResult<T> {
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), pagination: { page, pageSize, total } };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const tab = searchParams.get('tab') ?? 'purchase_orders';

  try {
    // Verify supplier exists
    const { data: supplier, error: supErr } = await service
      .from('suppliers')
      .select('id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (supErr || !supplier) return notFound('Supplier not found.');

    if (tab === 'purchase_orders') {
      const { data: rows, error } = await service
        .from('purchase_orders')
        .select('id, po_number, order_date, expected_delivery_date, total, status, purchase_order_items(id)')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('supplier_id', id)
        .order('order_date', { ascending: false });

      if (error) return serverError(error.message);

      return NextResponse.json(
        paginate(
          (rows ?? []).map((r: Record<string, unknown>) => ({
            id: r.id,
            poNumber: r.po_number,
            orderDate: r.order_date,
            expectedDeliveryDate: r.expected_delivery_date,
            total: Number(r.total ?? 0),
            status: r.status,
            itemsCount: Array.isArray(r.purchase_order_items)
              ? (r.purchase_order_items as unknown[]).length
              : 0,
          })),
          page,
          pageSize,
        ),
      );
    }

    if (tab === 'grns') {
      const { data: rows, error } = await service
        .from('goods_received_notes')
        .select(
          `id, grn_number, received_date, status, quality_status,
           goods_received_note_items(id),
           purchase_orders!inner(id, po_number, supplier_id)`,
        )
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('purchase_orders.supplier_id', id)
        .order('received_date', { ascending: false });

      if (error) return serverError(error.message);

      return NextResponse.json(
        paginate(
          (rows ?? []).map((r: Record<string, unknown>) => ({
            id: r.id,
            grnNumber: r.grn_number,
            poNumber: r.purchase_orders
              ? (r.purchase_orders as Record<string, unknown>).po_number
              : null,
            receivedDate: r.received_date,
            status: r.status,
            qualityStatus: r.quality_status,
            itemsCount: Array.isArray(r.goods_received_note_items)
              ? (r.goods_received_note_items as unknown[]).length
              : 0,
          })),
          page,
          pageSize,
        ),
      );
    }

    if (tab === 'returns') {
      const { data: rows, error } = await service
        .from('supplier_returns')
        .select('id, return_number, return_date, total_value, status')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('supplier_id', id)
        .order('return_date', { ascending: false });

      if (error) return serverError(error.message);

      return NextResponse.json(
        paginate(
          (rows ?? []).map((r: Record<string, unknown>) => ({
            id: r.id,
            returnNumber: r.return_number,
            returnDate: r.return_date,
            totalValue: Number(r.total_value ?? 0),
            status: r.status,
          })),
          page,
          pageSize,
        ),
      );
    }

    // Default: payments tab
    const { data: rows, error } = await service
      .from('payments')
      .select('id, payment_number, payment_date, amount, payment_method, reference_number')
      .eq('organization_id', ctx.organizationId)
      .eq('supplier_id', id)
      .order('payment_date', { ascending: false });

    if (error) return serverError(error.message);

    return NextResponse.json(
      paginate(
        (rows ?? []).map((r: Record<string, unknown>) => ({
          id: r.id,
          paymentNumber: r.payment_number,
          paymentDate: r.payment_date,
          amount: Number(r.amount ?? 0),
          method: r.payment_method,
          referenceNumber: r.reference_number,
        })),
        page,
        pageSize,
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}
