import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { normalizeShiftName } from '@/lib/hr';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  try {
    const service = hrService();
    const { data, error } = await service
      .from('hr_shift_definitions')
      .select('*, department:departments(id, code, name)')
      .eq('organization_id', ctx.organizationId)
      .order('shift_name');
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load shifts.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      active_status?: boolean;
      default_department_id?: string;
      end_time?: string;
      shift_name?: string;
      start_time?: string;
      standard_shift_hours?: number;
    };
    if (!body.shift_name || !body.start_time || !body.end_time) {
      return badRequest('shift_name, start_time, and end_time are required.');
    }

    const service = hrService();
    const { data, error } = await service
      .from('hr_shift_definitions')
      .insert({
        created_by: ctx.userId,
        default_department_id: body.default_department_id ?? null,
        end_time: body.end_time,
        is_active: body.active_status ?? true,
        organization_id: ctx.organizationId,
        shift_name: normalizeShiftName(body.shift_name),
        start_time: body.start_time,
        standard_shift_hours: Number(body.standard_shift_hours ?? 12),
        updated_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;
    await writeHrAuditLog('HR_SHIFT_CREATED', String(data.id), ctx.userId, data as Record<string, unknown>, 'shift_definition');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to create shift definition.');
  }
}
