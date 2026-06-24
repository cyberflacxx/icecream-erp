import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { normalizeShift } from '@/lib/production';
import { isMissingProductionTable, productionErrorMessage, productionService } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('shift_reports')
      .select('*')
      .is('deleted_at', null)
      .order('report_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (isMissingProductionTable(err)) return NextResponse.json([]);
    return serverError(productionErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      branchId?: string;
      notes?: string;
      productionBatchId?: string;
      reportDate: string;
      shift: string;
    };
    if (!body.reportDate) return badRequest('reportDate is required.');

    const service = productionService();
    const { data, error } = await service
      .from('shift_reports')
      .insert({
        branch_id: body.branchId ?? ctx.branchId,
        notes: body.notes ?? null,
        prepared_by: ctx.userId,
        production_batch_id: body.productionBatchId ?? null,
        report_date: body.reportDate,
        shift_type: normalizeShift(body.shift),
        status: 'OPEN',
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
