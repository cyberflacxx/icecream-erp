import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateProductionCostSummary } from '@/lib/finance';
import { financeService } from '@/lib/finance-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read', 'production.read')) return forbidden();

  try {
    const service = financeService();
    const { data, error } = await service
      .from('production_batches')
      .select('batch_number, actual_output, material_cost, labour_cost, overhead_cost')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []).map((row) => {
      const summary = calculateProductionCostSummary(
        Number(row.material_cost ?? 0),
        Number(row.labour_cost ?? 0),
        Number(row.overhead_cost ?? 0),
        Number(row.actual_output ?? 0),
      );
      return {
        batchNumber: row.batch_number,
        costPerUnit: summary.costPerUnit,
        outputQuantity: Number(row.actual_output ?? 0),
        totalCost: summary.totalCost,
      };
    });
    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
