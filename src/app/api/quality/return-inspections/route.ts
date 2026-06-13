import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { validateReturnClassification } from '@/lib/quality';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read')) return forbidden();
  try {
    const { data, error } = await qualityService().from('return_inspections').select('*').eq('organization_id', ctx.organizationId).order('created_at', { ascending: false });
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
    const body = await request.json() as {
      finalClassification: string;
      goodsReturnVoucherId: string;
      qcNote?: string;
      quantityDamaged?: number;
      quantityExpired?: number;
      quantityReturned: number;
      quantityReusable?: number;
      quantityRework?: number;
      quantityWaste?: number;
      voucherItemId: string;
    };
    if (!body.goodsReturnVoucherId || !body.voucherItemId || !body.finalClassification) return badRequest('goodsReturnVoucherId, voucherItemId, and finalClassification are required');
    const validation = validateReturnClassification({
      quantityDamaged: body.quantityDamaged ?? 0,
      quantityExpired: body.quantityExpired ?? 0,
      quantityReturned: body.quantityReturned,
      quantityReusable: body.quantityReusable ?? 0,
      quantityRework: body.quantityRework ?? 0,
      quantityWaste: body.quantityWaste ?? 0,
    });
    if (validation) return badRequest(validation);
    if (['DAMAGED', 'EXPIRED', 'WASTE', 'REWORK'].includes(body.finalClassification) && !body.qcNote) {
      return badRequest('QC note is required for damaged, expired, waste, or rework classification');
    }
    const { data, error } = await qualityService().from('return_inspections').insert({
      organization_id: ctx.organizationId,
      goods_return_voucher_id: body.goodsReturnVoucherId,
      voucher_item_id: body.voucherItemId,
      quantity_returned: body.quantityReturned,
      quantity_reusable: body.quantityReusable ?? 0,
      quantity_damaged: body.quantityDamaged ?? 0,
      quantity_expired: body.quantityExpired ?? 0,
      quantity_rework: body.quantityRework ?? 0,
      quantity_waste: body.quantityWaste ?? 0,
      final_classification: body.finalClassification,
      qc_note: body.qcNote ?? null,
      inspected_by: ctx.userId,
      inspected_at: new Date().toISOString(),
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }).select().single();
    if (error) throw error;
    await writeQualityAuditLog('RETURN_INSPECTION_CREATED', data.id, ctx.userId, { finalClassification: body.finalClassification }, 'return_inspection');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
