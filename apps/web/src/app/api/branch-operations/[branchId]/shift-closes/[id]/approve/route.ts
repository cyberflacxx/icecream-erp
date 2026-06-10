import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ branchId: string; id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  // Only admins/managers can approve
  if (!['super_admin', 'branch_manager', 'manager'].includes(ctx.role)) {
    return forbidden();
  }

  const { branchId, id } = await params;
  const service = createServiceRoleClient();

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== branchId) return forbidden();

    const { data: shiftClose, error: fetchErr } = await service
      .schema('icecream_erp')
      .from('branch_shift_closes')
      .select('id, status')
      .is('deleted_at', null)
      .eq('branch_id', branchId)
      .eq('id', id)
      .single();

    if (fetchErr || !shiftClose) return notFound('Shift close not found');
    if (shiftClose.status !== 'SUBMITTED') return badRequest('Only SUBMITTED shift closes can be approved');

    const { data: updated, error } = await service
      .schema('icecream_erp')
      .from('branch_shift_closes')
      .update({
        status: 'APPROVED',
        approved_at: new Date().toISOString(),
        approved_by: ctx.userId,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'BRANCH_SHIFT_APPROVED',
      entity_id: id,
      entity_type: 'branch_shift_close',
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
