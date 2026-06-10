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

  type BalanceRow = {
    id: string;
    quantity_on_hand: number;
    quantity_available: number;
    quantity_reserved: number;
    items: {
      id: string;
      code: string;
      name: string;
      reorder_level: number | null;
      units_of_measure: { id: string; name: string; abbreviation: string } | null;
    } | null;
    warehouses: {
      id: string;
      code: string;
      name: string;
      branches: { id: string; name: string } | null;
    } | null;
  };

  const lowStock = ((data ?? []) as BalanceRow[])
    .filter((b) => {
      const reorderLevel = Number(b.items?.reorder_level ?? 0);
      const available = Number(b.quantity_available);
      return reorderLevel > 0 && available <= reorderLevel;
    })
    .map((b) => ({
      id: b.id,
      quantityOnHand: Number(b.quantity_on_hand),
      quantityAvailable: Number(b.quantity_available),
      quantityReserved: Number(b.quantity_reserved),
      item: b.items
        ? {
            id: b.items.id,
            code: b.items.code,
            name: b.items.name,
            reorderLevel: Number(b.items.reorder_level ?? 0),
            unitOfMeasure: b.items.units_of_measure ?? null,
          }
        : null,
      warehouse: b.warehouses
        ? {
            id: b.warehouses.id,
            code: b.warehouses.code,
            name: b.warehouses.name,
            branch: b.warehouses.branches ?? null,
          }
        : null,
    }));

  return NextResponse.json(lowStock);
}
