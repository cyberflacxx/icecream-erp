import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { emitOperationalNotifications } from '@/lib/notifications-server';
import { financeService, isMissingFinanceColumn } from '@/lib/finance-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.gl.post', 'finance.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient().schema('icecream_erp');

  try {
    let entryResult = await service
      .from('journal_entries')
      .select('id, entry_number, is_posted, journal_entry_lines(debit_amount, credit_amount)')
      .eq('id', id)
      .single();

    let entry = entryResult.data as Record<string, unknown> | null;
    let fetchErr = entryResult.error;
    let lines = (entry?.journal_entry_lines as Array<{ debit_amount: number; credit_amount: number }>) ?? [];

    if (
      fetchErr &&
      (
        isMissingFinanceColumn(fetchErr, 'journal_entries', 'is_posted') ||
        fetchErr.message.includes('journal_entry_lines')
      )
    ) {
      const legacyEntry = await service
        .from('journal_entries')
        .select('id, entry_number, status')
        .eq('id', id)
        .single();
      if (legacyEntry.error || !legacyEntry.data) return notFound('Journal entry not found');

      const legacyLines = await service
        .from('journal_lines')
        .select('debit, credit')
        .eq('entry_id', id);
      if (legacyLines.error) return serverError(legacyLines.error.message);

      entry = legacyEntry.data as Record<string, unknown>;
      fetchErr = null;
      lines = (legacyLines.data ?? []).map((line) => ({
        credit_amount: Number(line.credit ?? 0),
        debit_amount: Number(line.debit ?? 0),
      }));
    }

    if (fetchErr || !entry) return notFound('Journal entry not found');
    if (entry.is_posted || String(entry.status ?? '').toUpperCase() === 'APPROVED' || String(entry.status ?? '').toUpperCase() === 'POSTED') {
      return badRequest(`Journal entry ${entry.entry_number} is already posted.`);
    }

    if (lines.length < 2) return badRequest('Journal entry must have at least 2 lines');

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit_amount ?? 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit_amount ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return badRequest(`Journal entry is not balanced. Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}`);
    }

    const updateResult = await service
      .from('journal_entries')
      .update({
        status: 'APPROVED',
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_posted: true,
        posted_by: ctx.userId,
        posted_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (
      updateResult.error &&
      !isMissingFinanceColumn(updateResult.error, 'journal_entries', 'is_posted') &&
      !isMissingFinanceColumn(updateResult.error, 'journal_entries', 'posted_by') &&
      !isMissingFinanceColumn(updateResult.error, 'journal_entries', 'posted_at')
    ) {
      return serverError(updateResult.error.message);
    }

    if (updateResult.error) {
      const legacyUpdate = await service
        .from('journal_entries')
        .update({
          status: 'APPROVED',
          total_debit: totalDebit,
          total_credit: totalCredit,
          approved_by: ctx.userId,
        })
        .eq('id', id);
      if (legacyUpdate.error) return serverError(legacyUpdate.error.message);
    }

    await emitOperationalNotifications({
      actorUserId: ctx.userId,
      branchId: null,
      documentId: id,
      documentType: 'journal_entry',
      eventType: 'JOURNAL_POSTED',
      message: `Journal entry ${entry.entry_number} was posted successfully.`,
      metadata: {
        entryNumber: entry.entry_number,
        totalCredit,
        totalDebit,
      },
      moduleName: 'finance',
      organizationId: ctx.organizationId,
      recipientRoleNames: ['Accountant', 'Finance Manager'],
      severity: 'MEDIUM',
      title: 'Journal entry posted',
    });

    const { data: updated, error: updatedError } = await financeService()
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (updatedError) return serverError(updatedError.message);

    return NextResponse.json(updated ?? { id, status: 'APPROVED', totalCredit, totalDebit });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
