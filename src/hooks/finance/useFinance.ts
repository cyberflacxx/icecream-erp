'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export interface FinanceDashboardResponse {
  stats: {
    revenue: number;
    payments: number;
    outstandingReceivables: number;
    outstandingPayables: number;
  };
  charts: {
    cashflowLast7Days: Array<{
      day: string;
      revenue: number;
      expenses: number;
    }>;
    paymentMethodBreakdown: Array<{
      method: string;
      total: number;
    }>;
  };
  overdueInvoices: Array<{
    balance: number;
    customer: string;
    dueDate: string;
    invoiceNumber: string;
    status: string;
  }>;
  recentEntries: Array<{
    credit: number;
    debit: number;
    description: string;
    entryDate: string;
    entryNumber: string;
  }>;
}

export function useFinanceDashboard() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['finance', 'dashboard', userId],
    queryFn: async () => {
      const token = await getToken();

      return apiFetch<FinanceDashboardResponse>(API_ROUTES.FINANCE.DASHBOARD, {
        token
      });
    },
    enabled: isLoaded && Boolean(isSignedIn)
  });
}
