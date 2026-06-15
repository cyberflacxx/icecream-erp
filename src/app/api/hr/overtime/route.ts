import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';
import { isMissingColumnOrRelation } from '@/app/api/hr/utils';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'reports.read')) return forbidden();

  try {
    const service = hrService();
    const { searchParams } = new URL(request.url);
    let query = service
      .from('hr_overtime_records')
      .select('*, employee:employees(id, employee_number, first_name, last_name, department, branch_id)')
      .eq('organization_id', ctx.organizationId)
      .order('overtime_date', { ascending: false });

    if (ctx.isBranchScoped) query = query.eq('branch_id', ctx.branchId!);
    if (searchParams.get('employeeId')) query = query.eq('employee_id', searchParams.get('employeeId'));
    if (searchParams.get('status')) query = query.eq('status', searchParams.get('status'));

    const { data, error } = await query;
    if (error && isMissingColumnOrRelation(error, 'hr_overtime_records')) {
      return NextResponse.json([]);
    }
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load overtime records.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  try {
    const body = await request.json() as {
      date?: string;
      employee_id?: string;
      hours?: number;
      reason?: string;
      shift?: string;
    };
    if (!body.employee_id || !body.date || !body.reason || Number(body.hours ?? 0) <= 0) {
      return badRequest('employee_id, date, reason, and hours greater than zero are required.');
    }

    const service = hrService();
    const { data, error } = await service
      .from('hr_overtime_records')
      .insert({
        branch_id: ctx.branchId ?? null,
        employee_id: body.employee_id,
        organization_id: ctx.organizationId,
        overtime_date: body.date,
        overtime_hours: Number(body.hours),
        reason: body.reason,
        requested_by: ctx.userId,
        shift_name: body.shift ?? 'DAY',
        status: 'PENDING_APPROVAL',
      })
      .select()
      .single();
    if (error) throw error;
    await writeHrAuditLog('HR_OVERTIME_CREATED', String(data.id), ctx.userId, data as Record<string, unknown>, 'overtime_record');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to create overtime record.');
  }
}
