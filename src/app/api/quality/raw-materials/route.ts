import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateFailedQuantity, validateInspectionQuantities } from '@/lib/quality';
import { generateQualityReferenceNumber, qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read', 'procurement.read')) return forbidden();
  try {
    const { data, error } = await qualityService().from('quality_inspections').select('*').eq('organization_id', ctx.organizationId).eq('inspection_type', 'RAW_MATERIAL_RECEIPT').order('inspection_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const body = await request.json() as { goodsReceivedNoteId?: string; itemId: string; quantityAccepted?: number; quantityInspected: number; quantityRejected?: number; remarks?: string; supplierId?: string };
    if (!body.goodsReceivedNoteId || !body.itemId) return badRequest('goodsReceivedNoteId and itemId are required');
    const failed = body.quantityRejected ?? calculateFailedQuantity(body.quantityInspected, body.quantityAccepted ?? 0);
    const validation = validateInspectionQuantities(body.quantityInspected, body.quantityAccepted ?? 0, failed);
    if (validation) return badRequest(validation);
    const inspectionNumber = await generateQualityReferenceNumber('quality_inspections', 'RMQ');
    const { data, error } = await qualityService().from('quality_inspections').insert({
      organization_id: ctx.organizationId,
      inspection_number: inspectionNumber,
      inspection_type: 'RAW_MATERIAL_RECEIPT',
      reference_document: 'goods_received_note',
      reference_id: body.goodsReceivedNoteId,
      supplier_id: body.supplierId ?? null,
      item_id: body.itemId,
      inspection_date: new Date().toISOString().slice(0, 10),
      quantity_inspected: body.quantityInspected,
      quantity_passed: body.quantityAccepted ?? 0,
      quantity_failed: failed,
      qc_status: failed > 0 ? 'FAILED' : 'PASSED',
      remarks: body.remarks ?? null,
      inspected_by: ctx.userId,
      inspected_at: new Date().toISOString(),
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }).select().single();
    if (error) throw error;
    await writeQualityAuditLog('RAW_MATERIAL_QC_CREATED', data.id, ctx.userId, { inspectionNumber }, 'quality_inspection');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
