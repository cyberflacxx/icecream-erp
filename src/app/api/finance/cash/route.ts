import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { data, error } = await financeService()
      .from('cash_transactions')
      .select('id, cash_account_id, transaction_date, transaction_type, amount, source, reference, counterparty, remarks, status')
      .eq('organization_id', ctx.organizationId)
      .order('transaction_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      amount: number;
      cashAccountId: string;
      counterparty?: string;
      reference?: string;
      remarks?: string;
      source?: string;
      transactionDate: string;
      transactionType: string;
    };
    if (!body.cashAccountId || !body.transactionDate || !body.transactionType || Number(body.amount) <= 0) {
      return badRequest('cashAccountId, transactionDate, transactionType, and a positive amount are required');
    }

    const { data, error } = await financeService()
      .from('cash_transactions')
      .insert({
        organization_id: ctx.organizationId,
        cash_account_id: body.cashAccountId,
        transaction_date: body.transactionDate,
        transaction_type: body.transactionType,
        amount: body.amount,
        source: body.source ?? null,
        reference: body.reference ?? null,
        counterparty: body.counterparty ?? null,
        remarks: body.remarks ?? null,
        status: 'POSTED',
        created_by: ctx.userId,
        posted_by: ctx.userId,
        posted_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('CASH_TRANSACTION_CREATED', data.id, ctx.userId, { amount: body.amount }, 'cash_transaction');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
