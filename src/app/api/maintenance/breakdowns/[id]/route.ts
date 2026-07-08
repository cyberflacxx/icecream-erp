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
      .from('machine_breakdowns')
      .select('id, machine_id, breakdown_date, description, severity, status, resolved_at, downtime_hours, repair_cost, machines(id, name, asset_number)')
      .is('deleted_at', null)
      .eq('id', id)
      .maybeSingle();

    if (
      result.error &&
      (
        isMissingColumnError(result.error, 'machine_breakdowns', 'deleted_at') ||
        isMissingRelationshipError(result.error, 'machine_breakdowns', 'machines') ||
        isMissingColumnError(result.error, 'machines', 'asset_number')
      )
    ) {
      result = await service
        .schema('icecream_erp')
        .from('machine_breakdowns')
        .select('id, machine_id, breakdown_date, description, severity, status, resolved_at, downtime_hours, repair_cost')
        .eq('id', id)
        .maybeSingle();
    }

    if (result.error && isMissingTableError(result.error, 'machine_breakdowns')) {
      return notFound('Breakdown not found');
    }
    if (result.error || !result.data) return notFound('Breakdown not found');

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
      breakdownDate?: string;
      description?: string;
      severity?: string;
      status?: string;
    };

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

    const updateData: Record<string, unknown> = {};
    if (body.machineId !== undefined) updateData.machine_id = body.machineId;
    if (body.breakdownDate !== undefined) updateData.breakdown_date = new Date(body.breakdownDate).toISOString();
    if (body.description !== undefined) updateData.description = body.description;
    if (body.severity !== undefined) updateData.severity = body.severity;
    if (body.status !== undefined) updateData.status = body.status;

    const { data: updated, error } = await service
      .schema('icecream_erp')
      .from('machine_breakdowns')
      .update(updateData)
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
