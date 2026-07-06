import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { firstRelation } from '@/lib/supabase-relations';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: batch, error } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .select(`
        id, batch_number, status, planned_quantity, warehouse_id, recipe_id,
        warehouses(id, branch_id)
      `)
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !batch) return notFound('Production batch not found');

    if (ctx.isBranchScoped && ctx.branchId) {
      const warehouse = firstRelation(batch.warehouses as { branch_id: string } | Array<{ branch_id: string }> | null);
      if (warehouse?.branch_id && warehouse.branch_id !== ctx.branchId) return forbidden();
    }

    if (batch.status !== 'MATERIALS_APPROVED') {
      return badRequest(`Cannot reserve materials: batch must be in MATERIALS_APPROVED status (current: ${batch.status})`);
    }

    const { data: recipe, error: recipeError } = await service
      .schema('icecream_erp')
      .from('recipes')
      .select('id, expected_output_quantity')
      .eq('id', batch.recipe_id)
      .maybeSingle();
    if (recipeError) throw recipeError;
    if (!recipe) return badRequest('Cannot reserve materials: batch has no recipe attached');

    const [recipeItemsResult, packagingItemsResult] = await Promise.all([
      service
        .schema('icecream_erp')
        .from('recipe_items')
        .select('item_id, quantity_required, unit_id')
        .eq('recipe_id', batch.recipe_id),
      service
        .schema('icecream_erp')
        .from('recipe_packaging_items')
        .select('item_id, quantity_required, unit_id')
        .eq('recipe_id', batch.recipe_id),
    ]);
    if (recipeItemsResult.error) throw recipeItemsResult.error;
    if (packagingItemsResult.error) throw packagingItemsResult.error;

    const baseOutput = Number(recipe.expected_output_quantity ?? 1);
    const scaleFactor = baseOutput > 0 ? Number(batch.planned_quantity) / baseOutput : 1;

    const recipeItems = recipeItemsResult.data ?? [];
    const packagingItems = packagingItemsResult.data ?? [];
    const itemIds = [...new Set([...recipeItems, ...packagingItems].map((row) => row.item_id).filter(Boolean))];
    const unitIds = [...new Set([...recipeItems, ...packagingItems].map((row) => row.unit_id).filter(Boolean))];

    const [{ data: packagingItemsData }, { data: packagingUnitsData }] = await Promise.all([
      itemIds.length
        ? service.schema('icecream_erp').from('items').select('id, code, name').in('id', itemIds)
        : Promise.resolve({ data: [] }),
      unitIds.length
        ? service.schema('icecream_erp').from('units_of_measure').select('id, abbreviation').in('id', unitIds)
        : Promise.resolve({ data: [] }),
    ]);
    const pkgItemMap = new Map((packagingItemsData ?? []).map((i: { id: string; code: string; name: string }) => [i.id, i]));
    const pkgUnitMap = new Map((packagingUnitsData ?? []).map((u: { id: string; abbreviation: string }) => [u.id, u]));

    const ingredients = [
      ...recipeItems.map((ri) => ({
        itemId: ri.item_id,
        itemName: pkgItemMap.get(ri.item_id)?.name ?? 'Unknown',
        itemCode: pkgItemMap.get(ri.item_id)?.code ?? 'N/A',
        unitId: ri.unit_id,
        unitAbbreviation: pkgUnitMap.get(ri.unit_id)?.abbreviation ?? '-',
        quantityRequired: Number(ri.quantity_required) * scaleFactor,
      })),
      ...packagingItems.map((pi) => ({
        itemId: pi.item_id,
        itemName: pkgItemMap.get(pi.item_id)?.name ?? 'Unknown',
        itemCode: pkgItemMap.get(pi.item_id)?.code ?? 'N/A',
        unitId: pi.unit_id,
        unitAbbreviation: pkgUnitMap.get(pi.unit_id)?.abbreviation ?? '-',
        quantityRequired: Number(pi.quantity_required) * scaleFactor,
      })),
    ];

    // Check stock availability
    const failures: string[] = [];
    for (const ingredient of ingredients) {
      const { data: balance } = await service
        .schema('icecream_erp')
        .from('stock_balances')
        .select('quantity_on_hand, quantity_reserved, quantity_available')
        .eq('item_id', ingredient.itemId)
        .eq('warehouse_id', batch.warehouse_id)
        .maybeSingle();

      const available = balance ? Number(balance.quantity_available) : 0;
      if (available < ingredient.quantityRequired) {
        failures.push(
          `${ingredient.itemName} (${ingredient.itemCode}): need ${ingredient.quantityRequired.toFixed(3)} ${ingredient.unitAbbreviation}, available ${available.toFixed(3)} ${ingredient.unitAbbreviation}`,
        );
      }
    }

    if (failures.length > 0) {
      return badRequest(`Cannot reserve materials. Insufficient stock:\n${failures.join('\n')}`);
    }

    // Reserve stock and create batch materials
    for (const ingredient of ingredients) {
      const { data: balance } = await service
        .schema('icecream_erp')
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_reserved, quantity_available')
        .eq('item_id', ingredient.itemId)
        .eq('warehouse_id', batch.warehouse_id)
        .single();

      if (!balance) continue;

      const newReserved = Number(balance.quantity_reserved) + ingredient.quantityRequired;
      const newAvailable = Number(balance.quantity_on_hand) - newReserved;

      await service.schema('icecream_erp').from('stock_balances').update({
        quantity_reserved: newReserved,
        quantity_available: newAvailable,
        last_updated: new Date().toISOString(),
      }).eq('id', balance.id);

      // Upsert batch material
      const { data: existing } = await service
        .schema('icecream_erp')
        .from('production_batch_materials')
        .select('id')
        .eq('batch_id', id)
        .eq('item_id', ingredient.itemId)
        .maybeSingle();

      if (existing) {
        await service.schema('icecream_erp').from('production_batch_materials').update({
          quantity_required: ingredient.quantityRequired,
        }).eq('id', existing.id);
      } else {
        await service.schema('icecream_erp').from('production_batch_materials').insert({
          batch_id: id,
          item_id: ingredient.itemId,
          unit_id: ingredient.unitId,
          quantity_required: ingredient.quantityRequired,
          quantity_actual: 0,
          quantity_issued: 0,
          variance: 0,
        });
      }
    }

    const { data: updated, error: updateError } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .update({ status: 'MATERIALS_RESERVED' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'MATERIALS_RESERVED',
      entity_id: id,
      entity_type: 'production_batch',
      new_values: { itemsReserved: ingredients.length, status: 'MATERIALS_RESERVED' },
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
