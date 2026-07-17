import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  financeService,
  loadCashAccountsCompatibility,
  logFinanceRouteError,
  writeFinanceAuditLog,
} from '@/lib/finance-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  const service = financeService();
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId');

  try {
    const data = await loadCashAccountsCompatibility(ctx.organizationId, {
      branchId: branchId ?? undefined,
      routeName: 'finance.cash-accounts',
    });
    return NextResponse.json(data);
  } catch (err) {
    logFinanceRouteError('finance.cash-accounts', 'list', err);
    return serverError('Cash accounts could not be loaded. Please refresh or contact support.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  const service = financeService();
  try {
    const body = await request.json() as {
      accountId: string;
      balance?: number;
      branchId?: string;
      name: string;
    };
    if (!body.accountId || !body.name) return badRequest('accountId and name are required');

    const { data, error } = await service
      .from('cash_accounts')
      .insert({
        account_id: body.accountId,
        branch_id: body.branchId ?? null,
        name: body.name,
        balance: body.balance ?? 0,
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('CASH_ACCOUNT_CREATED', data.id, ctx.userId, { name: body.name }, 'cash_account');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
