'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import {
  type PaginatedResponse,
  type PurchaseOrderFilters,
  type PurchaseOrderRow
} from './types';
import { buildProcurementQuery, useProcurementRequest } from './useProcurementRequest';

export function usePurchaseOrders(filters: PurchaseOrderFilters) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'purchase-orders', userId, filters],
    queryFn: () =>
      request<PaginatedResponse<PurchaseOrderRow>>(
        `/api/procurement/purchase-orders${buildProcurementQuery({
          endDate: filters.endDate,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          startDate: filters.startDate,
          status: filters.status,
          supplierId: filters.supplierId
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}

export function usePurchaseOrder(id: string | undefined) {
  const { isLoaded, isSignedIn } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'purchase-order', id],
    queryFn: () => request<unknown>(`/api/procurement/purchase-orders/${id}`),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(id)
  });
}


