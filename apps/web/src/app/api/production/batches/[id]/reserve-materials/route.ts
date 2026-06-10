import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
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
        id, batch_number, status, planned_quantity, warehouse_id,
        warehouses(id, branch_id),
        recipes(
          id, expected_output_quantity,
          recipe_items(item_id, quantity_required, unit_id, items(code, name), units_of_measure(abbreviation)),
          recipe_packaging_items(item_id, quantity_required, unit_id)
        )
      `)
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !batch) return notFound('Production batch not found');

    if (ctx.isBranchScoped && ctx.branchId) {
      const warehouse = batch.warehouses as { branch_id: string };
      if (warehouse?.branch_id !== ctx.branchId) return forbidden();
    }

    if (batch.status !== 'MATERIALS_APPROVED') {
      return badRequest(`Cannot reserve materials: batch must be in MATERIALS_APPROVED status (current: ${batch.status})`);
    }

    const recipe = batch.recipes as {
      expected_output_quantity: number;
      recipe_items: Array<{ item_id: string; quantity_required: number; unit_id: string; items: { code: string; name: string }; units_of_measure: { abbreviation: string } }>;
      recipe_packaging_items: Array<{ item_id: string; quantity_required: number; unit_id: string }>;
    };

    const baseOutput = Number(recipe.expected_output_quantity ?? 1);
    const scaleFactor = baseOutput > 0 ? Number(batch.planned_quantity) / baseOutput : 1;

    // Fetch packaging item details
    const packagingItemIds = [...new Set(recipe.recipe_packaging_items.map((pi) => pi.item_id))];
    const { data: packagingItemsData } = await service
      .schema('icecream_erp')
      .from('items')
      .select('id, code, name')
      .in('id', packagingItemIds);
    const packagingUnitIds = [...new Set(recipe.recipe_packaging_items.map((pi) => pi.unit_id))];
    const { data: packagingUnitsData } = await service
      .schema('icecream_erp')
      .from('units_of_measure')
      .select('id, abbreviation')
      .in('id', packagingUnitIds);
    const pkgItemMap = new Map((packagingItemsData ?? []).map((i: { id: string; code: string; name: string }) => [i.id, i]));
    const pkgUnitMap = new Map((packagingUnitsData ?? []).map((u: { id: string; abbreviation: string }) => [u.id, u]));

    const ingredients = [
      ...recipe.recipe_items.map((ri) => ({
        itemId: ri.item_id,
        itemName: ri.items.name,
        itemCode: ri.items.code,
        unitId: ri.unit_id,
        unitAbbreviation: ri.units_of_measure.abbreviation,
        quantityRequired: Number(ri.quantity_required) * scaleFactor,
      })),
      ...recipe.recipe_packaging_items.map((pi) => ({
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
