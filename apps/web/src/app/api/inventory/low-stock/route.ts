import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  void request;
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();

  let query = service.from('stock_balances').select(
    `id, quantity_on_hand, quantity_available, quantity_reserved,
     items!item_id(
       id, code, name, reorder_level,
       units_of_measure!unit_of_measure_id(id, name, abbreviation)
     ),
     warehouses!warehouse_id(
       id, code, name,
       branches!branch_id(id, name)
     )`,
  );

  if (ctx.isBranchScoped && ctx.branchId) {
    query = query.eq('warehouses.branch_id', ctx.branchId);
  }

  const { data, error } = await query;
  if (error) return serverError(error.message);

  type ItemObj = { id?: string; code?: string; name?: string; reorder_level?: number | null; units_of_measure?: { id: string; name: string; abbreviation: string } | Array<{ id: string; name: string; abbreviation: string }> | null } | null;
  type WHObj = { id?: string; code?: string; name?: string; branches?: { id: string; name: string } | Array<{ id: string; name: string }> | null } | null;

  const lowStock = (data ?? [])
    .map((row: Record<string, unknown>) => {
      const rawItems = row.items as ItemObj | ItemObj[];
      const items: ItemObj = Array.isArray(rawItems) ? (rawItems[0] ?? null) : rawItems;
      const rawWH = row.warehouses as WHObj | WHObj[];
      const warehouses: WHObj = Array.isArray(rawWH) ? (rawWH[0] ?? null) : rawWH;
      const rawUoM = items?.units_of_measure;
      const unitOfMeasure = Array.isArray(rawUoM) ? (rawUoM[0] ?? null) : (rawUoM ?? null);
      const rawBranch = warehouses?.branches;
      const branch = Array.isArray(rawBranch) ? (rawBranch[0] ?? null) : (rawBranch ?? null);
      return {
        id: row.id,
        quantityOnHand: Number(row.quantity_on_hand),
        quantityAvailable: Number(row.quantity_available),
        quantityReserved: Number(row.quantity_reserved),
        reorderLevel: Number(items?.reorder_level ?? 0),
        item: items
          ? { id: items.id, code: items.code, name: items.name, reorderLevel: Number(items.reorder_level ?? 0), unitOfMeasure }
          : null,
        warehouse: warehouses
          ? { id: warehouses.id, code: warehouses.code, name: warehouses.name, branch }
          : null,
      };
    })
    .filter((b) => b.reorderLevel > 0 && b.quantityAvailable <= b.reorderLevel);

  return NextResponse.json(lowStock);
}
