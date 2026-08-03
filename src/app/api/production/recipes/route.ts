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

const FINISHED_ITEM_TYPES = new Set(['FINISHED', 'FINISHED_GOOD']);
const INGREDIENT_ITEM_TYPES = new Set(['CONSUMABLE', 'INGREDIENT', 'RAW', 'RAW_MATERIAL', 'STOCK']);
const PACKAGING_ITEM_TYPES = new Set(['PACKAGING', 'PACKAGING_MATERIAL']);

function hasDuplicateRecipeItems(lines: RecipeIngredientInput[]) {
  const seen = new Set<string>();

  for (const line of lines) {
    const key = `${line.itemId}::${line.unitId}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }

  return false;
}

function normalizeRecipeItemType(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

function buildRecipeRows(input: {
  lines: RecipeIngredientInput[];
  productionCategory?: string;
  recipeId: string;
}) {
  return input.lines.map((line, index) => ({
    item_id: line.itemId,
    production_category: input.productionCategory ?? 'ICE_CREAM_MAKING',
    quantity_required: line.quantityRequired,
    recipe_id: input.recipeId,
    sort_order: index,
    unit_id: line.unitId,
    wastage_allowance_percent: line.wastageAllowancePercent ?? 0,
  }));
}

function buildPackagingRows(input: {
  lines: RecipeIngredientInput[];
  recipeId: string;
}) {
  return input.lines.map((line, index) => ({
    item_id: line.itemId,
    quantity_required: line.quantityRequired,
    recipe_id: input.recipeId,
    sort_order: index,
    unit_id: line.unitId,
    wastage_allowance_percent: line.wastageAllowancePercent ?? 0,
  }));
}

async function rollbackCreatedRecipe(service: ReturnType<typeof productionService>, recipeId: string) {
  await Promise.allSettled([
    service.from('recipe_packaging_items').delete().eq('recipe_id', recipeId),
    service.from('recipe_items').delete().eq('recipe_id', recipeId),
  ]);
  await service.from('recipes').delete().eq('id', recipeId);
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

  let createdRecipeId: string | null = null;

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

    for (const packagingItem of body.packagingItems ?? []) {
      ensurePositiveQuantity(packagingItem.quantityRequired, 'packaging quantity');
      if (!packagingItem.itemId || !packagingItem.unitId) {
        return badRequest('Each packaging item requires itemId and unitId.');
      }
    }

    const service = productionService();
    const itemIds = [
      body.finishedItemId,
      ...body.ingredients.map((ingredient) => ingredient.itemId),
      ...(body.packagingItems ?? []).map((item) => item.itemId),
    ];
    const unitIds = [
      body.outputUnitId,
      ...body.ingredients.map((ingredient) => ingredient.unitId),
      ...(body.packagingItems ?? []).map((item) => item.unitId),
    ];
    const [itemsResult, unitsResult] = await Promise.all([
      service
        .from('items')
        .select('id, item_type, type, is_active')
        .eq('organization_id', ctx.organizationId)
        .in('id', [...new Set(itemIds)]),
      service
        .from('units_of_measure')
        .select('id')
        .in('id', [...new Set(unitIds)]),
    ]);
    if (itemsResult.error) throw itemsResult.error;
    if (unitsResult.error) throw unitsResult.error;

    const itemsById = new Map(
      (itemsResult.data ?? []).map((item) => [String(item.id), item] as const),
    );
    const unitIdsFound = new Set((unitsResult.data ?? []).map((unit) => String(unit.id)));

    if (itemsById.size !== new Set(itemIds).size) {
      return badRequest('One or more BOM items could not be found.', 'PRODUCTION_BOM_ITEM_NOT_FOUND');
    }
    if (unitIdsFound.size !== new Set(unitIds).size) {
      return badRequest('One or more BOM units could not be found.', 'PRODUCTION_BOM_UNIT_NOT_FOUND');
    }

    const finishedItem = itemsById.get(body.finishedItemId);
    if (!finishedItem || !FINISHED_ITEM_TYPES.has(normalizeRecipeItemType(finishedItem.item_type ?? finishedItem.type))) {
      return badRequest('Finished item must be an active finished good.', 'PRODUCTION_BOM_FINISHED_ITEM_INVALID');
    }

    for (const ingredient of body.ingredients) {
      const item = itemsById.get(ingredient.itemId);
      const type = normalizeRecipeItemType(item?.item_type ?? item?.type);
      if (!item || item.is_active === false || !INGREDIENT_ITEM_TYPES.has(type)) {
        return badRequest('Each BOM raw-material line must reference an active production material item.', 'PRODUCTION_BOM_INGREDIENT_INVALID');
      }
    }

    for (const packagingItem of body.packagingItems ?? []) {
      const item = itemsById.get(packagingItem.itemId);
      const type = normalizeRecipeItemType(item?.item_type ?? item?.type);
      if (!item || item.is_active === false || !PACKAGING_ITEM_TYPES.has(type)) {
        return badRequest('Each BOM packaging line must reference an active packaging item.', 'PRODUCTION_BOM_PACKAGING_INVALID');
      }
    }

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
    createdRecipeId = String(recipe.id);

    const deactivateResult = await service
      .from('recipes')
      .update({ status: 'INACTIVE' })
      .eq('finished_item_id', body.finishedItemId)
      .eq('status', 'ACTIVE')
      .neq('id', recipe.id);
    if (deactivateResult.error) throw deactivateResult.error;

    const ingredientRows = buildRecipeRows({
      lines: body.ingredients,
      productionCategory: body.productionCategory,
      recipeId: recipe.id,
    });

    const { error: ingredientError } = await service.from('recipe_items').insert(ingredientRows);
    if (ingredientError) throw ingredientError;

    const packagingRows = buildPackagingRows({
      lines: body.packagingItems ?? [],
      recipeId: recipe.id,
    });
    if (packagingRows.length > 0) {
      const { error: packagingError } = await service.from('recipe_packaging_items').insert(packagingRows);
      if (packagingError) throw packagingError;
    }

    const [savedRecipeResult, savedIngredientsResult, savedPackagingResult] = await Promise.all([
      service.from('recipes').select('*').eq('id', recipe.id).single(),
      service.from('recipe_items').select('*').eq('recipe_id', recipe.id).order('sort_order', { ascending: true }),
      service.from('recipe_packaging_items').select('*').eq('recipe_id', recipe.id).order('sort_order', { ascending: true }),
    ]);
    if (savedRecipeResult.error) throw savedRecipeResult.error;
    if (savedIngredientsResult.error) throw savedIngredientsResult.error;
    if (savedPackagingResult.error) throw savedPackagingResult.error;
    if ((savedIngredientsResult.data ?? []).length !== ingredientRows.length) {
      throw new Error('Saved BOM ingredient lines could not be confirmed after creation.');
    }
    if ((savedPackagingResult.data ?? []).length !== packagingRows.length) {
      throw new Error('Saved BOM packaging lines could not be confirmed after creation.');
    }

    await writeProductionAuditLog('PRODUCTION_RECIPE_CREATED', String(recipe.id), ctx.userId, {
      code,
      ingredientCount: ingredientRows.length,
      packagingCount: packagingRows.length,
      name: recipe.name,
      status: 'ACTIVE',
    }, 'recipe');

    return NextResponse.json({
      ...(savedRecipeResult.data ?? recipe),
      ingredients: savedIngredientsResult.data ?? [],
      packagingItems: savedPackagingResult.data ?? [],
    }, { status: 201 });
  } catch (err) {
    if (createdRecipeId) {
      try {
        await rollbackCreatedRecipe(productionService(), createdRecipeId);
      } catch (rollbackError) {
        console.error('Failed to roll back recipe creation.', {
          message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          recipeId: createdRecipeId,
        });
      }
    }

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
