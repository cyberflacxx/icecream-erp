'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type ItemsFilters, type InventoryItemRow, type PaginatedResponse } from './types';
import { buildInventoryQuery, useInventoryRequest } from './useInventoryRequest';

export function useItems(filters: ItemsFilters) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'items', userId, filters],
    queryFn: () =>
      request<PaginatedResponse<InventoryItemRow>>(
        `/api/inventory/items${buildInventoryQuery({
          category: filters.category,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          search: filters.search,
          status: filters.status,
          type: filters.type
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


