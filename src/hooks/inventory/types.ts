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

export interface InventoryDashboardMetrics {
  currentStockQuantity: number;
  damagedTodayQuantity: number;
  expiringSoonCount: number;
  finishedGoodsValue: number;
  lowStockCount: number;
  movedToProductionTodayQuantity: number;
  nonConsumablesValue: number;
  packagingMaterialValue: number;
  pendingApprovalsCount: number;
  rawMaterialValue: number;
  receivedTodayQuantity: number;
  returnedFromProductionTodayQuantity: number;
  supplierShortageCount: number;
  recentApprovals: Array<{
    approvalStatus: string;
    id: string;
    referenceNumber: string;
    requestDate: string;
    requestType: string;
    requestedBy: string | null;
  }>;
  stockBalanceByWarehouse: Array<{
    availableQuantity: number;
    isLowStock: boolean;
    itemCode: string;
    itemId: string;
    itemName: string;
    quantityOnHand: number;
    reorderLevel: number;
    warehouseCode: string;
    warehouseId: string;
    warehouseName: string;
  }>;
  todaysMovements: Array<{
    createdAt: string;
    id: string;
    itemName: string;
    movementType: string;
    notes: string | null;
    quantity: number;
    referenceId: string | null;
    referenceType: string | null;
    warehouseCode: string | null;
    warehouseName: string;
  }>;
  totalStockValue: number;
  wipValue: number;
}

export interface SupplierShortageRow {
  expectedResolutionDate: string | null;
  itemCode: string | null;
  itemId: string;
  itemName: string;
  orderedQuantity: number;
  poNumber: string;
  purchaseOrderId: string;
  receivedQuantity: number;
  shortageQuantity: number;
  status: 'OPEN' | 'RESOLVED';
  supplierId: string | null;
  supplierName: string;
}

export interface InventoryApprovalRow {
  id: string;
  entity_id: string;
  entity_type: string;
  current_step: number;
  status: string;
  requested_at: string;
  completed_at: string | null;
  actions: Array<{
    id: string;
    action: string;
    comments: string | null;
    acted_at: string;
  }>;
  approvalId?: string;
  approvalNotes?: string | null;
  approvalStatus?: string;
  canApprove?: boolean;
  currentApprover?: string | null;
  destinationWarehouseId?: string | null;
  itemDescription?: string;
  quantity?: number | null;
  referenceNumber?: string;
  requestDate?: string;
  requestedBy?: string | null;
  requesterId?: string | null;
  requestType?: string;
  sourceWarehouseId?: string | null;
}

export interface InventoryReportResponse<T> {
  data: T[];
  summary: Record<string, number | string | null>;
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
    reorderQuantity: number;
    unitCost: number;
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
  stockValue: number;
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
  postingDate?: string | null;
  movementNumber?: string | null;
  item: {
    id: string;
    code: string;
    name: string;
  };
  warehouse: {
    id: string;
    name: string;
  };
  sourceWarehouse?: {
    id: string;
    name: string;
  } | null;
  destinationWarehouse?: {
    id: string;
    name: string;
  } | null;
  type: string;
  quantity: number;
  quantityIn?: number;
  quantityOut?: number;
  runningBalance: number;
  runningValue?: number;
  unitCost: number;
  totalCost: number;
  totalValue?: number;
  reference: {
    id: string | null;
    type: string;
    number?: string | null;
  };
  sourceModule?: string | null;
  postingStatus?: string | null;
  journalEntryId?: string | null;
  reversalReference?: string | null;
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
  reversal?: {
    approvedBy?: string | null;
    approvedByName?: string | null;
    id: string;
    operationType: string;
    originalJournalId: string | null;
    originalMovementIds: string[];
    postedAt: string | null;
    postedBy?: string | null;
    postedByName?: string | null;
    reason: string;
    reversalJournalId: string | null;
    reversalJournalNumber: string | null;
    reversalMovementIds: string[];
    reversalNumber: string | null;
    reversalReference: string | null;
    requestedBy?: string | null;
    requestedByName?: string | null;
    status: string;
  } | null;
  dispatchReversal?: StockTransferRow['reversal'];
  receiptReversal?: StockTransferRow['reversal'];
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
  lowStockCount?: number;
  stockQuantity?: number;
  totalValue: number;
}

export interface LowStockRow {
  id: string;
  item: {
    id: string;
    code: string;
    name: string;
    reorderLevel: number;
    reorderQuantity?: number;
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
