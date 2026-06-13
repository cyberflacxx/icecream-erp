import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateRequiredMaterials, summarizePlanShortages } from '@/lib/production';
import { fetchStockBalanceMap, productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const service = productionService();
    const { data: items, error: itemsError } = await service
      .from('production_plan_items')
      .select(`
        id, planned_quantity, expected_output,
        recipes(id, expected_output_quantity, recipe_items(item_id, quantity_required, unit_id, wastage_allowance_percent, items(code, name), units_of_measure(abbreviation)))
      `)
      .eq('production_plan_id', id);
    if (itemsError) throw itemsError;

    const stockMap = await fetchStockBalanceMap();
    const shortages = [];

    for (const row of items ?? []) {
      const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
      const requirements = calculateRequiredMaterials(
        Array.isArray(recipe?.recipe_items) ? recipe.recipe_items : [],
        Number(row.planned_quantity ?? 0),
        Number(row.expected_output ?? recipe?.expected_output_quantity ?? 0),
        stockMap,
      );
      shortages.push(...summarizePlanShortages(requirements));
    }

    if (shortages.length > 0) {
      return badRequest(`Cannot approve production plan while shortages exist: ${JSON.stringify(shortages.slice(0, 5))}`);
    }

    const { data, error } = await service
      .from('production_plans')
      .update({ status: 'APPROVED' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await writeProductionAuditLog('PRODUCTION_PLAN_APPROVED', id, ctx.userId, { status: 'APPROVED' }, 'production_plan');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
