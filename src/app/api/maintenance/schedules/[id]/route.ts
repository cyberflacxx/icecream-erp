import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import {
  isMissingColumnError,
  isMissingRelationshipError,
  isMissingTableError,
} from '@/lib/postgrest-compat';
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
    let result = await service
      .schema('icecream_erp')
      .from('maintenance_schedules')
      .select('id, machine_id, maintenance_type, scheduled_date, completed_date, status, notes, cost, performed_by, machines(id, name, asset_number)')
      .is('deleted_at', null)
      .eq('id', id)
      .maybeSingle();

    if (
      result.error &&
      (
        isMissingColumnError(result.error, 'maintenance_schedules', 'deleted_at') ||
        isMissingRelationshipError(result.error, 'maintenance_schedules', 'machines') ||
        isMissingColumnError(result.error, 'machines', 'asset_number')
      )
    ) {
      result = await service
        .schema('icecream_erp')
        .from('maintenance_schedules')
        .select('id, machine_id, maintenance_type, scheduled_date, completed_date, status, notes, cost, performed_by')
        .eq('id', id)
        .maybeSingle();
    }

    if (result.error && isMissingTableError(result.error, 'maintenance_schedules')) {
      return notFound('Maintenance schedule not found');
    }
    if (result.error || !result.data) return notFound('Maintenance schedule not found');

    const machineValue = (result.data as Record<string, unknown>).machines;
    const machine = Array.isArray(machineValue) ? machineValue[0] : machineValue;
    return NextResponse.json({
      ...result.data,
      machines: machine
        ? {
            ...(machine as Record<string, unknown>),
            code: String((machine as Record<string, unknown>).asset_number ?? ''),
          }
        : null,
    });
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
