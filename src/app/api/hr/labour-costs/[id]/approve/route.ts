import { NextRequest } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write', 'hr.write')) return forbidden();

  try {
    const { id } = await params;
    const service = hrService();
    const { data: existing, error: fetchError } = await service.from('hr_labour_cost_allocations').select('id').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Labour cost allocation not found.');

    const update = {
      approval_status: 'APPROVED',
      approved_at: new Date().toISOString(),
      approved_by: ctx.userId,
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    };
    const { data, error } = await service.from('hr_labour_cost_allocations').update(update).eq('id', id).select().single();
    if (error) throw error;
    await writeHrAuditLog('HR_LABOUR_COST_APPROVED', id, ctx.userId, update, 'labour_cost_allocation');
    return Response.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to approve labour cost allocation.');
  }
}
