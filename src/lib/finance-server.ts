import { createServiceRoleClient } from '@/lib/supabase/server';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import {
  buildFinanceSourceReference,
  isPostedJournalStatus,
  normalizeFinanceAccountType,
  validateJournalLines,
} from '@/lib/finance';

type FinanceRow = Record<string, unknown>;

export type LedgerLine = {
  accountCode: string;
  accountId: string;
  accountName: string;
  accountType: string;
  creditAmount: number;
  debitAmount: number;
  description: string | null;
  entryDate: string | null;
  entryNumber: string | null;
  journalId: string;
  sourceDocumentId: string | null;
  sourceDocumentType: string | null;
  sourceModule: string | null;
  sourceReference: string | null;
  status: string;
};

export type FinancePostingInput = {
  createdBy: string;
  description: string;
  journalDate?: string | null;
  lines: Array<{
    accountCode?: string;
    accountId?: string;
    creditAmount: number;
    debitAmount: number;
    description?: string | null;
  }>;
  organizationId: string;
  sourceDocumentId: string;
  sourceDocumentType: string;
  sourceModule: string;
};

export function financeService() {
  return createServiceRoleClient().schema('icecream_erp');
}

export async function generateFinanceReferenceNumber(table: string, prefix: string) {
  const service = financeService();
  const { count, error } = await service.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`;
}

export async function writeFinanceAuditLog(
  action: string,
  entityId: string,
  userProfileId: string,
  details: Record<string, unknown>,
  entityType = 'finance',
) {
  const service = financeService();
  await service.from('audit_logs').insert({
    action,
    entity_id: entityId,
    entity_type: entityType,
    new_values: details,
    user_profile_id: userProfileId,
  });
}

export function mapNestedRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function financeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

export function isMissingFinanceTable(error: unknown) {
  const message = financeErrorMessage(error);
  return (
    message.includes("Could not find the table 'icecream_erp.") ||
    message.includes('Could not find a relationship between')
  );
}

export function isMissingFinanceColumn(error: unknown, table: string, columnName: string) {
  return isMissingColumnError(error, table, columnName);
}

export async function loadLedgerLines(organizationId: string, postedOnly = true) {
  const service = financeService();
  const modern = await service
    .from('journal_entry_lines')
    .select(
      'id, journal_entry_id, account_id, description, debit_amount, credit_amount, accounts(id, account_code, account_name, account_type), journal_entries!inner(id, entry_number, entry_date, organization_id, is_posted, status, reference_type, reference_id)',
    )
    .eq('journal_entries.organization_id', organizationId);

  if (!modern.error) {
    const rows = (modern.data ?? []).filter((row) => {
      const entry = mapNestedRow(row.journal_entries as FinanceRow | FinanceRow[] | null);
      return !postedOnly || entry?.is_posted === true || isPostedJournalStatus(String(entry?.status ?? ''));
    });
    return rows.map((row) => mapModernLedgerLine(row as FinanceRow));
  }

  const legacyTableMissing =
    isMissingFinanceTable(modern.error) ||
    isMissingFinanceColumn(modern.error, 'journal_entries', 'is_posted') ||
    isMissingFinanceColumn(modern.error, 'journal_entries', 'reference_type') ||
    isMissingFinanceColumn(modern.error, 'accounts', 'account_code');

  if (!legacyTableMissing) {
    throw modern.error;
  }

  const legacy = await service
    .from('journal_lines')
    .select(
      'id, entry_id, account_id, description, debit, credit, sort_order, accounts(id, code, name, type), journal_entries!inner(id, entry_number, entry_date, organization_id, status, reference)',
    )
    .eq('journal_entries.organization_id', organizationId);

  if (legacy.error) throw legacy.error;

  const rows = (legacy.data ?? []).filter((row) => {
    const entry = mapNestedRow(row.journal_entries as FinanceRow | FinanceRow[] | null);
    return !postedOnly || isPostedJournalStatus(String(entry?.status ?? ''));
  });
  return rows.map((row) => mapLegacyLedgerLine(row as FinanceRow));
}

export async function findJournalBySource(
  organizationId: string,
  sourceModule: string,
  sourceDocumentType: string,
  sourceDocumentId: string,
) {
  const service = financeService();
  const sourceReference = buildFinanceSourceReference(sourceModule, sourceDocumentType, sourceDocumentId);

  const modern = await service
    .from('journal_entries')
    .select('id, entry_number, entry_date, status, reference_type, reference_id')
    .eq('organization_id', organizationId)
    .eq('reference_type', sourceDocumentType)
    .eq('reference_id', sourceDocumentId)
    .maybeSingle();

  if (!modern.error && modern.data) {
    return {
      entryDate: String(modern.data.entry_date ?? ''),
      entryNumber: String(modern.data.entry_number ?? ''),
      id: String(modern.data.id),
      sourceReference,
      status: String(modern.data.status ?? ''),
    };
  }

  if (
    modern.error &&
    !isMissingFinanceColumn(modern.error, 'journal_entries', 'reference_type') &&
    !isMissingFinanceColumn(modern.error, 'journal_entries', 'reference_id')
  ) {
    throw modern.error;
  }

  const legacy = await service
    .from('journal_entries')
    .select('id, entry_number, entry_date, status, reference')
    .eq('organization_id', organizationId)
    .eq('reference', sourceReference)
    .maybeSingle();
  if (legacy.error) throw legacy.error;
  if (!legacy.data) return null;

  return {
    entryDate: String(legacy.data.entry_date ?? ''),
    entryNumber: String(legacy.data.entry_number ?? ''),
    id: String(legacy.data.id),
    sourceReference,
    status: String(legacy.data.status ?? ''),
  };
}

export async function postFinanceDocument(input: FinancePostingInput) {
  const validationError = validateJournalLines(input.lines);
  if (validationError) {
    throw new Error(validationError);
  }

  const existing = await findJournalBySource(
    input.organizationId,
    input.sourceModule,
    input.sourceDocumentType,
    input.sourceDocumentId,
  );
  if (existing) {
    throw new Error(
      `A journal for ${input.sourceDocumentType} ${input.sourceDocumentId} already exists (${existing.entryNumber}).`,
    );
  }

  const service = financeService();
  const resolvedLines = await resolvePostingAccounts(service, input.organizationId, input.lines);
  const totalDebit = resolvedLines.reduce((sum, line) => sum + Number(line.debitAmount ?? 0), 0);
  const totalCredit = resolvedLines.reduce((sum, line) => sum + Number(line.creditAmount ?? 0), 0);
  const entryNumber = await generateFinanceReferenceNumber('journal_entries', 'JE');
  const journalDate = input.journalDate ?? new Date().toISOString().slice(0, 10);
  const sourceReference = buildFinanceSourceReference(
    input.sourceModule,
    input.sourceDocumentType,
    input.sourceDocumentId,
  );

  const modernInsert = await service
    .from('journal_entries')
    .insert({
      organization_id: input.organizationId,
      entry_number: entryNumber,
      entry_date: journalDate,
      description: input.description,
      reference_type: input.sourceDocumentType,
      reference_id: input.sourceDocumentId,
      status: 'APPROVED',
      is_posted: true,
      posted_by: input.createdBy,
      posted_at: new Date().toISOString(),
      created_by: input.createdBy,
      total_debit: totalDebit,
      total_credit: totalCredit,
    })
    .select()
    .single();

  let journal = modernInsert.data as FinanceRow | null;
  let insertError = modernInsert.error;
  let isLegacy = false;

  if (
    insertError &&
    (
      isMissingFinanceColumn(insertError, 'journal_entries', 'reference_type') ||
      isMissingFinanceColumn(insertError, 'journal_entries', 'reference_id') ||
      isMissingFinanceColumn(insertError, 'journal_entries', 'is_posted') ||
      isMissingFinanceColumn(insertError, 'journal_entries', 'posted_by') ||
      isMissingFinanceColumn(insertError, 'journal_entries', 'posted_at')
    )
  ) {
    const legacyInsert = await service
      .from('journal_entries')
      .insert({
        organization_id: input.organizationId,
        entry_number: entryNumber,
        entry_date: journalDate,
        description: input.description,
        reference: sourceReference,
        status: 'APPROVED',
        approved_by: input.createdBy,
        created_by: input.createdBy,
        total_debit: totalDebit,
        total_credit: totalCredit,
      })
      .select()
      .single();

    journal = legacyInsert.data as FinanceRow | null;
    insertError = legacyInsert.error;
    isLegacy = true;
  }

  if (insertError || !journal) {
    throw insertError ?? new Error('Failed to create journal entry.');
  }

  const lineInsert = isLegacy
    ? await service.from('journal_lines').insert(
        resolvedLines.map((line, index) => ({
          entry_id: journal!.id,
          account_id: line.accountId,
          credit: Number(line.creditAmount ?? 0),
          debit: Number(line.debitAmount ?? 0),
          description: line.description ?? null,
          sort_order: index + 1,
        })),
      )
    : await service.from('journal_entry_lines').insert(
        resolvedLines.map((line) => ({
          journal_entry_id: journal!.id,
          account_id: line.accountId,
          credit_amount: Number(line.creditAmount ?? 0),
          debit_amount: Number(line.debitAmount ?? 0),
          description: line.description ?? null,
        })),
      );

  if (lineInsert.error) {
    throw lineInsert.error;
  }

  await writeFinanceAuditLog(
    'FINANCE_SOURCE_POSTED',
    String(journal.id),
    input.createdBy,
    {
      sourceDocumentId: input.sourceDocumentId,
      sourceDocumentType: input.sourceDocumentType,
      sourceModule: input.sourceModule,
      totalCredit,
      totalDebit,
    },
    'journal_entry',
  );

  return {
    entryDate: journalDate,
    entryNumber,
    id: String(journal.id),
    sourceReference,
    totalCredit,
    totalDebit,
  };
}

export async function createLinkedFinanceTransaction(input: {
  amount: number;
  createdBy: string;
  description: string;
  direction?: 'IN' | 'OUT';
  organizationId: string;
  paymentMethod: 'BANK' | 'CASH' | 'PETTY_CASH';
  referenceNumber?: string | null;
  sourceDocument: string;
  transactionDate: string;
}) {
  const service = financeService();
  const accountTable = input.paymentMethod === 'BANK' ? 'bank_accounts' : 'cash_accounts';
  const accountSelect = input.paymentMethod === 'BANK'
    ? 'id, current_balance'
    : 'id, balance';

  const accountResult = await service
    .from(accountTable)
    .select(accountSelect)
    .eq('organization_id', input.organizationId)
    .limit(1)
    .maybeSingle();

  if (accountResult.error) {
    if (isMissingFinanceTable(accountResult.error)) return null;
    throw accountResult.error;
  }
  if (!accountResult.data) return null;

  if (input.paymentMethod === 'BANK') {
    const bankAccount = accountResult.data as { current_balance?: number | null; id: string };
    const direction = input.direction === 'IN' ? 1 : -1;
    const nextBalance = Number(bankAccount.current_balance ?? 0) + direction * Number(input.amount ?? 0);
    const insertResult = await service
      .from('bank_transactions')
      .insert({
        amount: input.amount,
        bank_account_id: bankAccount.id,
        created_by: input.createdBy,
        description: input.description,
        organization_id: input.organizationId,
        posted_at: new Date().toISOString(),
        posted_by: input.createdBy,
        reference_number: input.referenceNumber ?? null,
        source_document: input.sourceDocument,
        status: 'POSTED',
        transaction_date: input.transactionDate,
        transaction_type: input.direction === 'IN' ? 'RECEIPT' : 'PAYMENT_OUT',
      })
      .select()
      .single();
    if (insertResult.error) throw insertResult.error;
    await service.from('bank_accounts').update({ current_balance: nextBalance }).eq('id', bankAccount.id);
    return { id: String(insertResult.data.id), table: 'bank_transactions' };
  }

  const cashAccount = accountResult.data as { balance?: number | null; id: string };
  const direction = input.direction === 'IN' ? 1 : -1;
  const nextBalance = Number(cashAccount.balance ?? 0) + direction * Number(input.amount ?? 0);
  const insertResult = await service
    .from('cash_transactions')
    .insert({
      amount: input.amount,
      cash_account_id: cashAccount.id,
      created_by: input.createdBy,
      counterparty: input.sourceDocument,
      organization_id: input.organizationId,
      posted_at: new Date().toISOString(),
      posted_by: input.createdBy,
      reference: input.referenceNumber ?? null,
      remarks: input.description,
      source: input.sourceDocument,
      status: 'POSTED',
      transaction_date: input.transactionDate,
      transaction_type:
        input.direction === 'IN'
          ? input.paymentMethod === 'PETTY_CASH'
            ? 'PETTY_CASH_IN'
            : 'RECEIPT'
          : input.paymentMethod === 'PETTY_CASH'
            ? 'PETTY_CASH_OUT'
            : 'CASH_OUT',
    })
    .select()
    .single();
  if (insertResult.error) throw insertResult.error;
  await service.from('cash_accounts').update({ balance: nextBalance }).eq('id', cashAccount.id);
  return { id: String(insertResult.data.id), table: 'cash_transactions' };
}

async function resolvePostingAccounts(
  service: ReturnType<typeof financeService>,
  organizationId: string,
  lines: FinancePostingInput['lines'],
) {
  const ids = [...new Set(lines.map((line) => line.accountId).filter(Boolean))] as string[];
  const codes = [...new Set(lines.map((line) => line.accountCode).filter(Boolean))] as string[];

  const idMap = new Map<string, FinanceRow>();
  const codeMap = new Map<string, FinanceRow>();

  if (ids.length > 0) {
    const byIds = await service
      .from('accounts')
      .select('id, organization_id, account_code, account_name, account_type, code, name, type, is_active')
      .eq('organization_id', organizationId)
      .in('id', ids);

    if (byIds.error) {
      const fallback = await service
        .from('accounts')
        .select('id, organization_id, code, name, type, is_active')
        .eq('organization_id', organizationId)
        .in('id', ids);
      if (fallback.error) throw fallback.error;
      for (const row of fallback.data ?? []) idMap.set(String(row.id), row as FinanceRow);
    } else {
      for (const row of byIds.data ?? []) idMap.set(String(row.id), row as FinanceRow);
    }
  }

  if (codes.length > 0) {
    let byCodesResult = await service
      .from('accounts')
      .select('id, organization_id, account_code, account_name, account_type, code, name, type, is_active')
      .eq('organization_id', organizationId)
      .in('account_code', codes);
    if (byCodesResult.error && isMissingFinanceColumn(byCodesResult.error, 'accounts', 'account_code')) {
      byCodesResult = await service
        .from('accounts')
        .select('id, organization_id, code, name, type, is_active')
        .eq('organization_id', organizationId)
        .in('code', codes) as typeof byCodesResult;
    }
    if (byCodesResult.error) throw byCodesResult.error;
    for (const row of byCodesResult.data ?? []) {
      const key = String((row as FinanceRow).account_code ?? (row as FinanceRow).code ?? '');
      codeMap.set(key, row as FinanceRow);
    }
  }

  return lines.map((line) => {
    const account = line.accountId ? idMap.get(String(line.accountId)) : codeMap.get(String(line.accountCode ?? ''));
    if (!account) {
      throw new Error(`Finance account ${line.accountCode ?? line.accountId ?? ''} was not found.`);
    }
    if (account.is_active === false) {
      throw new Error(`Finance account ${account.account_code ?? account.code ?? account.id} is inactive.`);
    }
    return {
      ...line,
      accountId: String(account.id),
      accountCode: String(account.account_code ?? account.code ?? ''),
    };
  });
}

function mapModernLedgerLine(row: FinanceRow): LedgerLine {
  const account = mapNestedRow(row.accounts as FinanceRow | FinanceRow[] | null);
  const entry = mapNestedRow(row.journal_entries as FinanceRow | FinanceRow[] | null);
  return {
    accountCode: String(account?.account_code ?? account?.code ?? ''),
    accountId: String(row.account_id ?? account?.id ?? ''),
    accountName: String(account?.account_name ?? account?.name ?? ''),
    accountType: normalizeFinanceAccountType(String(account?.account_type ?? account?.type ?? '')),
    creditAmount: Number(row.credit_amount ?? row.credit ?? 0),
    debitAmount: Number(row.debit_amount ?? row.debit ?? 0),
    description: row.description ? String(row.description) : null,
    entryDate: entry?.entry_date ? String(entry.entry_date) : null,
    entryNumber: entry?.entry_number ? String(entry.entry_number) : null,
    journalId: String(entry?.id ?? row.journal_entry_id ?? ''),
    sourceDocumentId: entry?.reference_id ? String(entry.reference_id) : null,
    sourceDocumentType: entry?.reference_type ? String(entry.reference_type) : null,
    sourceModule: null,
    sourceReference: entry?.reference_type && entry?.reference_id ? `${entry.reference_type}:${entry.reference_id}` : null,
    status: String(entry?.status ?? ''),
  };
}

function mapLegacyLedgerLine(row: FinanceRow): LedgerLine {
  const account = mapNestedRow(row.accounts as FinanceRow | FinanceRow[] | null);
  const entry = mapNestedRow(row.journal_entries as FinanceRow | FinanceRow[] | null);
  const reference = entry?.reference ? String(entry.reference) : null;
  const parsed = parseLegacySourceReference(reference);
  return {
    accountCode: String(account?.code ?? account?.account_code ?? ''),
    accountId: String(row.account_id ?? account?.id ?? ''),
    accountName: String(account?.name ?? account?.account_name ?? ''),
    accountType: normalizeFinanceAccountType(String(account?.type ?? account?.account_type ?? '')),
    creditAmount: Number(row.credit ?? row.credit_amount ?? 0),
    debitAmount: Number(row.debit ?? row.debit_amount ?? 0),
    description: row.description ? String(row.description) : null,
    entryDate: entry?.entry_date ? String(entry.entry_date) : null,
    entryNumber: entry?.entry_number ? String(entry.entry_number) : null,
    journalId: String(entry?.id ?? row.entry_id ?? ''),
    sourceDocumentId: parsed?.sourceDocumentId ?? null,
    sourceDocumentType: parsed?.sourceDocumentType ?? null,
    sourceModule: parsed?.sourceModule ?? null,
    sourceReference: reference,
    status: String(entry?.status ?? ''),
  };
}

function parseLegacySourceReference(reference: string | null) {
  if (!reference) return null;
  const parts = reference.split(':');
  if (parts.length < 3) return null;
  return {
    sourceDocumentId: parts.slice(2).join(':'),
    sourceDocumentType: parts[1],
    sourceModule: parts[0],
  };
}
