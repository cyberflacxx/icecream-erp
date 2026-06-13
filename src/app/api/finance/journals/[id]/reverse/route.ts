import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, generateFinanceReferenceNumber, writeFinanceAuditLog } from '@/lib/finance-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as { reason?: string };
    if (!body.reason) return badRequest('reason is required');

    const service = financeService();
    const source = await service
      .from('journal_entries')
      .select('id, description, reference_type, reference_id, is_posted, journal_entry_lines(account_id, description, debit_amount, credit_amount)')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();
    if (source.error || !source.data) return notFound('Journal entry not found');
    if (!source.data.is_posted) return badRequest('Only posted journals can be reversed');

    const reverseNumber = await generateFinanceReferenceNumber('journal_entries', 'REV');
    const lines = (source.data.journal_entry_lines as Array<Record<string, unknown>>) ?? [];
    const reversedLines = lines.map((line) => ({
      account_id: line.account_id,
      credit_amount: Number(line.debit_amount ?? 0),
      debit_amount: Number(line.credit_amount ?? 0),
      description: line.description ?? `Reversal: ${body.reason}`,
    }));

    const entry = await service
      .from('journal_entries')
      .insert({
        organization_id: ctx.organizationId,
        entry_number: reverseNumber,
        entry_date: new Date().toISOString(),
        description: `Reversal of ${id}: ${body.reason}`,
        reference_type: source.data.reference_type ?? 'REVERSAL',
        reference_id: source.data.reference_id ?? id,
        total_debit: reversedLines.reduce((sum, line) => sum + Number(line.debit_amount), 0),
        total_credit: reversedLines.reduce((sum, line) => sum + Number(line.credit_amount), 0),
        status: 'POSTED',
        is_posted: true,
        posted_by: ctx.userId,
        posted_at: new Date().toISOString(),
        created_by: ctx.userId,
      })
      .select()
      .single();
    if (entry.error) throw entry.error;

    const linesInsert = await service.from('journal_entry_lines').insert(
      reversedLines.map((line) => ({
        journal_entry_id: entry.data.id,
        ...line,
      })),
    );
    if (linesInsert.error) throw linesInsert.error;

    await service.from('journal_entries').update({ status: 'REVERSED' }).eq('id', id).eq('organization_id', ctx.organizationId);
    await writeFinanceAuditLog('JOURNAL_ENTRY_REVERSED', entry.data.id, ctx.userId, { sourceJournalId: id, reason: body.reason }, 'journal_entry');
    return NextResponse.json(entry.data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
