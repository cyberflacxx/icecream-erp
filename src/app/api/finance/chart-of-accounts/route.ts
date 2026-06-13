import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { data, error } = await financeService()
      .from('accounts')
      .select('id, account_code, account_name, account_type, parent_account_id, is_active')
      .eq('organization_id', ctx.organizationId)
      .order('account_code', { ascending: true });
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
      accountCode: string;
      accountName: string;
      accountType: string;
      isActive?: boolean;
      parentAccountId?: string;
    };

    if (!body.accountCode || !body.accountName || !body.accountType) {
      return badRequest('accountCode, accountName, and accountType are required');
    }

    const { data, error } = await financeService()
      .from('accounts')
      .insert({
        organization_id: ctx.organizationId,
        account_code: body.accountCode,
        account_name: body.accountName,
        account_type: body.accountType,
        parent_account_id: body.parentAccountId ?? null,
        is_active: body.isActive ?? true,
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('ACCOUNT_CREATED', data.id, ctx.userId, { accountCode: body.accountCode }, 'account');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
