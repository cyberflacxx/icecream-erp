import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  const service = financeService();
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('activeOnly') === 'true';

  try {
    let query = service
      .from('bank_accounts')
      .select('id, account_id, account_name, bank_name, account_number, branch_name, currency, current_balance, is_active')
      .order('bank_name', { ascending: true });
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
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

  const service = financeService();
  try {
    const body = await request.json() as {
      accountId: string;
      accountName: string;
      accountNumber: string;
      bankName: string;
      branchName?: string;
      currency?: string;
      currentBalance?: number;
    };

    if (!body.accountId || !body.accountName || !body.accountNumber || !body.bankName) {
      return badRequest('accountId, accountName, accountNumber, and bankName are required');
    }

    const { data, error } = await service
      .from('bank_accounts')
      .insert({
        account_id: body.accountId,
        account_name: body.accountName,
        account_number: body.accountNumber,
        bank_name: body.bankName,
        branch_name: body.branchName ?? null,
        currency: body.currency ?? 'USD',
        current_balance: body.currentBalance ?? 0,
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('BANK_ACCOUNT_CREATED', data.id, ctx.userId, { bankName: body.bankName, accountNumber: body.accountNumber }, 'bank_account');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
