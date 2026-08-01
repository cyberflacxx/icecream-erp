'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

export interface ItemSelectorOption {
  branchQuantity: number | null;
  categoryId: string | null;
  categoryName: string | null;
  code: string;
  currentInventoryCost: number | null;
  id: string;
  isActive: boolean;
  itemType: string;
  label: string;
  name: string;
  sellingPrice: number | null;
  unitAbbreviation: string | null;
  unitId: string | null;
  unitName: string | null;
  warehouseQuantity: number | null;
}

export interface UseItemSelectorOptionsInput {
  branchId?: string | null;
  category?: string | null;
  includeCost?: boolean;
  includeInactive?: boolean;
  includePrice?: boolean;
  includeStock?: boolean;
  itemType?: string | string[] | null;
  search?: string | null;
  warehouseId?: string | null;
}

export function useItemSelectorOptions(input: UseItemSelectorOptionsInput = {}) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['selectors', 'items', userId, input],
    queryFn: async () => {
      const token = await getToken();
      const searchParams = new URLSearchParams({
        selector: 'true',
      });

      if (input.branchId) searchParams.set('branch_id', input.branchId);
      if (input.category) searchParams.set('category', input.category);
      if (input.includeCost) searchParams.set('include_cost', 'true');
      if (input.includeInactive) searchParams.set('includeInactive', 'true');
      if (input.includePrice) searchParams.set('include_price', 'true');
      if (input.includeStock) searchParams.set('include_stock', 'true');
      if (input.search) searchParams.set('search', input.search);
      if (input.warehouseId) searchParams.set('warehouse_id', input.warehouseId);
      if (input.itemType) {
        searchParams.set('item_type', Array.isArray(input.itemType) ? input.itemType.join(',') : input.itemType);
      }

      const response = await apiFetch<{ data: ItemSelectorOption[] }>(`${API_ROUTES.ITEMS}?${searchParams.toString()}`, {
        token,
      });
      return response.data ?? [];
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
