'use client';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface InventoryCategoryOption {
  id: string;
  name: string;
}

export interface InventoryBranchOption {
  id: string;
  code: string;
  name: string;
}

export interface InventoryWarehouseOption {
  id: string;
  code: string;
  name: string;
  branchId: string | null;
  type: string;
}

export interface InventoryItemOption {
  id: string;
  code: string;
  name: string;
  itemType: string;
  isActive: boolean;
}

export interface InventoryUnitOption {
  id: string;
  abbreviation: string;
  name: string;
}

export interface InventoryMetaResponse {
  branches: InventoryBranchOption[];
  categories: InventoryCategoryOption[];
  items: InventoryItemOption[];
  unitsOfMeasure: InventoryUnitOption[];
  warehouses: InventoryWarehouseOption[];
}

export interface InventoryItemRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  itemType: string;
  isActive: boolean;
  reorderLevel: number;
  reorderQuantity: number;
  sellingPrice: number;
  stock: number;
  trackExpiry: boolean;
  unitCost: number;
  category: {
    id: string;
    name: string;
  };
  unitOfMeasure: {
    id: string;
    abbreviation: string;
    name: string;
  };
}

export interface StockBalanceRow {
  id: string;
  item: {
    id: string;
    code: string;
    name: string;
    itemType: string;
    reorderLevel: number;
    unitOfMeasure: {
      id: string;
      abbreviation: string;
      name: string;
    };
  };
  lastUpdated: string;
  quantityAvailable: number;
  quantityOnHand: number;
  quantityReserved: number;
  warehouse: {
    id: string;
    code: string;
    name: string;
    branch: {
      id: string;
      name: string;
    } | null;
  };
}

export interface StockMovementRow {
  id: string;
  date: string;
  item: {
    id: string;
    code: string;
    name: string;
  };
  warehouse: {
    id: string;
    name: string;
  };
  type: string;
  quantity: number;
  runningBalance: number;
  unitCost: number;
  totalCost: number;
  reference: {
    id: string;
    type: string;
  };
  createdBy: {
    id: string;
    name: string;
  } | null;
  notes: string | null;
}

export interface StockTransferRow {
  id: string;
  transferNumber: string;
  fromWarehouse: {
    id: string;
    name: string;
  };
  toWarehouse: {
    id: string;
    name: string;
  };
  transferDate: string;
  status: string;
  itemsCount: number;
  notes: string | null;
}

export interface WarehouseCard {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  branch: {
    id: string;
    name: string;
  } | null;
  itemCount: number;
  totalValue: number;
}

export interface LowStockRow {
  id: string;
  item: {
    id: string;
    code: string;
    name: string;
    reorderLevel: number;
  };
  quantityAvailable: number;
  quantityOnHand: number;
  quantityReserved: number;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
}

export interface ExpiringBatchRow {
  id: string;
  batchNumber: string;
  expiryDate: string | null;
  item: {
    id: string;
    code: string;
    name: string;
  };
  quantityRemaining: number;
  status: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
}

export interface ItemsFilters {
  category?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'active' | 'inactive';
  type?: string;
}

export interface StockBalancesFilters {
  itemId?: string;
  itemType?: string;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
  warehouseId?: string;
}

export interface StockMovementsFilters {
  endDate?: string;
  itemId?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  type?: string;
  warehouseId?: string;
}

export interface TransfersFilters {
  fromWarehouseId?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  toWarehouseId?: string;
}
