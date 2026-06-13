import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildShiftPerformanceRows } from '@/lib/production';
import { loadProductionReportBatches, productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as { remarks?: string };
    const service = productionService();

    const { data: shift, error: shiftError } = await service
      .from('shift_reports')
      .select('id, report_date, shift_type')
      .eq('id', id)
      .single();
    if (shiftError) throw shiftError;

    const { batches, workerCounts } = await loadProductionReportBatches({
      branchId: ctx.branchId,
      endDate: String(shift.report_date).slice(0, 10),
      startDate: String(shift.report_date).slice(0, 10),
    });

    const { data: targets } = await service
      .from('production_shift_targets')
      .select('*')
      .eq('target_date', String(shift.report_date).slice(0, 10))
      .eq('shift', shift.shift_type);

    const rows = buildShiftPerformanceRows(
      batches.filter((row) => String(row.shift) === String(shift.shift_type)),
      (targets ?? []) as Array<Record<string, unknown>>,
      workerCounts,
    );
    const summary = rows[0] ?? null;

    const { data, error } = await service
      .from('shift_reports')
      .update({
        notes: body.remarks ?? null,
        status: 'APPROVED',
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await writeProductionAuditLog('PRODUCTION_SHIFT_CLOSED', id, ctx.userId, summary ?? {}, 'shift_report');
    return NextResponse.json({ shift: data, summary });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
