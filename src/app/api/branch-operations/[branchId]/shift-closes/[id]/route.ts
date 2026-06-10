import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ branchId: string; id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const { branchId, id } = await params;
  const service = createServiceRoleClient();

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== branchId) return forbidden();

    const { data: row, error } = await service
      .schema('icecream_erp')
      .from('branch_shift_closes')
      .select('*')
      .is('deleted_at', null)
      .eq('branch_id', branchId)
      .eq('id', id)
      .single();

    if (error || !row) return notFound('Shift close not found');

    return NextResponse.json({
      id: row.id,
      shiftDate: row.shift_date,
      shiftType: row.shift_type,
      status: row.status,
      openingStockValue: Number(row.opening_stock_value ?? 0),
      stockReceivedValue: Number(row.stock_received_value ?? 0),
      stockSoldValue: Number(row.stock_sold_value ?? 0),
      damagedStockValue: Number(row.damaged_stock_value ?? 0),
      closingStockValue: Number(row.closing_stock_value ?? 0),
      expectedCash: Number(row.expected_cash ?? 0),
      actualCash: Number(row.actual_cash ?? 0),
      ecocashTotal: Number(row.ecocash_total ?? 0),
      cardTotal: Number(row.card_total ?? 0),
      expensesTotal: Number(row.expenses_total ?? 0),
      cashVariance: Number(row.cash_variance ?? 0),
      stockVariance: Number(row.stock_variance ?? 0),
      notes: row.notes,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
