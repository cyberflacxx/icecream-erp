import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.approve')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: existing, error: fetchErr } = await service
      .from('goods_received_notes')
      .select('id, status, warehouse_id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Goods received note not found.');

    const grn = existing as Record<string, unknown>;

    // Branch scope check via warehouse
    if (ctx.isBranchScoped && ctx.branchId) {
      const { data: wh } = await service
        .from('warehouses')
        .select('branch_id')
        .eq('id', grn.warehouse_id as string)
        .single();
      if (!wh || (wh as Record<string, unknown>).branch_id !== ctx.branchId) {
        return forbidden();
      }
    }

    if (grn.status !== 'received') {
      return badRequest('Only received GRNs can be approved.');
    }

    const { data: updated, error: updateErr } = await service
      .from('goods_received_notes')
      .update({ status: 'quality_passed', quality_status: 'passed' })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
