import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingColumnError, isMissingTableError } from '@/lib/postgrest-compat';
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
    let machineResult = await service
      .schema('icecream_erp')
      .from('machines')
      .select('*')
      .is('deleted_at', null)
      .eq('id', id)
      .maybeSingle();

    if (machineResult.error && isMissingColumnError(machineResult.error, 'machines', 'deleted_at')) {
      machineResult = await service
        .schema('icecream_erp')
        .from('machines')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    }

    if (machineResult.error && isMissingTableError(machineResult.error, 'machines')) {
      return notFound('Machine not found');
    }

    const machine = machineResult.data;
    if (!machine) return notFound('Machine not found');

    const [schedulesResult, breakdownsResult] = await Promise.all([
      service
        .schema('icecream_erp')
        .from('maintenance_schedules')
        .select('id, machine_id, maintenance_type, status, scheduled_date, completed_date, notes, cost, performed_by')
        .eq('machine_id', id)
        .order('scheduled_date', { ascending: false })
        .limit(10),
      service
        .schema('icecream_erp')
        .from('machine_breakdowns')
        .select('id, machine_id, breakdown_date, description, severity, status, resolved_at, downtime_hours, repair_cost')
        .eq('machine_id', id)
        .order('breakdown_date', { ascending: false })
        .limit(10),
    ]);

    const schedules = isMissingTableError(schedulesResult.error, 'maintenance_schedules')
      ? []
      : (schedulesResult.data ?? []);
    const breakdowns = isMissingTableError(breakdownsResult.error, 'machine_breakdowns')
      ? []
      : (breakdownsResult.data ?? []);

    if (schedulesResult.error && !isMissingTableError(schedulesResult.error, 'maintenance_schedules')) {
      throw schedulesResult.error;
    }
    if (breakdownsResult.error && !isMissingTableError(breakdownsResult.error, 'machine_breakdowns')) {
      throw breakdownsResult.error;
    }

    return NextResponse.json({
      ...machine,
      maintenance_schedules: schedules,
      machine_breakdowns: breakdowns,
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
      name?: string;
      location?: string;
      machineType?: string;
      status?: string;
      isActive?: boolean;
      purchaseDate?: string;
      warrantyExpiry?: string;
    };

    let existingResult = await service
      .schema('icecream_erp')
      .from('machines')
      .select('id')
      .is('deleted_at', null)
      .eq('id', id)
      .maybeSingle();
    if (existingResult.error && isMissingColumnError(existingResult.error, 'machines', 'deleted_at')) {
      existingResult = await service
        .schema('icecream_erp')
        .from('machines')
        .select('id')
        .eq('id', id)
        .maybeSingle();
    }
    if (existingResult.error || !existingResult.data) return notFound('Machine not found');

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.machineType !== undefined) updateData.description = body.machineType;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.isActive === false && body.status === undefined) updateData.status = 'INACTIVE';
    if (body.purchaseDate !== undefined) updateData.purchase_date = new Date(body.purchaseDate).toISOString();

    const { data: updated, error } = await service
      .schema('icecream_erp')
      .from('machines')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error && isMissingTableError(error, 'machines')) {
      return notFound('Machine not found');
    }
    if (error) throw error;
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
