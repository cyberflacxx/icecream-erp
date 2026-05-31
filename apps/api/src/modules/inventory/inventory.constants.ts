export const InventoryBatchStatus = {
  ACTIVE: 'ACTIVE',
  DEPLETED: 'DEPLETED',
  EXPIRED: 'EXPIRED',
  QUARANTINE: 'QUARANTINE'
} as const;

export type InventoryBatchStatus =
  (typeof InventoryBatchStatus)[keyof typeof InventoryBatchStatus];

export const ItemType = {
  CONSUMABLE: 'CONSUMABLE',
  FINISHED_GOOD: 'FINISHED_GOOD',
  PACKAGING: 'PACKAGING',
  RAW_MATERIAL: 'RAW_MATERIAL',
  SPARE_PART: 'SPARE_PART'
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export const StockMovementType = {
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
  DAMAGE: 'DAMAGE',
  EXPIRY_WRITE_OFF: 'EXPIRY_WRITE_OFF',
  PRODUCTION_ISSUE: 'PRODUCTION_ISSUE',
  PRODUCTION_OUTPUT: 'PRODUCTION_OUTPUT',
  PURCHASE_RECEIVE: 'PURCHASE_RECEIVE',
  RETURN_IN: 'RETURN_IN',
  SALES_ISSUE: 'SALES_ISSUE',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT'
} as const;

export type StockMovementType =
  (typeof StockMovementType)[keyof typeof StockMovementType];

export const TransferStatus = {
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  DRAFT: 'DRAFT',
  IN_TRANSIT: 'IN_TRANSIT'
} as const;

export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

export const WarehouseType = {
  BRANCH: 'BRANCH',
  COLD_ROOM: 'COLD_ROOM',
  MAIN: 'MAIN'
} as const;

export type WarehouseType = (typeof WarehouseType)[keyof typeof WarehouseType];

export const inventoryBatchStatusValues = Object.values(
  InventoryBatchStatus,
) as [InventoryBatchStatus, ...InventoryBatchStatus[]];
export const itemTypeValues = Object.values(ItemType) as [ItemType, ...ItemType[]];
export const stockMovementTypeValues = Object.values(
  StockMovementType,
) as [StockMovementType, ...StockMovementType[]];
export const transferStatusValues = Object.values(
  TransferStatus,
) as [TransferStatus, ...TransferStatus[]];
export const warehouseTypeValues = Object.values(
  WarehouseType,
) as [WarehouseType, ...WarehouseType[]];
