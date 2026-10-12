import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

const ACTIVE_PRODUCTION_STATUSES = ['DRAFT', 'PLANNED', 'MATERIALS_REQUESTED', 'MATERIALS_APPROVED', 'MATERIALS_RESERVED', 'IN_PROGRESS', 'WIP', 'QUALITY_CHECK', 'RELEASED'];

function buildIngredientRows(recipeId: string, ingredients: Array<Record<string, unknown>>) {
  if (!ingredients.length) throw new Error('Recipe must have at least one ingredient.');
  return ingredients.map((ingredient, index) => ({
    item_id: ingredient.itemId,
    quantity_required: ensurePositiveQuantity(Number(ingredient.quantityRequired), 'ingredient quantity'),
    recipe_id: recipeId,
    sort_order: index,
    unit_id: ingredient.unitId,
    wastage_allowance_percent: Number(ingredient.wastageAllowancePercent ?? 0),
  }));
}

function buildPackagingRows(recipeId: string, packagingItems: Array<Record<string, unknown>>) {
  return packagingItems.map((item, index) => ({
    item_id: item.itemId,
    quantity_required: ensurePositiveQuantity(Number(item.quantityRequired), 'packaging quantity'),
    recipe_id: recipeId,
    sort_order: index,
    unit_id: item.unitId,
    wastage_allowance_percent: Number(item.wastageAllowancePercent ?? 0),
  }));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const service = productionService();

    const { data: existing, error: existingError } = await service
      .from('recipes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return notFound('Recipe not found.');

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.instructions !== undefined) updates.instructions = body.instructions || null;
    if (body.packagingRequirement !== undefined) updates.packaging_requirement = body.packagingRequirement || null;
    if (body.expectedOutputQuantity !== undefined) {
      ensurePositiveQuantity(Number(body.expectedOutputQuantity), 'expectedOutputQuantity');
      updates.expected_output_quantity = Number(body.expectedOutputQuantity);
      updates.batch_size = Number(body.expectedOutputQuantity);
    }
    if (body.outputUnitId !== undefined) {
      updates.output_unit_id = body.outputUnitId;
      updates.batch_unit_id = body.outputUnitId;
    }
    if (body.finishedItemId !== undefined) updates.finished_item_id = body.finishedItemId;
    if (body.flavourId !== undefined) updates.flavour_id = body.flavourId || null;
    if (body.chocolateTypeId !== undefined) updates.chocolate_type_id = body.chocolateTypeId || null;
    if (body.version !== undefined) updates.version = Number(body.version);

    if (Array.isArray(body.ingredients) || Array.isArray(body.packagingItems)) {
      const ingredients = body.ingredients as Array<Record<string, unknown>>;
      const packagingItems = Array.isArray(body.packagingItems) ? body.packagingItems as Array<Record<string, unknown>> : [];
      if (!ingredients.length) return badRequest('Recipe must have at least one ingredient.');

      const nextVersion = Number(existing.version ?? 1) + 1;
      const { data: newRecipe, error: newRecipeError } = await service
        .from('recipes')
        .insert({
          ...existing,
          ...updates,
          code: `${String(existing.code ?? 'RCP')}-V${nextVersion}`,
          created_at: undefined,
          created_by: ctx.userId,
          id: undefined,
          status: 'ACTIVE',
          updated_at: undefined,
          version: nextVersion,
        })
        .select()
        .single();
      if (newRecipeError || !newRecipe) throw newRecipeError ?? new Error('Failed to create new BOM version.');

      const ingredientRows = buildIngredientRows(String(newRecipe.id), ingredients);
      const packagingRows = buildPackagingRows(String(newRecipe.id), packagingItems);
      const { error: ingredientError } = await service.from('recipe_items').insert(ingredientRows);
      if (ingredientError) throw ingredientError;
      if (packagingRows.length) {
        const { error: packagingError } = await service.from('recipe_packaging_items').insert(packagingRows);
        if (packagingError) throw packagingError;
      }

      const deactivateOld = await service.from('recipes').update({ status: 'INACTIVE', updated_at: new Date().toISOString() }).eq('id', id);
      if (deactivateOld.error) throw deactivateOld.error;

      await service.from('recipe_version_history').insert({
        after_values: { recipe: newRecipe, ingredientCount: ingredientRows.length, packagingCount: packagingRows.length },
        before_values: existing,
        change_type: 'VERSION_CREATED',
        changed_by: ctx.userId,
        organization_id: ctx.organizationId,
        previous_recipe_id: id,
        recipe_id: newRecipe.id,
        version_number: nextVersion,
      }).then(() => undefined).catch(() => undefined);

      await writeProductionAuditLog('PRODUCTION_RECIPE_VERSION_CREATED', String(newRecipe.id), ctx.userId, {
        previousRecipeId: id,
        version: nextVersion,
      }, 'recipe');
      return NextResponse.json(newRecipe);
    }

    const { data, error } = await service
      .from('recipes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await writeProductionAuditLog('PRODUCTION_RECIPE_UPDATED', id, ctx.userId, updates, 'recipe');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const service = productionService();
    const { data: recipe, error } = await service.from('recipes').select('id, code, name, status').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!recipe) return notFound('Recipe not found.');

    const [activeOrders, historicalBatches] = await Promise.all([
      service.from('production_orders').select('id, production_order_number, status').eq('bom_id', id).in('status', ACTIVE_PRODUCTION_STATUSES).limit(1),
      service.from('production_batches').select('id').eq('recipe_id', id).limit(1),
    ]);
    if (activeOrders.error && !String(activeOrders.error.message ?? '').includes('bom_id')) throw activeOrders.error;
    if (historicalBatches.error) throw historicalBatches.error;

    const activeOrder = (activeOrders.data ?? [])[0];
    if (activeOrder) {
      return badRequest(`Cannot delete this BOM because Production Order ${activeOrder.production_order_number ?? activeOrder.id} currently uses it.`);
    }

    if ((historicalBatches.data ?? []).length > 0) {
      const archive = await service.from('recipes').update({ status: 'ARCHIVED', updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (archive.error) throw archive.error;
      await writeProductionAuditLog('PRODUCTION_RECIPE_ARCHIVED', id, ctx.userId, { reason: 'Historical production exists.' }, 'recipe');
      return NextResponse.json({ archived: true, recipe: archive.data });
    }

    const archive = await service.from('recipes').update({ status: 'INACTIVE', updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (archive.error) throw archive.error;
    await writeProductionAuditLog('PRODUCTION_RECIPE_DEACTIVATED', id, ctx.userId, { reason: 'Safe non-destructive delete action.' }, 'recipe');
    return NextResponse.json({ archived: false, deactivated: true, recipe: archive.data });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
