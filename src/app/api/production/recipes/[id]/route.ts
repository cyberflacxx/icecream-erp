import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

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
      .select('id, status')
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
    }
    if (body.outputUnitId !== undefined) updates.output_unit_id = body.outputUnitId;
    if (body.finishedItemId !== undefined) updates.finished_item_id = body.finishedItemId;
    if (body.flavourId !== undefined) updates.flavour_id = body.flavourId || null;
    if (body.chocolateTypeId !== undefined) updates.chocolate_type_id = body.chocolateTypeId || null;
    if (body.version !== undefined) updates.version = Number(body.version);

    const { data, error } = await service
      .from('recipes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (Array.isArray(body.ingredients)) {
      await service.from('recipe_items').delete().eq('recipe_id', id);
      const ingredients = body.ingredients as Array<Record<string, unknown>>;
      if (!ingredients.length) return badRequest('Recipe must have at least one ingredient.');

      const rows = ingredients.map((ingredient) => ({
        item_id: ingredient.itemId,
        quantity_required: ensurePositiveQuantity(Number(ingredient.quantityRequired), 'ingredient quantity'),
        recipe_id: id,
        unit_id: ingredient.unitId,
        wastage_allowance_percent: Number(ingredient.wastageAllowancePercent ?? 0),
      }));

      const { error: ingredientError } = await service.from('recipe_items').insert(rows);
      if (ingredientError) throw ingredientError;
    }

    await writeProductionAuditLog('PRODUCTION_RECIPE_UPDATED', id, ctx.userId, updates, 'recipe');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
