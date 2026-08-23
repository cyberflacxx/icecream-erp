import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateInventoryValuation } from '@/lib/finance';
import { financeService, mapNestedRow } from '@/lib/finance-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId') ?? undefined;
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;
    const warehouseId = searchParams.get('warehouseId') ?? undefined;
    let query = financeService()
      .from('stock_balances')
      .select('quantity_on_hand, quantity_available, average_cost, avg_cost, items(id, name, unit_cost, standard_cost), warehouses(id, name, branch_id)')
      .eq('organization_id', ctx.organizationId);
    if (warehouseId) query = query.eq('warehouse_id', warehouseId);
    const { data, error } = branchId
      ? await query.eq('warehouses.branch_id', branchId)
      : await query;
    if (error) throw error;

    const rows = (data ?? []).map((row) => {
      const item = mapNestedRow(row.items as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const warehouse = mapNestedRow(row.warehouses as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const qty = Number(row.quantity_on_hand ?? 0);
      const unitCost = Number(row.average_cost ?? row.avg_cost ?? item?.standard_cost ?? item?.unit_cost ?? 0);

      return {
        batchNumber: null,
        branch: null,
        branchId: warehouse?.branch_id ?? null,
        expiryDate: null,
        item: item?.name ?? 'Unknown item',
        itemCategory: 'Uncategorised',
        quantity: qty,
        quantityOnHand: qty,
        quantityAvailable: Number(row.quantity_available ?? qty),
        unitCost,
        valuation: calculateInventoryValuation(qty, unitCost),
        warehouseId: warehouse?.id ?? null,
        warehouse: warehouse?.name ?? 'Unknown warehouse',
      };
    });

    return NextResponse.json({
      filters: {
        branchId: branchId ?? null,
        warehouseId: warehouseId ?? null,
      },
      rows,
      totalValuation: rows.reduce((sum, row) => sum + Number(row.valuation ?? 0), 0),
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
