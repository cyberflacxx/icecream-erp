import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const { branchId } = await params;
  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const status = searchParams.get('status') ?? undefined;
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== branchId) return forbidden();

    let query = service
      .schema('icecream_erp')
      .from('branch_shift_closes')
      .select('id, shift_date, shift_type, status, expected_cash, actual_cash, cash_variance, stock_variance', { count: 'exact' })
      .is('deleted_at', null)
      .eq('branch_id', branchId)
      .order('shift_date', { ascending: false });

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('shift_date', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('shift_date', `${endDate}T23:59:59.999Z`);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        shiftDate: row.shift_date,
        shiftType: row.shift_type,
        status: row.status,
        expectedCash: Number(row.expected_cash ?? 0),
        actualCash: Number(row.actual_cash ?? 0),
        cashVariance: Number(row.cash_variance ?? 0),
        stockVariance: Number(row.stock_variance ?? 0),
      })),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const { branchId } = await params;
  const service = createServiceRoleClient();

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== branchId) return forbidden();

    const body = await request.json() as { date: string; shift: string };
    if (!body.date || !body.shift) return badRequest('date and shift are required');

    const shiftDate = new Date(`${body.date}T00:00:00.000Z`);

    // Check for existing open shift close
    const { data: existing } = await service
      .schema('icecream_erp')
      .from('branch_shift_closes')
      .select('id')
      .is('deleted_at', null)
      .eq('branch_id', branchId)
      .eq('shift_date', shiftDate.toISOString())
      .in('status', ['OPEN', 'SUBMITTED', 'APPROVED'])
      .maybeSingle();

    if (existing) return badRequest('A shift close already exists for this branch and date.');

    const { data: warehouse } = await service
      .schema('icecream_erp')
      .from('warehouses')
      .select('id')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .eq('type', 'BRANCH')
      .maybeSingle();
    if (!warehouse) return badRequest('No active branch warehouse found');

    // Calculate opening stock value
    const { data: balances } = await service
      .schema('icecream_erp')
      .from('stock_balances')
      .select('quantity_on_hand, items(unit_cost)')
      .eq('warehouse_id', warehouse.id);

    const openingStockValue = (balances ?? []).reduce((sum: number, b: Record<string, unknown>) => {
      const items = b.items as { unit_cost?: unknown } | { unit_cost?: unknown }[] | null;
      const itemObj = Array.isArray(items) ? items[0] : items;
      const unitCost = Number(itemObj?.unit_cost ?? 0);
      return sum + Number(b.quantity_on_hand ?? 0) * unitCost;
    }, 0);

    const { data: shiftClose, error } = await service
      .schema('icecream_erp')
      .from('branch_shift_closes')
      .insert({
        branch_id: branchId,
        shift_date: shiftDate.toISOString(),
        shift_type: body.shift,
        status: 'OPEN',
        opening_stock_value: openingStockValue,
        closing_stock_value: 0,
        actual_cash: 0,
        expected_cash: 0,
        cash_variance: 0,
        card_total: 0,
        ecocash_total: 0,
        expenses_total: 0,
        stock_received_value: 0,
        stock_sold_value: 0,
        stock_variance: 0,
        damaged_stock_value: 0,
        closed_by: ctx.userId,
      })
      .select()
      .single();

    if (error) throw error;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'BRANCH_SHIFT_OPENED',
      entity_id: shiftClose.id,
      entity_type: 'branch_shift_close',
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(shiftClose, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
