'use client';

import { useQuery } from '@tanstack/react-query';

import { API_ROUTES } from '@/lib/shared';
import { useAppAuth } from '@/hooks/useAppAuth';

import { type InventoryApprovalRow } from './types';
import { buildInventoryQuery, useInventoryRequest } from './useInventoryRequest';

export function useInventoryApprovals(status = 'PENDING') {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'approvals', userId, status],
    queryFn: async () => {
      const response = await request<InventoryApprovalRow[] | { data?: InventoryApprovalRow[]; success?: boolean }>(
        `${API_ROUTES.INVENTORY.APPROVALS}${buildInventoryQuery({ status })}`,
      );

      return Array.isArray(response) ? response : response.data ?? [];
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
