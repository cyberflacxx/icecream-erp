'use client';

import { useQuery } from '@tanstack/react-query';

import { API_ROUTES } from '@/lib/shared';
import { useAppAuth } from '@/hooks/useAppAuth';

import { type GoodsReceivingStatusRow } from './types';
import { useProcurementRequest } from './useProcurementRequest';

export function useGoodsReceivingStatus() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'goods-receiving-status', userId],
    queryFn: () => request<GoodsReceivingStatusRow[]>(API_ROUTES.PROCUREMENT.GOODS_RECEIVING_STATUS),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
