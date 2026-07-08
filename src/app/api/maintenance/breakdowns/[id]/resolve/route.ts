import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingColumnError, isMissingTableError } from '@/lib/postgrest-compat';
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

    let existingResult = await service
      .schema('icecream_erp')
      .from('machine_breakdowns')
      .select('id')
      .is('deleted_at', null)
      .eq('id', id)
      .maybeSingle();
    if (existingResult.error && isMissingColumnError(existingResult.error, 'machine_breakdowns', 'deleted_at')) {
      existingResult = await service
        .schema('icecream_erp')
        .from('machine_breakdowns')
        .select('id')
        .eq('id', id)
        .maybeSingle();
    }
    if (existingResult.error && isMissingTableError(existingResult.error, 'machine_breakdowns')) {
      return notFound('Breakdown not found');
    }
    if (existingResult.error || !existingResult.data) return notFound('Breakdown not found');

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

    if (error && isMissingTableError(error, 'machine_breakdowns')) {
      return notFound('Breakdown not found');
    }
    if (error) throw error;
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
