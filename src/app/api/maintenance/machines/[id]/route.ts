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
    const { data: machine, error } = await service
      .schema('icecream_erp')
      .from('machines')
      .select(`
        *,
        maintenance_schedules!inner(id, maintenance_type, status, scheduled_date, completed_date, notes),
        machine_breakdowns!inner(id, breakdown_date, description, severity, status, resolved_at)
      `)
      .is('deleted_at', null)
      .eq('id', id)
      .is('maintenance_schedules.deleted_at', null)
      .is('machine_breakdowns.deleted_at', null)
      .order('maintenance_schedules.scheduled_date', { ascending: false })
      .limit(10, { foreignTable: 'maintenance_schedules' })
      .order('machine_breakdowns.breakdown_date', { ascending: false })
      .limit(10, { foreignTable: 'machine_breakdowns' })
      .single();

    if (error) {
      // Try without relations if join fails
      const { data: m, error: e2 } = await service
        .schema('icecream_erp')
        .from('machines')
        .select('*')
        .is('deleted_at', null)
        .eq('id', id)
        .single();
      if (e2 || !m) return notFound('Machine not found');
      return NextResponse.json(m);
    }

    if (!machine) return notFound('Machine not found');
    return NextResponse.json(machine);
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

    const { data: existing, error: fetchErr } = await service
      .schema('icecream_erp')
      .from('machines')
      .select('id')
      .is('deleted_at', null)
      .eq('id', id)
      .single();
    if (fetchErr || !existing) return notFound('Machine not found');

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.machineType !== undefined) updateData.machine_type = body.machineType;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.purchaseDate !== undefined) updateData.purchase_date = new Date(body.purchaseDate).toISOString();
    if (body.warrantyExpiry !== undefined) updateData.warranty_expiry = new Date(body.warrantyExpiry).toISOString();

    const { data: updated, error } = await service
      .schema('icecream_erp')
      .from('machines')
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
