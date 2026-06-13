import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createLabourCostAllocation, fetchLabourCostRows, hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'finance.read', 'reports.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const rows = await fetchLabourCostRows({
      batchId: searchParams.get('batchId'),
      branchId: ctx.isBranchScoped ? ctx.branchId : searchParams.get('branchId'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      departmentId: searchParams.get('departmentId'),
    });
    return NextResponse.json(rows);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load labour costs.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'finance.write', 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      approval_status?: string;
      batch_id?: string;
      branch_id?: string;
      department_id?: string;
      employee_id?: string;
      hours_worked?: number;
      overhead_allocation?: number;
      rate?: number;
      rate_type?: string;
      schedule_id?: string;
      shift?: string;
    };
    if (!body.batch_id || body.hours_worked === undefined || body.rate === undefined || !body.rate_type) {
      return badRequest('batch_id, rate_type, rate, and hours_worked are required.');
    }
    if (Number(body.hours_worked) < 0 || Number(body.rate) < 0 || Number(body.overhead_allocation ?? 0) < 0) {
      return badRequest('Rate, hours worked, and overhead allocation must not be negative.');
    }

    const data = await createLabourCostAllocation({
      approvalStatus: body.approval_status,
      batchId: body.batch_id,
      branchId: body.branch_id ?? ctx.branchId ?? null,
      departmentId: body.department_id ?? null,
      employeeId: body.employee_id ?? null,
      hoursWorked: Number(body.hours_worked),
      overheadAllocation: Number(body.overhead_allocation ?? 0),
      rate: Number(body.rate),
      rateType: body.rate_type,
      scheduleId: body.schedule_id ?? null,
      shiftName: body.shift ?? null,
    });

    const service = hrService();
    const { data: batch } = await service.from('production_batches').select('labour_cost, overhead_cost').eq('id', body.batch_id).maybeSingle();
    await service.from('production_batches').update({
      labour_cost: Number(batch?.labour_cost ?? 0) + Number((data as Record<string, unknown>).labour_cost ?? 0),
      overhead_cost: Number(batch?.overhead_cost ?? 0) + Number((data as Record<string, unknown>).overhead_allocation ?? 0),
      updated_at: new Date().toISOString(),
    }).eq('id', body.batch_id);

    await writeHrAuditLog('HR_LABOUR_COST_CREATED', String((data as Record<string, unknown>).id), ctx.userId, data as Record<string, unknown>, 'labour_cost_allocation');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to create labour cost allocation.');
  }
}
