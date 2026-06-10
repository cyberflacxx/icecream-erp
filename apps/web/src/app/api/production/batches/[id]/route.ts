import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: batch, error } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .select(`
        id, batch_number, production_date, production_line, shift, status, quality_status,
        planned_quantity, expected_output, actual_output, wastage_quantity, wastage_percentage,
        efficiency_percentage, warehouse_id, recipe_id, start_time, end_time, quality_notes,
        recipes(id, code, name, finished_item_id, output_unit_id,
          recipe_items(id, item_id, quantity_required, unit_id, items(code, name), units_of_measure(abbreviation)),
          recipe_packaging_items(item_id, quantity_required, unit_id)
        ),
        warehouses(id, name, branch_id),
        production_batch_materials(id, item_id, quantity_required, quantity_issued, quantity_actual, variance, unit_id),
        production_batch_outputs(id, item_id, unit_id, expected_quantity, actual_quantity)
      `)
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !batch) return notFound('Production batch not found');

    if (ctx.isBranchScoped && ctx.branchId) {
      const warehouse = batch.warehouses as { branch_id: string };
      if (warehouse?.branch_id !== ctx.branchId) return forbidden();
    }

    return NextResponse.json({
      id: batch.id,
      batchNumber: batch.batch_number,
      productionDate: batch.production_date,
      productionLine: batch.production_line,
      shift: batch.shift,
      status: batch.status,
      qualityStatus: batch.quality_status,
      qualityNotes: batch.quality_notes,
      plannedQuantity: Number(batch.planned_quantity ?? 0),
      expectedOutput: Number(batch.expected_output ?? 0),
      actualOutput: Number(batch.actual_output ?? 0),
      wastageQuantity: Number(batch.wastage_quantity ?? 0),
      wastagePercentage: Number(batch.wastage_percentage ?? 0),
      efficiencyPercentage: Number(batch.efficiency_percentage ?? 0),
      warehouseId: batch.warehouse_id,
      recipeId: batch.recipe_id,
      startTime: batch.start_time,
      endTime: batch.end_time,
      recipe: batch.recipes,
      warehouse: batch.warehouses,
      materials: batch.production_batch_materials,
      outputs: batch.production_batch_outputs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
