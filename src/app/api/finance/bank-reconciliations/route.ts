import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      bankAccountId: string;
      closingBalance: number;
      openingBalance: number;
      outstandingDeposits?: number;
      outstandingPayments?: number;
      periodEnd: string;
      periodStart: string;
      statementBalance: number;
    };

    if (!body.bankAccountId || !body.periodStart || !body.periodEnd) {
      return badRequest('bankAccountId, periodStart, and periodEnd are required');
    }

    const reconciledBalance =
      Number(body.statementBalance ?? 0) +
      Number(body.outstandingDeposits ?? 0) -
      Number(body.outstandingPayments ?? 0);

    const { data, error } = await financeService()
      .from('bank_reconciliations')
      .insert({
        organization_id: ctx.organizationId,
        bank_account_id: body.bankAccountId,
        period_start: body.periodStart,
        period_end: body.periodEnd,
        opening_balance: body.openingBalance,
        closing_balance: body.closingBalance,
        statement_balance: body.statementBalance,
        outstanding_deposits: body.outstandingDeposits ?? 0,
        outstanding_payments: body.outstandingPayments ?? 0,
        reconciled_balance: reconciledBalance,
        is_reconciled: true,
        reconciled_by: ctx.userId,
        reconciled_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('BANK_RECONCILIATION_CREATED', data.id, ctx.userId, { bankAccountId: body.bankAccountId, reconciledBalance }, 'bank_reconciliation');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
