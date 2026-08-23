import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensureFinanceAccountCanBePosted } from '@/lib/finance-foundation-server';
import {
  financeErrorMessage,
  financeService,
  isMissingFinanceTable,
  loadBankAccountsCompatibility,
  writeFinanceAuditLog,
} from '@/lib/finance-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('activeOnly') === 'true';

  try {
    return NextResponse.json(
      await loadBankAccountsCompatibility(ctx.organizationId, {
        activeOnly,
        routeName: 'finance.bank-accounts',
      }),
    );
  } catch (err) {
    if (isMissingFinanceTable(err)) return NextResponse.json([]);
    return serverError(financeErrorMessage(err) || 'Internal server error');
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
      currencyCode?: string;
      currentBalance?: number;
      isActive?: boolean;
      openingBalance?: number;
    };

    if (!body.accountId || !body.accountName || !body.accountNumber || !body.bankName) {
      return badRequest('accountId, accountName, accountNumber, and bankName are required');
    }

    await ensureFinanceAccountCanBePosted(ctx.organizationId, body.accountId);

    const openingBalance = Number(body.openingBalance ?? body.currentBalance ?? 0);

    const { data, error } = await service
      .from('bank_accounts')
      .insert({
        account_id: body.accountId,
        account_name: body.accountName,
        account_number: body.accountNumber,
        bank_name: body.bankName,
        branch_name: body.branchName ?? null,
        created_by: ctx.userId,
        currency_code: String(body.currencyCode ?? 'USD').trim().toUpperCase(),
        current_balance: openingBalance,
        is_active: body.isActive ?? true,
        opening_balance: openingBalance,
        organization_id: ctx.organizationId,
        updated_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('BANK_ACCOUNT_CREATED', data.id, ctx.userId, { bankName: body.bankName, accountNumber: body.accountNumber }, 'bank_account');
    return NextResponse.json(
      (await loadBankAccountsCompatibility(ctx.organizationId, { routeName: 'finance.bank-accounts' }))
        .find((row) => row.id === String(data.id)) ?? data,
      { status: 201 },
    );
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      accountName?: string;
      branchName?: string;
      currencyCode?: string;
      id: string;
      isActive?: boolean;
    };
    if (!body.id) return badRequest('id is required');

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    };
    if (body.accountName !== undefined) payload.account_name = String(body.accountName).trim();
    if (body.branchName !== undefined) payload.branch_name = String(body.branchName).trim();
    if (body.currencyCode !== undefined) payload.currency_code = String(body.currencyCode).trim().toUpperCase();
    if (body.isActive !== undefined) payload.is_active = body.isActive;

    const result = await financeService()
      .from('bank_accounts')
      .update(payload)
      .eq('organization_id', ctx.organizationId)
      .eq('id', body.id)
      .select('id')
      .single();
    if (result.error) throw result.error;

    await writeFinanceAuditLog('BANK_ACCOUNT_UPDATED', body.id, ctx.userId, payload, 'bank_account');
    return NextResponse.json(
      (await loadBankAccountsCompatibility(ctx.organizationId, { routeName: 'finance.bank-accounts' }))
        .find((row) => row.id === body.id) ?? { id: body.id, ...payload },
    );
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
