'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

export function useFinanceMutation<TData = unknown, TVariables = Record<string, unknown>>(
  path: string | ((variables: TVariables) => string),
  options: {
    invalidateKey?: string;
    method?: 'POST' | 'PATCH' | 'DELETE';
  } = {},
) {
  const { getToken } = useAppAuth();
  const queryClient = useQueryClient();
  const method = options.method ?? 'POST';

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const token = await getToken();
      const resolvedPath = typeof path === 'function' ? path(variables) : path;

      return apiFetch<TData>(resolvedPath, {
        body: method === 'DELETE' ? undefined : JSON.stringify(variables),
        method,
        token,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance'] });
      if (options.invalidateKey) {
        await queryClient.invalidateQueries({ queryKey: ['finance', options.invalidateKey] });
      }
    },
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

export function useBankTransactions() {
  return useFinanceQuery<Array<Record<string, unknown>>>('bank-transactions', API_ROUTES.FINANCE.BANK_TRANSACTIONS);
}

export function useCashTransactions() {
  return useFinanceQuery<Array<Record<string, unknown>>>('cash-transactions', API_ROUTES.FINANCE.CASH);
}

export function useFinanceMeta() {
  return useFinanceQuery<{
    accounts: Array<Record<string, unknown>>;
    bankAccounts: Array<Record<string, unknown>>;
    branches: Array<Record<string, unknown>>;
    cashAccounts: Array<Record<string, unknown>>;
  }>('meta', API_ROUTES.FINANCE.META);
}

export function useFinanceTransactions() {
  return useFinanceQuery<Array<Record<string, unknown>>>('transactions', API_ROUTES.FINANCE.TRANSACTIONS);
}

export function useFinanceReport<T = Array<Record<string, unknown>>>(path: string) {
  return useFinanceQuery<T>(`report:${path}`, path);
}
