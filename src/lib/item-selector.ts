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
  warehouseId: string;
}

export interface ItemSelectorWarehouseRow {
  branchId: string | null;
  id: string;
}

export interface ItemSelectorOption extends ItemSelectorRow {
  branchQuantity: number | null;
  label: string;
  warehouseQuantity: number | null;
}

function asNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function buildItemSelectorLabel(option: Pick<
  ItemSelectorOption,
  'branchQuantity' | 'code' | 'currentInventoryCost' | 'itemType' | 'name' | 'sellingPrice' | 'unitAbbreviation' | 'unitName' | 'warehouseQuantity'
>) {
  const stockQuantity = option.warehouseQuantity ?? option.branchQuantity;
  const unitLabel = option.unitAbbreviation ?? option.unitName ?? 'Unit';
  const stockLabel = stockQuantity === null ? 'Stock n/a' : `Stock ${stockQuantity.toFixed(3)}`;
  const costLabel = option.currentInventoryCost === null ? 'Cost n/a' : `Cost ${option.currentInventoryCost.toFixed(2)}`;
  const priceLabel = option.sellingPrice === null ? 'Price n/a' : `Price ${option.sellingPrice.toFixed(2)}`;
  const typeLabel = option.itemType ? option.itemType.split('_').join(' ') : 'ITEM';

  return `${option.code} - ${option.name} | ${typeLabel} | ${unitLabel} | ${stockLabel} | ${costLabel} | ${priceLabel}`;
}

export function buildItemSelectorOptions(input: {
  items: ItemSelectorRow[];
  stockRows: ItemSelectorStockRow[];
  warehousesById: Map<string, ItemSelectorWarehouseRow>;
  branchId?: string | null;
  warehouseId?: string | null;
}) {
  const branchQuantityByItem = new Map<string, number>();
  const warehouseQuantityByItem = new Map<string, number>();
  const scopedAverageCostByItem = new Map<string, number | null>();

  for (const stockRow of input.stockRows) {
    const warehouse = input.warehousesById.get(stockRow.warehouseId);
    if (!warehouse) continue;

    const quantity = asNumber(stockRow.quantityAvailable ?? stockRow.quantityOnHand);
    if (input.branchId && warehouse.branchId === input.branchId && quantity !== null) {
      branchQuantityByItem.set(stockRow.itemId, (branchQuantityByItem.get(stockRow.itemId) ?? 0) + quantity);
    }
    if (input.warehouseId && stockRow.warehouseId === input.warehouseId && quantity !== null) {
      warehouseQuantityByItem.set(stockRow.itemId, (warehouseQuantityByItem.get(stockRow.itemId) ?? 0) + quantity);
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
    const option: ItemSelectorOption = {
      ...item,
      branchQuantity: input.branchId ? branchQuantityByItem.get(item.id) ?? 0 : null,
      currentInventoryCost: scopedAverageCostByItem.get(item.id) ?? item.currentInventoryCost,
      label: '',
      warehouseQuantity: input.warehouseId ? warehouseQuantityByItem.get(item.id) ?? 0 : null,
    };

    option.label = buildItemSelectorLabel(option);
    return option;
  });
}
