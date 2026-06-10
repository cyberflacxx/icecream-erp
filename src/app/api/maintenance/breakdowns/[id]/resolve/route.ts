import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'maintenance.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      resolvedAt: string;
      downtimeHours?: number;
      repairCost?: number;
    };

    if (!body.resolvedAt) return badRequest('resolvedAt is required');

    const { data: existing, error: fetchErr } = await service
      .schema('icecream_erp')
      .from('machine_breakdowns')
      .select('id')
      .is('deleted_at', null)
      .eq('id', id)
      .single();
    if (fetchErr || !existing) return notFound('Breakdown not found');

    const { data: updated, error } = await service
      .schema('icecream_erp')
      .from('machine_breakdowns')
      .update({
        status: 'RESOLVED',
        resolved_at: new Date(body.resolvedAt).toISOString(),
        downtime_hours: body.downtimeHours ?? null,
        repair_cost: body.repairCost ?? null,
      })
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
