import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import {
  buildFinanceAccountApiRow,
  canDeleteFinanceAccount,
  loadFinanceAccountById,
  loadFinanceAccounts,
  upsertFinanceAccount,
} from '@/lib/finance-foundation-server';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { id } = await params;
    const account = await loadFinanceAccountById(ctx.organizationId, id);
    if (!account) return notFound('Account not found.');

    const accounts = await loadFinanceAccounts(ctx.organizationId);
    return NextResponse.json(buildFinanceAccountApiRow(account, accounts));
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load account.');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      accountCode?: string;
      accountName?: string;
      accountType?: string;
      allowPosting?: boolean;
      description?: string | null;
      isActive?: boolean;
      parentAccountId?: string | null;
    };

    const existing = await loadFinanceAccountById(ctx.organizationId, id);
    if (!existing) return notFound('Account not found.');

    const saved = await upsertFinanceAccount(ctx, {
      id,
      accountCode: body.accountCode ?? existing.accountCode,
      accountName: body.accountName ?? existing.accountName,
      accountType: body.accountType ?? existing.accountType,
      allowPosting: body.allowPosting ?? existing.allowPosting,
      description: body.description ?? existing.description,
      isActive: body.isActive ?? existing.isActive,
      parentAccountId: body.parentAccountId === undefined ? existing.parentAccountId : body.parentAccountId,
    });

    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update account.';
    if (message.toLowerCase().includes('already exists')) {
      return badRequest(message);
    }
    return serverError(message);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const existing = await loadFinanceAccountById(ctx.organizationId, id);
    if (!existing) return notFound('Account not found.');

    const deletable = await canDeleteFinanceAccount(ctx.organizationId, id);
    if (!deletable.allowed) {
      return badRequest(deletable.reason);
    }

    const result = await financeService()
      .from('accounts')
      .delete()
      .eq('organization_id', ctx.organizationId)
      .eq('id', id);
    if (result.error) throw result.error;

    await writeFinanceAuditLog('ACCOUNT_DELETED', id, ctx.userId, { accountCode: existing.accountCode }, 'account');
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to delete account.');
  }
}
