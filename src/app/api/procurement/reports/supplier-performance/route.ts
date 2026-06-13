import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildSupplierShortageRows } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read', 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('purchase_orders')
    .select('po_number, expected_delivery_date, total, suppliers(name), purchase_order_items(quantity_ordered, quantity_received, items(name))')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null);

  if (error) return serverError(error.message);

  const shortages = buildSupplierShortageRows((data ?? []) as Array<Record<string, unknown>>);
  const grouped = new Map<string, { lateDeliveries: number; openShortages: number; totalValue: number }>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const key = String((supplier as Record<string, unknown> | null)?.name ?? 'Unknown supplier');
    const current = grouped.get(key) ?? { lateDeliveries: 0, openShortages: 0, totalValue: 0 };
    current.totalValue += Number(row.total ?? 0);
    grouped.set(key, current);
  }
  for (const shortage of shortages) {
    const current = grouped.get(shortage.supplierName) ?? { lateDeliveries: 0, openShortages: 0, totalValue: 0 };
    current.openShortages += 1;
    if (shortage.ageInDays > 0) current.lateDeliveries += 1;
    grouped.set(shortage.supplierName, current);
  }

  return NextResponse.json({
    data: Array.from(grouped.entries()).map(([supplierName, metrics]) => ({ supplierName, ...metrics })),
  });
}
