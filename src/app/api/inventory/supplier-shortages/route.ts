import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { deriveSupplierShortages } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'procurement.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const supplierId = searchParams.get('supplierId') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20')));

  try {
    let query = service
      .from('purchase_orders')
      .select(
        `id, po_number, expected_delivery_date, suppliers(id, name),
         purchase_order_items(item_id, quantity_ordered, quantity_received, items(id, code, name))`,
      )
      .in('status', ['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED'])
      .order('created_at', { ascending: false });

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data, error } = await query;
    if (error) return serverError(error.message);

    const shortages = deriveSupplierShortages((data ?? []) as Array<Record<string, unknown>>);
    const start = (page - 1) * pageSize;

    return NextResponse.json({
      data: shortages.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total: shortages.length,
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load supplier shortages');
  }
}
