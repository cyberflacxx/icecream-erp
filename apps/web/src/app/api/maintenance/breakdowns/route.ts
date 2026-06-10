import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
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
    let query = service
      .schema('icecream_erp')
      .from('machine_breakdowns')
      .select('*, machines(id, name, code)', { count: 'exact' })
      .is('deleted_at', null)
      .order('breakdown_date', { ascending: false });

    if (machineId) query = query.eq('machine_id', machineId);
    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);

    const from = (page - 1) * limit;
    const { data, count, error } = await query.range(from, from + limit - 1);
    if (error) throw error;

    return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) });
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
      .is('deleted_at', null)
      .eq('id', body.machineId)
      .single();
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

    if (error) throw error;
    return NextResponse.json(breakdown, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
