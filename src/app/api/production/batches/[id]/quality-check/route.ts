import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      failedQuantity?: number;
      notes?: string;
      passedQuantity?: number;
      status: 'PENDING' | 'PASSED' | 'FAILED' | 'CONDITIONAL_RELEASE';
    };

    if (!body.status) return badRequest('status is required.');

    const service = productionService();
    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return notFound('Production batch not found.');

    if (['IN_PROGRESS', 'WIP', 'QUALITY_CHECK'].includes(String(batch.status)) === false) {
      return badRequest('Batch must be in progress or pending quality.');
    }

    await service
      .from('production_batches')
      .update({
        quality_notes: body.notes ?? null,
        quality_status: body.status,
        status: 'QUALITY_CHECK',
      })
      .eq('id', id);

    await service.from('quality_checks').insert({
      check_date: new Date().toISOString(),
      checked_by: ctx.userId,
      failed_quantity: body.failedQuantity ?? null,
      notes: body.notes ?? null,
      passed_quantity: body.passedQuantity ?? null,
      reference_id: id,
      reference_type: 'production_batch',
      status: body.status,
    });

    await writeProductionAuditLog('PRODUCTION_BATCH_QUALITY_CHECK_RECORDED', id, ctx.userId, {
      qualityStatus: body.status,
    }, 'production_batch');

    return NextResponse.json({ saved: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
