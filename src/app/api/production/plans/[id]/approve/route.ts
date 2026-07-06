import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateRequiredMaterials, summarizePlanShortages, type MaterialRequirementInput } from '@/lib/production';
import { fetchStockBalanceMap, productionErrorMessage, productionService, writeProductionAuditLog } from '@/lib/production-server';

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
      .select('id, planned_quantity, expected_output, recipe_id')
      .eq('production_plan_id', id);
    if (itemsError) throw itemsError;

    const recipeIds = [...new Set((items ?? []).map((row) => String(row.recipe_id ?? '')).filter(Boolean))];
    const [recipesResult, recipeItemsResult, itemsResult, unitsResult] = await Promise.all([
      recipeIds.length
        ? service.from('recipes').select('id, expected_output_quantity').in('id', recipeIds)
        : Promise.resolve({ data: [], error: null }),
      recipeIds.length
        ? service.from('recipe_items').select('recipe_id, item_id, quantity_required, unit_id, wastage_allowance_percent').in('recipe_id', recipeIds)
        : Promise.resolve({ data: [], error: null }),
      service.from('items').select('id, code, name, unit_cost'),
      service.from('units_of_measure').select('id, abbreviation'),
    ]);
    if (recipesResult.error) throw recipesResult.error;
    if (recipeItemsResult.error) throw recipeItemsResult.error;
    if (itemsResult.error) throw itemsResult.error;
    if (unitsResult.error) throw unitsResult.error;

    const recipesById = new Map((recipesResult.data ?? []).map((recipe) => [String(recipe.id), recipe]));
    const itemsById = new Map((itemsResult.data ?? []).map((item) => [String(item.id), item]));
    const unitsById = new Map((unitsResult.data ?? []).map((unit) => [String(unit.id), unit]));
    const recipeItemsByRecipeId = new Map<string, MaterialRequirementInput[]>();
    for (const item of recipeItemsResult.data ?? []) {
      const recipeId = String(item.recipe_id ?? '');
      recipeItemsByRecipeId.set(recipeId, [...(recipeItemsByRecipeId.get(recipeId) ?? []), {
        ...item,
        items: itemsById.get(String(item.item_id ?? '')) ?? null,
        units_of_measure: unitsById.get(String(item.unit_id ?? '')) ?? null,
      } as MaterialRequirementInput]);
    }

    const stockMap = await fetchStockBalanceMap();
    const shortages = [];

    for (const row of items ?? []) {
      const recipeId = String(row.recipe_id ?? '');
      const recipe = recipesById.get(recipeId);
      const requirements = calculateRequiredMaterials(
        recipeItemsByRecipeId.get(recipeId) ?? [],
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
    return serverError(productionErrorMessage(err) || 'Internal server error');
  }
}
