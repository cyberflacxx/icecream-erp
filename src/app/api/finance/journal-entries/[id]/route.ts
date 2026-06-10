import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

function validateBalance(lines: Array<{ debitAmount: number; creditAmount: number }>) {
  if (lines.length < 2) return 'Journal entry must have at least 2 lines';
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debitAmount) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.creditAmount) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01)
    return `Journal entry is not balanced. Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}`;
  for (const l of lines) {
    if (l.debitAmount > 0 && l.creditAmount > 0) return 'A line cannot have both debit and credit amounts';
    if (!(l.debitAmount > 0) && !(l.creditAmount > 0)) return 'Each line must have either a debit or credit amount > 0';
  }
  return null;
}

function mapEntry(entry: Record<string, unknown>) {
  const lines = (entry.journal_entry_lines as Array<Record<string, unknown>>) ?? [];
  return {
    id: entry.id,
    entryNumber: entry.entry_number,
    entryDate: entry.entry_date,
    description: entry.description,
    referenceType: entry.reference_type,
    referenceId: entry.reference_id,
    status: entry.status,
    isPosted: entry.is_posted,
    postedBy: entry.posted_by,
    postedAt: entry.posted_at,
    totalDebit: Number(entry.total_debit ?? 0) || lines.reduce((s, l) => s + Number(l.debit_amount ?? 0), 0),
    totalCredit: Number(entry.total_credit ?? 0) || lines.reduce((s, l) => s + Number(l.credit_amount ?? 0), 0),
    lines: lines.map((l) => ({
      id: l.id,
      accountId: l.account_id,
      description: l.description,
      debitAmount: Number(l.debit_amount ?? 0),
      creditAmount: Number(l.credit_amount ?? 0),
    })),
  };
}

const SELECT_ENTRY = 'id, entry_number, entry_date, description, reference_type, reference_id, status, is_posted, posted_by, posted_at, total_debit, total_credit, journal_entry_lines(id, account_id, description, debit_amount, credit_amount)';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data, error } = await service
      .schema('icecream_erp')
      .from('journal_entries')
      .select(SELECT_ENTRY)
      .eq('id', id)
      .single();

    if (error || !data) return notFound('Journal entry not found');
    return NextResponse.json(mapEntry(data));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      entryDate?: string;
      description?: string;
      referenceType?: string;
      referenceId?: string;
      lines?: Array<{ accountId: string; description?: string; debitAmount: number; creditAmount: number }>;
    };

    const { data: existing, error: fetchErr } = await service
      .schema('icecream_erp')
      .from('journal_entries')
      .select(SELECT_ENTRY)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Journal entry not found');
    if (existing.is_posted) {
      return badRequest(`Journal entry ${existing.entry_number} has been posted and cannot be modified. Create a reversal entry instead.`);
    }

    const existingLines = (existing.journal_entry_lines as Array<Record<string, unknown>>) ?? [];
    const nextLines = body.lines
      ? body.lines.map((l) => ({ debitAmount: Number(l.debitAmount), creditAmount: Number(l.creditAmount) }))
      : existingLines.map((l) => ({ debitAmount: Number(l.debit_amount ?? 0), creditAmount: Number(l.credit_amount ?? 0) }));

    const validationError = validateBalance(nextLines);
    if (validationError) return badRequest(validationError);

    const totalDebit = nextLines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCredit = nextLines.reduce((s, l) => s + l.creditAmount, 0);

    const { error: updateErr } = await service
      .schema('icecream_erp')
      .from('journal_entries')
      .update({
        description: body.description,
        entry_date: body.entryDate ? new Date(body.entryDate).toISOString() : undefined,
        reference_type: body.referenceType,
        reference_id: body.referenceId,
        total_debit: totalDebit,
        total_credit: totalCredit,
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    if (body.lines) {
      await service.schema('icecream_erp').from('journal_entry_lines').delete().eq('journal_entry_id', id);
      await service.schema('icecream_erp').from('journal_entry_lines').insert(
        body.lines.map((l) => ({
          journal_entry_id: id,
          account_id: l.accountId,
          description: l.description ?? null,
          debit_amount: Number(l.debitAmount),
          credit_amount: Number(l.creditAmount),
        }))
      );
    }

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'JOURNAL_ENTRY_UPDATED',
      entity_id: id,
      entity_type: 'journal_entry',
      user_profile_id: ctx.userId,
    });

    const { data: updated } = await service
      .schema('icecream_erp')
      .from('journal_entries')
      .select(SELECT_ENTRY)
      .eq('id', id)
      .single();

    return NextResponse.json(mapEntry(updated!));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: existing, error: fetchErr } = await service
      .schema('icecream_erp')
      .from('journal_entries')
      .select('id, entry_number, is_posted')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Journal entry not found');
    if (existing.is_posted) {
      return badRequest(`Journal entry ${existing.entry_number} has been posted and cannot be deleted. Create a reversal entry instead.`);
    }

    await service.schema('icecream_erp').from('journal_entry_lines').delete().eq('journal_entry_id', id);
    const { error: deleteErr } = await service.schema('icecream_erp').from('journal_entries').delete().eq('id', id);
    if (deleteErr) throw deleteErr;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'JOURNAL_ENTRY_DELETED',
      entity_id: id,
      entity_type: 'journal_entry',
      user_profile_id: ctx.userId,
    });

    return NextResponse.json({ id, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
