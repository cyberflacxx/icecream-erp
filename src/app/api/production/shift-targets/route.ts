import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { productionService } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('production_shift_targets')
      .select(`
        id, target_date, shift, product_id, target_output_quantity, target_workers, target_production_time_hours, target_material_usage, approved_by, created_at,
        items(id, code, name)
      `)
      .order('target_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
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
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
