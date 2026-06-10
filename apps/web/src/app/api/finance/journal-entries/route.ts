import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
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
  if (!can(ctx, 'finance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;

  try {
    let query = service
      .schema('icecream_erp')
      .from('journal_entries')
      .select('id, entry_number, entry_date, description, reference_type, reference_id, status, is_posted, posted_by, posted_at, total_debit, total_credit, journal_entry_lines(id, account_id, description, debit_amount, credit_amount)', { count: 'exact' })
      .order('entry_date', { ascending: false });

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('entry_date', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('entry_date', `${endDate}T23:59:59.999Z`);
    if (search) query = query.or(`entry_number.ilike.%${search}%,description.ilike.%${search}%`);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map(mapEntry),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

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
    const { data: accounts, error: accErr } = await service
      .schema('icecream_erp')
      .from('accounts')
      .select('id')
      .in('id', accountIds);
    if (accErr) throw accErr;
    if ((accounts ?? []).length !== accountIds.length) {
      return badRequest('One or more journal line accounts are invalid');
    }

    // Generate entry number
    const { count } = await service.schema('icecream_erp').from('journal_entries').select('*', { count: 'exact', head: true });
    const entryNumber = `JE-${String((count ?? 0) + 1).padStart(5, '0')}`;
    const totalDebit = body.lines.reduce((s, l) => s + Number(l.debitAmount), 0);
    const totalCredit = body.lines.reduce((s, l) => s + Number(l.creditAmount), 0);

    const { data: entry, error: entryErr } = await service
      .schema('icecream_erp')
      .from('journal_entries')
      .insert({
        entry_number: entryNumber,
        entry_date: new Date(body.entryDate).toISOString(),
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

    if (entryErr) throw entryErr;

    const { error: linesErr } = await service
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

    const { data: full } = await service
      .schema('icecream_erp')
      .from('journal_entries')
      .select('id, entry_number, entry_date, description, reference_type, reference_id, status, is_posted, posted_by, posted_at, total_debit, total_credit, journal_entry_lines(id, account_id, description, debit_amount, credit_amount)')
      .eq('id', entry.id)
      .single();

    return NextResponse.json(mapEntry(full!), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
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
