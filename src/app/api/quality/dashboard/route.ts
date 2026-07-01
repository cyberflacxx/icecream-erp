import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingQualityTable, qualityService } from '@/lib/quality-server';

async function safeList(query: PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message?: string } | null }>) {
  const result = await query;
  if (!result.error) return result.data ?? [];
  if (isMissingQualityTable(result.error)) return [];
  throw result.error;
}

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
      safeList(service.from('quality_checks').select('id, status').eq('organization_id', ctx.organizationId)),
      safeList(service.from('goods_return_vouchers').select('id, status, qc_status').eq('organization_id', ctx.organizationId)),
      safeList(service.from('damaged_goods_records').select('total_value, status').eq('organization_id', ctx.organizationId)),
      safeList(service.from('expired_goods_records').select('total_value, status').eq('organization_id', ctx.organizationId)),
      safeList(service.from('rework_records').select('quantity, status').eq('organization_id', ctx.organizationId)),
      safeList(service.from('reusable_stock_approvals').select('quantity_reusable, approved_at').eq('organization_id', ctx.organizationId)),
      safeList(service.from('market_quality_reports').select('id, status').eq('organization_id', ctx.organizationId)),
    ]);

    return NextResponse.json({
      stats: {
        damagedGoodsValue: damaged.reduce((sum, row) => sum + Number(row.total_value ?? 0), 0),
        expiredGoodsValue: expired.reduce((sum, row) => sum + Number(row.total_value ?? 0), 0),
        failedInspections: inspections.filter((row) => ['FAILED', 'REJECTED'].includes(String(row.status ?? row.qc_status))).length,
        pendingInspections: inspections.filter((row) => ['PENDING', 'IN_PROGRESS'].includes(String(row.status ?? row.qc_status))).length,
        pendingReturns: vouchers.filter((row) => ['PENDING_QC', 'QC_IN_PROGRESS'].includes(String(row.qc_status))).length,
        reusableStockPendingApproval: reusable.filter((row) => !row.approved_at).length,
        reworkQuantity: rework.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0),
        weeklyMarketReportStatus: marketReports.some((row) => String(row.status) === 'SUBMITTED') ? 'SUBMITTED' : 'DRAFT',
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
