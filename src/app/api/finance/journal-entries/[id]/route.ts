import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { isPostedJournalStatus } from '@/lib/finance';
import { financeErrorMessage, financeService, isMissingFinanceColumn } from '@/lib/finance-server';

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

type JournalEntryResponse = {
  description: unknown;
  entryDate: unknown;
  entryNumber: unknown;
  id: string;
  isPosted: boolean;
  lines: Array<{
    accountId: unknown;
    creditAmount: number;
    debitAmount: number;
    description: unknown;
    id: unknown;
  }>;
  postedAt: unknown;
  postedBy: unknown;
  referenceId: unknown;
  referenceType: unknown;
  status: unknown;
  totalCredit: number;
  totalDebit: number;
};

type LoadedJournalEntry = {
  entry: JournalEntryResponse;
  storage: 'legacy' | 'modern';
};

function mapLegacyReference(reference: unknown) {
  const value = String(reference ?? '').trim();
  if (!value) return { referenceId: null, referenceType: null };
  const parts = value.split(':');
  if (parts.length >= 3) {
    return {
      referenceId: parts.slice(2).join(':'),
      referenceType: parts[1] ?? null,
    };
  }
  if (parts.length === 2) {
    return {
      referenceId: parts[1] ?? null,
      referenceType: parts[0] ?? null,
    };
  }
  return { referenceId: null, referenceType: value };
}

function mapModernEntry(entry: Record<string, unknown>): JournalEntryResponse {
  const lines = (entry.journal_entry_lines as Array<Record<string, unknown>>) ?? [];
  return {
    id: String(entry.id ?? ''),
    entryNumber: entry.entry_number,
    entryDate: entry.entry_date,
    description: entry.description,
    referenceType: entry.reference_type,
    referenceId: entry.reference_id,
    status: entry.status,
    isPosted: entry.is_posted === true || isPostedJournalStatus(String(entry.status ?? '')),
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

function mapLegacyEntry(
  entry: Record<string, unknown>,
  lines: Array<Record<string, unknown>>,
): JournalEntryResponse {
  const reference = mapLegacyReference(entry.reference);
  return {
    id: String(entry.id ?? ''),
    entryNumber: entry.entry_number,
    entryDate: entry.entry_date,
    description: entry.description,
    referenceType: reference.referenceType,
    referenceId: reference.referenceId,
    status: entry.status,
    isPosted: isPostedJournalStatus(String(entry.status ?? '')),
    postedBy: entry.approved_by ?? entry.created_by ?? null,
    postedAt: null,
    totalDebit: Number(entry.total_debit ?? 0) || lines.reduce((s, l) => s + Number(l.debit ?? 0), 0),
    totalCredit: Number(entry.total_credit ?? 0) || lines.reduce((s, l) => s + Number(l.credit ?? 0), 0),
    lines: lines.map((l, index) => ({
      id: l.id ?? `${entry.id}:${index + 1}`,
      accountId: l.account_id,
      description: l.description,
      debitAmount: Number(l.debit ?? 0),
      creditAmount: Number(l.credit ?? 0),
    })),
  };
}

const SELECT_ENTRY =
  'id, entry_number, entry_date, description, reference_type, reference_id, status, is_posted, posted_by, posted_at, total_debit, total_credit, journal_entry_lines(id, account_id, description, debit_amount, credit_amount)';

async function loadJournalEntry(id: string): Promise<LoadedJournalEntry | null> {
  const service = financeService();
  const modern = await service.from('journal_entries').select(SELECT_ENTRY).eq('id', id).maybeSingle();
  if (!modern.error) {
    if (!modern.data) return null;
    return { entry: mapModernEntry(modern.data as Record<string, unknown>), storage: 'modern' };
  }

  const canFallback =
    isMissingFinanceColumn(modern.error, 'journal_entries', 'reference_type') ||
    isMissingFinanceColumn(modern.error, 'journal_entries', 'reference_id') ||
    isMissingFinanceColumn(modern.error, 'journal_entries', 'is_posted') ||
    financeErrorMessage(modern.error).includes('journal_entry_lines');
  if (!canFallback) throw modern.error;

  const legacyEntry = await service
    .from('journal_entries')
    .select('id, entry_number, entry_date, description, reference, status, approved_by, created_by, total_debit, total_credit')
    .eq('id', id)
    .maybeSingle();
  if (legacyEntry.error) throw legacyEntry.error;
  if (!legacyEntry.data) return null;

  const legacyLines = await service
    .from('journal_lines')
    .select('id, entry_id, account_id, description, debit, credit')
    .eq('entry_id', id)
    .order('sort_order', { ascending: true });
  if (legacyLines.error) throw legacyLines.error;

  return {
    entry: mapLegacyEntry(
      legacyEntry.data as Record<string, unknown>,
      (legacyLines.data ?? []) as Array<Record<string, unknown>>,
    ),
    storage: 'legacy',
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.gl.view', 'finance.read')) return forbidden();

  const { id } = await params;

  try {
    const loaded = await loadJournalEntry(id);
    if (!loaded) return notFound('Journal entry not found');
    return NextResponse.json(loaded.entry);
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.gl.create', 'finance.write')) return forbidden();

  const { id } = await params;
  const service = financeService();

  try {
    const body = await request.json() as {
      entryDate?: string;
      description?: string;
      referenceType?: string;
      referenceId?: string;
      lines?: Array<{ accountId: string; description?: string; debitAmount: number; creditAmount: number }>;
    };

    const loaded = await loadJournalEntry(id);
    if (!loaded) return notFound('Journal entry not found');
    if (loaded.entry.isPosted) {
      return badRequest(`Journal entry ${loaded.entry.entryNumber} has been posted and cannot be modified. Create a reversal entry instead.`);
    }

    const nextLines = body.lines
      ? body.lines.map((l) => ({ debitAmount: Number(l.debitAmount), creditAmount: Number(l.creditAmount) }))
      : loaded.entry.lines.map((l) => ({ debitAmount: Number(l.debitAmount ?? 0), creditAmount: Number(l.creditAmount ?? 0) }));

    const validationError = validateBalance(nextLines);
    if (validationError) return badRequest(validationError);

    const totalDebit = nextLines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCredit = nextLines.reduce((s, l) => s + l.creditAmount, 0);

    const referenceValue =
      body.referenceType && body.referenceId ? `${body.referenceType}:${body.referenceId}` : body.referenceType ?? null;
    const updatePayload =
      loaded.storage === 'modern'
        ? {
            description: body.description,
            entry_date: body.entryDate ?? undefined,
            reference_type: body.referenceType,
            reference_id: body.referenceId,
            total_debit: totalDebit,
            total_credit: totalCredit,
          }
        : {
            description: body.description,
            entry_date: body.entryDate ?? undefined,
            reference: referenceValue,
            total_debit: totalDebit,
            total_credit: totalCredit,
          };

    const { error: updateErr } = await service
      .from('journal_entries')
      .update(updatePayload)
      .eq('id', id);

    if (updateErr) throw updateErr;

    if (body.lines) {
      if (loaded.storage === 'modern') {
        const { error: deleteLinesError } = await service.from('journal_entry_lines').delete().eq('journal_entry_id', id);
        if (deleteLinesError) throw deleteLinesError;
        const { error: insertLinesError } = await service.from('journal_entry_lines').insert(
          body.lines.map((l) => ({
            journal_entry_id: id,
            account_id: l.accountId,
            description: l.description ?? null,
            debit_amount: Number(l.debitAmount),
            credit_amount: Number(l.creditAmount),
          })),
        );
        if (insertLinesError) throw insertLinesError;
      } else {
        const { error: deleteLinesError } = await service.from('journal_lines').delete().eq('entry_id', id);
        if (deleteLinesError) throw deleteLinesError;
        const { error: insertLinesError } = await service.from('journal_lines').insert(
          body.lines.map((l, index) => ({
            entry_id: id,
            account_id: l.accountId,
            description: l.description ?? null,
            debit: Number(l.debitAmount),
            credit: Number(l.creditAmount),
            sort_order: index + 1,
          })),
        );
        if (insertLinesError) throw insertLinesError;
      }
    }

    await service.from('audit_logs').insert({
      action: 'JOURNAL_ENTRY_UPDATED',
      entity_id: id,
      entity_type: 'journal_entry',
      user_profile_id: ctx.userId,
    });

    const updated = await loadJournalEntry(id);
    if (!updated) return notFound('Journal entry not found');
    return NextResponse.json(updated.entry);
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.gl.create', 'finance.write')) return forbidden();

  const { id } = await params;
  const service = financeService();

  try {
    const loaded = await loadJournalEntry(id);
    if (!loaded) return notFound('Journal entry not found');
    if (loaded.entry.isPosted) {
      return badRequest(`Journal entry ${loaded.entry.entryNumber} has been posted and cannot be deleted. Create a reversal entry instead.`);
    }

    const lineDelete = loaded.storage === 'modern'
      ? await service.from('journal_entry_lines').delete().eq('journal_entry_id', id)
      : await service.from('journal_lines').delete().eq('entry_id', id);
    if (lineDelete.error) throw lineDelete.error;

    const { error: deleteErr } = await service.from('journal_entries').delete().eq('id', id);
    if (deleteErr) throw deleteErr;

    await service.from('audit_logs').insert({
      action: 'JOURNAL_ENTRY_DELETED',
      entity_id: id,
      entity_type: 'journal_entry',
      user_profile_id: ctx.userId,
    });

    return NextResponse.json({ id, success: true });
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
