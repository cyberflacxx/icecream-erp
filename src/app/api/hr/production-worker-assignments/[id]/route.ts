import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const service = hrService();
    const { data: existing, error: fetchError } = await service.from('production_worker_assignments').select('id').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Production worker assignment not found.');

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.attendanceStatus !== undefined || body.attendance_status !== undefined) {
      updates.attendance_status = String(body.attendanceStatus ?? body.attendance_status ?? '').toUpperCase();
      updates.is_off_shift = ['ABSENT', 'OFF'].includes(String(updates.attendance_status));
    }
    if (body.hoursWorked !== undefined || body.hours_worked !== undefined) {
      updates.hours_worked = Number(body.hoursWorked ?? body.hours_worked ?? 0);
    }
    if (body.outputQuantity !== undefined || body.output_quantity !== undefined) {
      updates.output_quantity = Number(body.outputQuantity ?? body.output_quantity ?? 0);
    }
    if (body.remarks !== undefined || body.notes !== undefined || body.role_on_batch !== undefined) {
      updates.remarks = body.remarks ?? body.notes ?? (body.role_on_batch ? `Role: ${String(body.role_on_batch)}` : null);
    }
    const { data, error } = await service
      .from('production_worker_assignments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await writeHrAuditLog('HR_WORKER_ASSIGNMENT_UPDATED', id, ctx.userId, updates, 'production_worker_assignment');
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to update worker assignment.');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const service = hrService();
    const { data: existing, error: fetchError } = await service
      .from('production_worker_assignments')
      .select('id, batch_id, employee_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Production worker assignment not found.');

    const batchId = String(existing.batch_id ?? '');
    const { data: batch, error: batchError } = batchId
      ? await service.from('production_batches').select('id, status, worker_count').eq('id', batchId).maybeSingle()
      : { data: null, error: null };
    if (batchError) throw batchError;
    if (batch && ['COMPLETED', 'CANCELLED'].includes(String(batch.status ?? '').toUpperCase())) {
      return badRequest('Workers cannot be unassigned from completed or cancelled production batches.');
    }

    const { error } = await service
      .from('production_worker_assignments')
      .delete()
      .eq('id', id);
    if (error) throw error;

    if (batchId) {
      await service.from('production_batches').update({
        updated_at: new Date().toISOString(),
        worker_count: Math.max(0, Number(batch?.worker_count ?? 1) - 1),
      }).eq('id', batchId);
    }

    await writeHrAuditLog(
      'HR_WORKER_UNASSIGNED_FROM_BATCH',
      id,
      ctx.userId,
      { batchId, employeeId: existing.employee_id },
      'production_worker_assignment',
    );
    return NextResponse.json({ id, removed: true });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to unassign worker.');
  }
}
