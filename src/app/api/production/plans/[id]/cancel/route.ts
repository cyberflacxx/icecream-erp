import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const service = productionService();
    const { data, error } = await service
      .from('production_plans')
      .update({ status: 'CANCELLED' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await writeProductionAuditLog('PRODUCTION_PLAN_CANCELLED', id, ctx.userId, { status: 'CANCELLED' }, 'production_plan');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
