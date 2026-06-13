import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensureNonNegative } from '@/lib/inventory';
import { productionService } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('production_wastage')
      .select(`
        id, production_batch_id, item_id, wastage_type, quantity, unit_cost, total_cost, reason, created_at,
        production_batches(batch_number),
        items(code, name)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
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
      itemId: string;
      productionBatchId: string;
      quantity: number;
      reason?: string;
      unitCost?: number;
      wastageType: string;
    };

    if (!body.productionBatchId) return badRequest('productionBatchId is required.');
    if (!body.itemId) return badRequest('itemId is required.');
    const quantity = ensureNonNegative(body.quantity, 'quantity');
    const unitCost = ensureNonNegative(body.unitCost ?? 0, 'unitCost');

    const service = productionService();
    const { data, error } = await service
      .from('production_wastage')
      .insert({
        item_id: body.itemId,
        production_batch_id: body.productionBatchId,
        quantity,
        reason: body.reason ?? null,
        reported_by: ctx.userId,
        total_cost: quantity * unitCost,
        unit_cost: unitCost,
        wastage_type: body.wastageType,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
