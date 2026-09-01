import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write', 'hr.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      workers: Array<{
        attendanceStatus?: string;
        employeeId?: string;
        hoursWorked?: number;
        isOffShift?: boolean;
        outputQuantity?: number;
        remarks?: string;
        workerName?: string;
      }>;
    };

    if (!Array.isArray(body.workers) || body.workers.length === 0) {
      return badRequest('workers are required.');
    }
    const employeeIds = body.workers.map((worker) => String(worker.employeeId ?? '').trim()).filter(Boolean);
    if (new Set(employeeIds).size !== employeeIds.length) {
      return badRequest('A worker can only be assigned once to the same production batch.');
    }

    const service = productionService();
    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select('id, shift, status')
      .eq('id', id)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return notFound('Production batch not found.');
    if (['COMPLETED', 'CANCELLED'].includes(String(batch.status ?? '').toUpperCase())) {
      return badRequest('Workers cannot be assigned to completed or cancelled production batches.');
    }

    await service.from('production_worker_assignments').delete().eq('batch_id', id);

    const rows = body.workers.map((worker) => {
      const attendanceStatus = String(worker.attendanceStatus ?? (worker.isOffShift ? 'OFF' : 'PRESENT')).toUpperCase();
      return {
        attendance_status: attendanceStatus,
        batch_id: id,
        created_by: ctx.userId,
        employee_id: worker.employeeId || null,
        hours_worked: Number(worker.hoursWorked ?? 0),
        is_off_shift: worker.isOffShift ?? (attendanceStatus === 'OFF' || attendanceStatus === 'ABSENT'),
        organization_id: ctx.organizationId,
        output_quantity: Number(worker.outputQuantity ?? 0),
        remarks: worker.remarks ?? null,
        shift_name: String(batch.shift ?? 'DAY'),
        worker_name: worker.workerName?.trim() || null,
      };
    });

    const { error } = await service.from('production_worker_assignments').insert(rows);
    if (error) throw error;

    const presentCount = rows.filter((row) => !row.is_off_shift && row.attendance_status !== 'ABSENT').length;
    const offCount = rows.length - presentCount;
    await service
      .from('production_batches')
      .update({
        people_off_count: offCount,
        worker_count: presentCount,
      })
      .eq('id', id);

    await writeProductionAuditLog('PRODUCTION_WORKERS_ASSIGNED', id, ctx.userId, {
      offCount,
      presentCount,
      totalWorkers: rows.length,
    }, 'production_batch');

    return NextResponse.json({ offCount, presentCount, saved: true, totalWorkers: rows.length });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
