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
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  const paymentMethod = searchParams.get('paymentMethod') ?? undefined;

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== branchId) return forbidden();

    let query = service
      .schema('icecream_erp')
      .from('branch_expenses')
      .select('id, amount, category, description, expense_date, payment_method, created_by', { count: 'exact' })
      .is('deleted_at', null)
      .eq('branch_id', branchId)
      .order('expense_date', { ascending: false });

    if (paymentMethod) query = query.eq('payment_method', paymentMethod);
    if (startDate) query = query.gte('expense_date', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('expense_date', `${endDate}T23:59:59.999Z`);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        amount: Number(row.amount ?? 0),
        category: row.category,
        description: row.description,
        expenseDate: row.expense_date,
        paymentMethod: row.payment_method,
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

    const body = await request.json() as {
      amount: number;
      category: string;
      description: string;
      paymentMethod: string;
      expenseDate?: string;
      receiptUrl?: string;
    };

    if (!body.amount || !body.category || !body.description || !body.paymentMethod) {
      return badRequest('amount, category, description, paymentMethod are required');
    }

    const { data: expense, error } = await service
      .schema('icecream_erp')
      .from('branch_expenses')
      .insert({
        branch_id: branchId,
        amount: body.amount,
        category: body.category,
        description: body.description,
        payment_method: body.paymentMethod,
        expense_date: body.expenseDate ? new Date(`${body.expenseDate}T00:00:00.000Z`).toISOString() : new Date().toISOString(),
        receipt_url: body.receiptUrl ?? null,
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
