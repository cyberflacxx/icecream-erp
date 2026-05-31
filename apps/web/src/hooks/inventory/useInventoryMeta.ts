'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type InventoryMetaResponse } from './types';
import { buildInventoryQuery, useInventoryRequest } from './useInventoryRequest';

interface InventoryMetaFilters {
  includeInactiveItems?: boolean;
}

export function useInventoryMeta(filters: InventoryMetaFilters = {}) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'meta', userId, filters],
    queryFn: () =>
      request<InventoryMetaResponse>(
        `/api/inventory/meta${buildInventoryQuery({
          includeInactiveItems: filters.includeInactiveItems
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


