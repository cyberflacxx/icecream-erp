'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type WarehouseCard } from './types';
import { useInventoryRequest } from './useInventoryRequest';

export function useWarehouses() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'warehouses', userId],
    queryFn: () => request<WarehouseCard[]>('/api/inventory/warehouses'),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


