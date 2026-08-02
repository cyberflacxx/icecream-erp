import { type AuthContext } from '@/lib/api-auth';
import {
  buildBranchCostCentreDefinitions,
  buildFinanceAccountTree,
  canFinanceAccountReceivePosting,
  DEFAULT_FINANCE_COST_CENTRES,
  defaultFinanceAccountPostingFlag,
  filterFinanceAccounts,
  getFinanceNormalBalance,
  normalizeFinanceAccountRecord,
  normalizeFinanceFoundationType,
  validateOpeningBalanceDraftLines,
} from '@/lib/finance-foundation';
import { financeErrorMessage, financeService, isMissingFinanceColumn, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';
import { toNumber } from '@/lib/inventory';

type Row = Record<string, unknown>;

const ACCOUNT_SELECT_WITH_CONTROLS =
  'id, organization_id, code, name, type, parent_id, is_active, balance, description, allow_posting, normal_balance';
const ACCOUNT_SELECT_BASE =
  'id, organization_id, code, name, type, parent_id, is_active, balance, description';

function isMissingAccountControlColumn(error: unknown) {
  return (
    isMissingFinanceColumn(error, 'accounts', 'allow_posting') ||
    isMissingFinanceColumn(error, 'accounts', 'normal_balance')
  );
}

export async function loadFinanceAccounts(
  organizationId: string,
  options?: {
    activeStatus?: 'active' | 'all' | 'inactive';
    search?: string | null;
    type?: string | null;
  },
) {
  const service = financeService();
  let result = await service
    .from('accounts')
    .select(ACCOUNT_SELECT_WITH_CONTROLS)
    .eq('organization_id', organizationId)
    .order('code', { ascending: true });

  if (result.error && isMissingAccountControlColumn(result.error)) {
    result = await service
      .from('accounts')
      .select(ACCOUNT_SELECT_BASE)
      .eq('organization_id', organizationId)
      .order('code', { ascending: true }) as typeof result;
  }

  if (result.error) {
    if (isMissingFinanceTable(result.error)) return [];
    throw result.error;
  }

  return filterFinanceAccounts(
    (result.data ?? []).map((row) => normalizeFinanceAccountRecord(row as Row)),
    options,
  );
}

export async function loadFinanceAccountById(organizationId: string, id: string) {
  const accounts = await loadFinanceAccounts(organizationId);
  return accounts.find((account) => account.id === id) ?? null;
}

export function buildFinanceAccountApiRow(
  account: ReturnType<typeof normalizeFinanceAccountRecord>,
  allAccounts: Array<ReturnType<typeof normalizeFinanceAccountRecord>>,
) {
  const parent = allAccounts.find((candidate) => candidate.id === account.parentAccountId) ?? null;
  const ledgerHref = `/finance/transactions?accountId=${account.id}`;

  return {
    id: account.id,
    organization_id: account.organizationId,
    organizationId: account.organizationId,
    code: account.accountCode,
    account_code: account.accountCode,
    accountCode: account.accountCode,
    name: account.accountName,
    account_name: account.accountName,
    accountName: account.accountName,
    type: account.accountType,
    account_type: account.accountType,
    accountType: account.accountType,
    parent_id: account.parentAccountId,
    parent_account_id: account.parentAccountId,
    parentAccountId: account.parentAccountId,
    parent_account_code: parent?.accountCode ?? account.parentAccountCode,
    parentAccountCode: parent?.accountCode ?? account.parentAccountCode,
    parent_account_name: parent?.accountName ?? null,
    parentAccountName: parent?.accountName ?? null,
    is_active: account.isActive,
    isActive: account.isActive,
    balance: account.currentBalance,
    current_balance: account.currentBalance,
    currentBalance: account.currentBalance,
    allow_posting: account.allowPosting,
    allowPosting: account.allowPosting,
    is_header: !account.allowPosting || account.accountType === 'HEADER',
    isHeader: !account.allowPosting || account.accountType === 'HEADER',
    normal_balance: account.normalBalance,
    normalBalance: account.normalBalance,
    description: account.description,
    ledgerHref,
  };
}

export async function buildFinanceAccountPayloads(
  organizationId: string,
  options?: {
    activeStatus?: 'active' | 'all' | 'inactive';
    search?: string | null;
    type?: string | null;
  },
) {
  const accounts = await loadFinanceAccounts(organizationId, options);
  const rows = accounts.map((account) => buildFinanceAccountApiRow(account, accounts));
  return {
    list: rows,
    tree: buildFinanceAccountTree(accounts).map((node) => buildFinanceAccountTreeNodePayload(node, accounts)),
  };
}

function buildFinanceAccountTreeNodePayload(
  node: ReturnType<typeof buildFinanceAccountTree>[number],
  allAccounts: Array<ReturnType<typeof normalizeFinanceAccountRecord>>,
) {
  const payload = buildFinanceAccountApiRow(node, allAccounts) as Record<string, unknown>;
  payload.depth = node.depth;
  payload.children = node.children.map((child) => buildFinanceAccountTreeNodePayload(child, allAccounts));
  return payload;
}

export async function ensureFinanceAccountCanBePosted(organizationId: string, accountId: string) {
  const account = await loadFinanceAccountById(organizationId, accountId);
  if (!account) {
    throw new Error('Finance account was not found.');
  }

  const postingError = canFinanceAccountReceivePosting(account);
  if (postingError) {
    throw new Error(postingError);
  }

  return account;
}

export async function ensureFinanceAccountCodeUnique(
  organizationId: string,
  code: string,
  excludeId?: string | null,
) {
  const service = financeService();
  const result = await service
    .from('accounts')
    .select('id, code')
    .eq('organization_id', organizationId)
    .eq('code', code)
    .maybeSingle();

  if (result.error && !isMissingFinanceTable(result.error)) throw result.error;
  if (result.data && String(result.data.id) !== String(excludeId ?? '')) {
    throw new Error(`Account code ${code} already exists.`);
  }
}

export async function upsertFinanceAccount(
  ctx: AuthContext,
  input: {
    accountCode: string;
    accountName: string;
    accountType: string;
    allowPosting?: boolean;
    description?: string | null;
    id?: string | null;
    isActive?: boolean;
    parentAccountId?: string | null;
  },
) {
  const accountCode = String(input.accountCode ?? '').trim().toUpperCase();
  const accountName = String(input.accountName ?? '').trim();
  const accountType = normalizeFinanceFoundationType(input.accountType);
  const isHeader = accountType === 'HEADER';
  const allowPosting = isHeader ? false : input.allowPosting ?? defaultFinanceAccountPostingFlag(accountType);

  if (!accountCode || !accountName) {
    throw new Error('accountCode and accountName are required.');
  }

  if (input.parentAccountId) {
    const parent = await loadFinanceAccountById(ctx.organizationId, input.parentAccountId);
    if (!parent) throw new Error('Parent account was not found.');
    if (String(input.id ?? '') && parent.id === input.id) throw new Error('An account cannot be its own parent.');
  }

  await ensureFinanceAccountCodeUnique(ctx.organizationId, accountCode, input.id);

  const service = financeService();
  const payload = {
    organization_id: ctx.organizationId,
    code: accountCode,
    name: accountName,
    type: accountType,
    parent_id: input.parentAccountId ?? null,
    is_active: input.isActive ?? true,
    description: input.description?.trim() || null,
    allow_posting: allowPosting,
    normal_balance: getFinanceNormalBalance(accountType),
    updated_at: new Date().toISOString(),
  };

  let result = input.id
    ? await service
        .from('accounts')
        .update(payload)
        .eq('organization_id', ctx.organizationId)
        .eq('id', input.id)
        .select(ACCOUNT_SELECT_WITH_CONTROLS)
        .single()
    : await service
        .from('accounts')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select(ACCOUNT_SELECT_WITH_CONTROLS)
        .single();

  if (result.error && isMissingAccountControlColumn(result.error)) {
    const fallbackPayload = {
      organization_id: ctx.organizationId,
      code: accountCode,
      name: accountName,
      type: accountType,
      parent_id: input.parentAccountId ?? null,
      is_active: input.isActive ?? true,
      description: input.description?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    result = input.id
      ? await service
          .from('accounts')
          .update(fallbackPayload)
          .eq('organization_id', ctx.organizationId)
          .eq('id', input.id)
          .select(ACCOUNT_SELECT_BASE)
          .single() as typeof result
      : await service
          .from('accounts')
          .insert({
            ...fallbackPayload,
            created_at: new Date().toISOString(),
          })
          .select(ACCOUNT_SELECT_BASE)
          .single() as typeof result;
  }

  if (result.error || !result.data) throw result.error ?? new Error('Failed to save account.');

  await writeFinanceAuditLog(
    input.id ? 'ACCOUNT_UPDATED' : 'ACCOUNT_CREATED',
    String(result.data.id),
    ctx.userId,
    { accountCode, accountType, allowPosting },
    'account',
  );

  const saved = normalizeFinanceAccountRecord(result.data as Row);
  const allAccounts = await loadFinanceAccounts(ctx.organizationId);
  return buildFinanceAccountApiRow(saved, allAccounts.some((account) => account.id === saved.id) ? allAccounts : [...allAccounts, saved]);
}

export async function canDeleteFinanceAccount(organizationId: string, accountId: string) {
  const service = financeService();
  const account = await loadFinanceAccountById(organizationId, accountId);
  if (!account) throw new Error('Account not found.');

  const childResult = await service
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('parent_id', accountId);
  if (childResult.error && !isMissingFinanceTable(childResult.error)) throw childResult.error;
  if ((childResult.count ?? 0) > 0) {
    return { allowed: false, reason: 'Account has child accounts.' };
  }

  const historyChecks = await Promise.allSettled([
    service.from('journal_entry_lines').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
    service.from('opening_account_balances').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
    service.from('sales_posting_account_mappings').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
    service.from('erp_account_mappings').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
  ]);

  for (const result of historyChecks) {
    if (result.status === 'rejected') {
      const message = financeErrorMessage(result.reason);
      if (!message.includes('Could not find the table')) throw result.reason;
      continue;
    }

    if (result.value.error && !isMissingFinanceTable(result.value.error)) throw result.value.error;
    if ((result.value.count ?? 0) > 0) {
      return { allowed: false, reason: 'Account has posting history and cannot be deleted.' };
    }
  }

  return { allowed: true as const };
}

export type ResolveFinancePostingAccountOptions = {
  branchId?: string | null;
  fallbackAccountCode?: string | null;
  itemCategoryId?: string | null;
  transactionType?: string | null;
};

function buildFinanceMappingErrorContext(options?: ResolveFinancePostingAccountOptions) {
  const parts = [
    options?.branchId ? `branch ${options.branchId}` : null,
    options?.itemCategoryId ? `item category ${options.itemCategoryId}` : null,
    options?.transactionType ? `transaction type ${options.transactionType}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? ` for ${parts.join(', ')}` : '';
}

export async function resolveFinancePostingAccount(
  organizationId: string,
  mappingKey: string,
  options?: ResolveFinancePostingAccountOptions,
) {
  const service = financeService();
  const branchId = options?.branchId ?? null;
  const mappingResult = await service
    .from('erp_account_mappings')
    .select('id, account_id, branch_id, is_active, accounts!inner(id, organization_id, code, name, type, parent_id, is_active, balance, description, allow_posting, normal_balance)')
    .eq('organization_id', organizationId)
    .eq('mapping_key', mappingKey)
    .eq('is_active', true);

  if (!mappingResult.error) {
    const candidates = (mappingResult.data ?? []) as Array<Row>;
    const branchMatch = candidates.find((candidate) => String(candidate.branch_id ?? '') === String(branchId ?? ''));
    const fallbackMatch = candidates.find((candidate) => !candidate.branch_id);
    const selected = branchMatch ?? fallbackMatch ?? null;
    if (selected) {
      const account = normalizeFinanceAccountRecord(
        Array.isArray(selected.accounts) ? (selected.accounts[0] as Row) : (selected.accounts as Row),
      );
      const postingError = canFinanceAccountReceivePosting(account);
      if (postingError) throw new Error(postingError);
      return account;
    }
  } else if (!isMissingFinanceTable(mappingResult.error)) {
    throw mappingResult.error;
  }

  if (!options?.fallbackAccountCode) {
    throw new Error(`Missing active account mapping for ${mappingKey}${buildFinanceMappingErrorContext(options)}.`);
  }

  const fallbackAccounts = await loadFinanceAccounts(organizationId);
  const account = fallbackAccounts.find((candidate) => candidate.accountCode === options.fallbackAccountCode);
  if (!account) {
    throw new Error(`Fallback account ${options.fallbackAccountCode} was not found.`);
  }

  const postingError = canFinanceAccountReceivePosting(account);
  if (postingError) throw new Error(postingError);
  return account;
}

export async function loadFinanceCostCentres(organizationId: string) {
  const service = financeService();
  const result = await service
    .from('cost_centres')
    .select('id, organization_id, code, name, branch_id, parent_id, is_active, created_at, updated_at')
    .eq('organization_id', organizationId)
    .order('code', { ascending: true });

  if (result.error) {
    if (isMissingFinanceTable(result.error)) return [];
    throw result.error;
  }

  return (result.data ?? []) as Row[];
}

export async function resolveFinanceCostCentreCode(
  organizationId: string,
  options?: {
    allowNull?: boolean;
    branchId?: string | null;
    explicitCostCenterCode?: string | null;
    preferredCodes?: string[];
  },
) {
  const explicitCostCenterCode = String(options?.explicitCostCenterCode ?? '').trim().toUpperCase();
  const preferredCodes = (options?.preferredCodes ?? [])
    .map((code) => String(code ?? '').trim().toUpperCase())
    .filter(Boolean);
  const branchId = options?.branchId ?? null;
  const costCentres = await loadFinanceCostCentres(organizationId);
  const activeCentres = costCentres.filter((row) => row.is_active !== false);

  const findByCode = (code: string) =>
    activeCentres.find((row) => String(row.code ?? '').trim().toUpperCase() === code) ?? null;

  if (explicitCostCenterCode) {
    const explicit = findByCode(explicitCostCenterCode);
    if (!explicit) {
      throw new Error(`Cost centre ${explicitCostCenterCode} is not configured or inactive.`);
    }
    if (
      branchId &&
      explicit.branch_id &&
      String(explicit.branch_id) !== String(branchId)
    ) {
      throw new Error(`Cost centre ${explicitCostCenterCode} does not belong to branch ${branchId}.`);
    }
    return explicitCostCenterCode;
  }

  if (branchId) {
    const branchCentre = activeCentres.find((row) => String(row.branch_id ?? '') === String(branchId)) ?? null;
    if (branchCentre?.code) {
      return String(branchCentre.code).trim().toUpperCase();
    }
  }

  for (const code of preferredCodes) {
    const preferred = findByCode(code);
    if (preferred?.code) {
      return String(preferred.code).trim().toUpperCase();
    }
  }

  if (options?.allowNull === true) {
    return null;
  }

  const preferredLabel = preferredCodes.length > 0 ? ` (${preferredCodes.join(', ')})` : '';
  throw new Error(`No active cost centre mapping is configured${preferredLabel}.`);
}

export async function syncBranchCostCentres(organizationId: string) {
  const service = financeService();
  let branchesResult = await service
    .from('branches')
    .select('id, code, name, status, deleted_at')
    .eq('organization_id', organizationId)
    .eq('status', 'ACTIVE')
    .is('deleted_at', null);

  if (
    branchesResult.error &&
    (
      isMissingFinanceColumn(branchesResult.error, 'branches', 'status') ||
      isMissingFinanceColumn(branchesResult.error, 'branches', 'deleted_at')
    )
  ) {
    branchesResult = await service
      .from('branches')
      .select('id, code, name, is_active')
      .eq('organization_id', organizationId)
      .eq('is_active', true) as typeof branchesResult;
  }

  const costCentresResult = await service
    .from('cost_centres')
    .select('id, code, branch_id, is_active')
    .eq('organization_id', organizationId);

  if (branchesResult.error) throw branchesResult.error;
  if (costCentresResult.error) {
    if (isMissingFinanceTable(costCentresResult.error)) return [];
    throw costCentresResult.error;
  }

  const existingByBranchId = new Map(
    ((costCentresResult.data ?? []) as Row[])
      .filter((row) => row.branch_id)
      .map((row) => [String(row.branch_id), row] as const),
  );

  const branchDefinitions = buildBranchCostCentreDefinitions((branchesResult.data ?? []) as Array<{ code?: string | null; id: string; name?: string | null }>);
  const upserts = branchDefinitions.map((definition) => ({
    branch_id: definition.branchId,
    code: definition.code,
    created_at: new Date().toISOString(),
    is_active: true,
    name: definition.name,
    organization_id: organizationId,
    parent_id: null,
    updated_at: new Date().toISOString(),
    id: existingByBranchId.get(definition.branchId)?.id,
  }));

  if (upserts.length === 0) return [];

  const upsertResult = await service
    .from('cost_centres')
    .upsert(upserts, { onConflict: 'id' })
    .select('id, organization_id, code, name, branch_id, parent_id, is_active, created_at, updated_at');

  if (upsertResult.error) throw upsertResult.error;
  return (upsertResult.data ?? []) as Row[];
}

export async function loadFinanceMetaResources(organizationId: string) {
  const service = financeService();
  const [accounts, branches, cashAccounts, bankAccounts, costCentres, fiscalPeriods, currencies] = await Promise.all([
    loadFinanceAccounts(organizationId, { activeStatus: 'active' }),
    service.from('branches').select('id, code, name, status, deleted_at').eq('organization_id', organizationId).order('name', { ascending: true }),
    service.from('cash_accounts').select('id, name, account_name, branch_id, balance, current_balance').eq('organization_id', organizationId).order('name', { ascending: true }),
    service.from('bank_accounts').select('id, account_name, account_number, bank_name, current_balance').eq('organization_id', organizationId).order('account_name', { ascending: true }),
    loadFinanceCostCentres(organizationId).catch((error) => {
      if (isMissingFinanceTable(error)) return [] as Row[];
      throw error;
    }),
    service.from('fiscal_periods').select('id, period_name, start_date, end_date, status, is_locked').eq('organization_id', organizationId).order('start_date', { ascending: false }),
    service.from('currencies').select('id, code, name, exchange_rate, is_active').eq('organization_id', organizationId).order('code', { ascending: true }),
  ]);

  if (branches.error) throw branches.error;
  if (cashAccounts.error && !isMissingFinanceTable(cashAccounts.error)) throw cashAccounts.error;
  if (bankAccounts.error && !isMissingFinanceTable(bankAccounts.error)) throw bankAccounts.error;
  if (fiscalPeriods.error && !isMissingFinanceTable(fiscalPeriods.error)) throw fiscalPeriods.error;
  if (currencies.error && !isMissingFinanceTable(currencies.error)) throw currencies.error;

  return {
    accounts: accounts
      .map((account) => buildFinanceAccountApiRow(account, accounts))
      .filter((account) => Boolean(account.allowPosting) && account.is_active !== false),
    bankAccounts: ((bankAccounts.data ?? []) as Row[]).map((row) => ({
      accountName: String(row.account_name ?? ''),
      accountNumber: String(row.account_number ?? ''),
      bankName: String(row.bank_name ?? ''),
      currentBalance: toNumber(row.current_balance),
      id: String(row.id ?? ''),
    })),
    branches: ((branches.data ?? []) as Row[])
      .filter((row) => !row.deleted_at)
      .filter((row) => String(row.status ?? 'ACTIVE').toUpperCase() !== 'INACTIVE')
      .map((row) => ({
        code: String(row.code ?? ''),
        id: String(row.id ?? ''),
        name: String(row.name ?? row.code ?? ''),
      })),
    cashAccounts: ((cashAccounts.data ?? []) as Row[]).map((row) => ({
      balance: toNumber(row.current_balance ?? row.balance),
      branchId: row.branch_id ? String(row.branch_id) : null,
      id: String(row.id ?? ''),
      name: String(row.name ?? row.account_name ?? ''),
    })),
    costCentres: costCentres.map((row) => ({
      branchId: row.branch_id ? String(row.branch_id) : null,
      code: String(row.code ?? ''),
      id: String(row.id ?? ''),
      isActive: row.is_active !== false,
      name: String(row.name ?? ''),
      parentId: row.parent_id ? String(row.parent_id) : null,
    })),
    currencies: ((currencies.data ?? []) as Row[]).map((row) => ({
      code: String(row.code ?? ''),
      exchangeRate: toNumber(row.exchange_rate ?? 1),
      id: String(row.id ?? ''),
      isActive: row.is_active !== false,
      name: String(row.name ?? row.code ?? ''),
    })),
    fiscalPeriods: ((fiscalPeriods.data ?? []) as Row[]).map((row) => ({
      endDate: String(row.end_date ?? ''),
      id: String(row.id ?? ''),
      isLocked: row.is_locked === true,
      periodName: String(row.period_name ?? ''),
      startDate: String(row.start_date ?? ''),
      status: String(row.status ?? ''),
    })),
  };
}

export function getFinanceModuleDefaultCostCentreCodes(moduleName: string | null | undefined) {
  const normalized = String(moduleName ?? '').trim().toUpperCase();
  const defaults = new Set(DEFAULT_FINANCE_COST_CENTRES.map((centre) => centre.code));

  switch (normalized) {
    case 'PROCUREMENT':
      return defaults.has('PROCUREMENT') ? ['PROCUREMENT'] : [];
    case 'PRODUCTION':
      return defaults.has('FACTORY') ? ['FACTORY'] : [];
    case 'STORES':
    case 'INVENTORY':
      return defaults.has('STORES') ? ['STORES'] : [];
    case 'SALES':
      return defaults.has('SALES') ? ['SALES'] : [];
    case 'DISPATCH':
      return defaults.has('DISPATCH') ? ['DISPATCH'] : [];
    case 'FINANCE':
      return defaults.has('FINANCE') ? ['FINANCE'] : [];
    default:
      return [];
  }
}

export async function findOpenFiscalPeriod(organizationId: string, effectiveDate: string) {
  const service = financeService();
  const result = await service
    .from('fiscal_periods')
    .select('id, period_name, start_date, end_date, status, is_locked')
    .eq('organization_id', organizationId)
    .lte('start_date', effectiveDate)
    .gte('end_date', effectiveDate)
    .maybeSingle();

  if (result.error) {
    if (isMissingFinanceTable(result.error)) return null;
    throw result.error;
  }

  const period = result.data as Row | null;
  if (!period) return null;
  const status = String(period.status ?? '').toUpperCase();
  if (status !== 'OPEN' || period.is_locked === true) return null;
  return period;
}

export async function listFinanceOpeningBalances(organizationId: string) {
  const service = financeService();
  const result = await service
    .from('opening_account_balances')
    .select('id, organization_id, account_id, debit_amount, credit_amount, reference, remarks, posting_status, posted_at, posted_by, journal_entry_id, effective_date, branch_id, cost_center_code, currency_code, fiscal_period_id, notes, created_at, accounts(code, name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (result.error) {
    if (isMissingFinanceTable(result.error)) return [];
    throw result.error;
  }

  return ((result.data ?? []) as Row[]).map((row) => {
    const account = Array.isArray(row.accounts) ? (row.accounts[0] as Row | undefined) : (row.accounts as Row | undefined);
    return {
      accountCode: String(account?.code ?? ''),
      accountId: String(row.account_id ?? ''),
      accountName: String(account?.name ?? ''),
      branchId: row.branch_id ? String(row.branch_id) : null,
      costCenterCode: row.cost_center_code ? String(row.cost_center_code) : null,
      createdAt: String(row.created_at ?? ''),
      creditAmount: toNumber(row.credit_amount),
      currencyCode: row.currency_code ? String(row.currency_code) : 'USD',
      debitAmount: toNumber(row.debit_amount),
      effectiveDate: String(row.effective_date ?? ''),
      fiscalPeriodId: row.fiscal_period_id ? String(row.fiscal_period_id) : null,
      id: String(row.id ?? ''),
      journalEntryId: row.journal_entry_id ? String(row.journal_entry_id) : null,
      notes: row.notes ? String(row.notes) : row.remarks ? String(row.remarks) : null,
      postedAt: row.posted_at ? String(row.posted_at) : null,
      postingStatus: String(row.posting_status ?? 'DRAFT'),
      reference: row.reference ? String(row.reference) : null,
    };
  });
}

export async function createFinanceOpeningBalanceDraft(
  ctx: AuthContext,
  body: {
    accountId: string;
    branchId?: string | null;
    costCenterCode?: string | null;
    creditAmount?: number;
    currencyCode?: string | null;
    debitAmount?: number;
    effectiveDate?: string | null;
    notes?: string | null;
    reference?: string | null;
  },
) {
  const account = await ensureFinanceAccountCanBePosted(ctx.organizationId, body.accountId);
  const effectiveDate = String(body.effectiveDate ?? '').trim();
  if (!effectiveDate) throw new Error('effectiveDate is required.');

  const period = await findOpenFiscalPeriod(ctx.organizationId, effectiveDate);
  if (!period) {
    throw new Error(`No open fiscal period exists for ${effectiveDate}.`);
  }

  const debitAmount = toNumber(body.debitAmount, 0);
  const creditAmount = toNumber(body.creditAmount, 0);
  if (debitAmount <= 0 && creditAmount <= 0) {
    throw new Error('Opening balance line must include a debit or credit amount greater than zero.');
  }
  if (debitAmount > 0 && creditAmount > 0) {
    throw new Error('Opening balance line cannot include both debit and credit values.');
  }

  const service = financeService();
  let duplicateQuery = service
    .from('opening_account_balances')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .eq('account_id', body.accountId)
    .eq('effective_date', effectiveDate)
    .in('posting_status', ['DRAFT', 'POSTED'])
    .limit(1);

  duplicateQuery = body.branchId ? duplicateQuery.eq('branch_id', body.branchId) : duplicateQuery.is('branch_id', null);
  duplicateQuery = body.costCenterCode ? duplicateQuery.eq('cost_center_code', body.costCenterCode) : duplicateQuery.is('cost_center_code', null);
  duplicateQuery = body.reference ? duplicateQuery.eq('reference', body.reference) : duplicateQuery.is('reference', null);

  const duplicateResult = await duplicateQuery;

  if (duplicateResult.error && !isMissingFinanceColumn(duplicateResult.error, 'opening_account_balances', 'effective_date')) {
    throw duplicateResult.error;
  }
  if ((duplicateResult.data ?? []).length > 0) {
    throw new Error('Duplicate opening balance line blocked for this account, date, branch, cost centre, and reference.');
  }

  const payload = {
    account_id: body.accountId,
    branch_id: body.branchId ?? null,
    cost_center_code: body.costCenterCode ?? null,
    created_by: ctx.userId,
    credit_amount: creditAmount,
    currency_code: body.currencyCode ?? 'USD',
    debit_amount: debitAmount,
    effective_date: effectiveDate,
    fiscal_period_id: String(period.id ?? ''),
    notes: body.notes?.trim() || null,
    organization_id: ctx.organizationId,
    posting_status: 'DRAFT',
    reference: body.reference?.trim() || null,
    remarks: body.notes?.trim() || null,
    updated_by: ctx.userId,
  };

  let insertResult = await service
    .from('opening_account_balances')
    .insert(payload)
    .select('*')
    .single();

  if (
    insertResult.error &&
    (
      isMissingFinanceColumn(insertResult.error, 'opening_account_balances', 'branch_id') ||
      isMissingFinanceColumn(insertResult.error, 'opening_account_balances', 'cost_center_code') ||
      isMissingFinanceColumn(insertResult.error, 'opening_account_balances', 'currency_code') ||
      isMissingFinanceColumn(insertResult.error, 'opening_account_balances', 'effective_date') ||
      isMissingFinanceColumn(insertResult.error, 'opening_account_balances', 'fiscal_period_id') ||
      isMissingFinanceColumn(insertResult.error, 'opening_account_balances', 'notes')
    )
  ) {
    insertResult = await service
      .from('opening_account_balances')
      .insert({
        account_id: body.accountId,
        created_by: ctx.userId,
        credit_amount: creditAmount,
        debit_amount: debitAmount,
        organization_id: ctx.organizationId,
        reference: body.reference?.trim() || null,
        remarks: body.notes?.trim() || null,
        updated_by: ctx.userId,
      })
      .select('*')
      .single() as typeof insertResult;
  }

  if (insertResult.error || !insertResult.data) {
    throw insertResult.error ?? new Error('Failed to create opening balance line.');
  }

  await writeFinanceAuditLog(
    'OPENING_BALANCE_DRAFT_CREATED',
    String(insertResult.data.id),
    ctx.userId,
    { accountCode: account.accountCode, effectiveDate },
    'opening_balance',
  );

  return insertResult.data as Row;
}

export async function postFinanceOpeningBalanceDrafts(
  ctx: AuthContext,
  options?: {
    effectiveDate?: string | null;
  },
) {
  const service = financeService();
  let query = service
    .from('opening_account_balances')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .eq('posting_status', 'DRAFT')
    .order('created_at', { ascending: true });

  if (options?.effectiveDate) {
    query = query.eq('effective_date', options.effectiveDate);
  }

  const result = await query;
  if (result.error) {
    if (isMissingFinanceTable(result.error)) {
      return { journalEntryId: null, postedRows: 0 };
    }
    throw result.error;
  }

  const rows = (result.data ?? []) as Row[];
  if (rows.length === 0) {
    throw new Error('No draft opening balances were found.');
  }

  const balanceError = validateOpeningBalanceDraftLines(rows.map((row) => ({
    accountId: String(row.account_id ?? ''),
    creditAmount: toNumber(row.credit_amount),
    debitAmount: toNumber(row.debit_amount),
  })));
  if (balanceError) throw new Error(balanceError);

  const effectiveDates = [...new Set(rows.map((row) => String(row.effective_date ?? '').trim()).filter(Boolean))];
  if (effectiveDates.length !== 1) {
    throw new Error('Draft opening balances must share one effective date before posting.');
  }

  const effectiveDate = effectiveDates[0]!;
  const period = await findOpenFiscalPeriod(ctx.organizationId, effectiveDate);
  if (!period) throw new Error(`No open fiscal period exists for ${effectiveDate}.`);

  for (const row of rows) {
    await ensureFinanceAccountCanBePosted(ctx.organizationId, String(row.account_id ?? ''));
  }

  const totalDebit = rows.reduce((sum, row) => sum + toNumber(row.debit_amount), 0);
  const totalCredit = rows.reduce((sum, row) => sum + toNumber(row.credit_amount), 0);
  const existingCount = await service
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.organizationId);
  if (existingCount.error) throw existingCount.error;

  const entryNumber = `OPEN-${effectiveDate.replace(/-/g, '')}-${String((existingCount.count ?? 0) + 1).padStart(4, '0')}`;
  const entryInsert = await service
    .from('journal_entries')
    .insert({
      organization_id: ctx.organizationId,
      entry_number: entryNumber,
      entry_date: effectiveDate,
      description: `Opening balances for ${effectiveDate}`,
      reference_type: 'opening_balance',
      reference_id: effectiveDate,
      status: 'APPROVED',
      is_posted: true,
      posted_by: ctx.userId,
      posted_at: new Date().toISOString(),
      created_by: ctx.userId,
      total_debit: totalDebit,
      total_credit: totalCredit,
    })
    .select('id')
    .single();

  if (entryInsert.error) throw entryInsert.error;

  const journalEntryId = String(entryInsert.data.id);
  const lineInsert = await service
    .from('journal_entry_lines')
    .insert(rows.map((row) => ({
      journal_entry_id: journalEntryId,
      account_id: row.account_id,
      branch_id: row.branch_id ?? null,
      cost_center_code: row.cost_center_code ?? null,
      description: row.notes ?? row.remarks ?? row.reference ?? 'Opening balance',
      debit_amount: toNumber(row.debit_amount),
      credit_amount: toNumber(row.credit_amount),
    })));

  if (lineInsert.error) throw lineInsert.error;

  const rowIds = rows.map((row) => String(row.id));
  const updateResult = await service
    .from('opening_account_balances')
    .update({
      fiscal_period_id: String(period.id ?? ''),
      journal_entry_id: journalEntryId,
      posted_at: new Date().toISOString(),
      posted_by: ctx.userId,
      posting_status: 'POSTED',
      updated_by: ctx.userId,
    })
    .in('id', rowIds);
  if (updateResult.error) throw updateResult.error;

  await writeFinanceAuditLog(
    'OPENING_BALANCE_POSTED',
    journalEntryId,
    ctx.userId,
    { effectiveDate, postedRows: rows.length },
    'journal_entry',
  );

  return { journalEntryId, postedRows: rows.length };
}
