export interface ItemSelectorRow {
  categoryId: string | null;
  categoryName: string | null;
  code: string;
  currentInventoryCost: number | null;
  id: string;
  isActive: boolean;
  itemType: string;
  name: string;
  sellingPrice: number | null;
  taxStatus?: string | null;
  unitAbbreviation: string | null;
  unitId: string | null;
  unitName: string | null;
}

export interface ItemSelectorStockRow {
  averageCost: number | null;
  itemId: string;
  quantityAvailable: number | null;
  quantityOnHand: number | null;
  quantityReserved: number | null;
  warehouseId: string;
}

export interface ItemSelectorWarehouseRow {
  branchId: string | null;
  id: string;
  name: string | null;
}

export interface ItemSelectorOption extends ItemSelectorRow {
  branchQuantity: number | null;
  hasStockRecord: boolean;
  label: string;
  quantityAvailable: number | null;
  quantityOnHand: number | null;
  quantityReserved: number | null;
  warehouseName: string | null;
  warehouseQuantity: number | null;
}

function asNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function buildItemSelectorLabel(option: Pick<
  ItemSelectorOption,
  'code' | 'currentInventoryCost' | 'hasStockRecord' | 'itemType' | 'name' | 'quantityAvailable' | 'quantityOnHand' | 'quantityReserved' | 'sellingPrice' | 'unitAbbreviation' | 'unitName' | 'warehouseName'
>) {
  const unitLabel = option.unitAbbreviation ?? option.unitName ?? 'Unit';
  const stockLabel = option.hasStockRecord
    ? `On Hand ${(option.quantityOnHand ?? 0).toFixed(3)} | Reserved ${(option.quantityReserved ?? 0).toFixed(3)} | Available ${(option.quantityAvailable ?? 0).toFixed(3)}`
    : 'No stock record';
  const costLabel = option.currentInventoryCost === null ? 'Cost not configured' : `Cost ${option.currentInventoryCost.toFixed(2)}`;
  const priceLabel = option.sellingPrice === null ? 'Price n/a' : `Price ${option.sellingPrice.toFixed(2)}`;
  const typeLabel = option.itemType ? option.itemType.split('_').join(' ') : 'ITEM';
  const warehouseLabel = option.warehouseName ? `Warehouse ${option.warehouseName}` : 'Warehouse not assigned';

  return `${option.code} - ${option.name} | ${typeLabel} | ${unitLabel} | ${warehouseLabel} | ${stockLabel} | ${costLabel} | ${priceLabel}`;
}

export function buildItemSelectorOptions(input: {
  items: ItemSelectorRow[];
  stockRows: ItemSelectorStockRow[];
  warehousesById: Map<string, ItemSelectorWarehouseRow>;
  branchId?: string | null;
  warehouseId?: string | null;
}) {
  const branchQuantityByItem = new Map<string, number>();
  const branchOnHandByItem = new Map<string, number>();
  const branchReservedByItem = new Map<string, number>();
  const branchRecordByItem = new Map<string, boolean>();
  const warehouseQuantityByItem = new Map<string, number>();
  const warehouseOnHandByItem = new Map<string, number>();
  const warehouseReservedByItem = new Map<string, number>();
  const warehouseRecordByItem = new Map<string, boolean>();
  const scopedAverageCostByItem = new Map<string, number | null>();

  for (const stockRow of input.stockRows) {
    const warehouse = input.warehousesById.get(stockRow.warehouseId);
    if (!warehouse) continue;

    const quantityAvailable = asNumber(stockRow.quantityAvailable ?? stockRow.quantityOnHand);
    const quantityOnHand = asNumber(stockRow.quantityOnHand);
    const quantityReserved = asNumber(stockRow.quantityReserved);
    if (input.branchId && warehouse.branchId === input.branchId) {
      branchRecordByItem.set(stockRow.itemId, true);
      if (quantityAvailable !== null) {
        branchQuantityByItem.set(stockRow.itemId, (branchQuantityByItem.get(stockRow.itemId) ?? 0) + quantityAvailable);
      }
      if (quantityOnHand !== null) {
        branchOnHandByItem.set(stockRow.itemId, (branchOnHandByItem.get(stockRow.itemId) ?? 0) + quantityOnHand);
      }
      if (quantityReserved !== null) {
        branchReservedByItem.set(stockRow.itemId, (branchReservedByItem.get(stockRow.itemId) ?? 0) + quantityReserved);
      }
    }
    if (input.warehouseId && stockRow.warehouseId === input.warehouseId) {
      warehouseRecordByItem.set(stockRow.itemId, true);
      if (quantityAvailable !== null) {
        warehouseQuantityByItem.set(stockRow.itemId, (warehouseQuantityByItem.get(stockRow.itemId) ?? 0) + quantityAvailable);
      }
      if (quantityOnHand !== null) {
        warehouseOnHandByItem.set(stockRow.itemId, (warehouseOnHandByItem.get(stockRow.itemId) ?? 0) + quantityOnHand);
      }
      if (quantityReserved !== null) {
        warehouseReservedByItem.set(stockRow.itemId, (warehouseReservedByItem.get(stockRow.itemId) ?? 0) + quantityReserved);
      }
    }

    const scopedToRequestedWarehouse = input.warehouseId ? stockRow.warehouseId === input.warehouseId : true;
    const scopedToRequestedBranch = input.branchId ? warehouse.branchId === input.branchId : true;
    if (scopedToRequestedWarehouse && scopedToRequestedBranch) {
      const averageCost = asNumber(stockRow.averageCost);
      if (averageCost !== null && !scopedAverageCostByItem.has(stockRow.itemId)) {
        scopedAverageCostByItem.set(stockRow.itemId, averageCost);
      }
    }
  }

  return input.items.map((item) => {
    const hasWarehouseRecord = input.warehouseId ? warehouseRecordByItem.get(item.id) === true : false;
    const hasBranchRecord = input.branchId ? branchRecordByItem.get(item.id) === true : false;
    const hasStockRecord = input.warehouseId ? hasWarehouseRecord : hasBranchRecord;
    const quantityAvailable = input.warehouseId
      ? hasWarehouseRecord
        ? warehouseQuantityByItem.get(item.id) ?? 0
        : null
      : input.branchId
        ? hasBranchRecord
          ? branchQuantityByItem.get(item.id) ?? 0
          : null
        : null;
    const quantityOnHand = input.warehouseId
      ? hasWarehouseRecord
        ? warehouseOnHandByItem.get(item.id) ?? 0
        : null
      : input.branchId
        ? hasBranchRecord
          ? branchOnHandByItem.get(item.id) ?? 0
          : null
        : null;
    const quantityReserved = input.warehouseId
      ? hasWarehouseRecord
        ? warehouseReservedByItem.get(item.id) ?? 0
        : null
      : input.branchId
        ? hasBranchRecord
          ? branchReservedByItem.get(item.id) ?? 0
          : null
        : null;
    const option: ItemSelectorOption = {
      ...item,
      branchQuantity: input.branchId && hasBranchRecord ? branchQuantityByItem.get(item.id) ?? 0 : null,
      currentInventoryCost: scopedAverageCostByItem.get(item.id) ?? item.currentInventoryCost,
      hasStockRecord,
      label: '',
      quantityAvailable,
      quantityOnHand,
      quantityReserved,
      warehouseName: input.warehouseId ? (input.warehousesById.get(input.warehouseId)?.name ?? null) : null,
      warehouseQuantity: input.warehouseId && hasWarehouseRecord ? warehouseQuantityByItem.get(item.id) ?? 0 : null,
    };

    option.label = buildItemSelectorLabel(option);
    return option;
  });
}
