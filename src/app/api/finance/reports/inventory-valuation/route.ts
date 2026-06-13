import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateInventoryValuation } from '@/lib/finance';
import { financeService, mapNestedRow } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { data, error } = await financeService()
      .from('stock_balances')
      .select('quantity_on_hand, items(name, unit_cost, item_category_id, item_categories(name)), warehouses(name)')
      .eq('organization_id', ctx.organizationId);
    if (error) throw error;

    return NextResponse.json((data ?? []).map((row) => {
      const item = mapNestedRow(row.items as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const warehouse = mapNestedRow(row.warehouses as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const category = mapNestedRow((item?.item_categories as Record<string, unknown> | Array<Record<string, unknown>> | null) ?? null);
      const qty = Number(row.quantity_on_hand ?? 0);
      const unitCost = Number(item?.unit_cost ?? 0);

      return {
        category: category?.name ?? 'Uncategorised',
        item: item?.name ?? 'Unknown item',
        quantityOnHand: qty,
        unitCost,
        valuation: calculateInventoryValuation(qty, unitCost),
        warehouse: warehouse?.name ?? 'Unknown warehouse',
      };
    }));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
