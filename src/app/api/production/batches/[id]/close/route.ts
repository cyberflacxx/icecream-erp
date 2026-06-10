import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
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
        warehouses(branch_id),
        production_batch_materials(id, item_id, quantity_required, quantity_issued, quantity_actual),
        production_batch_outputs(id, item_id, unit_id, expected_quantity, actual_quantity),
        recipes(finished_item_id, output_unit_id)
      `)
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !batch) return notFound('Production batch not found');

    if (ctx.isBranchScoped && ctx.branchId) {
      const warehouse = batch.warehouses as { branch_id: string };
      if (warehouse?.branch_id !== ctx.branchId) return forbidden();
    }

    if (batch.status !== 'QUALITY_CHECK') {
      return badRequest(`Cannot close batch: must be in QUALITY_CHECK status (current: ${batch.status})`);
    }
    if (batch.quality_status === 'FAILED') {
      return badRequest(`Cannot close batch: quality check FAILED. Cancel this batch instead.`);
    }
    if (batch.quality_status === 'PENDING') {
      return badRequest(`Cannot close batch: quality check has not been completed yet.`);
    }

    const actualByItemId = new Map((body.actualMaterials ?? []).map((r) => [r.itemId, r.quantityActual]));
    const materials = batch.production_batch_materials as Array<{
      id: string; item_id: string; quantity_required: number; quantity_issued: number; quantity_actual: number;
    }>;

    // Issue stock for materials consumed
    for (const material of materials) {
      const required = Number(material.quantity_required);
      const defaultIssued = Number(material.quantity_issued);
      const actualQty = actualByItemId.get(material.item_id) ?? (defaultIssued || required);
      if (actualQty <= 0) continue;

      // Deduct from stock balance
      const { data: balance } = await service
        .schema('icecream_erp')
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_reserved, quantity_available')
        .eq('item_id', material.item_id)
        .eq('warehouse_id', batch.warehouse_id)
        .maybeSingle();

      if (balance) {
        const toRelease = Math.max(0, required - actualQty);
        const releaseAmount = Math.min(toRelease, Number(balance.quantity_reserved));

        await service.schema('icecream_erp').from('stock_balances').update({
          quantity_on_hand: Math.max(0, Number(balance.quantity_on_hand) - actualQty),
          quantity_reserved: Math.max(0, Number(balance.quantity_reserved) - releaseAmount),
          quantity_available: Number(balance.quantity_available) + releaseAmount,
          last_updated: new Date().toISOString(),
        }).eq('id', balance.id);

        await service.schema('icecream_erp').from('stock_movements').insert({
          item_id: material.item_id,
          warehouse_id: batch.warehouse_id,
          movement_type: 'PRODUCTION_ISSUE',
          quantity: actualQty,
          reference_id: id,
          reference_type: 'production_batch',
          unit_cost: 0,
          total_cost: 0,
          created_by: ctx.userId,
        });
      }

      await service.schema('icecream_erp').from('production_batch_materials').update({
        quantity_actual: actualQty,
        quantity_issued: actualQty,
        variance: required - actualQty,
      }).eq('id', material.id);
    }

    // Add finished goods to inventory
    const outputs = batch.production_batch_outputs as Array<{
      id: string; item_id: string; unit_id: string; expected_quantity: number; actual_quantity: number;
    }>;
    const recipe = batch.recipes as { finished_item_id: string; output_unit_id: string };

    let totalActualOutput = 0;
    const outputList = outputs.length > 0 ? outputs : [{ item_id: recipe.finished_item_id, actual_quantity: 0, expected_quantity: Number(batch.expected_output) }];

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
          item_id: output.item_id,
          warehouse_id: batch.warehouse_id,
          quantity_on_hand: actualQty,
          quantity_available: actualQty,
          quantity_reserved: 0,
        });
      }

      await service.schema('icecream_erp').from('stock_movements').insert({
        item_id: output.item_id,
        warehouse_id: batch.warehouse_id,
        movement_type: 'PRODUCTION_RECEIVE',
        quantity: actualQty,
        reference_id: id,
        reference_type: 'production_batch',
        unit_cost: 0,
        total_cost: 0,
        created_by: ctx.userId,
      });
    }

    const expectedOutput = Number(batch.expected_output);
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
