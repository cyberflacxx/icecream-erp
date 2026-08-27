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

    const updates = {
      end_time: body.end_time ?? undefined,
      notes: body.notes ?? undefined,
      role_in_production: body.role_on_batch ?? body.role_in_production ?? undefined,
      start_time: body.start_time ?? undefined,
      updated_at: new Date().toISOString(),
    };
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
      .select('id, batch_id, production_batch, employee_id, production_batches(id, status, worker_count)')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Production worker assignment not found.');

    const batch = Array.isArray(existing.production_batches)
      ? existing.production_batches[0]
      : existing.production_batches as Record<string, unknown> | null | undefined;
    if (batch && ['COMPLETED', 'CANCELLED'].includes(String(batch.status ?? '').toUpperCase())) {
      return badRequest('Workers cannot be unassigned from completed or cancelled production batches.');
    }

    const { error } = await service
      .from('production_worker_assignments')
      .delete()
      .eq('id', id);
    if (error) throw error;

    const batchId = String(existing.batch_id ?? existing.production_batch ?? batch?.id ?? '');
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
