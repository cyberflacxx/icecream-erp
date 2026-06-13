import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensureEmployeeAssignable, hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'production.read')) return forbidden();

  try {
    const service = hrService();
    const { searchParams } = new URL(request.url);
    let query = service
      .from('production_worker_assignments')
      .select(`
        *, 
        employee:employees(id, employee_number, first_name, last_name, department, branch_id),
        batch:production_batches(id, batch_number, shift, production_date, warehouse_id, warehouses(branch_id, name))
      `)
      .order('created_at', { ascending: false });

    if (searchParams.get('batchId')) query = query.eq('batch_id', searchParams.get('batchId'));
    if (searchParams.get('employeeId')) query = query.eq('employee_id', searchParams.get('employeeId'));

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []).filter((row: Record<string, unknown>) => {
      if (!ctx.isBranchScoped) return true;
      const employee = row.employee as Record<string, unknown> | null;
      const batch = row.batch as Record<string, unknown> | null;
      const warehouse = batch?.warehouses as Record<string, unknown> | undefined;
      return String(employee?.branch_id ?? warehouse?.branch_id ?? '') === ctx.branchId;
    });

    return NextResponse.json(rows);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load production worker assignments.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      employee_id?: string;
      production_batch?: string;
      role_on_batch?: string;
      shift?: string;
    };
    if (!body.production_batch || !body.employee_id || !body.shift) {
      return badRequest('production_batch, employee_id, and shift are required.');
    }

    await ensureEmployeeAssignable(body.employee_id);

    const service = hrService();
    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select('id, worker_count')
      .eq('id', body.production_batch)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return badRequest('Production batch not found.');

    const { data, error } = await service
      .from('production_worker_assignments')
      .insert({
        batch_id: body.production_batch,
        employee_id: body.employee_id,
        role_in_production: body.role_on_batch ?? 'Operator',
        shift: body.shift,
      })
      .select()
      .single();
    if (error) throw error;

    await service.from('production_batches').update({
      updated_at: new Date().toISOString(),
      worker_count: Number(batch.worker_count ?? 0) + 1,
    }).eq('id', body.production_batch);

    await writeHrAuditLog('HR_WORKER_ASSIGNED_TO_BATCH', String(data.id), ctx.userId, data as Record<string, unknown>, 'production_worker_assignment');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to assign worker to batch.');
  }
}
