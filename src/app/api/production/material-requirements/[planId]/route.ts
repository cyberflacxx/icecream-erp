import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateRequiredMaterials, summarizePlanShortages } from '@/lib/production';
import { fetchStockBalanceMap, productionService } from '@/lib/production-server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const { planId } = await params;
    const service = productionService();
    const { data, error } = await service
      .from('production_plan_items')
      .select(`
        id, planned_quantity, expected_output,
        recipes(id, name, expected_output_quantity, recipe_items(item_id, quantity_required, unit_id, wastage_allowance_percent, items(code, name), units_of_measure(abbreviation)))
      `)
      .eq('production_plan_id', planId);

    if (error) throw error;

    const stockMap = await fetchStockBalanceMap();
    const rows = [];
    for (const planItem of data ?? []) {
      const recipe = Array.isArray(planItem.recipes) ? planItem.recipes[0] : planItem.recipes;
      const requirements = calculateRequiredMaterials(
        Array.isArray(recipe?.recipe_items) ? recipe.recipe_items : [],
        Number(planItem.planned_quantity ?? 0),
        Number(planItem.expected_output ?? recipe?.expected_output_quantity ?? 0),
        stockMap,
      );
      rows.push(...requirements.map((requirement) => ({
        ...requirement,
        planItemId: planItem.id,
        recipeName: recipe?.name ?? 'Unknown recipe',
      })));
    }

    return NextResponse.json({
      data: rows,
      shortages: summarizePlanShortages(rows),
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
