import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'maintenance.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data, error } = await service
      .schema('icecream_erp')
      .from('maintenance_schedules')
      .select('*, machines(id, name, code)')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !data) return notFound('Maintenance schedule not found');
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function PATCH(
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
      machineId?: string;
      maintenanceType?: string;
      scheduledDate?: string;
      notes?: string;
      status?: string;
    };

    const { data: existing, error: fetchErr } = await service
      .schema('icecream_erp')
      .from('maintenance_schedules')
      .select('id')
      .is('deleted_at', null)
      .eq('id', id)
      .single();
    if (fetchErr || !existing) return notFound('Maintenance schedule not found');

    const updateData: Record<string, unknown> = {};
    if (body.machineId !== undefined) updateData.machine_id = body.machineId;
    if (body.maintenanceType !== undefined) updateData.maintenance_type = body.maintenanceType;
    if (body.scheduledDate !== undefined) updateData.scheduled_date = new Date(body.scheduledDate).toISOString();
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    const { data: updated, error } = await service
      .schema('icecream_erp')
      .from('maintenance_schedules')
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
