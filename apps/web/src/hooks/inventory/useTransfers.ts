'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type PaginatedResponse, type StockTransferRow, type TransfersFilters } from './types';
import { buildInventoryQuery, useInventoryRequest } from './useInventoryRequest';

export function useTransfers(filters: TransfersFilters) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'transfers', userId, filters],
    queryFn: () =>
      request<PaginatedResponse<StockTransferRow>>(
        `/api/inventory/transfers${buildInventoryQuery({
          fromWarehouseId: filters.fromWarehouseId,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          status: filters.status,
          toWarehouseId: filters.toWarehouseId
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


