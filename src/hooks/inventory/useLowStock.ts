'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type LowStockRow } from './types';
import { useInventoryRequest } from './useInventoryRequest';

export function useLowStock() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'low-stock', userId],
    queryFn: () => request<LowStockRow[]>('/api/inventory/low-stock'),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


