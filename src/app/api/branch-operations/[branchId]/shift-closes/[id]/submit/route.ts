import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string; id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const { branchId, id } = await params;
  const service = createServiceRoleClient();

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== branchId) return forbidden();

    const body = await request.json() as {
      actualCash: number;
      actualClosingStock: number;
      damagedStockValue?: number;
      notes?: string;
    };

    if (body.actualCash === undefined || body.actualCash === null) return badRequest('actualCash is required');
    if (body.actualClosingStock === undefined || body.actualClosingStock === null) return badRequest('actualClosingStock is required');

    const { data: shiftClose, error: fetchErr } = await service
      .schema('icecream_erp')
      .from('branch_shift_closes')
      .select('*')
      .is('deleted_at', null)
      .eq('branch_id', branchId)
      .eq('id', id)
      .single();

    if (fetchErr || !shiftClose) return notFound('Shift close not found');
    if (shiftClose.status !== 'OPEN') return badRequest('Only OPEN shift closes can be submitted');

    const shiftDate = new Date(shiftClose.shift_date);
    const dayStart = new Date(shiftDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(shiftDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Calculate shift metrics
    const { data: sales } = await service
      .schema('icecream_erp')
      .from('branch_sales')
      .select('id, total_amount, payment_method')
      .is('deleted_at', null)
      .eq('branch_id', branchId)
      .eq('shift', shiftClose.shift_type)
      .gte('sale_date', dayStart.toISOString())
      .lte('sale_date', dayEnd.toISOString());

    const { data: expenses } = await service
      .schema('icecream_erp')
      .from('branch_expenses')
      .select('amount')
      .is('deleted_at', null)
      .eq('branch_id', branchId)
      .gte('expense_date', dayStart.toISOString())
      .lte('expense_date', dayEnd.toISOString());

    const { data: warehouse } = await service
      .schema('icecream_erp')
      .from('warehouses')
      .select('id')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();

    let stockReceivedValue = 0;
    let stockSoldValue = 0;
    if (warehouse) {
      const { data: transferMovements } = await service
        .schema('icecream_erp')
        .from('stock_movements')
        .select('total_cost')
        .eq('warehouse_id', warehouse.id)
        .eq('movement_type', 'TRANSFER_IN')
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      const { data: salesMovements } = await service
        .schema('icecream_erp')
        .from('stock_movements')
        .select('total_cost')
        .eq('warehouse_id', warehouse.id)
        .eq('movement_type', 'SALES_ISSUE')
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      stockReceivedValue = (transferMovements ?? []).reduce((s: number, m: { total_cost: number }) => s + Number(m.total_cost ?? 0), 0);
      stockSoldValue = (salesMovements ?? []).reduce((s: number, m: { total_cost: number }) => s + Number(m.total_cost ?? 0), 0);
    }

    const expectedCash = (sales ?? []).filter((s: { payment_method: string }) => s.payment_method === 'CASH').reduce((s: number, sale: { total_amount: number }) => s + Number(sale.total_amount ?? 0), 0);
    const ecocashTotal = (sales ?? []).filter((s: { payment_method: string }) => s.payment_method === 'ECOCASH').reduce((s: number, sale: { total_amount: number }) => s + Number(sale.total_amount ?? 0), 0);
    const cardTotal = (sales ?? []).filter((s: { payment_method: string }) => s.payment_method === 'CARD').reduce((s: number, sale: { total_amount: number }) => s + Number(sale.total_amount ?? 0), 0);
    const expensesTotal = (expenses ?? []).reduce((s: number, e: { amount: number }) => s + Number(e.amount ?? 0), 0);
    const damagedStockValue = body.damagedStockValue ?? Number(shiftClose.damaged_stock_value ?? 0);
    const openingStockValue = Number(shiftClose.opening_stock_value ?? 0);
    const expectedClosingStock = openingStockValue + stockReceivedValue - stockSoldValue - damagedStockValue;

    const { data: updated, error: updateErr } = await service
      .schema('icecream_erp')
      .from('branch_shift_closes')
      .update({
        status: 'SUBMITTED',
        actual_cash: body.actualCash,
        closing_stock_value: body.actualClosingStock,
        damaged_stock_value: damagedStockValue,
        expected_cash: expectedCash,
        cash_variance: body.actualCash - expectedCash,
        ecocash_total: ecocashTotal,
        card_total: cardTotal,
        expenses_total: expensesTotal,
        stock_received_value: stockReceivedValue,
        stock_sold_value: stockSoldValue,
        stock_variance: expectedClosingStock - body.actualClosingStock,
        notes: body.notes ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'BRANCH_SHIFT_SUBMITTED',
      entity_id: id,
      entity_type: 'branch_shift_close',
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
