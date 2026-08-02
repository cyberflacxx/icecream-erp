import { NextRequest, NextResponse } from 'next/server';

import { apiServerError, badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import { generateReferenceNumber, isMissingProductionTable, productionErrorMessage, productionService, writeProductionAuditLog } from '@/lib/production-server';

type RecipeIngredientInput = {
  itemId: string;
  quantityRequired: number;
  unitId: string;
  wastageAllowancePercent?: number;
};

function hasDuplicateRecipeItems(lines: RecipeIngredientInput[]) {
  const seen = new Set<string>();

  for (const line of lines) {
    const key = `${line.itemId}::${line.unitId}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }

  return false;
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('recipes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const recipes = (data ?? []) as Array<Record<string, unknown>>;
    const recipeIds = recipes.map((recipe) => String(recipe.id));
    if (!recipeIds.length) {
      return NextResponse.json([]);
    }

    const [ingredientsResult, packagingResult] = await Promise.all([
      service.from('recipe_items').select('*').in('recipe_id', recipeIds).order('sort_order', { ascending: true }),
      service.from('recipe_packaging_items').select('*').in('recipe_id', recipeIds).order('sort_order', { ascending: true }),
    ]);

    if (ingredientsResult.error) throw ingredientsResult.error;
    if (packagingResult.error) throw packagingResult.error;

    const ingredientsByRecipeId = new Map<string, Array<Record<string, unknown>>>();
    for (const row of (ingredientsResult.data ?? []) as Array<Record<string, unknown>>) {
      const recipeId = String(row.recipe_id ?? '');
      if (!recipeId) continue;
      ingredientsByRecipeId.set(recipeId, [...(ingredientsByRecipeId.get(recipeId) ?? []), row]);
    }

    const packagingByRecipeId = new Map<string, Array<Record<string, unknown>>>();
    for (const row of (packagingResult.data ?? []) as Array<Record<string, unknown>>) {
      const recipeId = String(row.recipe_id ?? '');
      if (!recipeId) continue;
      packagingByRecipeId.set(recipeId, [...(packagingByRecipeId.get(recipeId) ?? []), row]);
    }

    return NextResponse.json(
      recipes.map((recipe) => ({
        ...recipe,
        ingredients: ingredientsByRecipeId.get(String(recipe.id)) ?? [],
        packagingItems: packagingByRecipeId.get(String(recipe.id)) ?? [],
      })),
    );
  } catch (err) {
    if (isMissingProductionTable(err)) return NextResponse.json([]);
    return serverError(productionErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      chocolateTypeId?: string;
      expectedOutputQuantity: number;
      finishedItemId: string;
      flavourId?: string;
      ingredients: RecipeIngredientInput[];
      instructions?: string;
      name: string;
      outputUnitId: string;
      packagingItems?: RecipeIngredientInput[];
      packagingRequirement?: string;
      productionCategory?: string;
      version?: number;
    };

    if (!body.name?.trim()) return badRequest('Recipe name is required.');
    if (!body.finishedItemId) return badRequest('finishedItemId is required.');
    if (!body.outputUnitId) return badRequest('outputUnitId is required.');
    ensurePositiveQuantity(body.expectedOutputQuantity, 'expectedOutputQuantity');
    if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      return badRequest('Recipe must have at least one ingredient.');
    }
    if (hasDuplicateRecipeItems(body.ingredients)) {
      return badRequest('Each raw material may only appear once in a BOM.');
    }
    if (Array.isArray(body.packagingItems) && hasDuplicateRecipeItems(body.packagingItems)) {
      return badRequest('Each packaging material may only appear once in a BOM.');
    }

    for (const ingredient of body.ingredients) {
      ensurePositiveQuantity(ingredient.quantityRequired, 'ingredient quantity');
      if (!ingredient.itemId || !ingredient.unitId) {
        return badRequest('Each ingredient requires itemId and unitId.');
      }
    }

    const service = productionService();
    const code = await generateReferenceNumber('recipes', 'RCP');

    const recipePayload: Record<string, unknown> = {
      batch_size: body.expectedOutputQuantity,
      batch_unit_id: body.outputUnitId,
      code,
      created_by: ctx.userId,
      expected_output_quantity: body.expectedOutputQuantity,
      expected_yield: 100,
      finished_item_id: body.finishedItemId,
      instructions: body.instructions ?? null,
      name: body.name.trim(),
      organization_id: ctx.organizationId,
      output_unit_id: body.outputUnitId,
      packaging_requirement: body.packagingRequirement ?? null,
      production_category: body.productionCategory ?? 'ICE_CREAM_MAKING',
      status: 'ACTIVE',
      version: body.version ?? 1,
    };
    if (body.chocolateTypeId) recipePayload.chocolate_type_id = body.chocolateTypeId;
    if (body.flavourId) recipePayload.flavour_id = body.flavourId;

    const { data: recipe, error: recipeError } = await service
      .from('recipes')
      .insert(recipePayload)
      .select()
      .single();

    if (recipeError) throw recipeError;

    await service
      .from('recipes')
      .update({ status: 'INACTIVE' })
      .eq('finished_item_id', body.finishedItemId)
      .eq('status', 'ACTIVE')
      .neq('id', recipe.id);

    const ingredientRows = body.ingredients.map((ingredient) => ({
      item_id: ingredient.itemId,
      production_category: 'ICE_CREAM_MAKING',
      quantity_required: ingredient.quantityRequired,
      recipe_id: recipe.id,
      unit_id: ingredient.unitId,
      wastage_allowance_percent: ingredient.wastageAllowancePercent ?? 0,
    }));

    const { error: ingredientError } = await service.from('recipe_items').insert(ingredientRows);
    if (ingredientError) throw ingredientError;

    const packagingRows = (body.packagingItems ?? []).map((item) => ({
      item_id: item.itemId,
      quantity_required: item.quantityRequired,
      recipe_id: recipe.id,
      unit_id: item.unitId,
      wastage_allowance_percent: item.wastageAllowancePercent ?? 0,
    }));
    if (packagingRows.length > 0) {
      const { error: packagingError } = await service.from('recipe_packaging_items').insert(packagingRows);
      if (packagingError) throw packagingError;
    }

    await writeProductionAuditLog('PRODUCTION_RECIPE_CREATED', String(recipe.id), ctx.userId, {
      code,
      ingredientCount: ingredientRows.length,
      packagingCount: packagingRows.length,
      name: recipe.name,
      status: 'ACTIVE',
    }, 'recipe');

    return NextResponse.json(recipe, { status: 201 });
  } catch (err) {
    return apiServerError({
      ctx,
      error: err,
      message: productionErrorMessage(err) || 'Production BOM could not be created.',
      module: 'production.recipes',
      path: '/api/production/recipes',
      status: 500,
    });
  }
}
