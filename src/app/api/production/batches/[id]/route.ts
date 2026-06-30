import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
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
        worker_count, people_off_count, labour_cost, overhead_cost, material_cost
      `)
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !batch) return notFound('Production batch not found');

    const [warehouseResult, recipeResult, recipeItemsResult, packagingItemsResult, materialsResult, outputsResult, workersResult] = await Promise.all([
      service
        .schema('icecream_erp')
        .from('warehouses')
        .select('id, name, branch_id')
        .eq('id', batch.warehouse_id)
        .maybeSingle(),
      service
        .schema('icecream_erp')
        .from('recipes')
        .select('id, code, name, finished_item_id, output_unit_id')
        .eq('id', batch.recipe_id)
        .maybeSingle(),
      service
        .schema('icecream_erp')
        .from('recipe_items')
        .select('id, item_id, quantity_required, unit_id, wastage_allowance_percent')
        .eq('recipe_id', batch.recipe_id),
      service
        .schema('icecream_erp')
        .from('recipe_packaging_items')
        .select('id, item_id, quantity_required, unit_id, wastage_allowance_percent')
        .eq('recipe_id', batch.recipe_id),
      service
        .schema('icecream_erp')
        .from('production_batch_materials')
        .select('id, item_id, quantity_required, quantity_issued, quantity_actual, quantity_remaining, variance, unit_id, unit_cost, total_cost, notes')
        .eq('batch_id', id),
      service
        .schema('icecream_erp')
        .from('production_batch_outputs')
        .select('id, item_id, unit_id, expected_quantity, actual_quantity, wastage_quantity, notes')
        .eq('batch_id', id),
      service
        .schema('icecream_erp')
        .from('production_worker_assignments')
        .select('id, employee_id, worker_name, attendance_status, is_off_shift, hours_worked, output_quantity, remarks')
        .eq('batch_id', id),
    ]);

    if (warehouseResult.error) throw warehouseResult.error;
    if (recipeResult.error) throw recipeResult.error;
    if (recipeItemsResult.error) throw recipeItemsResult.error;
    if (packagingItemsResult.error) throw packagingItemsResult.error;
    if (materialsResult.error) throw materialsResult.error;
    if (outputsResult.error) throw outputsResult.error;
    if (workersResult.error) throw workersResult.error;

    if (ctx.isBranchScoped && ctx.branchId && warehouseResult.data?.branch_id !== ctx.branchId) return forbidden();

    const recipe = recipeResult.data
      ? {
          ...recipeResult.data,
          recipe_items: recipeItemsResult.data ?? [],
          recipe_packaging_items: packagingItemsResult.data ?? [],
        }
      : null;

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
      workerCount: Number(batch.worker_count ?? 0),
      peopleOffCount: Number(batch.people_off_count ?? 0),
      labourCost: Number(batch.labour_cost ?? 0),
      overheadCost: Number(batch.overhead_cost ?? 0),
      materialCost: Number(batch.material_cost ?? 0),
      wastageQuantity: Number(batch.wastage_quantity ?? 0),
      wastagePercentage: Number(batch.wastage_percentage ?? 0),
      efficiencyPercentage: Number(batch.efficiency_percentage ?? 0),
      warehouseId: batch.warehouse_id,
      recipeId: batch.recipe_id,
      startTime: batch.start_time,
      endTime: batch.end_time,
      recipe,
      warehouse: warehouseResult.data,
      materials: materialsResult.data ?? [],
      outputs: outputsResult.data ?? [],
      workers: workersResult.data ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const body = await request.json() as Record<string, unknown>;
    const { data: existing, error: existingError } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .select('id, status, warehouses(branch_id)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (existingError || !existing) return notFound('Production batch not found');

    if (ctx.isBranchScoped && ctx.branchId) {
      const warehouse = Array.isArray(existing.warehouses) ? existing.warehouses[0] : existing.warehouses as { branch_id: string } | undefined;
      if (warehouse?.branch_id !== ctx.branchId) return forbidden();
    }

    if (['COMPLETED', 'CANCELLED'].includes(String(existing.status))) {
      return badRequest('Completed or cancelled batches cannot be edited.');
    }

    const updates: Record<string, unknown> = {};
    if (body.productionDate !== undefined) updates.production_date = body.productionDate;
    if (body.shift !== undefined) updates.shift = body.shift;
    if (body.productionLine !== undefined) updates.production_line = body.productionLine;
    if (body.expectedOutput !== undefined) updates.expected_output = Number(body.expectedOutput);
    if (body.plannedQuantity !== undefined) updates.planned_quantity = Number(body.plannedQuantity);
    if (body.workerCount !== undefined) updates.worker_count = Number(body.workerCount);
    if (body.peopleOffCount !== undefined) updates.people_off_count = Number(body.peopleOffCount);
    if (body.labourCost !== undefined) updates.labour_cost = Number(body.labourCost);
    if (body.overheadCost !== undefined) updates.overhead_cost = Number(body.overheadCost);
    if (body.materialCost !== undefined) updates.material_cost = Number(body.materialCost);
    if (body.warehouseId !== undefined) updates.warehouse_id = body.warehouseId;

    const { data, error } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'PRODUCTION_BATCH_UPDATED',
      entity_id: id,
      entity_type: 'production_batch',
      new_values: updates,
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
