import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  const warehouseId = searchParams.get('warehouseId') ?? undefined;
  const recipeId = searchParams.get('recipeId') ?? undefined;
  const branchId = searchParams.get('branchId') ?? undefined;

  try {
    const effectiveBranchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : (branchId ?? null);

    let warehouseIds: string[] | null = null;
    if (effectiveBranchId) {
      const { data: warehouses } = await service
        .schema('icecream_erp')
        .from('warehouses')
        .select('id')
        .eq('branch_id', effectiveBranchId);
      warehouseIds = (warehouses ?? []).map((w: { id: string }) => w.id);
    }

    let query = service
      .schema('icecream_erp')
      .from('production_batches')
      .select(`
        id, batch_number, production_date, shift, production_line, status, quality_status,
        planned_quantity, expected_output, actual_output, warehouse_id, recipe_id,
        recipes!inner(id, code, name),
        warehouses!inner(id, name)
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('production_date', { ascending: false });

    if (status) query = query.eq('status', status);
    if (warehouseId) query = query.eq('warehouse_id', warehouseId);
    if (recipeId) query = query.eq('recipe_id', recipeId);
    if (startDate) query = query.gte('production_date', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('production_date', `${endDate}T23:59:59.999Z`);
    if (warehouseIds && warehouseIds.length > 0) query = query.in('warehouse_id', warehouseIds);
    if (search) {
      query = query.or(`batch_number.ilike.%${search}%,production_line.ilike.%${search}%`);
    }

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        batchNumber: row.batch_number,
        productionDate: row.production_date,
        shift: row.shift,
        productionLine: row.production_line,
        status: row.status,
        qualityStatus: row.quality_status,
        plannedQuantity: Number(row.planned_quantity ?? 0),
        expectedOutput: Number(row.expected_output ?? 0),
        actualOutput: Number(row.actual_output ?? 0),
        recipe: row.recipes,
        warehouse: row.warehouses,
      })),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      recipeId: string;
      warehouseId: string;
      plannedQuantity: number;
      expectedOutput: number;
      productionDate: string;
      productionLine?: string;
      shift?: string;
    };

    const { recipeId, warehouseId, plannedQuantity, expectedOutput, productionDate, productionLine, shift } = body;
    if (!recipeId || !warehouseId || !plannedQuantity || !expectedOutput || !productionDate) {
      return badRequest('recipeId, warehouseId, plannedQuantity, expectedOutput, productionDate are required');
    }

    // Validate recipe
    const { data: recipe } = await service
      .schema('icecream_erp')
      .from('recipes')
      .select('id, code, name, finished_item_id, output_unit_id')
      .eq('id', recipeId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .single();
    if (!recipe) return badRequest('Recipe not found or inactive.');

    // Validate warehouse
    const { data: warehouse } = await service
      .schema('icecream_erp')
      .from('warehouses')
      .select('id, branch_id')
      .eq('id', warehouseId)
      .eq('is_active', true)
      .single();
    if (!warehouse) return badRequest('Warehouse not found.');

    if (ctx.isBranchScoped && ctx.branchId && warehouse.branch_id !== ctx.branchId) {
      return forbidden();
    }

    // Generate batch number
    const { count } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .select('*', { count: 'exact', head: true });
    const batchNumber = `PB-${String((count ?? 0) + 1).padStart(5, '0')}`;

    const { data: batch, error: batchErr } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .insert({
        batch_number: batchNumber,
        recipe_id: recipeId,
        warehouse_id: warehouseId,
        planned_quantity: plannedQuantity,
        expected_output: expectedOutput,
        production_date: `${productionDate}T00:00:00.000Z`,
        production_line: productionLine ?? null,
        shift: shift ?? null,
        status: 'PLANNED',
        quality_status: 'PENDING',
        actual_output: 0,
        wastage_quantity: 0,
        wastage_percentage: 0,
        efficiency_percentage: 0,
      })
      .select()
      .single();

    if (batchErr) throw batchErr;

    // Create output record
    await service.schema('icecream_erp').from('production_batch_outputs').insert({
      batch_id: batch.id,
      item_id: recipe.finished_item_id,
      unit_id: recipe.output_unit_id,
      expected_quantity: expectedOutput,
      actual_quantity: 0,
    });

    // Audit log
    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'PRODUCTION_BATCH_CREATED',
      entity_id: batch.id,
      entity_type: 'production_batch',
      new_values: { batchNumber, status: 'PLANNED' },
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(batch, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
