import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    // Branch scoped access check
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== id) return forbidden();

    const { data: existing, error: fetchErr } = await service
      .schema('icecream_erp')
      .from('branches')
      .select('id')
      .is('deleted_at', null)
      .eq('id', id)
      .single();
    if (fetchErr || !existing) return notFound('Branch not found');

    const body = await request.json() as {
      name?: string;
      phone?: string;
      address?: string;
      managerId?: string;
      status?: string;
    };

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.managerId !== undefined) updateData.manager_id = body.managerId;
    if (body.status !== undefined) updateData.status = body.status;

    const { data: updated, error } = await service
      .schema('icecream_erp')
      .from('branches')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
