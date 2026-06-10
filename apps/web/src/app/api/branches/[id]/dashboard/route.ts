import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== id) return forbidden();

    const { data: branch, error: branchErr } = await service
      .schema('icecream_erp')
      .from('branches')
      .select('id, name')
      .is('deleted_at', null)
      .eq('id', id)
      .single();
    if (branchErr || !branch) return notFound('Branch not found');

    const dayStart = new Date(`${dateParam}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateParam}T23:59:59.999Z`);

    const [{ data: sales }, { data: expenses }, { data: shiftClose }] = await Promise.all([
      service.schema('icecream_erp').from('branch_sales')
        .select('id, total_amount, payment_method')
        .is('deleted_at', null)
        .eq('branch_id', id)
        .gte('sale_date', dayStart.toISOString())
        .lte('sale_date', dayEnd.toISOString()),

      service.schema('icecream_erp').from('branch_expenses')
        .select('id, amount')
        .is('deleted_at', null)
        .eq('branch_id', id)
        .gte('expense_date', dayStart.toISOString())
        .lte('expense_date', dayEnd.toISOString()),

      service.schema('icecream_erp').from('branch_shift_closes')
        .select('id, shift_type, status, opening_stock_value, closing_stock_value, stock_received_value, stock_sold_value')
        .is('deleted_at', null)
        .eq('branch_id', id)
        .gte('shift_date', dayStart.toISOString())
        .lte('shift_date', dayEnd.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const cash = (sales ?? []).filter((s: { payment_method: string }) => s.payment_method === 'CASH').reduce((sum: number, s: { total_amount: number }) => sum + Number(s.total_amount ?? 0), 0);
    const ecocash = (sales ?? []).filter((s: { payment_method: string }) => s.payment_method === 'ECOCASH').reduce((sum: number, s: { total_amount: number }) => sum + Number(s.total_amount ?? 0), 0);
    const card = (sales ?? []).filter((s: { payment_method: string }) => s.payment_method === 'CARD').reduce((sum: number, s: { total_amount: number }) => sum + Number(s.total_amount ?? 0), 0);
    const expensesTotal = (expenses ?? []).reduce((sum: number, e: { amount: number }) => sum + Number(e.amount ?? 0), 0);

    return NextResponse.json({
      date: dateParam,
      stats: {
        openingStockValue: Number(shiftClose?.opening_stock_value ?? 0),
        closingStockEstimated: Number(shiftClose?.closing_stock_value ?? 0),
        stockReceivedToday: Number(shiftClose?.stock_received_value ?? 0),
        stockSoldToday: Number(shiftClose?.stock_sold_value ?? 0),
      },
      payments: { cash, ecocash, card, expenses: expensesTotal },
      shiftClose: shiftClose
        ? { id: shiftClose.id, shiftType: shiftClose.shift_type, status: shiftClose.status }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
