import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const { data, error } = await financeService()
      .from('journal_entries')
      .update({ status: 'PENDING_APPROVAL' })
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .select()
      .single();
    if (error || !data) return notFound('Journal entry not found');
    await writeFinanceAuditLog('JOURNAL_ENTRY_SUBMITTED', id, ctx.userId, {}, 'journal_entry');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
