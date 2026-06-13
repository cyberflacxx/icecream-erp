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
      materials: Array<{
        id: string;
        note?: string;
        quantityActual: number;
        quantityIssued?: number;
      }>;
    };

    if (!Array.isArray(body.materials) || body.materials.length === 0) {
      return badRequest('materials are required.');
    }

    const service = productionService();
    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return notFound('Production batch not found.');
    if (['COMPLETED', 'CANCELLED'].includes(String(batch.status))) {
      return badRequest('Completed or cancelled batches cannot be edited.');
    }

    for (const material of body.materials) {
      const actual = ensureNonNegative(material.quantityActual, 'quantityActual');
      const issued = material.quantityIssued !== undefined
        ? ensureNonNegative(material.quantityIssued, 'quantityIssued')
        : actual;
      await service
        .from('production_batch_materials')
        .update({
          notes: material.note ?? null,
          quantity_actual: actual,
          quantity_issued: issued,
          variance: 0,
        })
        .eq('id', material.id)
        .eq('batch_id', id);
    }

    await writeProductionAuditLog('PRODUCTION_BATCH_MATERIAL_USAGE_RECORDED', id, ctx.userId, {
      materialCount: body.materials.length,
    }, 'production_batch');

    return NextResponse.json({ updated: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
