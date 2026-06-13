import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { calculateStraightLineDepreciation } from '@/lib/finance';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as { periodEnd: string; periodStart: string };
    if (!body.periodStart || !body.periodEnd) return badRequest('periodStart and periodEnd are required');

    const service = financeService();
    const asset = await service
      .from('fixed_assets')
      .select('id, purchase_cost, residual_value, useful_life_years, accumulated_dep')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (asset.error || !asset.data) return notFound('Fixed asset not found');

    const depreciation = calculateStraightLineDepreciation(
      Number(asset.data.purchase_cost ?? 0),
      Number(asset.data.residual_value ?? 0),
      Number(asset.data.useful_life_years ?? 1),
    );

    const accumulatedTotal = Number(asset.data.accumulated_dep ?? 0) + depreciation.periodicDepreciation;
    const bookValue = Math.max(0, Number(asset.data.purchase_cost ?? 0) - accumulatedTotal);
    const insert = await service
      .from('asset_depreciation')
      .insert({
        asset_id: id,
        period_start: body.periodStart,
        period_end: body.periodEnd,
        depreciation_amount: depreciation.periodicDepreciation,
        accumulated_total: accumulatedTotal,
        book_value: bookValue,
      })
      .select()
      .single();
    if (insert.error) throw insert.error;

    await service
      .from('fixed_assets')
      .update({ accumulated_dep: accumulatedTotal, current_value: bookValue })
      .eq('organization_id', ctx.organizationId)
      .eq('id', id);

    await writeFinanceAuditLog('FIXED_ASSET_DEPRECIATED', id, ctx.userId, { depreciationAmount: depreciation.periodicDepreciation }, 'fixed_asset');
    return NextResponse.json(insert.data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
