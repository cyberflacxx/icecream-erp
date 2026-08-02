import { NextRequest, NextResponse } from 'next/server';

import { apiServerError, badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import {
  isMissingColumnError,
  isMissingRelationshipError,
  isMissingTableError,
} from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'maintenance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'));
  const machineId = searchParams.get('machineId') ?? undefined;
  const maintenanceType = searchParams.get('maintenanceType') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  try {
    const buildBaseQuery = () => {
      let query = service
        .schema('icecream_erp')
        .from('maintenance_schedules')
        .select('id, machine_id, maintenance_type, scheduled_date, completed_date, status, notes, cost, performed_by', { count: 'exact' });
      if (machineId) query = query.eq('machine_id', machineId);
      if (maintenanceType) query = query.eq('maintenance_type', maintenanceType);
      if (status) query = query.eq('status', status);
      return query;
    };

    let query = service
      .schema('icecream_erp')
      .from('maintenance_schedules')
      .select('id, machine_id, maintenance_type, scheduled_date, completed_date, status, notes, cost, performed_by, machines(id, name, asset_number)', { count: 'exact' })
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: false });
    if (machineId) query = query.eq('machine_id', machineId);
    if (maintenanceType) query = query.eq('maintenance_type', maintenanceType);
    if (status) query = query.eq('status', status);

    const from = (page - 1) * limit;
    const primary = await query.range(from, from + limit - 1);
    let data = (primary.data ?? null) as Record<string, unknown>[] | null;
    let count = primary.count ?? 0;
    let error = primary.error;
    if (error && isMissingTableError(error, 'maintenance_schedules')) {
      return NextResponse.json({ data: [], total: 0, page, limit, totalPages: 0 });
    }

    if (
      error &&
      (
        isMissingColumnError(error, 'maintenance_schedules', 'deleted_at') ||
        isMissingRelationshipError(error, 'maintenance_schedules', 'machines') ||
        isMissingColumnError(error, 'machines', 'asset_number')
      )
    ) {
      const fallback = await buildBaseQuery()
        .order('scheduled_date', { ascending: false })
        .range(from, from + limit - 1);
      data = (fallback.data ?? null) as Record<string, unknown>[] | null;
      count = fallback.count ?? 0;
      error = fallback.error;
    }

    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((row: Record<string, unknown>) => {
        const machineValue = (row as Record<string, unknown>).machines;
        const machine = Array.isArray(machineValue) ? machineValue[0] : machineValue;
        return {
          ...row,
          machines: machine
            ? {
                ...(machine as Record<string, unknown>),
                code: String((machine as Record<string, unknown>).asset_number ?? ''),
              }
            : null,
        };
      }),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    return apiServerError({
      ctx,
      error: err,
      message: 'Maintenance schedules could not be loaded.',
      module: 'maintenance.schedules',
      path: request.nextUrl.pathname,
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'maintenance.write')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      machineId: string;
      maintenanceType: string;
      scheduledDate: string;
      notes?: string;
    };

    if (!body.machineId || !body.maintenanceType || !body.scheduledDate) {
      return badRequest('machineId, maintenanceType, scheduledDate are required');
    }

    const { data: machine } = await service
      .schema('icecream_erp')
      .from('machines')
      .select('id')
      .eq('id', body.machineId)
      .maybeSingle();
    if (!machine) return badRequest('Machine not found');

    const { data: schedule, error } = await service
      .schema('icecream_erp')
      .from('maintenance_schedules')
      .insert({
        machine_id: body.machineId,
        maintenance_type: body.maintenanceType,
        scheduled_date: new Date(body.scheduledDate).toISOString(),
        status: 'SCHEDULED',
        notes: body.notes ?? null,
      })
      .select()
      .single();

    if (error && isMissingTableError(error, 'maintenance_schedules')) {
      return NextResponse.json(
        { error: 'Maintenance scheduling is not available in this environment.' },
        { status: 503 },
      );
    }
    if (error) throw error;
    return NextResponse.json(schedule, { status: 201 });
  } catch (err) {
    return apiServerError({
      ctx,
      error: err,
      message: 'The maintenance schedule could not be created.',
      module: 'maintenance.schedules',
      path: request.nextUrl.pathname,
      status: 500,
      transactionReference: 'maintenance-schedule-create',
    });
  }
}
