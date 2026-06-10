import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: entry, error: fetchErr } = await service
      .schema('icecream_erp')
      .from('journal_entries')
      .select('id, entry_number, is_posted, journal_entry_lines(debit_amount, credit_amount)')
      .eq('id', id)
      .single();

    if (fetchErr || !entry) return notFound('Journal entry not found');
    if (entry.is_posted) {
      return badRequest(`Journal entry ${entry.entry_number} is already posted.`);
    }

    const lines = (entry.journal_entry_lines as Array<{ debit_amount: number; credit_amount: number }>) ?? [];
    if (lines.length < 2) return badRequest('Journal entry must have at least 2 lines');

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit_amount ?? 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit_amount ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return badRequest(`Journal entry is not balanced. Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}`);
    }

    const { data: updated, error: updateErr } = await service
      .schema('icecream_erp')
      .from('journal_entries')
      .update({
        is_posted: true,
        posted_at: new Date().toISOString(),
        posted_by: ctx.userId,
        status: 'POSTED',
        total_debit: totalDebit,
        total_credit: totalCredit,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'JOURNAL_ENTRY_POSTED',
      entity_id: id,
      entity_type: 'journal_entry',
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
