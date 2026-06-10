'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/shared';

import { type PaginatedResponse, type StockMovementRow, type StockMovementsFilters } from './types';
import { buildInventoryQuery, useInventoryRequest } from './useInventoryRequest';

export function useStockMovements(filters: StockMovementsFilters) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'stock-movements', userId, filters],
    queryFn: () =>
      request<PaginatedResponse<StockMovementRow>>(
        `${API_ROUTES.INVENTORY.STOCK_MOVEMENTS}${buildInventoryQuery({
          endDate: filters.endDate,
          itemId: filters.itemId,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          startDate: filters.startDate,
          type: filters.type,
          warehouseId: filters.warehouseId
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


