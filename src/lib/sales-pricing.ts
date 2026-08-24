type SalesServiceLike = {
  from: (table: string) => any;
};

type CustomerPricingContext = {
  code: string | null;
  creditLimit: number;
  customerGroupCode: string | null;
  id: string;
  organizationId: string;
  paymentTerms: string | null;
  priceListCode: string | null;
  status: string | null;
};

export type ResolvedSalesItemPricing = {
  availableBranchStock: number | null;
  availableWarehouseStock: number | null;
  code: string;
  currentInventoryCost: number | null;
  inventoryCostSource: string | null;
  id: string;
  isActive: boolean;
  itemType: string;
  name: string;
  priceSource: string | null;
  sellingPrice: number | null;
  taxCode: string | null;
  unitAbbreviation: string | null;
  unitId: string | null;
  unitName: string | null;
};

export const NO_ACTIVE_SELLING_PRICE_MESSAGE = 'No active selling price has been configured for this item and customer category.';

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickPositiveCost(...values: unknown[]) {
  for (const value of values) {
    const parsed = toOptionalNumber(value);
    if (parsed !== null && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function normalizeCode(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || null;
}

export type InventoryUnitCostResolution = {
  cost: number | null;
  source: 'inventory_batch' | 'item_master' | 'production_receipt' | 'stock_balance_average' | null;
};

function isCompatibilityFailure(error: unknown, table: string) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? error ?? '');
  return (
    message.includes(`Could not find the table 'icecream_erp.${table}'`) ||
    message.includes(`column ${table}.`) ||
    message.includes('Could not find a relationship between')
  );
}

export async function resolveInventoryUnitCost(input: {
  branchId?: string | null;
  itemId: string;
  organizationId: string;
  service: SalesServiceLike;
  warehouseId?: string | null;
}) {
  const resolved = await resolveInventoryUnitCosts({
    branchId: input.branchId,
    itemIds: [input.itemId],
    organizationId: input.organizationId,
    service: input.service,
    warehouseId: input.warehouseId,
  });

  return resolved.get(input.itemId) ?? { cost: null, source: null };
}

export async function resolveInventoryUnitCosts(input: {
  branchId?: string | null;
  itemIds: string[];
  organizationId: string;
  service: SalesServiceLike;
  warehouseId?: string | null;
}) {
  const itemIds = [...new Set(input.itemIds.map((value) => String(value)).filter(Boolean))];
  if (itemIds.length === 0) {
    return new Map<string, InventoryUnitCostResolution>();
  }

  const branchId = input.branchId ? String(input.branchId) : null;
  const warehouseId = input.warehouseId ? String(input.warehouseId) : null;
  const itemResult = await input.service
    .from('items')
    .select('id, unit_cost, standard_cost')
    .eq('organization_id', input.organizationId)
    .in('id', itemIds);
  if (itemResult.error) throw itemResult.error;

  const stockResult = await input.service
    .from('stock_balances')
    .select('item_id, warehouse_id, average_cost, avg_cost')
    .in('item_id', itemIds);
  if (stockResult.error) throw stockResult.error;

  let inventoryBatchRows: Array<Record<string, unknown>> = [];
  const inventoryBatchResult = await input.service
    .from('inventory_batches')
    .select('item_id, warehouse_id, unit_cost, quantity_remaining, created_at')
    .in('item_id', itemIds);
  if (inventoryBatchResult.error) {
    if (!isCompatibilityFailure(inventoryBatchResult.error, 'inventory_batches')) {
      throw inventoryBatchResult.error;
    }
  } else {
    inventoryBatchRows = (inventoryBatchResult.data ?? []) as Array<Record<string, unknown>>;
  }

  let productionReceiptRows: Array<Record<string, unknown>> = [];
  const productionReceiptResult = await input.service
    .from('production_receipt_lines')
    .select(
      'finished_product_id, unit_production_cost, current_completed_quantity, total_production_cost, production_receipts!inner(receipt_date, branch_id, finished_goods_warehouse_id)',
    )
    .in('finished_product_id', itemIds);
  if (productionReceiptResult.error) {
    if (!isCompatibilityFailure(productionReceiptResult.error, 'production_receipt_lines')) {
      throw productionReceiptResult.error;
    }
  } else {
    productionReceiptRows = (productionReceiptResult.data ?? []) as Array<Record<string, unknown>>;
  }

  const warehouseIds = [
    ...new Set(
      [
        ...((stockResult.data ?? []) as Array<Record<string, unknown>>).map((row) => String(row.warehouse_id ?? '')).filter(Boolean),
        ...inventoryBatchRows.map((row) => String(row.warehouse_id ?? '')).filter(Boolean),
      ],
    ),
  ];
  const warehouseBranchById = new Map<string, string | null>();
  if (warehouseIds.length > 0) {
    const warehousesResult = await input.service.from('warehouses').select('id, branch_id').in('id', warehouseIds);
    if (warehousesResult.error) throw warehousesResult.error;
    for (const row of (warehousesResult.data ?? []) as Array<Record<string, unknown>>) {
      warehouseBranchById.set(String(row.id ?? ''), row.branch_id ? String(row.branch_id) : null);
    }
  }

  const itemCostById = new Map<string, number | null>();
  for (const row of (itemResult.data ?? []) as Array<Record<string, unknown>>) {
    const configuredStandardCost = row.unit_cost ?? row.standard_cost;
    itemCostById.set(String(row.id ?? ''), pickPositiveCost(configuredStandardCost));
  }

  const resolutionByItemId = new Map<string, InventoryUnitCostResolution>();
  for (const itemId of itemIds) {
    resolutionByItemId.set(itemId, { cost: null, source: null });
  }

  const sortedProductionReceiptRows = productionReceiptRows.sort((left, right) => {
    const leftReceipt = Array.isArray(left.production_receipts) ? left.production_receipts[0] : left.production_receipts;
    const rightReceipt = Array.isArray(right.production_receipts) ? right.production_receipts[0] : right.production_receipts;
    return String((rightReceipt as Record<string, unknown> | null)?.receipt_date ?? '').localeCompare(
      String((leftReceipt as Record<string, unknown> | null)?.receipt_date ?? ''),
    );
  });

  for (const row of sortedProductionReceiptRows) {
    const itemId = String(row.finished_product_id ?? '');
    const current = resolutionByItemId.get(itemId);
    if (!current || current.cost !== null) continue;

    const receipt = Array.isArray(row.production_receipts) ? row.production_receipts[0] : row.production_receipts;
    const receiptRow = (receipt ?? null) as Record<string, unknown> | null;
    const receiptWarehouseId = receiptRow?.finished_goods_warehouse_id ? String(receiptRow.finished_goods_warehouse_id) : null;
    const receiptBranchId = receiptRow?.branch_id ? String(receiptRow.branch_id) : null;
    const inScope =
      (warehouseId && receiptWarehouseId === warehouseId) ||
      (!warehouseId && branchId && receiptBranchId === branchId) ||
      (!warehouseId && !branchId);
    if (!inScope) continue;

    const productionCost = pickPositiveCost(
      row.unit_production_cost,
      toOptionalNumber(row.current_completed_quantity) && toOptionalNumber(row.total_production_cost)
        ? Number(row.total_production_cost) / Math.max(Number(row.current_completed_quantity), 1)
        : null,
    );
    if (productionCost !== null) {
      resolutionByItemId.set(itemId, { cost: productionCost, source: 'production_receipt' });
    }
  }

  for (const row of (stockResult.data ?? []) as Array<Record<string, unknown>>) {
    const itemId = String(row.item_id ?? '');
    const current = resolutionByItemId.get(itemId);
    if (!current || current.cost !== null) continue;

    const rowWarehouseId = String(row.warehouse_id ?? '');
    const rowBranchId = warehouseBranchById.get(rowWarehouseId) ?? null;
    const inScope =
      (warehouseId && rowWarehouseId === warehouseId) ||
      (!warehouseId && branchId && rowBranchId === branchId) ||
      (!warehouseId && !branchId);
    if (!inScope) continue;

    const averageCost = pickPositiveCost(row.average_cost, row.avg_cost);
    if (averageCost !== null) {
      resolutionByItemId.set(itemId, { cost: averageCost, source: 'stock_balance_average' });
    }
  }

  const sortedInventoryBatchRows = inventoryBatchRows
    .filter((row) => {
      const remaining = toOptionalNumber(row.quantity_remaining);
      return remaining === null || remaining > 0;
    })
    .sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')));

  for (const row of sortedInventoryBatchRows) {
    const itemId = String(row.item_id ?? '');
    const current = resolutionByItemId.get(itemId);
    if (!current || current.cost !== null) continue;

    const rowWarehouseId = String(row.warehouse_id ?? '');
    const rowBranchId = warehouseBranchById.get(rowWarehouseId) ?? null;
    const inScope =
      (warehouseId && rowWarehouseId === warehouseId) ||
      (!warehouseId && branchId && rowBranchId === branchId) ||
      (!warehouseId && !branchId);
    if (!inScope) continue;

    const batchCost = pickPositiveCost(row.unit_cost);
    if (batchCost !== null) {
      resolutionByItemId.set(itemId, { cost: batchCost, source: 'inventory_batch' });
    }
  }

  for (const itemId of itemIds) {
    const current = resolutionByItemId.get(itemId);
    if (!current || current.cost !== null) continue;
    const itemCost = itemCostById.get(itemId) ?? null;
    if (itemCost !== null) {
      resolutionByItemId.set(itemId, { cost: itemCost, source: 'item_master' });
    }
  }

  return resolutionByItemId;
}

function buildPricePriority(input: {
  branchCode?: string | null;
  customer?: CustomerPricingContext | null;
}) {
  return [
    input.customer?.code ? { code: input.customer.code, source: 'CUSTOMER' } : null,
    input.customer?.customerGroupCode ? { code: input.customer.customerGroupCode, source: 'CUSTOMER_CATEGORY' } : null,
    input.branchCode ? { code: input.branchCode, source: 'BRANCH' } : null,
    input.customer?.priceListCode ? { code: input.customer.priceListCode, source: 'PRICE_LIST' } : null,
    { code: 'WHOLESALE', source: 'DEFAULT_WHOLESALE' },
    { code: 'RETAIL', source: 'DEFAULT_RETAIL' },
    { code: 'STANDARD', source: 'STANDARD' },
  ].filter((value): value is { code: string; source: string } => Boolean(value?.code));
}

function isActivePriceOnDate(row: Record<string, unknown>, documentDate: string) {
  if (row.is_active === false) return false;
  const effectiveDate = row.effective_date ? String(row.effective_date) : null;
  const expiryDate = row.expiry_date ? String(row.expiry_date) : null;
  if (effectiveDate && effectiveDate > documentDate) return false;
  if (expiryDate && expiryDate < documentDate) return false;
  return true;
}

function pickResolvedPrice(
  itemId: string,
  documentDate: string,
  priceRows: Array<Record<string, unknown>>,
  priorities: Array<{ code: string; source: string }>,
) {
  const activeRows = priceRows
    .filter((row) => String(row.item_id ?? '') === itemId)
    .filter((row) => isActivePriceOnDate(row, documentDate))
    .sort((left, right) => String(right.effective_date ?? '').localeCompare(String(left.effective_date ?? '')));

  for (const priority of priorities) {
    const match = activeRows.find((row) => normalizeCode(row.price_list_code) === normalizeCode(priority.code));
    if (match) {
      const amount = toOptionalNumber(match.selling_price);
      return {
        priceSource: priority.source,
        sellingPrice: amount !== null && amount > 0 ? amount : null,
      };
    }
  }

  return {
    priceSource: null,
    sellingPrice: null,
  };
}

export async function loadSalesCustomerPricingContext(
  service: SalesServiceLike,
  organizationId: string,
  customerId: string,
) {
  const { data: customer, error: customerError } = await service
    .from('customers')
    .select('id, organization_id, code, customer_group_id, price_list_code, payment_terms, credit_limit, status')
    .eq('organization_id', organizationId)
    .eq('id', customerId)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer) return null;

  const customerGroupId = String((customer as Record<string, unknown>).customer_group_id ?? '');
  let customerGroupCode: string | null = null;
  if (customerGroupId) {
    const { data: customerGroup, error: customerGroupError } = await service
      .from('sales_customer_groups')
      .select('id, code')
      .eq('id', customerGroupId)
      .maybeSingle();
    if (customerGroupError) throw customerGroupError;
    customerGroupCode = customerGroup?.code ? String(customerGroup.code) : null;
  }

  return {
    code: customer.code ? String(customer.code) : null,
    creditLimit: toNumber((customer as Record<string, unknown>).credit_limit),
    customerGroupCode,
    id: String(customer.id),
    organizationId: String(customer.organization_id ?? organizationId),
    paymentTerms: customer.payment_terms ? String(customer.payment_terms) : null,
    priceListCode: customer.price_list_code ? String(customer.price_list_code) : null,
    status: customer.status ? String(customer.status) : null,
  } satisfies CustomerPricingContext;
}

export async function loadResolvedSalesItemPricing(input: {
  branchId?: string | null;
  documentDate?: string | null;
  itemIds: string[];
  organizationId: string;
  service: SalesServiceLike;
  warehouseId?: string | null;
  customer?: CustomerPricingContext | null;
}) {
  if (input.itemIds.length === 0) {
    return new Map<string, ResolvedSalesItemPricing>();
  }

  const branchId = input.branchId ? String(input.branchId) : null;
  const warehouseId = input.warehouseId ? String(input.warehouseId) : null;
  const documentDate = input.documentDate ? String(input.documentDate) : new Date().toISOString().slice(0, 10);

  const [itemsResult, pricesResult, stockResult, branchResult, resolvedInventoryCosts] = await Promise.all([
    input.service
      .from('items')
      .select('id, organization_id, code, name, type, item_type, unit_id, unit_of_measure_id, unit_cost, standard_cost, selling_price, is_active')
      .eq('organization_id', input.organizationId)
      .in('id', input.itemIds),
    input.service
      .from('sales_product_prices')
      .select('id, item_id, price_list_code, selling_price, effective_date, expiry_date, is_active')
      .in('item_id', input.itemIds),
    input.service
      .from('stock_balances')
      .select('item_id, warehouse_id, quantity_on_hand, quantity_available, average_cost, avg_cost')
      .in('item_id', input.itemIds),
    branchId
      ? input.service.from('branches').select('id, code').eq('organization_id', input.organizationId).eq('id', branchId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    resolveInventoryUnitCosts({
      branchId,
      itemIds: input.itemIds,
      organizationId: input.organizationId,
      service: input.service,
      warehouseId,
    }),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (pricesResult.error) throw pricesResult.error;
  if (stockResult.error) throw stockResult.error;
  if (branchResult.error) throw branchResult.error;

  const unitIds = [...new Set(((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => String(row.unit_id ?? row.unit_of_measure_id ?? '')).filter(Boolean))];
  const warehouseIds = [...new Set(((stockResult.data ?? []) as Array<Record<string, unknown>>).map((row) => String(row.warehouse_id ?? '')).filter(Boolean))];

  const [unitsResult, warehousesResult] = await Promise.all([
    unitIds.length
      ? input.service.from('units_of_measure').select('id, name, abbreviation').in('id', unitIds)
      : Promise.resolve({ data: [], error: null }),
    warehouseIds.length
      ? input.service.from('warehouses').select('id, branch_id').in('id', warehouseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (unitsResult.error) throw unitsResult.error;
  if (warehousesResult.error) throw warehousesResult.error;

  const unitById = new Map(
    ((unitsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.id),
      {
        abbreviation: row.abbreviation ? String(row.abbreviation) : null,
        name: row.name ? String(row.name) : null,
      },
    ]),
  );
  const warehouseBranchById = new Map(
    ((warehousesResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.id),
      row.branch_id ? String(row.branch_id) : null,
    ]),
  );

  const pricePriority = buildPricePriority({
    branchCode: branchResult.data?.code ? String(branchResult.data.code) : null,
    customer: input.customer,
  });

  const stockByItem = new Map<string, {
    availableBranchStock: number | null;
    availableWarehouseStock: number | null;
    currentInventoryCost: number | null;
  }>();

  for (const itemId of input.itemIds) {
    stockByItem.set(itemId, {
      availableBranchStock: branchId ? 0 : null,
      availableWarehouseStock: warehouseId ? 0 : null,
      currentInventoryCost: resolvedInventoryCosts.get(itemId)?.cost ?? null,
    });
  }

  for (const row of (stockResult.data ?? []) as Array<Record<string, unknown>>) {
    const itemId = String(row.item_id ?? '');
    const bucket = stockByItem.get(itemId);
    if (!bucket) continue;

    const rowWarehouseId = String(row.warehouse_id ?? '');
    const quantityAvailable = toOptionalNumber(row.quantity_available ?? row.quantity_on_hand) ?? 0;
    const averageCost = toOptionalNumber(row.average_cost ?? row.avg_cost);
    const rowBranchId = warehouseBranchById.get(rowWarehouseId) ?? null;

    if (branchId && rowBranchId === branchId) {
      bucket.availableBranchStock = (bucket.availableBranchStock ?? 0) + quantityAvailable;
    }
    if (warehouseId && rowWarehouseId === warehouseId) {
      bucket.availableWarehouseStock = (bucket.availableWarehouseStock ?? 0) + quantityAvailable;
    }
    if (averageCost !== null) {
      const useCost =
        (warehouseId && rowWarehouseId === warehouseId) ||
        (!warehouseId && branchId && rowBranchId === branchId) ||
        (!warehouseId && !branchId);
      if (useCost && resolvedInventoryCosts.get(itemId)?.source === 'stock_balance_average') {
        bucket.currentInventoryCost = averageCost;
      }
    }
  }

  const resolved = new Map<string, ResolvedSalesItemPricing>();
  for (const row of (itemsResult.data ?? []) as Array<Record<string, unknown>>) {
    const id = String(row.id);
    const stock = stockByItem.get(id);
    const unitId = row.unit_id ? String(row.unit_id) : row.unit_of_measure_id ? String(row.unit_of_measure_id) : null;
    const unit = unitId ? unitById.get(unitId) ?? null : null;
    const resolvedPrice = pickResolvedPrice(id, documentDate, (pricesResult.data ?? []) as Array<Record<string, unknown>>, pricePriority);
    const fallbackPrice = toOptionalNumber(row.selling_price);
    const resolvedCost = resolvedInventoryCosts.get(id) ?? { cost: null, source: null };

    resolved.set(id, {
      availableBranchStock: stock?.availableBranchStock ?? null,
      availableWarehouseStock: stock?.availableWarehouseStock ?? null,
      code: String(row.code ?? ''),
      currentInventoryCost: stock?.currentInventoryCost ?? resolvedCost.cost,
      inventoryCostSource: resolvedCost.source,
      id,
      isActive: row.is_active !== false,
      itemType: String(row.item_type ?? row.type ?? ''),
      name: String(row.name ?? row.code ?? ''),
      priceSource: resolvedPrice.priceSource,
      sellingPrice: resolvedPrice.sellingPrice ?? (fallbackPrice !== null && fallbackPrice > 0 ? fallbackPrice : null),
      taxCode: null,
      unitAbbreviation: unit?.abbreviation ?? null,
      unitId,
      unitName: unit?.name ?? null,
    });
  }

  return resolved;
}
