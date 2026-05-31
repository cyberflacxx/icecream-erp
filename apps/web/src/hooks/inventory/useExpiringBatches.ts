'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type ExpiringBatchRow } from './types';
import { buildInventoryQuery, useInventoryRequest } from './useInventoryRequest';

export function useExpiringBatches(days = 30) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'expiring', userId, days],
    queryFn: () =>
      request<ExpiringBatchRow[]>(
        `/api/inventory/expiring${buildInventoryQuery({
          days
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


