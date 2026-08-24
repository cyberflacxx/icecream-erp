import { createServiceRoleClient } from '@/lib/supabase/server';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import {
  buildFinanceSourceReference,
  isPostedJournalStatus,
  normalizeCashAccount,
  normalizePettyCashRequest,
  normalizeTrialBalanceRow,
  resolveLedgerCredit,
  resolveLedgerDebit,
  validateJournalLines,
} from '@/lib/finance';
import {
  canFinanceAccountReceivePosting,
  normalizeFinanceAccountRecord,
} from '@/lib/finance-foundation';

type FinanceRow = Record<string, unknown>;

export type LedgerLine = {
  accountCode: string;
  accountId: string;
  accountName: string;
  accountType: string;
  branchId: string | null;
  creditAmount: number;
  costCenterCode: string | null;
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
  branchId?: string | null;
  costCenterCode?: string | null;
  createdBy: string;
  currencyCode?: string | null;
  description: string;
  journalDate?: string | null;
  lines: Array<{
    accountCode?: string;
    accountId?: string;
    branchId?: string | null;
    creditAmount: number;
    costCenterCode?: string | null;
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

export function getSafeFinanceErrorDetails(error: unknown, routeName: string, step: string) {
  const source = error as {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    message?: unknown;
  } | null;

  return {
    code: source?.code ? String(source.code) : null,
    detail: source?.details ? String(source.details) : null,
    message: source?.message ? String(source.message) : financeErrorMessage(error),
    route: routeName,
    step,
  };
}

export function logFinanceRouteError(routeName: string, step: string, error: unknown) {
  console.error('Finance route failed.', getSafeFinanceErrorDetails(error, routeName, step));
}

type PettyCashCompatibilityRow = Record<string, unknown>;

async function runPettyCashCompatibilityQuery(
  selectClause: string,
  organizationId: string,
  applyFilters?: (query: any) => any,
) {
  const withDeletedAt = financeService()
    .from('petty_cash_requests')
    .select(selectClause)
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  const withDeletedAtResult = applyFilters ? await applyFilters(withDeletedAt) : await withDeletedAt;
  if (!withDeletedAtResult.error) {
    return withDeletedAtResult;
  }

  if (!isMissingFinanceColumn(withDeletedAtResult.error, 'petty_cash_requests', 'deleted_at')) {
    return withDeletedAtResult;
  }

  const fallback = financeService()
    .from('petty_cash_requests')
    .select(selectClause)
    .eq('organization_id', organizationId);
  return applyFilters ? applyFilters(fallback) : fallback;
}

export async function loadPettyCashRequestsCompatibility(
  organizationId: string,
  options?: {
    endDate?: string;
    routeName?: string;
    startDate?: string;
  },
) {
  const routeName = options?.routeName ?? 'finance';
  const applyFilters = (query: any) => {
    let current = query;
    if (options?.startDate) current = current.gte('request_date', options.startDate);
    if (options?.endDate) current = current.lte('request_date', options.endDate);
    return current.order('request_date', { ascending: false });
  };

  const attempts = [
    {
      select: 'id, organization_id, request_number, branch_id, request_date, amount_requested, amount_approved, amount_paid, purpose, status, requested_by, created_at, branches(name)',
      step: 'petty_cash_requests.modern',
    },
    {
      select: 'id, organization_id, request_number, branch_id, request_date, requested_amount, amount_approved, amount_paid, purpose, status, requested_by, created_at, branches(name)',
      step: 'petty_cash_requests.requested_amount',
    },
    {
      select: 'id, organization_id, request_number, branch_id, request_date, amount, amount_approved, amount_paid, purpose, status, requested_by, created_at, branches(name)',
      step: 'petty_cash_requests.amount',
    },
    {
      select: 'id, organization_id, request_number, branch_id, request_date, total_amount, amount_approved, amount_paid, purpose, status, requested_by, created_at, branches(name)',
      step: 'petty_cash_requests.total_amount',
    },
    {
      select: 'id, organization_id, request_number, branch_id, request_date, estimated_amount, amount_approved, amount_paid, purpose, status, requested_by, created_at, branches(name)',
      step: 'petty_cash_requests.estimated_amount',
    },
    {
      select: 'id, organization_id, request_number, branch_id, request_date, purpose, status, requested_by, created_at, branches(name)',
      step: 'petty_cash_requests.minimal',
    },
  ];

  for (const attempt of attempts) {
    const result = await runPettyCashCompatibilityQuery(attempt.select, organizationId, applyFilters);
    if (!result.error) {
      return (result.data ?? []).map((row: unknown) => normalizePettyCashRequest(row as Record<string, unknown>));
    }

    if (isMissingFinanceTable(result.error)) {
      return [];
    }

    const message = financeErrorMessage(result.error);
    const compatibilityFailure =
      message.includes("Could not find the table 'icecream_erp.petty_cash_requests'") ||
      message.includes('Could not find a relationship between') ||
      /column\s+petty_cash_requests\.[a-z_]+\s+does not exist/i.test(message);

    if (!compatibilityFailure) {
      logFinanceRouteError(routeName, attempt.step, result.error);
      throw result.error;
    }

    logFinanceRouteError(routeName, attempt.step, result.error);
  }

  return [];
}

async function runCashAccountsCompatibilityQuery(
  selectClause: string,
  organizationId: string,
  options?: {
    branchId?: string;
    routeName?: string;
  },
) {
  let withDeletedAt = financeService()
    .from('cash_accounts')
    .select(selectClause)
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (options?.branchId) {
    withDeletedAt = withDeletedAt.eq('branch_id', options.branchId);
  }

  const withDeletedAtResult = await withDeletedAt.order('name', { ascending: true });
  if (!withDeletedAtResult.error) {
    return withDeletedAtResult;
  }

  if (!isMissingFinanceColumn(withDeletedAtResult.error, 'cash_accounts', 'deleted_at')) {
    return withDeletedAtResult;
  }

  let fallback = financeService()
    .from('cash_accounts')
    .select(selectClause)
    .eq('organization_id', organizationId);

  if (options?.branchId) {
    fallback = fallback.eq('branch_id', options.branchId);
  }

  return fallback.order('name', { ascending: true });
}

export async function loadCashAccountsCompatibility(
  organizationId: string,
  options?: {
    branchId?: string;
    routeName?: string;
  },
) {
  const routeName = options?.routeName ?? 'finance';
  const attempts = [
    {
      select:
        'id, organization_id, branch_id, account_id, account_name, account_number, name, current_balance, opening_balance, status, is_active, currency_code, currency, created_at, branches(name)',
      step: 'cash_accounts.modern',
    },
    {
      select:
        'id, organization_id, branch_id, account_id, account_name, account_number, name, balance, opening_balance, status, is_active, currency_code, currency, created_at, branches(name)',
      step: 'cash_accounts.balance',
    },
    {
      select:
        'id, organization_id, branch_id, account_name, account_number, name, current_balance, balance, status, is_active, created_at, branches(name)',
      step: 'cash_accounts.lean',
    },
    {
      select: 'id, organization_id, branch_id, name, account_name, balance, current_balance, is_active, branches(name)',
      step: 'cash_accounts.minimal_balance',
    },
    {
      select: 'id, organization_id, name, account_name, created_at',
      step: 'cash_accounts.minimal_identity',
    },
  ];

  for (const attempt of attempts) {
    const result = await runCashAccountsCompatibilityQuery(attempt.select, organizationId, options);
    if (!result.error) {
      return (result.data ?? []).map((row: unknown) => normalizeCashAccount(row as Record<string, unknown>));
    }

    if (isMissingFinanceTable(result.error)) {
      return [];
    }

    const message = financeErrorMessage(result.error);
    const compatibilityFailure =
      message.includes("Could not find the table 'icecream_erp.cash_accounts'") ||
      message.includes('Could not find a relationship between') ||
      /column\s+cash_accounts\.[a-z_]+\s+does not exist/i.test(message) ||
      /column\s+branches\.[a-z_]+\s+does not exist/i.test(message);

    if (!compatibilityFailure) {
      logFinanceRouteError(routeName, attempt.step, result.error);
      throw result.error;
    }

    logFinanceRouteError(routeName, attempt.step, result.error);
  }

  return [];
}

export async function loadBankAccountsCompatibility(
  organizationId: string,
  options?: {
    activeOnly?: boolean;
    routeName?: string;
  },
) {
  const routeName = options?.routeName ?? 'finance';
  const attempts = [
    'id, organization_id, account_id, account_name, bank_name, account_number, branch_name, currency_code, opening_balance, current_balance, is_active, created_at',
    'id, organization_id, account_id, account_name, bank_name, account_number, branch_name, currency_code, current_balance, is_active, created_at',
    'id, organization_id, account_name, bank_name, account_number, branch_name, current_balance, is_active, created_at',
    'id, organization_id, account_name, bank_name, account_number, current_balance',
    'id, account_name, bank_name',
  ];

  for (let index = 0; index < attempts.length; index += 1) {
    let query = financeService()
      .from('bank_accounts')
      .select(attempts[index]!)
      .eq('organization_id', organizationId)
      .order('bank_name', { ascending: true });

    if (options?.activeOnly) {
      query = query.eq('is_active', true);
    }

    const result = await query;
    if (!result.error) {
      return ((result.data ?? []) as unknown as FinanceRow[]).map((row) => {
        const currentBalance = Number(row.current_balance ?? row.balance ?? row.opening_balance ?? 0);
        const openingBalance = Number(row.opening_balance ?? row.current_balance ?? 0);
        const isActive = row.is_active === undefined ? true : row.is_active !== false;
        const currencyCode = row.currency_code ? String(row.currency_code) : null;

        return {
          accountId: row.account_id ? String(row.account_id) : null,
          accountName: String(row.account_name ?? ''),
          accountNumber: row.account_number ? String(row.account_number) : null,
          bankName: String(row.bank_name ?? ''),
          branchName: row.branch_name ? String(row.branch_name) : null,
          createdAt: row.created_at ? String(row.created_at) : null,
          currency: currencyCode,
          currencyCode,
          currentBalance,
          current_balance: currentBalance,
          id: String(row.id ?? ''),
          isActive,
          is_active: isActive,
          openingBalance,
        };
      });
    }

    if (isMissingFinanceTable(result.error)) {
      return [];
    }

    const compatibilityFailure =
      isMissingFinanceColumn(result.error, 'bank_accounts', 'currency_code') ||
      isMissingFinanceColumn(result.error, 'bank_accounts', 'opening_balance') ||
      isMissingFinanceColumn(result.error, 'bank_accounts', 'branch_name') ||
      isMissingFinanceColumn(result.error, 'bank_accounts', 'is_active') ||
      /column\s+bank_accounts\.[a-z_]+\s+does not exist/i.test(financeErrorMessage(result.error));

    if (!compatibilityFailure) {
      logFinanceRouteError(routeName, `bank_accounts.attempt_${index + 1}`, result.error);
      throw result.error;
    }

    logFinanceRouteError(routeName, `bank_accounts.attempt_${index + 1}`, result.error);
  }

  return [];
}

export async function loadLedgerLines(
  organizationId: string,
  postedOnly = true,
  options?: {
    accountCode?: string | null;
    branchId?: string | null;
    costCenterCode?: string | null;
    endDate?: string | null;
    startDate?: string | null;
  },
) {
  const service = financeService();
  const modernAttempts = [
    'id, journal_entry_id, account_id, branch_id, cost_center_code, description, debit_amount, credit_amount, accounts(id, code, name, type), journal_entries!inner(id, entry_number, entry_date, organization_id, branch_id, cost_center_code, is_posted, status, reference_type, reference_id)',
    'id, journal_entry_id, account_id, branch_id, cost_center_code, description, debit_amount, credit_amount, accounts(id, account_code, account_name, account_type), journal_entries!inner(id, entry_number, entry_date, organization_id, branch_id, cost_center_code, is_posted, status, reference_type, reference_id)',
    'id, journal_entry_id, account_id, branch_id, cost_center_code, description, debit_amount, credit_amount, accounts(id, code, name, type), journal_entries!inner(id, entry_number, entry_date, organization_id, branch_id, cost_center_code, status, reference_type, reference_id)',
  ];

  for (let index = 0; index < modernAttempts.length; index += 1) {
    let modernQuery = service
      .from('journal_entry_lines')
      .select(modernAttempts[index]!)
      .eq('journal_entries.organization_id', organizationId);
    if (options?.startDate) modernQuery = modernQuery.gte('journal_entries.entry_date', options.startDate);
    if (options?.endDate) modernQuery = modernQuery.lte('journal_entries.entry_date', options.endDate);
    const modern = await modernQuery;

    if (!modern.error) {
      const rows = ((modern.data ?? []) as unknown as FinanceRow[]).filter((row) => {
        const entry = mapNestedRow(row.journal_entries as FinanceRow | FinanceRow[] | null);
        if (postedOnly && entry?.is_posted !== true && !isPostedJournalStatus(String(entry?.status ?? ''))) {
          return false;
        }

        const branchId = String(row.branch_id ?? entry?.branch_id ?? '').trim();
        if (options?.branchId && branchId !== options.branchId) {
          return false;
        }

        const costCenterCode = String(row.cost_center_code ?? entry?.cost_center_code ?? '').trim();
        if (options?.costCenterCode && costCenterCode !== options.costCenterCode) {
          return false;
        }

        const account = mapNestedRow(row.accounts as FinanceRow | FinanceRow[] | null);
        const accountCode = String(account?.account_code ?? account?.code ?? '').trim().toUpperCase();
        if (options?.accountCode && accountCode !== String(options.accountCode).trim().toUpperCase()) {
          return false;
        }

        return true;
      });
      return rows.map((row) => mapModernLedgerLine(row as FinanceRow));
    }

    const modernCompatibleFailure =
      isMissingFinanceTable(modern.error) ||
      isMissingFinanceColumn(modern.error, 'journal_entries', 'is_posted') ||
      isMissingFinanceColumn(modern.error, 'journal_entries', 'reference_type') ||
      isMissingFinanceColumn(modern.error, 'journal_entries', 'reference_id') ||
      isMissingFinanceColumn(modern.error, 'journal_entry_lines', 'debit_amount') ||
      isMissingFinanceColumn(modern.error, 'journal_entry_lines', 'credit_amount') ||
      isMissingFinanceColumn(modern.error, 'accounts', 'account_code') ||
      isMissingFinanceColumn(modern.error, 'accounts', 'account_name') ||
      isMissingFinanceColumn(modern.error, 'accounts', 'account_type') ||
      isMissingFinanceColumn(modern.error, 'accounts', 'code') ||
      isMissingFinanceColumn(modern.error, 'accounts', 'name') ||
      isMissingFinanceColumn(modern.error, 'accounts', 'type') ||
      financeErrorMessage(modern.error).includes('journal_entries') ||
      financeErrorMessage(modern.error).includes('accounts');

    if (!modernCompatibleFailure) {
      throw modern.error;
    }
  }

  let legacyQuery = service
    .from('journal_lines')
    .select(
      'id, entry_id, account_id, description, debit, credit, sort_order, accounts(id, code, name, type), journal_entries!inner(id, entry_number, entry_date, organization_id, branch_id, cost_center_code, status, reference)',
    )
    .eq('journal_entries.organization_id', organizationId);
  if (options?.startDate) legacyQuery = legacyQuery.gte('journal_entries.entry_date', options.startDate);
  if (options?.endDate) legacyQuery = legacyQuery.lte('journal_entries.entry_date', options.endDate);
  const legacy = await legacyQuery;

  if (!legacy.error) {
    const rows = (legacy.data ?? []).filter((row) => {
      const entry = mapNestedRow(row.journal_entries as FinanceRow | FinanceRow[] | null);
      if (postedOnly && !isPostedJournalStatus(String(entry?.status ?? ''))) {
        return false;
      }

      const branchId = String(entry?.branch_id ?? '').trim();
      if (options?.branchId && branchId !== options.branchId) {
        return false;
      }

      const costCenterCode = String(entry?.cost_center_code ?? '').trim();
      if (options?.costCenterCode && costCenterCode !== options.costCenterCode) {
        return false;
      }

      const account = mapNestedRow(row.accounts as FinanceRow | FinanceRow[] | null);
      const accountCode = String(account?.account_code ?? account?.code ?? '').trim().toUpperCase();
      if (options?.accountCode && accountCode !== String(options.accountCode).trim().toUpperCase()) {
        return false;
      }

      return true;
    });
    return rows.map((row) => mapLegacyLedgerLine(row as FinanceRow));
  }

  const legacyCompatibleFailure =
    isMissingFinanceTable(legacy.error) ||
    isMissingFinanceColumn(legacy.error, 'journal_lines', 'debit') ||
    isMissingFinanceColumn(legacy.error, 'journal_lines', 'credit') ||
    isMissingFinanceColumn(legacy.error, 'accounts', 'code') ||
    isMissingFinanceColumn(legacy.error, 'accounts', 'name') ||
    isMissingFinanceColumn(legacy.error, 'accounts', 'type') ||
    financeErrorMessage(legacy.error).includes('journal_entries') ||
    financeErrorMessage(legacy.error).includes('accounts');

  if (!legacyCompatibleFailure) {
    throw legacy.error;
  }

  return loadAccountsOnlyLedgerFallback(service, organizationId, options?.accountCode ?? null);
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
      branch_id: input.branchId ?? null,
      cost_center_code: input.costCenterCode ?? null,
      organization_id: input.organizationId,
      entry_number: entryNumber,
      entry_date: journalDate,
      description: input.description,
      currency_code: input.currencyCode ?? 'USD',
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
        branch_id: input.branchId ?? null,
        cost_center_code: input.costCenterCode ?? null,
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
          branch_id: line.branchId ?? input.branchId ?? null,
          journal_entry_id: journal!.id,
          account_id: line.accountId,
          cost_center_code: line.costCenterCode ?? input.costCenterCode ?? null,
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

export async function deleteFinanceJournalById(journalId: string) {
  const service = financeService();

  const modernDelete = await service
    .from('journal_entry_lines')
    .delete()
    .eq('journal_entry_id', journalId);
  if (modernDelete.error && !isMissingFinanceTable(modernDelete.error)) {
    throw modernDelete.error;
  }

  const legacyDelete = await service
    .from('journal_lines')
    .delete()
    .eq('entry_id', journalId);
  if (legacyDelete.error && !isMissingFinanceTable(legacyDelete.error)) {
    throw legacyDelete.error;
  }

  const headerDelete = await service
    .from('journal_entries')
    .delete()
    .eq('id', journalId);
  if (headerDelete.error && !isMissingFinanceTable(headerDelete.error)) {
    throw headerDelete.error;
  }
}

export async function createLinkedFinanceTransaction(input: {
  amount: number;
  createdBy: string;
  description: string;
  direction?: 'IN' | 'OUT';
  organizationId: string;
  paymentMethod: 'BANK' | 'CASH' | 'PETTY_CASH';
  selectedAccountId?: string | null;
  referenceNumber?: string | null;
  sourceDocument: string;
  transactionDate: string;
}) {
  const service = financeService();
  const accountTable = input.paymentMethod === 'BANK' ? 'bank_accounts' : 'cash_accounts';
  const accountSelect = 'id, opening_balance, current_balance, is_active';

  const accountResult = await service
    .from(accountTable)
    .select(accountSelect)
    .eq('organization_id', input.organizationId)
    .eq('id', input.selectedAccountId ?? '')
    .maybeSingle();

  const fallbackAccountResult = input.selectedAccountId
    ? null
    : await service
        .from(accountTable)
        .select(accountSelect)
        .eq('organization_id', input.organizationId)
        .limit(1)
        .maybeSingle();

  const resolvedAccountResult = input.selectedAccountId
    ? accountResult
    : fallbackAccountResult;

  if (resolvedAccountResult?.error) {
    if (isMissingFinanceTable(resolvedAccountResult.error)) return null;
    throw resolvedAccountResult.error;
  }
  if (!resolvedAccountResult?.data) {
    if (input.selectedAccountId) {
      throw new Error(`The selected ${input.paymentMethod === 'BANK' ? 'bank' : 'cash'} account is no longer available.`);
    }
    return null;
  }

  if (input.paymentMethod === 'BANK') {
    const existingResult = await service
      .from('bank_transactions')
      .select('id')
      .eq('organization_id', input.organizationId)
      .eq('source_document', input.sourceDocument)
      .maybeSingle();
    if (existingResult.error && !isMissingFinanceTable(existingResult.error)) throw existingResult.error;
    if (existingResult.data?.id) return { id: String(existingResult.data.id), table: 'bank_transactions' };

    const insertResult = await service
      .from('bank_transactions')
      .insert({
        amount: input.amount,
        bank_account_id: String(resolvedAccountResult.data.id),
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
    await syncBankAccountCurrentBalance(String(resolvedAccountResult.data.id));
    return { id: String(insertResult.data.id), table: 'bank_transactions' };
  }

  const existingResult = await service
    .from('cash_transactions')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('source', input.sourceDocument)
    .maybeSingle();
  if (existingResult.error && !isMissingFinanceTable(existingResult.error)) throw existingResult.error;
  if (existingResult.data?.id) return { id: String(existingResult.data.id), table: 'cash_transactions' };

  const insertResult = await service
    .from('cash_transactions')
    .insert({
      amount: input.amount,
      cash_account_id: String(resolvedAccountResult.data.id),
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
  await syncCashAccountCurrentBalance(String(resolvedAccountResult.data.id));
  return { id: String(insertResult.data.id), table: 'cash_transactions' };
}

function getTransactionBalanceEffect(transactionType: string | null | undefined) {
  const normalized = String(transactionType ?? '').trim().toUpperCase();
  if (
    normalized.includes('OUT') ||
    normalized.includes('PAYMENT') ||
    normalized.includes('WITHDRAW') ||
    normalized.includes('DISBURSE')
  ) {
    return -1;
  }
  return 1;
}

export async function syncCashAccountCurrentBalance(cashAccountId: string) {
  const service = financeService();
  const [accountResult, transactionsResult] = await Promise.all([
    service.from('cash_accounts').select('id, opening_balance').eq('id', cashAccountId).single(),
    service
      .from('cash_transactions')
      .select('amount, transaction_type, status')
      .eq('cash_account_id', cashAccountId),
  ]);

  if (accountResult.error) throw accountResult.error;
  if (transactionsResult.error && !isMissingFinanceTable(transactionsResult.error)) {
    throw transactionsResult.error;
  }

  const openingBalance = Number(accountResult.data.opening_balance ?? 0);
  const currentBalance = openingBalance + (transactionsResult.data ?? [])
    .filter((row) => String(row.status ?? 'POSTED').trim().toUpperCase() !== 'VOID')
    .reduce((sum, row) => sum + getTransactionBalanceEffect(String(row.transaction_type ?? '')) * Number(row.amount ?? 0), 0);

  const updateResult = await service
    .from('cash_accounts')
    .update({ current_balance: currentBalance, updated_at: new Date().toISOString() })
    .eq('id', cashAccountId);
  if (updateResult.error) throw updateResult.error;
  return currentBalance;
}

export async function syncBankAccountCurrentBalance(bankAccountId: string) {
  const service = financeService();
  const [accountResult, transactionsResult] = await Promise.all([
    service.from('bank_accounts').select('id, opening_balance').eq('id', bankAccountId).single(),
    service
      .from('bank_transactions')
      .select('amount, transaction_type, status')
      .eq('bank_account_id', bankAccountId),
  ]);

  if (accountResult.error) throw accountResult.error;
  if (transactionsResult.error && !isMissingFinanceTable(transactionsResult.error)) {
    throw transactionsResult.error;
  }

  const openingBalance = Number(accountResult.data.opening_balance ?? 0);
  const currentBalance = openingBalance + (transactionsResult.data ?? [])
    .filter((row) => String(row.status ?? 'POSTED').trim().toUpperCase() !== 'VOID')
    .reduce((sum, row) => sum + getTransactionBalanceEffect(String(row.transaction_type ?? '')) * Number(row.amount ?? 0), 0);

  const updateResult = await service
    .from('bank_accounts')
    .update({ current_balance: currentBalance, updated_at: new Date().toISOString() })
    .eq('id', bankAccountId);
  if (updateResult.error) throw updateResult.error;
  return currentBalance;
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
      .select('id, organization_id, account_code, account_name, account_type, code, name, type, is_active, allow_posting, normal_balance, balance, parent_id, description')
      .eq('organization_id', organizationId)
      .in('id', ids);

    if (byIds.error) {
      const fallback = await service
        .from('accounts')
        .select('id, organization_id, code, name, type, is_active, balance, parent_id, description')
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
      .select('id, organization_id, account_code, account_name, account_type, code, name, type, is_active, allow_posting, normal_balance, balance, parent_id, description')
      .eq('organization_id', organizationId)
      .in('account_code', codes);
    if (byCodesResult.error && isMissingFinanceColumn(byCodesResult.error, 'accounts', 'account_code')) {
      byCodesResult = await service
        .from('accounts')
        .select('id, organization_id, code, name, type, is_active, balance, parent_id, description')
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
    const normalizedAccount = normalizeFinanceAccountRecord(account);
    const postingError = canFinanceAccountReceivePosting(normalizedAccount);
    if (postingError) {
      throw new Error(postingError);
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
  const normalized = normalizeTrialBalanceRow({
    ...row,
    account_code: account?.account_code ?? account?.code,
    account_name: account?.account_name ?? account?.name,
    account_type: account?.account_type ?? account?.type,
  });
  return {
    accountCode: normalized.accountCode,
    accountId: String(row.account_id ?? account?.id ?? ''),
    accountName: normalized.accountName,
    accountType: normalized.accountType,
    branchId: row.branch_id ? String(row.branch_id) : entry?.branch_id ? String(entry.branch_id) : null,
    creditAmount: normalized.credit,
    costCenterCode: row.cost_center_code ? String(row.cost_center_code) : entry?.cost_center_code ? String(entry.cost_center_code) : null,
    debitAmount: normalized.debit,
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
  const normalized = normalizeTrialBalanceRow({
    ...row,
    account_code: account?.account_code ?? account?.code,
    account_name: account?.account_name ?? account?.name,
    account_type: account?.account_type ?? account?.type,
  });
  return {
    accountCode: normalized.accountCode,
    accountId: String(row.account_id ?? account?.id ?? ''),
    accountName: normalized.accountName,
    accountType: normalized.accountType,
    branchId: entry?.branch_id ? String(entry.branch_id) : null,
    creditAmount: normalized.credit,
    costCenterCode: entry?.cost_center_code ? String(entry.cost_center_code) : null,
    debitAmount: normalized.debit,
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

async function loadAccountsOnlyLedgerFallback(
  service: ReturnType<typeof financeService>,
  organizationId: string,
  accountCode?: string | null,
) {
  const attempts = [
    'id, organization_id, account_code, account_name, account_type, is_active',
    'id, organization_id, code, name, type, is_active',
    'id, organization_id, gl_code, title, category, is_active',
    'id, organization_id, number, name, type',
    'id, organization_id, name',
  ];

  for (const selectClause of attempts) {
    const result = await service
      .from('accounts')
      .select(selectClause)
      .eq('organization_id', organizationId);

    if (!result.error) {
      return (result.data ?? [])
        .map((row) => row as unknown as FinanceRow)
        .filter((row) => row.is_active !== false)
        .filter((row) => {
          if (!accountCode) return true;
          const normalizedCode = String(row.account_code ?? row.code ?? '').trim().toUpperCase();
          return normalizedCode === String(accountCode).trim().toUpperCase();
        })
        .map((row) => {
          const normalized = normalizeTrialBalanceRow(row);
          return {
            accountCode: normalized.accountCode,
            accountId: normalized.accountId,
            accountName: normalized.accountName || 'Unknown account',
            accountType: normalized.accountType,
            branchId: null,
            creditAmount: 0,
            costCenterCode: null,
            debitAmount: 0,
            description: null,
            entryDate: null,
            entryNumber: null,
            journalId: `account:${normalized.accountId}`,
            sourceDocumentId: null,
            sourceDocumentType: null,
            sourceModule: null,
            sourceReference: null,
            status: 'POSTED',
          } satisfies LedgerLine;
        });
    }

    if (!isMissingFinanceTable(result.error) && !/column\s+accounts\.[a-z_]+\s+does not exist/i.test(financeErrorMessage(result.error))) {
      throw result.error;
    }
  }

  return [] as LedgerLine[];
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
