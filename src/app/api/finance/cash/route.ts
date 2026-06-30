import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

const increaseTypes = new Set(['ADJUSTMENT_IN', 'CASH_IN', 'DEPOSIT', 'RECEIPT', 'SALE_RECEIPT', 'TRANSFER_IN']);
const decreaseTypes = new Set(['ADJUSTMENT_OUT', 'CASH_OUT', 'DISBURSEMENT', 'EXPENSE', 'PAYMENT', 'TRANSFER_OUT', 'WITHDRAWAL']);

function signedAmount(type: string, amount: number) {
  const normalizedType = type.trim().toUpperCase();
  if (decreaseTypes.has(normalizedType)) return -amount;
  if (increaseTypes.has(normalizedType)) return amount;
  return normalizedType.includes('OUT') || normalizedType.includes('PAYMENT') || normalizedType.includes('WITHDRAW')
    ? -amount
    : amount;
}

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

    const service = financeService();
    const amount = Number(body.amount);
    const { data: account, error: accountError } = await service
      .from('cash_accounts')
      .select('balance')
      .eq('id', body.cashAccountId)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return badRequest('Cash account was not found');

    const { data, error } = await service
      .from('cash_transactions')
      .insert({
        organization_id: ctx.organizationId,
        cash_account_id: body.cashAccountId,
        transaction_date: body.transactionDate,
        transaction_type: body.transactionType,
        amount,
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

    const nextBalance = Number(account.balance ?? 0) + signedAmount(body.transactionType, amount);
    const { error: balanceError } = await service
      .from('cash_accounts')
      .update({ balance: nextBalance })
      .eq('id', body.cashAccountId);
    if (balanceError) throw balanceError;

    await writeFinanceAuditLog('CASH_TRANSACTION_CREATED', data.id, ctx.userId, { amount, nextBalance }, 'cash_transaction');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
