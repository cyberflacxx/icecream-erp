import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

function isMissingColumnError(error: unknown, columnName: string) {
  return error instanceof Error && error.message.includes(`column accounts.${columnName} does not exist`);
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const service = financeService();
    const { id } = await params;
    const body = await request.json() as {
      accountName?: string;
      accountType?: string;
      isActive?: boolean;
      parentAccountId?: string | null;
    };

    const existing = await service
      .from('accounts')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();
    if (existing.error || !existing.data) return notFound('Account not found');

    const primary = await service
      .from('accounts')
      .update({
        account_name: body.accountName,
        account_type: body.accountType,
        is_active: body.isActive,
        parent_account_id: body.parentAccountId,
      })
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .select()
      .single();

    let data = primary.data;
    let error = primary.error;

    if (error && (isMissingColumnError(error, 'account_name') || isMissingColumnError(error, 'account_type') || isMissingColumnError(error, 'parent_account_id'))) {
      const fallback = await service
        .from('accounts')
        .update({
          name: body.accountName,
          type: body.accountType,
          is_active: body.isActive,
          parent_id: body.parentAccountId,
        })
        .eq('organization_id', ctx.organizationId)
        .eq('id', id)
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) throw error ?? new Error('Failed to update account');

    await writeFinanceAuditLog('ACCOUNT_UPDATED', id, ctx.userId, body as Record<string, unknown>, 'account');
    return NextResponse.json(normalizeAccountRow(data as Record<string, unknown>));
  } catch (err) {
    if (err instanceof Error && err.message.includes('23505')) return badRequest('Account code already exists');
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
