import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { ensureNonNegative } from '@/lib/inventory';
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
      outputs: Array<{
        actualQuantity: number;
        id: string;
        notes?: string;
        wastageQuantity?: number;
      }>;
    };

    if (!Array.isArray(body.outputs) || body.outputs.length === 0) {
      return badRequest('outputs are required.');
    }

    const service = productionService();
    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select('id, status, expected_output')
      .eq('id', id)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return notFound('Production batch not found.');
    if (['COMPLETED', 'CANCELLED'].includes(String(batch.status))) {
      return badRequest('Completed or cancelled batches cannot be edited.');
    }

    let totalActual = 0;
    let totalWastage = 0;
    for (const output of body.outputs) {
      const actual = ensureNonNegative(output.actualQuantity, 'actualQuantity');
      const wastage = ensureNonNegative(output.wastageQuantity ?? 0, 'wastageQuantity');
      totalActual += actual;
      totalWastage += wastage;
      await service
        .from('production_batch_outputs')
        .update({
          actual_quantity: actual,
          notes: output.notes ?? null,
          wastage_quantity: wastage,
        })
        .eq('id', output.id)
        .eq('batch_id', id);
    }

    const expectedOutput = Number(batch.expected_output ?? 0);
    await service
      .from('production_batches')
      .update({
        actual_output: totalActual,
        efficiency_percentage: expectedOutput > 0 ? (totalActual / expectedOutput) * 100 : 0,
        wastage_quantity: totalWastage,
        wastage_percentage: expectedOutput > 0 ? (totalWastage / expectedOutput) * 100 : 0,
      })
      .eq('id', id);

    await writeProductionAuditLog('PRODUCTION_BATCH_OUTPUT_RECORDED', id, ctx.userId, {
      totalActual,
      totalWastage,
    }, 'production_batch');

    return NextResponse.json({ updated: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
