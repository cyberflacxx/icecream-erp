import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      currentValue?: number;
      isActive?: boolean;
      location?: string;
      name?: string;
      residualValue?: number;
    };
    if (body.currentValue !== undefined && Number(body.currentValue) < 0) return badRequest('currentValue must not be negative');

    const { data, error } = await financeService()
      .from('fixed_assets')
      .update({
        current_value: body.currentValue,
        is_active: body.isActive,
        location: body.location,
        name: body.name,
        residual_value: body.residualValue,
      })
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();
    if (error || !data) return notFound('Fixed asset not found');

    await writeFinanceAuditLog('FIXED_ASSET_UPDATED', id, ctx.userId, body as Record<string, unknown>, 'fixed_asset');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
