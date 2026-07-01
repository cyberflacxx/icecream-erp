import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateFailedQuantity, validateInspectionQuantities } from '@/lib/quality';
import {
  isMissingQualityTable,
  listQualityChecksAsInspections,
  qualityService,
  writeQualityAuditLog,
} from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read', 'production.read')) return forbidden();
  try {
    const service = qualityService();
    const primary = await service
      .from('quality_inspections')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('inspection_type', 'PRODUCTION_BATCH')
      .order('inspection_date', { ascending: false });

    if (!primary.error) {
      return NextResponse.json(primary.data ?? []);
    }

    if (!isMissingQualityTable(primary.error, 'quality_inspections')) {
      throw primary.error;
    }

    return NextResponse.json(await listQualityChecksAsInspections({
      organizationId: ctx.organizationId,
      referenceType: 'production_batch',
    }));
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
    const service = qualityService();
    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select('id, batch_number, quality_status, status')
      .eq('organization_id', ctx.organizationId)
      .eq('id', body.productionBatchId)
      .is('deleted_at', null)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return badRequest('Production batch not found.');

    const nextStatus = failed > 0 ? 'FAILED' : 'PASSED';
    const { data, error } = await service
      .from('quality_checks')
      .insert({
        organization_id: ctx.organizationId,
        reference_type: 'production_batch',
        reference_id: body.productionBatchId,
        check_date: new Date().toISOString().slice(0, 10),
        status: nextStatus,
        notes: body.notes ?? null,
        passed_quantity: body.passedQuantity ?? 0,
        failed_quantity: failed,
        checked_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;

    await service
      .from('production_batches')
      .update({
        quality_notes: body.notes ?? null,
        quality_status: nextStatus,
        status: nextStatus === 'PASSED' ? 'COMPLETED' : batch.status,
      })
      .eq('id', body.productionBatchId);

    await writeQualityAuditLog('PRODUCTION_BATCH_QC_CREATED', data.id, ctx.userId, {
      batchNumber: batch.batch_number,
      status: nextStatus,
    }, 'quality_check');

    return NextResponse.json({
      id: data.id,
      inspection_number: `QC-${String(data.id).slice(0, 8).toUpperCase()}`,
      inspection_type: 'PRODUCTION_BATCH',
      production_batch_id: body.productionBatchId,
      qc_status: nextStatus,
      quantity_failed: failed,
      quantity_inspected: body.actualOutput,
      quantity_passed: body.passedQuantity ?? 0,
      remarks: body.notes ?? null,
    }, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
