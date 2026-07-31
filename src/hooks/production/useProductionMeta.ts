'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

export type ProductionMetaItem = Record<string, unknown> & {
  id: string;
  itemType: string;
  name: string;
  unitCost: number;
  unitOfMeasureId: string | null;
};

export type ProductionMetaRecipe = Record<string, unknown> & {
  expectedOutputQuantity: number;
  finishedItemId: string | null;
  id: string;
  ingredients: Array<Record<string, unknown>>;
  name: string;
  outputUnitId: string | null;
  packagingItems: Array<Record<string, unknown>>;
};

export type ProductionMetaWarehouse = Record<string, unknown> & {
  id: string;
  isMainWarehouse?: boolean;
  isProductionFinishedWarehouse?: boolean;
  isProductionMaterialWarehouse?: boolean;
  isProductionWarehouse: boolean;
  name: string;
  productionRole?: string | null;
  warehouseType?: string | null;
};

export type ProductionMetaResponse = {
  branches: Array<Record<string, unknown> & {
    code?: string | null;
    id: string;
    name: string;
    status?: string | null;
  }>;
  categories: Array<Record<string, unknown>>;
  chocolateTypes: Array<Record<string, unknown>>;
  employees: Array<Record<string, unknown>>;
  finishedGoods: ProductionMetaItem[];
  flavours: Array<Record<string, unknown>>;
  items: ProductionMetaItem[];
  mainWarehouses?: ProductionMetaWarehouse[];
  packagingItems: ProductionMetaItem[];
  products?: Array<Record<string, unknown>>;
  productionFinishedWarehouses?: ProductionMetaWarehouse[];
  productionMaterialWarehouses?: ProductionMetaWarehouse[];
  productionCategories: Array<{ label: string; value: string }>;
  rawMaterials: ProductionMetaItem[];
  recipes: ProductionMetaRecipe[];
  stockByItemId: Record<string, number>;
  stockByItemWarehouse: Record<string, number>;
  unitsOfMeasure: Array<Record<string, unknown>>;
  warehouses: ProductionMetaWarehouse[];
};

export function useProductionMeta() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['production', 'meta', userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<ProductionMetaResponse>(API_ROUTES.PRODUCTION.META, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
