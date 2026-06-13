'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';

interface SalesDashboardResponse {
  stats: {
    creditAlerts: string;
    overdueInvoices: string;
    pendingDispatches: string;
    stockAvailableForSale: string;
    todaySales: string;
  };
}

export function useSalesDashboard() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery<SalesDashboardResponse>({
    queryKey: ['sales', 'dashboard', userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<SalesDashboardResponse>('/api/sales/dashboard', { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
