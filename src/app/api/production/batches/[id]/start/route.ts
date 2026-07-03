import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity, toNumber } from '@/lib/inventory';
import { getBalance, recordStockMovement, requireItem } from '@/lib/inventory-server';
import { firstRelation } from '@/lib/supabase-relations';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Requirement = {
  itemId: string;
  quantityRequired: number;
  unitCost: number;
  unitId: string | null;
};

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
      .select('id, batch_number, status, warehouses(branch_id)')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !batch) return notFound('Production batch not found');

    if (ctx.isBranchScoped && ctx.branchId) {
      const warehouse = firstRelation(batch.warehouses as { branch_id: string } | Array<{ branch_id: string }> | null);
      if (warehouse?.branch_id !== ctx.branchId) return forbidden();
    }

    if (['COMPLETED', 'CANCELLED'].includes(String(batch.status))) {
      return badRequest(`Cannot issue materials: batch is ${batch.status}.`);
    }

    if (['IN_PROGRESS', 'WIP', 'QUALITY_CHECK'].includes(String(batch.status))) {
      return badRequest(`Materials have already been issued for this batch (current: ${batch.status}).`);
    }

    if (!['PLANNED', 'MATERIALS_REQUESTED', 'MATERIALS_APPROVED', 'MATERIALS_RESERVED'].includes(String(batch.status))) {
      return badRequest(`Cannot issue materials from status ${batch.status}.`);
    }

    const { data: batchDetail, error: detailError } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .select('id, batch_number, organization_id, planned_quantity, expected_output, warehouse_id, recipe_id, status')
      .eq('id', id)
      .single();
    if (detailError) throw detailError;
    if (!batchDetail) return notFound('Production batch not found.');

    const { data: existingIssues, error: existingIssueError } = await service
      .schema('icecream_erp')
      .from('stock_movements')
      .select('item_id')
      .eq('reference_type', 'production_batch')
      .eq('reference_id', id)
      .eq('movement_type', 'PRODUCTION_ISSUE')
      .eq('warehouse_id', batchDetail.warehouse_id);
    if (existingIssueError) throw existingIssueError;
    if ((existingIssues ?? []).length > 0) {
      return badRequest('Materials were already issued for this production batch.');
    }

    const requirements = await buildBatchRequirements(service, {
      plannedQuantity: Number(batchDetail.planned_quantity ?? batchDetail.expected_output ?? 0),
      recipeId: String(batchDetail.recipe_id),
    });

    if (!requirements.length) {
      return badRequest('This BOM has no raw material lines to issue.');
    }

    const { data: existingMaterials, error: existingMaterialsError } = await service
      .schema('icecream_erp')
      .from('production_batch_materials')
      .select('id, item_id')
      .eq('batch_id', id);
    if (existingMaterialsError) throw existingMaterialsError;
    const materialByItemId = new Map((existingMaterials ?? []).map((row) => [String(row.item_id), row]));

    const failures: string[] = [];
    for (const requirement of requirements) {
      const item = await requireItem(service.schema('icecream_erp'), requirement.itemId);
      const balance = await getBalance(service.schema('icecream_erp'), requirement.itemId, String(batchDetail.warehouse_id));
      const reservedForThisBatch = batchDetail.status === 'MATERIALS_RESERVED' && materialByItemId.has(requirement.itemId)
        ? Math.min(toNumber(balance?.quantity_reserved), requirement.quantityRequired)
        : 0;
      const availableForIssue = toNumber(balance?.quantity_available) + reservedForThisBatch;

      if (!balance || availableForIssue < requirement.quantityRequired) {
        failures.push(
          `${item.name}: need ${requirement.quantityRequired.toFixed(3)}, available ${availableForIssue.toFixed(3)}`,
        );
      }
    }

    if (failures.length > 0) {
      return badRequest(`Cannot issue to production. Insufficient production raw material stock:\n${failures.join('\n')}`);
    }

    let materialCost = 0;
    for (const requirement of requirements) {
      const balance = await getBalance(service.schema('icecream_erp'), requirement.itemId, String(batchDetail.warehouse_id));
      if (!balance) {
        return badRequest(`No stock balance found for material ${requirement.itemId}.`);
      }

      const onHand = toNumber(balance.quantity_on_hand);
      const reserved = toNumber(balance.quantity_reserved);
      const reservedRelief = batchDetail.status === 'MATERIALS_RESERVED' && materialByItemId.has(requirement.itemId)
        ? Math.min(reserved, requirement.quantityRequired)
        : 0;
      const nextOnHand = onHand - requirement.quantityRequired;
      const nextReserved = Math.max(0, reserved - reservedRelief);
      const nextAvailable = nextOnHand - nextReserved;

      if (nextOnHand < 0 || nextAvailable < 0) {
        return badRequest(`Insufficient stock for material ${requirement.itemId}.`);
      }

      const { error: balanceError } = await service
        .schema('icecream_erp')
        .from('stock_balances')
        .update({
          last_updated: new Date().toISOString(),
          quantity_available: nextAvailable,
          quantity_on_hand: nextOnHand,
          quantity_reserved: nextReserved,
        })
        .eq('id', balance.id);
      if (balanceError) throw balanceError;

      const totalCost = requirement.quantityRequired * requirement.unitCost;
      materialCost += totalCost;
      const existingMaterial = materialByItemId.get(requirement.itemId);

      if (existingMaterial) {
        const { error: materialError } = await service
          .schema('icecream_erp')
          .from('production_batch_materials')
          .update({
            quantity_actual: requirement.quantityRequired,
            quantity_issued: requirement.quantityRequired,
            quantity_remaining: 0,
            quantity_required: requirement.quantityRequired,
            total_cost: totalCost,
            unit_cost: requirement.unitCost,
            variance: 0,
          })
          .eq('id', existingMaterial.id);
        if (materialError) throw materialError;
      } else {
        const { error: materialError } = await service
          .schema('icecream_erp')
          .from('production_batch_materials')
          .insert({
            batch_id: id,
            item_id: requirement.itemId,
            quantity_actual: requirement.quantityRequired,
            quantity_issued: requirement.quantityRequired,
            quantity_remaining: 0,
            quantity_required: requirement.quantityRequired,
            total_cost: totalCost,
            unit_cost: requirement.unitCost,
            unit_id: requirement.unitId,
            variance: 0,
          });
        if (materialError) throw materialError;
      }

      await recordStockMovement(service.schema('icecream_erp'), {
        createdBy: ctx.userId,
        itemId: requirement.itemId,
        movementType: 'PRODUCTION_ISSUE',
        notes: `Issued to production batch ${batch.batch_number}`,
        organizationId: ctx.organizationId,
        quantity: requirement.quantityRequired,
        referenceId: id,
        referenceType: 'production_batch',
        warehouseId: String(batchDetail.warehouse_id),
      });
    }

    const { data: updated, error: updateError } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .update({
        status: 'IN_PROGRESS',
        start_time: new Date().toISOString(),
        started_by: ctx.userId,
        material_cost: materialCost,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'PRODUCTION_MATERIALS_ISSUED',
      entity_id: id,
      entity_type: 'production_batch',
      new_values: { materialCost, materialsIssued: requirements.length, status: 'IN_PROGRESS' },
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

async function buildBatchRequirements(
  service: ReturnType<typeof createServiceRoleClient>,
  input: { plannedQuantity: number; recipeId: string },
): Promise<Requirement[]> {
  const plannedQuantity = ensurePositiveQuantity(input.plannedQuantity, 'plannedQuantity');
  const { data: recipe, error: recipeError } = await service
    .schema('icecream_erp')
    .from('recipes')
    .select('id, expected_output_quantity')
    .eq('id', input.recipeId)
    .single();
  if (recipeError) throw recipeError;

  const [ingredientResult, packagingResult] = await Promise.all([
    service
      .schema('icecream_erp')
      .from('recipe_items')
      .select('item_id, quantity_required, unit_id, wastage_allowance_percent')
      .eq('recipe_id', input.recipeId),
    service
      .schema('icecream_erp')
      .from('recipe_packaging_items')
      .select('item_id, quantity_required, unit_id, wastage_allowance_percent')
      .eq('recipe_id', input.recipeId),
  ]);
  if (ingredientResult.error) throw ingredientResult.error;
  if (packagingResult.error) throw packagingResult.error;

  const standardOutput = ensurePositiveQuantity(recipe.expected_output_quantity ?? 1, 'standard BOM output');
  const scale = plannedQuantity / standardOutput;
  const requirementsByItem = new Map<string, Requirement>();

  for (const line of [...(ingredientResult.data ?? []), ...(packagingResult.data ?? [])]) {
    const itemId = String(line.item_id ?? '');
    if (!itemId) continue;

    const item = await requireItem(service.schema('icecream_erp'), itemId);
    const baseQuantity = ensurePositiveQuantity(line.quantity_required, 'BOM quantity');
    const wastagePercent = Math.max(0, Number(line.wastage_allowance_percent ?? 0));
    const quantityRequired = (baseQuantity * scale) + ((baseQuantity * scale * wastagePercent) / 100);
    const current = requirementsByItem.get(itemId);

    requirementsByItem.set(itemId, {
      itemId,
      quantityRequired: (current?.quantityRequired ?? 0) + quantityRequired,
      unitCost: Number(item.unit_cost ?? current?.unitCost ?? 0),
      unitId: current?.unitId ?? (line.unit_id ? String(line.unit_id) : null),
    });
  }

  return Array.from(requirementsByItem.values());
}
