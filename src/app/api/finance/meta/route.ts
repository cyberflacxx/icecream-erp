import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, isMissingFinanceTable, loadCashAccountsCompatibility } from '@/lib/finance-server';

type Row = Record<string, unknown>;

async function fetchRows(table: string, organizationId: string) {
  const result = await financeService().from(table).select('*');
  if (result.error) {
    if (isMissingFinanceTable(result.error)) return [] as Row[];
    throw result.error;
  }

  return ((result.data ?? []) as Row[]).filter((row) => {
    const rowOrganizationId = row.organization_id;
    return !rowOrganizationId || String(rowOrganizationId) === organizationId;
  });
}

function sortByName<T>(rows: T[]) {
  return rows.sort((a, b) =>
    String(
      (a as Row).accountName ??
        (a as Row).bankName ??
        (a as Row).account_name ??
        (a as Row).name ??
        (a as Row).account_code ??
        (a as Row).code ??
        '',
    ).localeCompare(
      String(
        (b as Row).accountName ??
          (b as Row).bankName ??
          (b as Row).account_name ??
          (b as Row).name ??
          (b as Row).account_code ??
          (b as Row).code ??
          '',
      ),
    ),
  );
}

function normalizeAccount(row: Row) {
  return {
    id: String(row.id),
    account_code: String(row.account_code ?? row.code ?? ''),
    account_name: String(row.account_name ?? row.name ?? ''),
    account_type: String(row.account_type ?? row.type ?? ''),
    is_active: row.is_active !== false,
  };
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const [accounts, bankAccounts, branches, cashAccounts] = await Promise.all([
      fetchRows('accounts', ctx.organizationId),
      fetchRows('bank_accounts', ctx.organizationId),
      fetchRows('branches', ctx.organizationId),
      loadCashAccountsCompatibility(ctx.organizationId, { routeName: 'finance.meta' }),
    ]);

    return NextResponse.json({
      accounts: sortByName(accounts.map(normalizeAccount).filter((row) => row.is_active)),
      bankAccounts: sortByName(
        bankAccounts
          .filter((row) => row.is_active !== false)
          .map((row) => ({
            id: String(row.id),
            accountName: String(row.account_name ?? row.name ?? ''),
            accountNumber: String(row.account_number ?? ''),
            bankName: String(row.bank_name ?? ''),
            currentBalance: Number(row.current_balance ?? row.balance ?? 0),
          })),
      ),
      branches: sortByName(
        branches.map((row) => ({
          code: String(row.code ?? ''),
          id: String(row.id),
          name: String(row.name ?? row.code ?? 'Unnamed branch'),
        })),
      ),
      cashAccounts: sortByName(
        cashAccounts
          .filter((row) => row.isActive !== false)
          .map((row) => ({
            branchId: row.branchId ? String(row.branchId) : null,
            id: String(row.id),
            name: String(row.name ?? row.accountName ?? ''),
            balance: Number(row.balance ?? row.currentBalance ?? 0),
          })),
      ),
    });
  } catch (error) {
    return serverError(financeErrorMessage(error) || 'Failed to load finance metadata.');
  }
}
