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
  const maintenanceType = searchParams.get('maintenanceType') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  try {
    let query = service
      .schema('icecream_erp')
      .from('maintenance_schedules')
      .select('*, machines(id, name, code)', { count: 'exact' })
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: false });

    if (machineId) query = query.eq('machine_id', machineId);
    if (maintenanceType) query = query.eq('maintenance_type', maintenanceType);
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
      .is('deleted_at', null)
      .eq('id', body.machineId)
      .single();
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

    if (error) throw error;
    return NextResponse.json(schedule, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
