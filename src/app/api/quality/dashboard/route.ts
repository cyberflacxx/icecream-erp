import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService } from '@/lib/quality-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read')) return forbidden();

  try {
    const service = qualityService();
    const [
      inspections,
      vouchers,
      damaged,
      expired,
      rework,
      reusable,
      marketReports,
    ] = await Promise.all([
      service.from('quality_inspections').select('id, qc_status').eq('organization_id', ctx.organizationId),
      service.from('goods_return_vouchers').select('id, status, qc_status').eq('organization_id', ctx.organizationId),
      service.from('damaged_goods_records').select('total_value, status').eq('organization_id', ctx.organizationId),
      service.from('expired_goods_records').select('total_value, status').eq('organization_id', ctx.organizationId),
      service.from('rework_records').select('quantity, status').eq('organization_id', ctx.organizationId),
      service.from('reusable_stock_approvals').select('quantity_reusable, approved_at').eq('organization_id', ctx.organizationId),
      service.from('market_quality_reports').select('id, status').eq('organization_id', ctx.organizationId),
    ]);
    if (inspections.error) throw inspections.error;
    if (vouchers.error) throw vouchers.error;
    if (damaged.error) throw damaged.error;
    if (expired.error) throw expired.error;
    if (rework.error) throw rework.error;
    if (reusable.error) throw reusable.error;
    if (marketReports.error) throw marketReports.error;

    return NextResponse.json({
      stats: {
        damagedGoodsValue: (damaged.data ?? []).reduce((sum, row) => sum + Number(row.total_value ?? 0), 0),
        expiredGoodsValue: (expired.data ?? []).reduce((sum, row) => sum + Number(row.total_value ?? 0), 0),
        failedInspections: (inspections.data ?? []).filter((row) => ['FAILED', 'REJECTED'].includes(String(row.qc_status))).length,
        pendingInspections: (inspections.data ?? []).filter((row) => ['PENDING', 'IN_PROGRESS'].includes(String(row.qc_status))).length,
        pendingReturns: (vouchers.data ?? []).filter((row) => ['PENDING_QC', 'QC_IN_PROGRESS'].includes(String(row.qc_status))).length,
        reusableStockPendingApproval: (reusable.data ?? []).filter((row) => !row.approved_at).length,
        reworkQuantity: (rework.data ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0),
        weeklyMarketReportStatus: (marketReports.data ?? []).some((row) => String(row.status) === 'SUBMITTED') ? 'SUBMITTED' : 'DRAFT',
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
