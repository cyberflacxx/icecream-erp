import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'payroll.read')) return forbidden();

  try {
    const service = hrService();
    const { data, error } = await service
      .from('hr_payroll_periods')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('start_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load payroll periods.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'payroll.create')) return forbidden();

  try {
    const body = await request.json() as {
      end_date?: string;
      locked_status?: boolean;
      period_name?: string;
      start_date?: string;
      status?: string;
    };
    if (!body.period_name || !body.start_date || !body.end_date) {
      return badRequest('period_name, start_date, and end_date are required.');
    }

    const service = hrService();
    const { data: overlaps, error: overlapError } = await service
      .from('hr_payroll_periods')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .neq('status', 'VOIDED')
      .lte('start_date', body.end_date)
      .gte('end_date', body.start_date);
    if (overlapError) throw overlapError;
    if ((overlaps ?? []).length > 0) return badRequest('Payroll period dates must not overlap an active payroll period.');

    const { data, error } = await service
      .from('hr_payroll_periods')
      .insert({
        created_by: ctx.userId,
        end_date: body.end_date,
        is_locked: body.locked_status ?? false,
        organization_id: ctx.organizationId,
        period_name: body.period_name,
        start_date: body.start_date,
        status: body.status ?? 'DRAFT',
        updated_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;
    await writeHrAuditLog('HR_PAYROLL_PERIOD_CREATED', String(data.id), ctx.userId, data as Record<string, unknown>, 'payroll_period');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to create payroll period.');
  }
}
