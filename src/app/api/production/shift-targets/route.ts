import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { loadShiftTargetRows, productionService } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    return NextResponse.json(await loadShiftTargetRows(ctx.isBranchScoped ? ctx.branchId : null));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      productId: string;
      shift: string;
      targetDate: string;
      targetMaterialUsage?: number;
      targetOutputQuantity: number;
      targetProductionTimeHours?: number;
      targetWorkers: number;
    };
    if (!body.productId) return badRequest('productId is required.');
    if (!body.targetDate) return badRequest('targetDate is required.');

    const service = productionService();
    const { data, error } = await service
      .from('production_shift_targets')
      .insert({
        approved_by: ctx.userId,
        product_id: body.productId,
        shift: String(body.shift ?? 'DAY').toUpperCase(),
        target_date: body.targetDate,
        target_material_usage: Number(body.targetMaterialUsage ?? 0),
        target_output_quantity: Number(body.targetOutputQuantity ?? 0),
        target_production_time_hours: Number(body.targetProductionTimeHours ?? 0),
        target_workers: Number(body.targetWorkers ?? 0),
      })
      .select()
      .single();
    if (error) {
      if (String(error.message ?? '').includes("Could not find the table 'icecream_erp.production_shift_targets'")) {
        return badRequest('Shift targets setup is not available in this environment. Use production planning and shift reports until target tables are provisioned.');
      }
      throw error;
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
