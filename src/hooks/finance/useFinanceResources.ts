'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

function useFinanceQuery<T>(key: string, path: string) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['finance', key, userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<T>(path, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useJournalEntries() {
  return useFinanceQuery<{ data: Array<Record<string, unknown>>; pagination: { page: number; pageSize: number; total: number } }>(
    'journals',
    `${API_ROUTES.FINANCE.JOURNAL_ENTRIES}?page=1&pageSize=50`,
  );
}

export function useBankAccounts() {
  return useFinanceQuery<Array<Record<string, unknown>>>('bank-accounts', '/api/finance/bank-accounts');
}

export function useCashAccounts() {
  return useFinanceQuery<Array<Record<string, unknown>>>('cash-accounts', '/api/finance/cash-accounts');
}

export function useChartOfAccounts() {
  return useFinanceQuery<Array<Record<string, unknown>>>('chart-of-accounts', '/api/finance/chart-of-accounts');
}

export function useFiscalPeriods() {
  return useFinanceQuery<Array<Record<string, unknown>>>('fiscal-periods', '/api/finance/fiscal-periods');
}

export function usePettyCashRequests() {
  return useFinanceQuery<Array<Record<string, unknown>>>('petty-cash', '/api/finance/petty-cash');
}

export function useFinanceExpenses() {
  return useFinanceQuery<Array<Record<string, unknown>>>('expenses', '/api/finance/expenses');
}

export function useBudgets() {
  return useFinanceQuery<Array<Record<string, unknown>>>('budgets', '/api/finance/budgets');
}

export function useFixedAssets() {
  return useFinanceQuery<Array<Record<string, unknown>>>('fixed-assets', '/api/finance/fixed-assets');
}

export function useTaxCodes() {
  return useFinanceQuery<Array<Record<string, unknown>>>('tax-codes', '/api/finance/tax-codes');
}

export function useAccountsReceivable() {
  return useFinanceQuery<Array<Record<string, unknown>>>('accounts-receivable', '/api/finance/accounts-receivable');
}

export function useAccountsPayable() {
  return useFinanceQuery<Array<Record<string, unknown>>>('accounts-payable', '/api/finance/accounts-payable');
}

export function useFinanceReport(path: string) {
  return useFinanceQuery<Array<Record<string, unknown>>>(`report:${path}`, path);
}
