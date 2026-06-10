'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/shared';

import { type PaginatedResponse, type SupplierHistoryRow } from './types';
import { buildProcurementQuery, useProcurementRequest } from './useProcurementRequest';

export function useSupplierPurchaseHistory(
  id: string | undefined,
  tab: 'grns' | 'payments' | 'purchase_orders' | 'returns',
  page: number,
) {
  const { isLoaded, isSignedIn } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'supplier-history', id, tab, page],
    queryFn: () =>
      request<PaginatedResponse<SupplierHistoryRow>>(
        `${API_ROUTES.SUPPLIER_PURCHASE_HISTORY(id ?? '')}${buildProcurementQuery({
          page,
          pageSize: 10,
          tab
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(id)
  });
}


