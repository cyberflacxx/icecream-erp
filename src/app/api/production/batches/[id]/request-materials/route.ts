import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

const VALID_FROM = 'PLANNED';
const NEXT_STATUS = 'MATERIALS_REQUESTED';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: batch, error } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .select('id, batch_number, status, warehouse_id, warehouses(branch_id)')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !batch) return notFound('Production batch not found');

    if (ctx.isBranchScoped && ctx.branchId) {
      const warehouse = batch.warehouses as { branch_id: string };
      if (warehouse?.branch_id !== ctx.branchId) return forbidden();
    }

    if (batch.status !== VALID_FROM) {
      return badRequest(`Cannot transition from ${batch.status} to ${NEXT_STATUS}. Allowed from: ${VALID_FROM}`);
    }

    const { data: updated, error: updateError } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .update({ status: NEXT_STATUS })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'PRODUCTION_MATERIALS_REQUESTED',
      entity_id: id,
      entity_type: 'production_batch',
      new_values: { status: NEXT_STATUS },
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
