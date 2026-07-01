import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateFailedQuantity, validateInspectionQuantities } from '@/lib/quality';
import {
  generateQualityReferenceNumber,
  isMissingQualityTable,
  listQualityChecksAsInspections,
  qualityService,
  writeQualityAuditLog,
} from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read')) return forbidden();

  try {
    const primary = await qualityService()
      .from('quality_inspections')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('inspection_date', { ascending: false });
    if (!primary.error) return NextResponse.json(primary.data ?? []);
    if (!isMissingQualityTable(primary.error, 'quality_inspections')) throw primary.error;
    return NextResponse.json(await listQualityChecksAsInspections({ organizationId: ctx.organizationId }));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();

  try {
    const body = await request.json() as {
      batchNumber?: string;
      branchId?: string;
      customerId?: string;
      inspectionDate?: string;
      inspectionType: string;
      itemId?: string;
      productionBatchId?: string;
      quantityFailed?: number;
      quantityInspected: number;
      quantityPassed?: number;
      referenceDocument?: string;
      referenceId?: string;
      remarks?: string;
      supplierId?: string;
    };
    if (!body.inspectionType) return badRequest('inspectionType is required');
    const failed = body.quantityFailed ?? calculateFailedQuantity(body.quantityInspected, body.quantityPassed ?? 0);
    const validation = validateInspectionQuantities(body.quantityInspected, body.quantityPassed ?? 0, failed);
    if (validation) return badRequest(validation);

    const inspectionNumber = await generateQualityReferenceNumber('quality_inspections', 'QCI');
    const { data, error } = await qualityService()
      .from('quality_inspections')
      .insert({
        organization_id: ctx.organizationId,
        inspection_number: inspectionNumber,
        inspection_type: body.inspectionType,
        reference_document: body.referenceDocument ?? null,
        reference_id: body.referenceId ?? null,
        supplier_id: body.supplierId ?? null,
        customer_id: body.customerId ?? null,
        branch_id: body.branchId ?? null,
        production_batch_id: body.productionBatchId ?? null,
        item_id: body.itemId ?? null,
        batch_number: body.batchNumber ?? null,
        inspection_date: body.inspectionDate ?? new Date().toISOString().slice(0, 10),
        quantity_inspected: body.quantityInspected,
        quantity_passed: body.quantityPassed ?? 0,
        quantity_failed: failed,
        qc_status: 'PENDING',
        remarks: body.remarks ?? null,
        created_by: ctx.userId,
        updated_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;
    await writeQualityAuditLog('QUALITY_INSPECTION_CREATED', data.id, ctx.userId, { inspectionNumber }, 'quality_inspection');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
