import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { getActiveBranchWarehouse } from '@/lib/branches-server';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

async function findExistingShiftClose(
  service: ReturnType<typeof createServiceRoleClient>,
  branchId: string,
  shiftDate: string,
) {
  const buildQuery = () => service
    .schema('icecream_erp')
    .from('branch_shift_closes')
    .select('id')
    .eq('branch_id', branchId)
    .eq('shift_date', shiftDate)
    .in('status', ['OPEN', 'SUBMITTED', 'APPROVED']);

  let result = await buildQuery().is('deleted_at', null).maybeSingle();
  if (result.error && isMissingColumnError(result.error, 'branch_shift_closes', 'deleted_at')) {
    result = await buildQuery().maybeSingle();
  }

  if (result.error) throw result.error;
  return result.data;
}

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
    const primary = await query.range(from, from + pageSize - 1);
    if (primary.error) {
      const compatibleLegacy =
        isMissingColumnError(primary.error, 'branch_shift_closes', 'shift_type') ||
        isMissingColumnError(primary.error, 'branch_shift_closes', 'expected_cash') ||
        isMissingColumnError(primary.error, 'branch_shift_closes', 'actual_cash') ||
        isMissingColumnError(primary.error, 'branch_shift_closes', 'cash_variance') ||
        isMissingColumnError(primary.error, 'branch_shift_closes', 'stock_variance') ||
        isMissingColumnError(primary.error, 'branch_shift_closes', 'deleted_at');

      if (!compatibleLegacy) throw primary.error;

      let fallbackQuery = service
        .schema('icecream_erp')
        .from('branch_shift_closes')
        .select('id, shift_date, shift, status, total_sales, cash_counted, variance', { count: 'exact' })
        .eq('branch_id', branchId)
        .order('shift_date', { ascending: false });

      if (status) fallbackQuery = fallbackQuery.eq('status', status);
      if (startDate) fallbackQuery = fallbackQuery.gte('shift_date', startDate);
      if (endDate) fallbackQuery = fallbackQuery.lte('shift_date', endDate);

      const fallback = await fallbackQuery.range(from, from + pageSize - 1);
      if (fallback.error) throw fallback.error;

      return NextResponse.json({
        data: (fallback.data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id,
          shiftDate: row.shift_date,
          shiftType: row.shift,
          status: row.status,
          expectedCash: Number(row.total_sales ?? 0),
          actualCash: Number(row.cash_counted ?? 0),
          cashVariance: Number(row.variance ?? 0),
          stockVariance: 0,
        })),
        pagination: { page, pageSize, total: fallback.count ?? 0 },
      });
    }

    return NextResponse.json({
      data: (primary.data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        shiftDate: row.shift_date,
        shiftType: row.shift_type,
        status: row.status,
        expectedCash: Number(row.expected_cash ?? 0),
        actualCash: Number(row.actual_cash ?? 0),
        cashVariance: Number(row.cash_variance ?? 0),
        stockVariance: Number(row.stock_variance ?? 0),
      })),
      pagination: { page, pageSize, total: primary.count ?? 0 },
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
    const existing = await findExistingShiftClose(service, branchId, body.date);

    if (existing) return badRequest('A shift close already exists for this branch and date.');

    const warehouse = await getActiveBranchWarehouse(branchId);

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

    const primaryInsert = await service
      .schema('icecream_erp')
      .from('branch_shift_closes')
      .insert({
        organization_id: ctx.organizationId,
        branch_id: branchId,
        shift_date: shiftDate.toISOString(),
        shift: body.shift,
        shift_type: body.shift,
        status: 'OPEN',
        opening_stock_value: openingStockValue,
        closing_stock_value: 0,
        actual_cash: 0,
        expected_cash: 0,
        cash_variance: 0,
        expenses_total: 0,
        stock_received_value: 0,
        stock_sold_value: 0,
        damaged_stock_value: 0,
        closed_by: ctx.userId,
      })
      .select()
      .single();
    let shiftClose = primaryInsert.data;
    let error = primaryInsert.error;

    if (
      error &&
      (
        isMissingColumnError(error, 'branch_shift_closes', 'shift_type') ||
        isMissingColumnError(error, 'branch_shift_closes', 'opening_stock_value') ||
        isMissingColumnError(error, 'branch_shift_closes', 'expected_cash') ||
        isMissingColumnError(error, 'branch_shift_closes', 'actual_cash')
      )
    ) {
      const fallback = await service
        .schema('icecream_erp')
        .from('branch_shift_closes')
        .insert({
          organization_id: ctx.organizationId,
          branch_id: branchId,
          shift_date: body.date,
          shift: body.shift,
          opening_balance: 0,
          total_sales: 0,
          total_expenses: 0,
          closing_balance: 0,
          cash_counted: 0,
          variance: 0,
          status: 'OPEN',
          notes: null,
        })
        .select()
        .single();
      shiftClose = fallback.data;
      error = fallback.error;
    }

    if (error || !shiftClose) throw error ?? new Error('Failed to create branch shift close');

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
