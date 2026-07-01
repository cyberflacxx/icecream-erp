'use client';

import { useInventoryMutation } from './useInventoryRequest';

export interface CreateItemPayload {
  categoryId?: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  itemType: string;
  name: string;
  reorderLevel?: number;
  reorderQuantity?: number;
  sellingPrice?: number;
  trackExpiry: boolean;
  unitCost?: number;
  unitOfMeasureId: string;
}

export interface CreateTransferPayload {
  destinationWarehouseId?: string;
  fromWarehouseId: string;
  items: Array<{
    batchNumber?: string | null;
    itemId: string;
    quantity: number;
  }>;
  notes?: string | null;
  referenceNumber?: string;
  remarks?: string | null;
  sourceWarehouseId?: string;
  status?: string;
  transferDate?: string;
  toWarehouseId: string;
}

export interface CreateWarehousePayload {
  address?: string | null;
  branchId?: string | null;
  code: string;
  isActive: boolean;
  name: string;
  type: string;
}

export function useCreateItem() {
  return useInventoryMutation<unknown, CreateItemPayload>('/api/inventory/items');
}

export function useCreateTransfer() {
  return useInventoryMutation<unknown, CreateTransferPayload>('/api/inventory/transfers');
}

export function useCreateWarehouse() {
  return useInventoryMutation<unknown, CreateWarehousePayload>('/api/inventory/warehouses');
}
