import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, isMissingFinanceColumn, isMissingFinanceTable, loadLedgerLines } from '@/lib/finance-server';
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

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.gl.view', 'finance.read')) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;

  try {
    const allEntries = groupLedgerLines(await loadLedgerLines(ctx.organizationId, false));
    const filtered = allEntries.filter((entry) => {
      if (status && String(entry.status ?? '').toUpperCase() !== String(status).toUpperCase()) return false;
      if (startDate && String(entry.entryDate ?? '') < startDate) return false;
      if (endDate && String(entry.entryDate ?? '') > endDate) return false;
      if (search) {
        const needle = search.toLowerCase();
        if (
          !String(entry.entryNumber ?? '').toLowerCase().includes(needle) &&
          !String(entry.description ?? '').toLowerCase().includes(needle)
        ) {
          return false;
        }
      }
      return true;
    });
    const from = (page - 1) * pageSize;
    const paged = filtered.slice(from, from + pageSize);

    return NextResponse.json({
      data: paged,
      pagination: { page, pageSize, total: filtered.length },
    });
  } catch (err) {
    if (isMissingFinanceTable(err)) {
      return NextResponse.json({
        data: [],
        pagination: { page, pageSize, total: 0 },
      });
    }
    const message = financeErrorMessage(err) || 'Internal server error';
    return serverError(message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.gl.create', 'finance.write')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      entryDate: string;
      description: string;
      referenceType?: string;
      referenceId?: string;
      lines: Array<{ accountId: string; description?: string; debitAmount: number; creditAmount: number }>;
    };

    if (!body.entryDate || !body.description || !body.lines?.length) {
      return badRequest('entryDate, description, and lines are required');
    }

    const validationError = validateBalance(body.lines.map((l) => ({ debitAmount: l.debitAmount, creditAmount: l.creditAmount })));
    if (validationError) return badRequest(validationError);

    // Validate accounts
    const accountIds = [...new Set(body.lines.map((l) => l.accountId))];
    let accountsResult = await service
      .schema('icecream_erp')
      .from('accounts')
      .select('id')
      .in('id', accountIds);
    if (accountsResult.error) throw accountsResult.error;
    if ((accountsResult.data ?? []).length !== accountIds.length) {
      return badRequest('One or more journal line accounts are invalid');
    }

    // Generate entry number
    const { count } = await service.schema('icecream_erp').from('journal_entries').select('*', { count: 'exact', head: true });
    const entryNumber = `JE-${String((count ?? 0) + 1).padStart(5, '0')}`;
    const totalDebit = body.lines.reduce((s, l) => s + Number(l.debitAmount), 0);
    const totalCredit = body.lines.reduce((s, l) => s + Number(l.creditAmount), 0);

    const modernInsert = await service
      .schema('icecream_erp')
      .from('journal_entries')
      .insert({
        entry_number: entryNumber,
        entry_date: body.entryDate,
        description: body.description,
        reference_type: body.referenceType ?? null,
        reference_id: body.referenceId ?? null,
        status: 'DRAFT',
        is_posted: false,
        total_debit: totalDebit,
        total_credit: totalCredit,
        created_by: ctx.userId,
      })
      .select()
      .single();

    let entry = modernInsert.data;
    let entryErr = modernInsert.error;
    let useLegacyLines = false;

    if (
      entryErr &&
      (
        isMissingFinanceColumn(entryErr, 'journal_entries', 'reference_type') ||
        isMissingFinanceColumn(entryErr, 'journal_entries', 'reference_id') ||
        isMissingFinanceColumn(entryErr, 'journal_entries', 'is_posted')
      )
    ) {
      const fallbackInsert = await service
        .schema('icecream_erp')
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: body.entryDate,
          description: body.description,
          reference: body.referenceType && body.referenceId ? `${body.referenceType}:${body.referenceId}` : null,
          status: 'DRAFT',
          total_debit: totalDebit,
          total_credit: totalCredit,
          created_by: ctx.userId,
          organization_id: ctx.organizationId,
        })
        .select()
        .single();
      entry = fallbackInsert.data;
      entryErr = fallbackInsert.error;
      useLegacyLines = true;
    }

    if (entryErr || !entry) throw entryErr ?? new Error('Failed to create journal entry.');

    const { error: linesErr } = useLegacyLines
      ? await service
          .schema('icecream_erp')
          .from('journal_lines')
          .insert(body.lines.map((l, index) => ({
            entry_id: entry.id,
            account_id: l.accountId,
            description: l.description ?? null,
            debit: Number(l.debitAmount),
            credit: Number(l.creditAmount),
            sort_order: index + 1,
          })))
      : await service
          .schema('icecream_erp')
          .from('journal_entry_lines')
          .insert(body.lines.map((l) => ({
            journal_entry_id: entry.id,
            account_id: l.accountId,
            description: l.description ?? null,
            debit_amount: Number(l.debitAmount),
            credit_amount: Number(l.creditAmount),
          })));
    if (linesErr) throw linesErr;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'JOURNAL_ENTRY_CREATED',
      entity_id: entry.id,
      entity_type: 'journal_entry',
      user_profile_id: ctx.userId,
    });

    const created = groupLedgerLines(await loadLedgerLines(ctx.organizationId, false)).find((row) => row.id === String(entry.id));
    return NextResponse.json(created ?? mapFallbackEntry(entry as Record<string, unknown>, body.lines), { status: 201 });
  } catch (err) {
    const message = financeErrorMessage(err) || 'Internal server error';
    return serverError(message);
  }
}

function groupLedgerLines(lines: Awaited<ReturnType<typeof loadLedgerLines>>) {
  const grouped = new Map<string, ReturnType<typeof mapFallbackEntry>>();

  for (const line of lines) {
    const current = grouped.get(line.journalId) ?? {
      id: line.journalId,
      entryNumber: line.entryNumber,
      entryDate: line.entryDate,
      description: line.description,
      referenceType: line.sourceDocumentType,
      referenceId: line.sourceDocumentId,
      status: line.status,
      isPosted: ['APPROVED', 'POSTED'].includes(String(line.status ?? '').toUpperCase()),
      postedBy: null,
      postedAt: null,
      totalDebit: 0,
      totalCredit: 0,
      lines: [] as Array<{
        id: string;
        accountId: string;
        description: string | null;
        debitAmount: number;
        creditAmount: number;
      }>,
    };

    current.totalDebit += line.debitAmount;
    current.totalCredit += line.creditAmount;
    current.lines.push({
      id: `${line.journalId}:${current.lines.length + 1}`,
      accountId: line.accountId,
      description: line.description,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
    });
    grouped.set(line.journalId, current);
  }

  return [...grouped.values()].sort((a, b) => String(b.entryDate ?? '').localeCompare(String(a.entryDate ?? '')));
}

function mapFallbackEntry(
  entry: Record<string, unknown>,
  lines: Array<{ accountId: string; creditAmount: number; debitAmount: number; description?: string }>,
) {
  return {
    id: String(entry.id ?? ''),
    entryNumber: entry.entry_number,
    entryDate: entry.entry_date,
    description: entry.description,
    referenceType: entry.reference_type ?? null,
    referenceId: entry.reference_id ?? null,
    status: entry.status,
    isPosted: false,
    postedBy: null,
    postedAt: null,
    totalDebit: Number(entry.total_debit ?? 0),
    totalCredit: Number(entry.total_credit ?? 0),
    lines: lines.map((line, index) => ({
      id: `${entry.id}:${index + 1}`,
      accountId: line.accountId,
      description: line.description ?? null,
      debitAmount: Number(line.debitAmount),
      creditAmount: Number(line.creditAmount),
    })),
  };
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
