import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      accountName?: string;
      accountType?: string;
      isActive?: boolean;
      parentAccountId?: string | null;
    };

    const existing = await financeService()
      .from('accounts')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();
    if (existing.error || !existing.data) return notFound('Account not found');

    const { data, error } = await financeService()
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
    if (error) throw error;

    await writeFinanceAuditLog('ACCOUNT_UPDATED', id, ctx.userId, body as Record<string, unknown>, 'account');
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && err.message.includes('23505')) return badRequest('Account code already exists');
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
