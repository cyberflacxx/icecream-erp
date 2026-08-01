import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateDetailedProductionCostSummary } from '@/lib/finance';
import { financeService } from '@/lib/finance-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read', 'production.read')) return forbidden();

  try {
    const service = financeService();
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId') ?? undefined;
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;
    let query = service
      .from('production_receipt_lines')
      .select('production_receipt_id, production_order_id, finished_product_id, current_completed_quantity, current_rejected_quantity, current_wastage_quantity, unit_production_cost, total_production_cost, batch_number, production_receipts!inner(receipt_number, receipt_date, branch_id)')
      .order('created_at', { ascending: false });
    if (branchId) {
      query = query.eq('production_receipts.branch_id', branchId);
    }
    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []).map((row) => {
      const receipt = Array.isArray(row.production_receipts) ? row.production_receipts[0] : row.production_receipts;
      const summary = calculateDetailedProductionCostSummary({
        acceptedFinishedQuantity: Number(row.current_completed_quantity ?? 0),
        rawMaterialCost: Number(row.total_production_cost ?? 0) - (Number(row.current_wastage_quantity ?? 0) * Number(row.unit_production_cost ?? 0)),
        varianceCost: 0,
        wastageCost: Number(row.current_wastage_quantity ?? 0) * Number(row.unit_production_cost ?? 0),
      });
      return {
        acceptedQuantity: summary.acceptedFinishedQuantity,
        batchNumber: row.batch_number ?? null,
        branchId: receipt && typeof receipt === 'object' ? (receipt as Record<string, unknown>).branch_id ?? null : null,
        costPerUnit: summary.costPerAcceptedUnit,
        productionOrderId: row.production_order_id ?? null,
        receiptDate: receipt && typeof receipt === 'object' ? (receipt as Record<string, unknown>).receipt_date ?? null : null,
        receiptNumber: receipt && typeof receipt === 'object' ? (receipt as Record<string, unknown>).receipt_number ?? null : null,
        rejectedQuantity: Number(row.current_rejected_quantity ?? 0),
        totalCost: summary.totalProductionCost,
        wastageCost: summary.wastageCost,
        wastageQuantity: Number(row.current_wastage_quantity ?? 0),
      };
    });
    return NextResponse.json({
      filters: {
        branchId: branchId ?? null,
      },
      rows,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
