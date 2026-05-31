'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type PaginatedResponse, type StockBalanceRow, type StockBalancesFilters } from './types';
import { buildInventoryQuery, useInventoryRequest } from './useInventoryRequest';

export function useStockBalances(filters: StockBalancesFilters) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'stock-balances', userId, filters],
    queryFn: () =>
      request<PaginatedResponse<StockBalanceRow>>(
        `/api/inventory/stock-balances${buildInventoryQuery({
          itemId: filters.itemId,
          itemType: filters.itemType,
          lowStock: filters.lowStock,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          warehouseId: filters.warehouseId
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


