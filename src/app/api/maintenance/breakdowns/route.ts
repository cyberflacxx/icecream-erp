import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
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
  const severity = searchParams.get('severity') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  try {
    const buildBaseQuery = () => {
      let query = service
        .schema('icecream_erp')
        .from('machine_breakdowns')
        .select('id, machine_id, breakdown_date, description, severity, status, resolved_at, downtime_hours, repair_cost', { count: 'exact' });
      if (machineId) query = query.eq('machine_id', machineId);
      if (severity) query = query.eq('severity', severity);
      if (status) query = query.eq('status', status);
      return query;
    };

    let query = service
      .schema('icecream_erp')
      .from('machine_breakdowns')
      .select('id, machine_id, breakdown_date, description, severity, status, resolved_at, downtime_hours, repair_cost, machines(id, name, asset_number)', { count: 'exact' })
      .is('deleted_at', null)
      .order('breakdown_date', { ascending: false });
    if (machineId) query = query.eq('machine_id', machineId);
    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);

    const from = (page - 1) * limit;
    const primary = await query.range(from, from + limit - 1);
    let data = (primary.data ?? null) as Record<string, unknown>[] | null;
    let count = primary.count ?? 0;
    let error = primary.error;
    if (error && isMissingTableError(error, 'machine_breakdowns')) {
      return NextResponse.json({ data: [], total: 0, page, limit, totalPages: 0 });
    }

    if (
      error &&
      (
        isMissingColumnError(error, 'machine_breakdowns', 'deleted_at') ||
        isMissingRelationshipError(error, 'machine_breakdowns', 'machines') ||
        isMissingColumnError(error, 'machines', 'asset_number')
      )
    ) {
      const fallback = await buildBaseQuery()
        .order('breakdown_date', { ascending: false })
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
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
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
      breakdownDate: string;
      description: string;
      severity: string;
    };

    if (!body.machineId || !body.breakdownDate || !body.description || !body.severity) {
      return badRequest('machineId, breakdownDate, description, severity are required');
    }

    const { data: machine } = await service
      .schema('icecream_erp')
      .from('machines')
      .select('id')
      .eq('id', body.machineId)
      .maybeSingle();
    if (!machine) return badRequest('Machine not found');

    const { data: breakdown, error } = await service
      .schema('icecream_erp')
      .from('machine_breakdowns')
      .insert({
        machine_id: body.machineId,
        breakdown_date: new Date(body.breakdownDate).toISOString(),
        description: body.description,
        severity: body.severity,
        status: 'OPEN',
        reported_by: ctx.userId,
      })
      .select()
      .single();

    if (error && isMissingTableError(error, 'machine_breakdowns')) {
      return NextResponse.json(
        { error: 'Breakdown tracking is not available in this environment.' },
        { status: 503 },
      );
    }
    if (error) throw error;
    return NextResponse.json(breakdown, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
