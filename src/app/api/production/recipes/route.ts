import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import { generateReferenceNumber, isMissingProductionTable, productionErrorMessage, productionService, writeProductionAuditLog } from '@/lib/production-server';

type RecipeIngredientInput = {
  itemId: string;
  quantityRequired: number;
  unitId: string;
  wastageAllowancePercent?: number;
};

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('recipes')
      .select(`
        id, code, name, version, status, batch_size, expected_yield,
        finished_item_id, batch_unit_id, notes
      `)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
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
      packagingRequirement?: string;
      version?: number;
    };

    if (!body.name?.trim()) return badRequest('Recipe name is required.');
    if (!body.finishedItemId) return badRequest('finishedItemId is required.');
    if (!body.outputUnitId) return badRequest('outputUnitId is required.');
    ensurePositiveQuantity(body.expectedOutputQuantity, 'expectedOutputQuantity');
    if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      return badRequest('Recipe must have at least one ingredient.');
    }

    for (const ingredient of body.ingredients) {
      ensurePositiveQuantity(ingredient.quantityRequired, 'ingredient quantity');
      if (!ingredient.itemId || !ingredient.unitId) {
        return badRequest('Each ingredient requires itemId and unitId.');
      }
    }

    const service = productionService();
    const code = await generateReferenceNumber('recipes', 'RCP');

    const { data: recipe, error: recipeError } = await service
      .from('recipes')
      .insert({
        chocolate_type_id: body.chocolateTypeId ?? null,
        code,
        expected_output_quantity: body.expectedOutputQuantity,
        finished_item_id: body.finishedItemId,
        flavour_id: body.flavourId ?? null,
        instructions: body.instructions ?? null,
        name: body.name.trim(),
        output_unit_id: body.outputUnitId,
        packaging_requirement: body.packagingRequirement ?? null,
        status: 'DRAFT',
        version: body.version ?? 1,
      })
      .select()
      .single();

    if (recipeError) throw recipeError;

    const ingredientRows = body.ingredients.map((ingredient) => ({
      item_id: ingredient.itemId,
      quantity_required: ingredient.quantityRequired,
      recipe_id: recipe.id,
      unit_id: ingredient.unitId,
      wastage_allowance_percent: ingredient.wastageAllowancePercent ?? 0,
    }));

    const { error: ingredientError } = await service.from('recipe_items').insert(ingredientRows);
    if (ingredientError) throw ingredientError;

    await writeProductionAuditLog('PRODUCTION_RECIPE_CREATED', String(recipe.id), ctx.userId, {
      code,
      ingredientCount: ingredientRows.length,
      name: recipe.name,
    }, 'recipe');

    return NextResponse.json(recipe, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
