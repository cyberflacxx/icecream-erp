import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { fetchProductivityRows, hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'production.read', 'reports.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const data = await fetchProductivityRows({
      branchId: ctx.isBranchScoped ? ctx.branchId : (searchParams.get('branchId') ?? null),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      departmentId: searchParams.get('departmentId'),
      employeeId: searchParams.get('employeeId'),
    });
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load productivity records.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      accepted_quantity?: number;
      employee_id?: string;
      hours_worked_snapshot?: number;
      product_id?: string;
      production_batch?: string;
      quantity_produced?: number;
      quantity_rejected?: number;
      remarks?: string;
      shift?: string;
    };
    if (!body.production_batch || !body.employee_id || !body.shift) {
      return badRequest('production_batch, employee_id, and shift are required.');
    }
    if (Number(body.quantity_produced ?? 0) < 0) return badRequest('Production output quantity must not be negative.');

    const service = hrService();
    const tableCheck = await service.from('hr_production_worker_outputs').select('id', { count: 'exact', head: true });
    if (tableCheck.error?.message.includes("Could not find the table 'icecream_erp.hr_production_worker_outputs'")) {
      return serverError('Productivity records table is not deployed in Supabase yet.');
    }
    const { data, error } = await service
      .from('hr_production_worker_outputs')
      .insert({
        accepted_quantity: Number(body.accepted_quantity ?? body.quantity_produced ?? 0),
        batch_id: body.production_batch,
        created_by: ctx.userId,
        employee_id: body.employee_id,
        hours_worked_snapshot: Number(body.hours_worked_snapshot ?? 0),
        organization_id: ctx.organizationId,
        product_id: body.product_id ?? null,
        quantity_produced: Number(body.quantity_produced ?? 0),
        rejected_quantity: Number(body.quantity_rejected ?? 0),
        remarks: body.remarks ?? null,
        shift_name: body.shift,
        updated_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;

    await writeHrAuditLog('HR_PRODUCTIVITY_RECORDED', String(data.id), ctx.userId, data as Record<string, unknown>, 'worker_output');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to record worker productivity.');
  }
}
