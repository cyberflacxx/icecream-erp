import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateRequiredMaterials, summarizePlanShortages, type MaterialRequirementInput } from '@/lib/production';
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
        id, planned_quantity, expected_output, recipe_id
      `)
      .eq('production_plan_id', planId);

    if (error) throw error;

    const recipeIds = [...new Set((data ?? []).map((row) => String(row.recipe_id ?? '')).filter(Boolean))];
    const [recipesResult, recipeItemsResult, itemsResult, unitsResult] = await Promise.all([
      recipeIds.length
        ? service.from('recipes').select('id, name, expected_output_quantity').in('id', recipeIds)
        : Promise.resolve({ data: [], error: null }),
      recipeIds.length
        ? service.from('recipe_items').select('recipe_id, item_id, quantity_required, unit_id, wastage_allowance_percent').in('recipe_id', recipeIds)
        : Promise.resolve({ data: [], error: null }),
      service.from('items').select('id, code, name'),
      service.from('units_of_measure').select('id, abbreviation'),
    ]);
    if (recipesResult.error) throw recipesResult.error;
    if (recipeItemsResult.error) throw recipeItemsResult.error;
    if (itemsResult.error) throw itemsResult.error;
    if (unitsResult.error) throw unitsResult.error;

    const recipesById = new Map((recipesResult.data ?? []).map((recipe) => [String(recipe.id), recipe]));
    const itemsById = new Map((itemsResult.data ?? []).map((item) => [String(item.id), item]));
    const unitsById = new Map((unitsResult.data ?? []).map((unit) => [String(unit.id), unit]));
    const recipeItemsByRecipeId = new Map<string, Array<Record<string, unknown>>>();
    for (const item of recipeItemsResult.data ?? []) {
      const recipeId = String(item.recipe_id ?? '');
      recipeItemsByRecipeId.set(recipeId, [...(recipeItemsByRecipeId.get(recipeId) ?? []), {
        ...item,
        items: itemsById.get(String(item.item_id ?? '')) ?? null,
        units_of_measure: unitsById.get(String(item.unit_id ?? '')) ?? null,
      }]);
    }

    const stockMap = await fetchStockBalanceMap();
    const rows = [];
    for (const planItem of data ?? []) {
      const recipe = recipesById.get(String(planItem.recipe_id ?? ''));
      const requirements = calculateRequiredMaterials(
        (recipeItemsByRecipeId.get(String(planItem.recipe_id ?? '')) ?? []) as MaterialRequirementInput[],
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
