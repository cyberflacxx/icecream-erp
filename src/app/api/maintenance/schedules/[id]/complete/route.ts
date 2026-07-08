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
      completedDate: string;
      performedBy?: string;
      cost?: number;
      notes?: string;
    };

    if (!body.completedDate) return badRequest('completedDate is required');

    let existingResult = await service
      .schema('icecream_erp')
      .from('maintenance_schedules')
      .select('id')
      .is('deleted_at', null)
      .eq('id', id)
      .maybeSingle();
    if (existingResult.error && isMissingColumnError(existingResult.error, 'maintenance_schedules', 'deleted_at')) {
      existingResult = await service
        .schema('icecream_erp')
        .from('maintenance_schedules')
        .select('id')
        .eq('id', id)
        .maybeSingle();
    }
    if (existingResult.error && isMissingTableError(existingResult.error, 'maintenance_schedules')) {
      return notFound('Maintenance schedule not found');
    }
    if (existingResult.error || !existingResult.data) return notFound('Maintenance schedule not found');

    const { data: updated, error } = await service
      .schema('icecream_erp')
      .from('maintenance_schedules')
      .update({
        status: 'COMPLETED',
        completed_date: new Date(body.completedDate).toISOString(),
        performed_by: body.performedBy ?? ctx.userId,
        cost: body.cost ?? null,
        notes: body.notes ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error && isMissingTableError(error, 'maintenance_schedules')) {
      return notFound('Maintenance schedule not found');
    }
    if (error) throw error;
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
