import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { firstRelation } from '@/lib/supabase-relations';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      actualMaterials?: Array<{ itemId: string; quantityActual: number }>;
      wastageReason?: string;
    };

    const { data: batch, error } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .select(`
        id, batch_number, status, quality_status, expected_output, warehouse_id, quality_notes, wastage_reason,
        organization_id,
        recipe_id,
        warehouses(branch_id)
      `)
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !batch) return notFound('Production batch not found');

    if (ctx.isBranchScoped && ctx.branchId) {
      const warehouse = firstRelation(batch.warehouses as { branch_id: string } | Array<{ branch_id: string }> | null);
      if (warehouse?.branch_id !== ctx.branchId) return forbidden();
    }

    const status = String(batch.status);
    const directReleaseStatus = ['IN_PROGRESS', 'WIP', 'MATERIALS_RESERVED'].includes(status);
    const qualityReleaseStatus = status === 'QUALITY_CHECK';
    if (!directReleaseStatus && !qualityReleaseStatus) {
      return badRequest(`Cannot release finished goods from status ${batch.status}. Issue materials first.`);
    }
    if (qualityReleaseStatus && batch.quality_status === 'FAILED') {
      return badRequest('Cannot release finished goods: quality check FAILED. Cancel this batch instead.');
    }
    if (qualityReleaseStatus && batch.quality_status === 'PENDING') {
      return badRequest('Cannot release finished goods: quality check has not been completed yet.');
    }

    const [materialsResult, outputsResult, recipeResult] = await Promise.all([
      service
        .schema('icecream_erp')
        .from('production_batch_materials')
        .select('id, item_id, quantity_required, quantity_issued, quantity_actual')
        .eq('batch_id', id),
      service
        .schema('icecream_erp')
        .from('production_batch_outputs')
        .select('id, item_id, unit_id, expected_quantity, actual_quantity')
        .eq('batch_id', id),
      service
        .schema('icecream_erp')
        .from('recipes')
        .select('finished_item_id, output_unit_id')
        .eq('id', batch.recipe_id)
        .maybeSingle(),
    ]);
    if (materialsResult.error) throw materialsResult.error;
    if (outputsResult.error) throw outputsResult.error;
    if (recipeResult.error) throw recipeResult.error;

    const { data: issuedMovements, error: issuedMovementsError } = await service
      .schema('icecream_erp')
      .from('stock_movements')
      .select('item_id')
      .eq('reference_type', 'production_batch')
      .eq('reference_id', id)
      .eq('movement_type', 'PRODUCTION_ISSUE')
      .eq('warehouse_id', batch.warehouse_id);
    if (issuedMovementsError) throw issuedMovementsError;
    const issuedItemIds = new Set((issuedMovements ?? []).map((row) => String(row.item_id)));

    const actualByItemId = new Map((body.actualMaterials ?? []).map((r) => [r.itemId, r.quantityActual]));
    const materials = (materialsResult.data ?? []) as Array<{
      id: string; item_id: string; quantity_required: number; quantity_issued: number; quantity_actual: number;
    }>;

    if (materials.length === 0) {
      return badRequest('Issue materials before releasing finished goods.');
    }

    // Issue stock for materials consumed
    for (const material of materials) {
      const required = Number(material.quantity_required);
      const defaultIssued = Number(material.quantity_issued);
      const actualQty = actualByItemId.get(material.item_id) ?? (defaultIssued || required);
      if (actualQty <= 0) continue;

      if (issuedItemIds.has(material.item_id)) {
        await service.schema('icecream_erp').from('production_batch_materials').update({
          quantity_actual: actualQty,
          quantity_issued: defaultIssued || actualQty,
          variance: actualQty - required,
        }).eq('id', material.id);
        continue;
      }

      const { data: balance, error: balanceError } = await service
        .schema('icecream_erp')
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_reserved, quantity_available')
        .eq('item_id', material.item_id)
        .eq('warehouse_id', batch.warehouse_id)
        .maybeSingle();
      if (balanceError) throw balanceError;

      if (!balance) {
        return badRequest(`No stock balance found for material ${material.item_id} in the production warehouse.`);
      }

      const onHand = Number(balance.quantity_on_hand ?? 0);
      const reserved = Number(balance.quantity_reserved ?? 0);
      if (onHand < actualQty) {
        return badRequest(`Insufficient stock to close batch for material ${material.item_id}.`);
      }

      const releaseAmount = Math.min(actualQty, reserved);
      const newOnHand = onHand - actualQty;
      const newReserved = Math.max(0, reserved - releaseAmount);

      await service.schema('icecream_erp').from('stock_balances').update({
        quantity_on_hand: newOnHand,
        quantity_reserved: newReserved,
        quantity_available: Math.max(0, newOnHand - newReserved),
        last_updated: new Date().toISOString(),
      }).eq('id', balance.id);

      await service.schema('icecream_erp').from('stock_movements').insert({
        organization_id: batch.organization_id,
        item_id: material.item_id,
        warehouse_id: batch.warehouse_id,
        movement_type: 'PRODUCTION_ISSUE',
        quantity: actualQty,
        reference_id: id,
        reference_type: 'production_batch',
        unit_cost: 0,
        total_cost: 0,
        created_by: ctx.userId,
        running_balance: newOnHand,
      });

      await service.schema('icecream_erp').from('production_batch_materials').update({
        quantity_actual: actualQty,
        quantity_issued: actualQty,
        variance: actualQty - required,
      }).eq('id', material.id);
    }

    // Add finished goods to inventory
    const outputs = (outputsResult.data ?? []) as Array<{
      id: string; item_id: string; unit_id: string; expected_quantity: number; actual_quantity: number;
    }>;
    const recipe = recipeResult.data as { finished_item_id: string; output_unit_id: string } | null;

    let totalActualOutput = 0;
    const outputList = outputs.length > 0
      ? outputs
      : recipe
        ? [{ item_id: recipe.finished_item_id, actual_quantity: 0, expected_quantity: Number(batch.expected_output) }]
        : [];

    for (const output of outputList) {
      const actualQty = Number(output.actual_quantity ?? 0);
      if (actualQty <= 0) continue;
      totalActualOutput += actualQty;

      // Check if stock balance exists for finished good
      const { data: fgBalance } = await service
        .schema('icecream_erp')
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_available')
        .eq('item_id', output.item_id)
        .eq('warehouse_id', batch.warehouse_id)
        .maybeSingle();

      if (fgBalance) {
        await service.schema('icecream_erp').from('stock_balances').update({
          quantity_on_hand: Number(fgBalance.quantity_on_hand) + actualQty,
          quantity_available: Number(fgBalance.quantity_available) + actualQty,
          last_updated: new Date().toISOString(),
        }).eq('id', fgBalance.id);
      } else {
        await service.schema('icecream_erp').from('stock_balances').insert({
          organization_id: batch.organization_id,
          item_id: output.item_id,
          warehouse_id: batch.warehouse_id,
          quantity_on_hand: actualQty,
          quantity_available: actualQty,
          quantity_reserved: 0,
        });
      }

      await service.schema('icecream_erp').from('stock_movements').insert({
        organization_id: batch.organization_id,
        item_id: output.item_id,
        warehouse_id: batch.warehouse_id,
        movement_type: 'PRODUCTION_OUTPUT',
        quantity: actualQty,
        reference_id: id,
        reference_type: 'production_batch',
        unit_cost: 0,
        total_cost: 0,
        created_by: ctx.userId,
        running_balance: Number(fgBalance?.quantity_on_hand ?? 0) + actualQty,
      });
    }

    const expectedOutput = Number(batch.expected_output);
    if (totalActualOutput <= 0) {
      return badRequest('Enter the actual quantity produced before releasing finished goods.');
    }

    const wastageQuantity = Math.max(0, expectedOutput - totalActualOutput);
    const wastagePercentage = expectedOutput > 0 ? (wastageQuantity / expectedOutput) * 100 : 0;
    const efficiencyPercentage = expectedOutput > 0 ? (totalActualOutput / expectedOutput) * 100 : 0;

    const { data: updated, error: updateError } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .update({
        status: 'COMPLETED',
        actual_output: totalActualOutput,
        wastage_quantity: wastageQuantity,
        wastage_percentage: wastagePercentage,
        efficiency_percentage: efficiencyPercentage,
        end_time: new Date().toISOString(),
        closed_by: ctx.userId,
        wastage_reason: body.wastageReason ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'PRODUCTION_BATCH_COMPLETED',
      entity_id: id,
      entity_type: 'production_batch',
      new_values: { actualOutput: totalActualOutput, efficiencyPercentage, wastageQuantity, status: 'COMPLETED' },
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
