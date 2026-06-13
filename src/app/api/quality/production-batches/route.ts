import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateFailedQuantity, validateInspectionQuantities } from '@/lib/quality';
import { generateQualityReferenceNumber, qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read', 'production.read')) return forbidden();
  try {
    const { data, error } = await qualityService().from('quality_inspections').select('*').eq('organization_id', ctx.organizationId).eq('inspection_type', 'PRODUCTION_BATCH').order('inspection_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write', 'production.write')) return forbidden();
  try {
    const body = await request.json() as { actualOutput: number; itemId?: string; notes?: string; passedQuantity?: number; productionBatchId: string; rejectedQuantity?: number };
    if (!body.productionBatchId) return badRequest('productionBatchId is required');
    const failed = body.rejectedQuantity ?? calculateFailedQuantity(body.actualOutput, body.passedQuantity ?? 0);
    const validation = validateInspectionQuantities(body.actualOutput, body.passedQuantity ?? 0, failed);
    if (validation) return badRequest(validation);
    const inspectionNumber = await generateQualityReferenceNumber('quality_inspections', 'PBQ');
    const { data, error } = await qualityService().from('quality_inspections').insert({
      organization_id: ctx.organizationId,
      inspection_number: inspectionNumber,
      inspection_type: 'PRODUCTION_BATCH',
      reference_document: 'production_batch',
      reference_id: body.productionBatchId,
      production_batch_id: body.productionBatchId,
      item_id: body.itemId ?? null,
      inspection_date: new Date().toISOString().slice(0, 10),
      quantity_inspected: body.actualOutput,
      quantity_passed: body.passedQuantity ?? 0,
      quantity_failed: failed,
      qc_status: failed > 0 ? 'PARTIALLY_PASSED' : 'PASSED',
      remarks: body.notes ?? null,
      inspected_by: ctx.userId,
      inspected_at: new Date().toISOString(),
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }).select().single();
    if (error) throw error;
    await writeQualityAuditLog('PRODUCTION_BATCH_QC_CREATED', data.id, ctx.userId, { inspectionNumber }, 'quality_inspection');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
