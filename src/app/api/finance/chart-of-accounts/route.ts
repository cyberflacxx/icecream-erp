import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';

function isMissingColumnError(error: unknown, columnName: string) {
  return financeErrorMessage(error).includes(`column accounts.${columnName} does not exist`);
}

function normalizeAccountRow(row: Record<string, unknown>) {
  return {
    ...row,
    account_code: row.account_code ?? row.code ?? '',
    account_name: row.account_name ?? row.name ?? '',
    account_type: row.account_type ?? row.type ?? '',
    parent_account_id: row.parent_account_id ?? row.parent_id ?? null,
  };
}

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const service = financeService();
    const primary = await service
      .from('accounts')
      .select('id, organization_id, account_code, account_name, account_type, parent_account_id, is_active')
      .eq('organization_id', ctx.organizationId)
      .order('account_code', { ascending: true });

    if (!primary.error) {
      return NextResponse.json((primary.data ?? []).map((row) => normalizeAccountRow(row as Record<string, unknown>)));
    }

    if (!isMissingColumnError(primary.error, 'account_code') && !isMissingColumnError(primary.error, 'account_name') && !isMissingColumnError(primary.error, 'account_type') && !isMissingColumnError(primary.error, 'parent_account_id')) {
      throw primary.error;
    }

    const fallback = await service
      .from('accounts')
      .select('id, organization_id, code, name, type, parent_id, is_active')
      .eq('organization_id', ctx.organizationId)
      .order('code', { ascending: true });

    if (fallback.error) throw fallback.error;
    return NextResponse.json((fallback.data ?? []).map((row) => normalizeAccountRow(row as Record<string, unknown>)));
  } catch (err) {
    if (isMissingFinanceTable(err)) return NextResponse.json([]);
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const service = financeService();
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

    const primary = await service
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

    let data = primary.data;
    let error = primary.error;

    if (error && (isMissingColumnError(error, 'account_code') || isMissingColumnError(error, 'account_name') || isMissingColumnError(error, 'account_type') || isMissingColumnError(error, 'parent_account_id'))) {
      const fallback = await service
        .from('accounts')
        .insert({
          organization_id: ctx.organizationId,
          code: body.accountCode,
          name: body.accountName,
          type: body.accountType,
          parent_id: body.parentAccountId ?? null,
          is_active: body.isActive ?? true,
        })
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) throw error ?? new Error('Failed to create account');

    await writeFinanceAuditLog('ACCOUNT_CREATED', data.id, ctx.userId, { accountCode: body.accountCode }, 'account');
    return NextResponse.json(normalizeAccountRow(data as Record<string, unknown>), { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
