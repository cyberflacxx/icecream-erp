import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      status: 'PASSED' | 'FAILED' | 'PENDING';
      notes?: string;
      rejectionReason?: string;
      passedQuantity?: number;
      failedQuantity?: number;
    };

    if (!body.status) return badRequest('status is required');
    if (body.status === 'FAILED' && !body.rejectionReason) {
      return badRequest('rejectionReason is required when quality check fails');
    }

    const { data: batch, error } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .select('id, batch_number, status, quality_notes, warehouses(branch_id)')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !batch) return notFound('Production batch not found');

    if (ctx.isBranchScoped && ctx.branchId) {
      const warehouse = batch.warehouses as { branch_id: string };
      if (warehouse?.branch_id !== ctx.branchId) return forbidden();
    }

    if (batch.status !== 'QUALITY_CHECK') {
      return badRequest(`Batch must be in QUALITY_CHECK status to record quality result (current: ${batch.status})`);
    }

    const { data: updated, error: updateError } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .update({
        quality_status: body.status,
        quality_notes: body.notes ?? batch.quality_notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create quality check record
    await service.schema('icecream_erp').from('quality_checks').insert({
      reference_id: id,
      reference_type: 'production_batch',
      status: body.status,
      check_date: new Date().toISOString(),
      checked_by: ctx.userId,
      notes: body.notes ?? null,
      passed_quantity: body.passedQuantity ?? null,
      failed_quantity: body.failedQuantity ?? null,
    });

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'PRODUCTION_BATCH_QUALITY_RESULT',
      entity_id: id,
      entity_type: 'production_batch',
      new_values: { qualityStatus: body.status, rejectionReason: body.rejectionReason ?? null },
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
