import { normalizeStockMovementType } from './inventory';

export function normalizeGoodsReceivedPurchaseOrderId(input: {
  purchase_order_id?: unknown;
  purchaseOrderId?: unknown;
  po_id?: unknown;
  poId?: unknown;
}) {
  const purchaseOrderId = [input.purchase_order_id, input.purchaseOrderId, input.po_id, input.poId]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return purchaseOrderId ?? '';
}

export function normalizeGoodsReceivedSupplierId(input: {
  supplier_id?: unknown;
  supplierId?: unknown;
}) {
  const supplierId = [input.supplier_id, input.supplierId]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return supplierId ?? '';
}

export function normalizeGoodsReceivedWarehouseId(input: {
  warehouse_id?: unknown;
  warehouseId?: unknown;
  receiving_warehouse_id?: unknown;
  receivingWarehouseId?: unknown;
  destination_warehouse_id?: unknown;
  destinationWarehouseId?: unknown;
}) {
  const warehouseId = [
    input.warehouse_id,
    input.warehouseId,
    input.receiving_warehouse_id,
    input.receivingWarehouseId,
    input.destination_warehouse_id,
    input.destinationWarehouseId,
  ]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return warehouseId ?? '';
}

export function normalizeGoodsReceivedItemId(input: {
  item_id?: unknown;
  itemId?: unknown;
  product_id?: unknown;
  productId?: unknown;
  raw_material_id?: unknown;
  rawMaterialId?: unknown;
}) {
  const itemId = [
    input.item_id,
    input.itemId,
    input.product_id,
    input.productId,
    input.raw_material_id,
    input.rawMaterialId,
  ]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return itemId ?? '';
}

export function normalizeGoodsReceivedUnitOfMeasureId(input: {
  unit_of_measure_id?: unknown;
  unitOfMeasureId?: unknown;
  uom_id?: unknown;
  uomId?: unknown;
  uom?: unknown;
}) {
  const unitOfMeasureId = [
    input.unit_of_measure_id,
    input.unitOfMeasureId,
    input.uom_id,
    input.uomId,
    input.uom,
  ]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return unitOfMeasureId ?? '';
}

interface GoodsReceivedDraftPayloadInput {
  entryMode: string;
  items: Array<{
    batchNumber?: string | null;
    expiryDate?: string | null;
    itemId?: string | null;
    item_id?: string | null;
    poItemId?: string | null;
    po_item_id?: string | null;
    qualityNotes?: string | null;
    quantityExpected: number;
    quantityReceived: number;
    quantityRejected: number;
    reason?: string | null;
    unitCost: number;
    unitOfMeasureId?: string | null;
    unit_of_measure_id?: string | null;
    uomId?: string | null;
    uom_id?: string | null;
    uom?: string | null;
  }>;
  notes?: string | null;
  purchaseOrderId?: string | null;
  purchase_order_id?: string | null;
  qualityNotes?: string | null;
  supplierId?: string | null;
  supplier_id?: string | null;
  warehouse_id?: string | null;
  warehouseId?: string | null;
  receiving_warehouse_id?: string | null;
  receivingWarehouseId?: string | null;
  destination_warehouse_id?: string | null;
  destinationWarehouseId?: string | null;
}

export function buildGoodsReceivedDraftPayload(input: GoodsReceivedDraftPayloadInput) {
  const purchaseOrderId = normalizeGoodsReceivedPurchaseOrderId(input);
  const supplierId = normalizeGoodsReceivedSupplierId(input);
  const warehouseId = normalizeGoodsReceivedWarehouseId(input);

  return {
    entryMode: input.entryMode,
    items: input.items.map((item) => {
      const itemId = normalizeGoodsReceivedItemId(item);
      const unitOfMeasureId = normalizeGoodsReceivedUnitOfMeasureId(item);
      const poItemId = String(item.po_item_id ?? item.poItemId ?? '').trim();

      return {
        batchNumber: item.batchNumber ?? null,
        expiryDate: item.expiryDate ?? null,
        itemId,
        item_id: itemId,
        overReceiveReason: item.reason ?? null,
        poItemId: poItemId || null,
        po_item_id: poItemId || null,
        qualityNotes: item.qualityNotes ?? null,
        quantityExpected: item.quantityExpected,
        quantityReceived: item.quantityReceived,
        quantityRejected: item.quantityRejected,
        unitCost: item.unitCost,
        unitOfMeasureId,
        unit_of_measure_id: unitOfMeasureId,
        uomId: unitOfMeasureId,
        uom_id: unitOfMeasureId,
      };
    }),
    notes: input.notes ?? null,
    purchaseOrderId: purchaseOrderId || null,
    purchase_order_id: purchaseOrderId || null,
    qualityNotes: input.qualityNotes ?? null,
    supplierId: supplierId || null,
    supplier_id: supplierId || null,
    warehouseId: warehouseId || null,
    warehouse_id: warehouseId || null,
    receivingWarehouseId: warehouseId || null,
    receiving_warehouse_id: warehouseId || null,
  };
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '');
  return '';
}

export function sanitizeDbMessage(error: unknown) {
  const message = getErrorMessage(error).replace(/\s+/g, ' ').trim();
  if (!message) {
    return null;
  }

  return message.slice(0, 400);
}

const GRN_POSTED_STATUS_CANDIDATES = ['POSTED', 'RECEIVED', 'COMPLETED'] as const;
const STOCK_MOVEMENT_TYPE_CANDIDATES = ['GRN_RECEIPT', 'IN', 'RECEIPT'] as const;

export type GrnStockPostingFailureStage =
  | 'GRN_HEADER_LOAD_FAILED'
  | 'GRN_ITEMS_LOAD_FAILED'
  | 'GRN_HAS_NO_ITEMS'
  | 'GRN_ORGANIZATION_MISSING'
  | 'GRN_WAREHOUSE_MISSING'
  | 'GRN_ITEM_ID_MISSING'
  | 'GRN_QUANTITY_MISSING_OR_ZERO'
  | 'GRN_STOCK_BALANCE_READ_FAILED'
  | 'GRN_STOCK_BALANCE_UPDATE_FAILED'
  | 'GRN_STOCK_MOVEMENT_INSERT_FAILED'
  | 'GRN_MARK_POSTED_FAILED';

export interface GrnStockPostingFailureDetails {
  dbMessage?: string | null;
  grnId: string;
  itemCount?: number;
  itemId?: string | null;
  lineId?: string | null;
  operation?: string | null;
  purchaseOrderItemId?: string | null;
  quantity?: number;
  stage: GrnStockPostingFailureStage;
  totalValue?: number;
  unitCost?: number;
  warehouseId?: string | null;
  warehouseResolved?: boolean;
}

export interface NormalizedPostableGrnLine {
  batchNumber: string | null;
  hasAcceptedQuantity: boolean;
  itemId: string;
  lineId: string | null;
  organizationId: string;
  purchaseOrderItemId: string | null;
  quantity: number;
  rawLine: Record<string, unknown>;
  receivedValue: number;
  unitCost: number;
  warehouseId: string;
}

export class GrnStockPostingError extends Error {
  readonly code = 'GRN_STOCK_POST_FAILED';
  readonly details: GrnStockPostingFailureDetails;

  constructor(details: GrnStockPostingFailureDetails, message?: string) {
    super(message ?? details.stage);
    this.name = 'GrnStockPostingError';
    this.details = details;
  }
}

export function resolveCompatibleGrnPostedStatus(currentStatus: unknown) {
  const normalized = String(currentStatus ?? '').trim().toUpperCase();
  return (GRN_POSTED_STATUS_CANDIDATES.find((status) => status === normalized) ?? GRN_POSTED_STATUS_CANDIDATES[0]) as
    (typeof GRN_POSTED_STATUS_CANDIDATES)[number];
}

export function isGrnStockPostingError(error: unknown): error is GrnStockPostingError {
  return error instanceof GrnStockPostingError;
}

function isMissingColumnError(error: unknown, table: string, columnName: string) {
  return getErrorMessage(error).includes(`column ${table}.${columnName} does not exist`);
}

function isInvalidGrnStatusEnumError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('invalid input value for enum grn_status');
}

function isInvalidMovementTypeEnumError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('invalid input value for enum') && message.includes('movement');
}

function isUniqueConstraintError(error: unknown, constraintName?: string) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('duplicate key value violates unique constraint') && (
    !constraintName || message.includes(constraintName.toLowerCase())
  );
}

function extractMissingColumnName(error: unknown, table: string) {
  const message = getErrorMessage(error);
  const directMatch = message.match(new RegExp(`column\\s+${table}\\.([a-z_]+)\\s+does not exist`, 'i'));
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  const schemaCacheMatch = message.match(
    new RegExp(`Could not find the '([a-z_]+)' column of '${table}' in the schema cache`, 'i'),
  );
  return schemaCacheMatch?.[1] ?? null;
}

function buildGrnPostingFailure(
  details: GrnStockPostingFailureDetails,
  error?: unknown,
  fallbackMessage?: string,
) {
  const dbMessage = details.dbMessage ?? sanitizeDbMessage(error);
  const nextDetails = dbMessage ? { ...details, dbMessage } : details;
  return new GrnStockPostingError(nextDetails, getErrorMessage(error) || fallbackMessage || details.stage);
}

function resolveGrnHeaderWarehouseId(grn: Record<string, unknown>) {
  return normalizeGoodsReceivedWarehouseId({
    destinationWarehouseId: grn.destinationWarehouseId,
    destination_warehouse_id: grn.destination_warehouse_id,
    receivingWarehouseId: grn.receivingWarehouseId,
    receiving_warehouse_id: grn.receiving_warehouse_id,
    warehouseId: grn.warehouseId,
    warehouse_id: grn.warehouse_id,
  });
}

function resolveGrnNumber(grn: Record<string, unknown>) {
  return String(grn.grn_number ?? grn.grnNumber ?? grn.reference_number ?? grn.referenceNumber ?? '').trim() || null;
}

function resolvePurchaseOrderId(grn: Record<string, unknown>) {
  return normalizeGoodsReceivedPurchaseOrderId({
    po_id: grn.po_id,
    poId: grn.poId,
    purchase_order_id: grn.purchase_order_id,
    purchaseOrderId: grn.purchaseOrderId,
  });
}

function resolveOrganizationId(...values: unknown[]) {
  return values
    .map((value) => String(value ?? '').trim())
    .find(Boolean) ?? '';
}

function resolveGrnOrganizationId(input: {
  fallbackOrganizationId?: string | null;
  grn?: Record<string, unknown> | null;
  itemMaster?: Record<string, unknown> | null;
  line?: Record<string, unknown> | null;
  purchaseOrderItem?: Record<string, unknown> | null;
}) {
  return resolveOrganizationId(
    input.grn?.organization_id,
    input.grn?.organizationId,
    input.line?.organization_id,
    input.line?.organizationId,
    input.purchaseOrderItem?.organization_id,
    input.purchaseOrderItem?.organizationId,
    input.itemMaster?.organization_id,
    input.itemMaster?.organizationId,
    input.fallbackOrganizationId,
  );
}

function resolveGrnItemQuantity(item: Record<string, unknown>) {
  const acceptedCandidates = [
    item.accepted_quantity,
    item.acceptedQuantity,
    item.quantity_accepted,
    item.quantityAccepted,
    item.received_accepted_quantity,
    item.receivedAcceptedQuantity,
  ];

  for (const candidate of acceptedCandidates) {
    const quantity = toNumber(candidate);
    if (quantity > 0) {
      return quantity;
    }
  }

  const hasAcceptedQuantityField = acceptedCandidates.some(
    (candidate) => candidate !== undefined && candidate !== null && String(candidate).trim() !== '',
  );
  if (hasAcceptedQuantityField) {
    return 0;
  }

  return toNumber(item.quantity_received ?? item.received_quantity ?? item.quantity ?? item.qty);
}

function resolveGrnItemWarehouseId(item: Record<string, unknown>, headerWarehouseId: string) {
  return (
    normalizeGoodsReceivedWarehouseId({
      destinationWarehouseId: item.destinationWarehouseId,
      destination_warehouse_id: item.destination_warehouse_id,
      receivingWarehouseId: item.receivingWarehouseId,
      receiving_warehouse_id: item.receiving_warehouse_id,
      warehouseId: item.warehouseId,
      warehouse_id: item.warehouse_id,
    }) || headerWarehouseId
  );
}

function resolveGrnItemPurchaseOrderItemId(item: Record<string, unknown>) {
  return String(
    item.purchase_order_item_id ??
      item.purchaseOrderItemId ??
      item.po_item_id ??
      item.poItemId ??
      '',
  ).trim();
}

function resolveLineUnitCost(
  line: Record<string, unknown>,
  purchaseOrderItem: Record<string, unknown> | null | undefined,
  itemMaster: Record<string, unknown> | null | undefined,
) {
  return toNumber(
    line.unit_cost ??
      line.cost ??
      line.price ??
      line.unit_price ??
      purchaseOrderItem?.unit_price ??
      purchaseOrderItem?.unitPrice ??
      purchaseOrderItem?.unit_cost ??
      purchaseOrderItem?.unitCost ??
      resolveItemMasterUnitCost(itemMaster) ??
      0,
  );
}

function buildNormalizedLineScore(line: Pick<NormalizedPostableGrnLine, 'hasAcceptedQuantity' | 'purchaseOrderItemId' | 'quantity'>) {
  return (line.purchaseOrderItemId ? 100 : 0) + (line.hasAcceptedQuantity ? 10 : 0) + Math.min(line.quantity, 1);
}

export function findMatchingGrnReceiveLine(
  existingItems: Array<Record<string, unknown>>,
  input: {
    itemId: string;
    poItemId?: string | null;
  },
) {
  const purchaseOrderItemId = String(input.poItemId ?? '').trim();
  if (purchaseOrderItemId) {
    const byPurchaseOrderItem = existingItems.find(
      (item) => resolveGrnItemPurchaseOrderItemId(item) === purchaseOrderItemId,
    );
    if (byPurchaseOrderItem) {
      return byPurchaseOrderItem;
    }
  }

  return existingItems.find((item) => normalizeGoodsReceivedItemId(item) === input.itemId) ?? null;
}

export function normalizePostableGrnLines(input: {
  fallbackOrganizationId?: string | null;
  grn: Record<string, unknown>;
  itemMastersById: Map<string, Record<string, unknown>>;
  poItemsById: Map<string, Record<string, unknown>>;
  rawLines: Array<Record<string, unknown>>;
}) {
  const headerWarehouseId = resolveGrnHeaderWarehouseId(input.grn);
  const candidates = new Map<string, NormalizedPostableGrnLine>();

  for (const rawLine of input.rawLines) {
    const purchaseOrderItemId = resolveGrnItemPurchaseOrderItemId(rawLine) || null;
    const purchaseOrderItem = purchaseOrderItemId ? input.poItemsById.get(purchaseOrderItemId) ?? null : null;
    const itemId = normalizeGoodsReceivedItemId({
      item_id: rawLine.item_id ?? purchaseOrderItem?.item_id,
      itemId: rawLine.itemId ?? purchaseOrderItem?.itemId,
      product_id: rawLine.product_id ?? purchaseOrderItem?.product_id,
      productId: rawLine.productId ?? purchaseOrderItem?.productId,
      raw_material_id: rawLine.raw_material_id ?? purchaseOrderItem?.raw_material_id,
      rawMaterialId: rawLine.rawMaterialId ?? purchaseOrderItem?.rawMaterialId,
    });
    const quantity = resolveGrnItemQuantity(rawLine);
    if (!itemId || quantity <= 0) {
      continue;
    }

    const warehouseId = resolveGrnItemWarehouseId(rawLine, headerWarehouseId);
    if (!warehouseId) {
      continue;
    }

    const itemMaster = input.itemMastersById.get(itemId) ?? null;
    const unitCost = resolveLineUnitCost(rawLine, purchaseOrderItem, itemMaster);
    const receivedValue = toNumber(rawLine.line_total ?? rawLine.total_value) || (quantity * unitCost);
    const normalizedLine: NormalizedPostableGrnLine = {
      batchNumber: rawLine.batch_number ? String(rawLine.batch_number) : null,
      hasAcceptedQuantity: quantity > 0 && (
        rawLine.accepted_quantity !== undefined ||
        rawLine.acceptedQuantity !== undefined ||
        rawLine.quantity_accepted !== undefined ||
        rawLine.quantityAccepted !== undefined ||
        rawLine.received_accepted_quantity !== undefined ||
        rawLine.receivedAcceptedQuantity !== undefined
      ),
      itemId,
      lineId: String(rawLine.id ?? '').trim() || null,
      organizationId: resolveGrnOrganizationId({
        fallbackOrganizationId: input.fallbackOrganizationId ?? null,
        grn: input.grn,
        itemMaster,
        line: rawLine,
        purchaseOrderItem,
      }),
      purchaseOrderItemId,
      quantity,
      rawLine,
      receivedValue,
      unitCost,
      warehouseId,
    };

    const exactKey = `${normalizedLine.itemId}::${normalizedLine.warehouseId}::${normalizedLine.purchaseOrderItemId ?? ''}`;
    const existingExact = candidates.get(exactKey);
    if (!existingExact || buildNormalizedLineScore(normalizedLine) > buildNormalizedLineScore(existingExact) || (
      buildNormalizedLineScore(normalizedLine) === buildNormalizedLineScore(existingExact) &&
      normalizedLine.quantity > existingExact.quantity
    )) {
      candidates.set(exactKey, normalizedLine);
    }
  }

  const groupedByItemWarehouse = new Map<string, NormalizedPostableGrnLine[]>();
  for (const line of candidates.values()) {
    const key = `${line.itemId}::${line.warehouseId}`;
    groupedByItemWarehouse.set(key, [...(groupedByItemWarehouse.get(key) ?? []), line]);
  }

  const normalizedLines: NormalizedPostableGrnLine[] = [];
  for (const group of groupedByItemWarehouse.values()) {
    const poLinked = group.filter((line) => Boolean(line.purchaseOrderItemId));
    if (poLinked.length > 0) {
      normalizedLines.push(...poLinked);
      continue;
    }
    normalizedLines.push(...group);
  }

  return normalizedLines;
}

function resolveItemMasterUnitCost(itemMaster: Record<string, unknown> | null | undefined) {
  return toNumber(
    itemMaster?.purchase_price ??
      itemMaster?.purchasePrice ??
      itemMaster?.cost_price ??
      itemMaster?.costPrice ??
      itemMaster?.unit_cost ??
      itemMaster?.unitCost ??
      itemMaster?.standard_cost ??
      itemMaster?.standardCost ??
      itemMaster?.default_purchase_price ??
      itemMaster?.defaultPurchasePrice ??
      itemMaster?.price ??
      itemMaster?.selling_price ??
      itemMaster?.sellingPrice ??
      0,
  );
}

async function loadCompatibleGrnHeader(
  service: {
    from: (table: string) => any;
  },
  input: {
    grnId: string;
    organizationId: string;
  },
) {
  const attempts = [
    () =>
      service
        .from('goods_received_notes')
        .select('*')
        .eq('organization_id', input.organizationId)
        .eq('id', input.grnId)
        .maybeSingle(),
    () =>
      service
        .from('goods_received_notes')
        .select('*')
        .eq('id', input.grnId)
        .maybeSingle(),
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    const result = await attempt();
    if (result.data) {
      return result.data as Record<string, unknown>;
    }
    if (!result.error) {
      continue;
    }
    lastError = result.error;
    if (isMissingColumnError(result.error, 'goods_received_notes', 'organization_id')) {
      continue;
    }
    break;
  }

  throw buildGrnPostingFailure(
    {
      grnId: input.grnId,
      stage: 'GRN_HEADER_LOAD_FAILED',
      warehouseResolved: false,
    },
    lastError,
    'Goods received note not found.',
  );
}

async function loadCompatibleGrnItems(
  service: {
    from: (table: string) => any;
  },
  grnId: string,
) {
  const attempts = [
    { table: 'goods_received_note_items', column: 'grn_id' },
    { table: 'goods_received_note_items', column: 'goods_received_note_id' },
    { table: 'goods_received_note_items', column: 'goods_received_id' },
    { table: 'grn_items', column: 'grn_id' },
  ] as const;

  let lastError: unknown = null;
  for (const attempt of attempts) {
    const result = await service
      .from(attempt.table)
      .select('*')
      .eq(attempt.column, grnId);

    if (!result.error) {
      const rows = (result.data ?? []) as Record<string, unknown>[];
      if (rows.length > 0) {
        return rows;
      }
      continue;
    }

    lastError = result.error;
    if (
      isMissingColumnError(result.error, attempt.table, attempt.column) ||
      getErrorMessage(result.error).includes(attempt.table)
    ) {
      continue;
    }
    break;
  }

  if (lastError) {
    throw buildGrnPostingFailure(
      {
        grnId,
        stage: 'GRN_ITEMS_LOAD_FAILED',
        warehouseResolved: false,
      },
      lastError,
      'Failed to load goods received note items.',
    );
  }

  return [] as Record<string, unknown>[];
}

async function loadCompatiblePurchaseOrderItems(
  service: {
    from: (table: string) => any;
  },
  purchaseOrderId: string,
  purchaseOrderItemIds: string[],
) {
  const byId = new Map<string, Record<string, unknown>>();

  if (purchaseOrderItemIds.length > 0) {
    const rowsById = await service
      .from('purchase_order_items')
      .select('*')
      .in('id', purchaseOrderItemIds);
    if (!rowsById.error) {
      for (const row of (rowsById.data ?? []) as Record<string, unknown>[]) {
        const id = String(row.id ?? '').trim();
        if (id) byId.set(id, row);
      }
    }
  }

  if (purchaseOrderId) {
    for (const column of ['purchase_order_id', 'po_id'] as const) {
      const result = await service
        .from('purchase_order_items')
        .select('*')
        .eq(column, purchaseOrderId);
      if (!result.error) {
        for (const row of (result.data ?? []) as Record<string, unknown>[]) {
          const id = String(row.id ?? '').trim();
          if (id) byId.set(id, row);
        }
        break;
      }
      if (!isMissingColumnError(result.error, 'purchase_order_items', column)) {
        break;
      }
    }
  }

  return byId;
}

async function loadCompatibleItemMasters(
  service: {
    from: (table: string) => any;
  },
  itemIds: string[],
) {
  if (!itemIds.length) return new Map<string, Record<string, unknown>>();

  const result = await service.from('items').select('*').in('id', itemIds);
  if (result.error) {
    return new Map<string, Record<string, unknown>>();
  }

  return new Map(
    ((result.data ?? []) as Record<string, unknown>[])
      .map((row) => [String(row.id ?? '').trim(), row] as const)
      .filter(([id]) => id),
  );
}

async function loadCompatibleStockBalance(
  service: {
    from: (table: string) => any;
  },
  input: {
    grnId: string;
    itemId: string;
    warehouseId: string;
  },
) {
  const result = await service
    .from('stock_balances')
    .select('*')
    .eq('item_id', input.itemId)
    .eq('warehouse_id', input.warehouseId)
    .maybeSingle();

  if (result.error) {
    throw buildGrnPostingFailure(
      {
        grnId: input.grnId,
        itemId: input.itemId,
        stage: 'GRN_STOCK_BALANCE_READ_FAILED',
        warehouseId: input.warehouseId,
        warehouseResolved: true,
      },
      result.error,
      'Failed to read stock balance.',
    );
  }

  return (result.data ?? null) as Record<string, unknown> | null;
}

async function insertWithMissingColumnFallback(
  service: {
    from: (table: string) => any;
  },
  table: string,
  payload: Record<string, unknown>,
) {
  let nextPayload = { ...payload };
  const removed = new Set<string>();

  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt += 1) {
    const result = await service
      .from(table)
      .insert(nextPayload)
      .select()
      .single();

    if (!result.error && result.data) {
      return result;
    }

    const missingColumn = extractMissingColumnName(result.error, table);
    if (!missingColumn || removed.has(missingColumn)) {
      return result;
    }

    removed.add(missingColumn);
    delete nextPayload[missingColumn];
  }

  return { data: null, error: new Error(`Failed to insert ${table} row.`) };
}

async function updateWithMissingColumnFallback(
  service: {
    from: (table: string) => any;
  },
  table: string,
  payload: Record<string, unknown>,
  applyFilter: (query: any) => any,
) {
  let nextPayload = { ...payload };
  const removed = new Set<string>();

  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt += 1) {
    let query = service.from(table).update(nextPayload);
    query = applyFilter(query);
    const result = await query.select().single();

    if (!result.error && result.data) {
      return result;
    }

    const missingColumn = extractMissingColumnName(result.error, table);
    if (!missingColumn || removed.has(missingColumn)) {
      return result;
    }

    removed.add(missingColumn);
    delete nextPayload[missingColumn];
  }

  return { data: null, error: new Error(`Failed to update ${table} row.`) };
}

function buildStockBalanceInsertPayloadLevels(input: {
  organizationId: string;
  itemId: string;
  quantity: number;
  receivedValue: number;
  unitCost: number;
  warehouseId: string;
}, now: string) {
  // Alias fields are read-compatible only. Do not write optional alias columns to
  // PostgREST unless schema inspection confirms they exist.
  const sharedPayload: Record<string, unknown> = {
    organization_id: input.organizationId,
    item_id: input.itemId,
    warehouse_id: input.warehouseId,
    quantity_on_hand: input.quantity,
  };

  return [
    {
      ...sharedPayload,
      average_cost: input.unitCost,
      quantity_available: input.quantity,
      total_value: input.receivedValue,
      updated_at: now,
    },
    {
      ...sharedPayload,
      quantity_available: input.quantity,
    },
    {
      ...sharedPayload,
    },
  ] as Array<Record<string, unknown>>;
}

function buildStockBalanceUpdatePayloadLevels(input: {
  nextAvailable: number;
  nextAverageCost: number;
  nextOnHand: number;
  nextTotalValue: number;
}, now: string) {
  const sharedPayload: Record<string, unknown> = {
    quantity_on_hand: input.nextOnHand,
  };

  return [
    {
      ...sharedPayload,
      quantity_available: input.nextAvailable,
      average_cost: input.nextAverageCost,
      total_value: input.nextTotalValue,
      updated_at: now,
    },
    {
      ...sharedPayload,
      quantity_available: input.nextAvailable,
    },
    {
      ...sharedPayload,
    },
  ] as Array<Record<string, unknown>>;
}

async function tryStockBalanceWriteLevels(
  service: {
    from: (table: string) => any;
  },
  input: {
    applyFilter?: ((query: any) => any) | null;
    levels: Array<Record<string, unknown>>;
    operation: 'insert' | 'update';
  },
) {
  let lastResult: { data: unknown; error: unknown } | null = null;

  for (const payload of input.levels) {
    const result = input.operation === 'insert'
      ? await insertWithMissingColumnFallback(service, 'stock_balances', payload)
      : await updateWithMissingColumnFallback(
          service,
          'stock_balances',
          payload,
          input.applyFilter ?? ((query) => query),
        );

    if (!result.error && result.data) {
      return result;
    }

    lastResult = result;
  }

  return lastResult ?? { data: null, error: new Error('Failed to write stock balance.') };
}

export async function createOrUpdateStockBalance(
  service: {
    from: (table: string) => any;
  },
  input: {
    grnId: string;
    itemId: string;
    organizationId: string;
    quantity: number;
    receivedValue: number;
    unitCost: number;
    warehouseId: string;
  },
) {
  const current = await loadCompatibleStockBalance(service, input);
  const now = new Date().toISOString();
  const quantity = toNumber(input.quantity);
  const unitCost = toNumber(input.unitCost);
  const totalValue = toNumber(input.receivedValue);

  if (current) {
    const quantityOnHand = toNumber(
      current.quantity_on_hand ??
        current.current_quantity ??
        current.balance_quantity ??
        current.stock_quantity ??
        current.quantity,
    );
    const quantityReserved = toNumber(current.quantity_reserved ?? current.reserved_qty);
    const nextOnHand = quantityOnHand + input.quantity;
    const nextAvailable = nextOnHand - quantityReserved;
    const currentAverageCost = toNumber(current.average_cost ?? current.avg_cost ?? current.unit_cost);
    const currentTotalValue = toNumber(
      current.total_value ??
        current.stock_value ??
        (quantityOnHand * currentAverageCost),
    );
    const nextTotalValue = currentTotalValue + totalValue;
    const nextAverageCost = nextOnHand > 0 ? nextTotalValue / nextOnHand : currentAverageCost;

    const result = await tryStockBalanceWriteLevels(service, {
      applyFilter: (query) => query.eq('id', current.id),
      levels: buildStockBalanceUpdatePayloadLevels({
        nextAvailable,
        nextAverageCost,
        nextOnHand,
        nextTotalValue,
      }, now),
      operation: 'update',
    });

    if (result.error || !result.data) {
      throw buildGrnPostingFailure(
        {
          dbMessage: sanitizeDbMessage(result.error),
          grnId: input.grnId,
          itemId: input.itemId,
          operation: 'update_stock_balance',
          quantity,
          stage: 'GRN_STOCK_BALANCE_UPDATE_FAILED',
          totalValue,
          unitCost,
          warehouseId: input.warehouseId,
          warehouseResolved: true,
        },
        result.error,
        'Failed to update stock balance.',
      );
    }

    return result.data as Record<string, unknown>;
  }

  const lastResult = await tryStockBalanceWriteLevels(service, {
    levels: buildStockBalanceInsertPayloadLevels({
      itemId: input.itemId,
      organizationId: input.organizationId,
      quantity,
      receivedValue: totalValue,
      unitCost,
      warehouseId: input.warehouseId,
    }, now),
    operation: 'insert',
  });

  if (!lastResult.error && lastResult.data) {
    return lastResult.data as Record<string, unknown>;
  }

  throw buildGrnPostingFailure(
    {
      dbMessage: sanitizeDbMessage(lastResult?.error),
      grnId: input.grnId,
      itemId: input.itemId,
      operation: 'insert_stock_balance',
      quantity,
      stage: 'GRN_STOCK_BALANCE_UPDATE_FAILED',
      totalValue,
      unitCost,
      warehouseId: input.warehouseId,
      warehouseResolved: true,
    },
    lastResult?.error,
    'Failed to create stock balance.',
  );
}

async function insertCompatibleStockMovement(
  service: {
    from: (table: string) => any;
  },
  input: {
    batchNumber?: string | null;
    grnId: string;
    grnNumber?: string | null;
    itemId: string;
    notes?: string | null;
    organizationId: string;
    quantity: number;
    runningBalance: number;
    unitCost: number;
    userId: string;
    warehouseId: string;
  },
) {
  const basePayload: Record<string, unknown> = {
    batch_number: input.batchNumber ?? null,
    created_at: new Date().toISOString(),
    created_by: input.userId,
    item_id: input.itemId,
    notes: input.notes ?? null,
    organization_id: input.organizationId,
    quantity: input.quantity,
    reference_id: input.grnId,
    reference_number: input.grnNumber ?? input.grnId,
    reference_type: 'goods_received_note',
    running_balance: input.runningBalance,
    source_document_id: input.grnId,
    source_document_type: 'GRN',
    total_cost: input.quantity * input.unitCost,
    total_value: input.quantity * input.unitCost,
    unit_cost: input.unitCost,
    warehouse_id: input.warehouseId,
  };

  const movementTypes = [...new Set(STOCK_MOVEMENT_TYPE_CANDIDATES.map((value) => normalizeStockMovementType(value)))];

  for (const movementType of movementTypes) {
    const result = await insertWithMissingColumnFallback(service, 'stock_movements', {
      ...basePayload,
      movement_type: movementType,
    });

    if (!result.error && result.data) {
      return result.data as Record<string, unknown>;
    }

    if (isUniqueConstraintError(result.error, 'idx_stock_movements_reference_guard')) {
      const existingMovement = await findExistingGrnMovementForLine(service, {
        grnId: input.grnId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
      });
      if (existingMovement) {
        return existingMovement;
      }
    }

    if (isInvalidMovementTypeEnumError(result.error)) {
      continue;
    }

    throw buildGrnPostingFailure(
      {
        dbMessage: sanitizeDbMessage(result.error),
        grnId: input.grnId,
        itemId: input.itemId,
        operation: 'insert_stock_movement',
        quantity: input.quantity,
        stage: 'GRN_STOCK_MOVEMENT_INSERT_FAILED',
        totalValue: input.quantity * input.unitCost,
        unitCost: input.unitCost,
        warehouseId: input.warehouseId,
        warehouseResolved: true,
      },
      result.error,
      'Failed to insert stock movement.',
    );
  }

  throw buildGrnPostingFailure(
    {
      dbMessage: null,
      grnId: input.grnId,
      itemId: input.itemId,
      operation: 'insert_stock_movement',
      quantity: input.quantity,
      stage: 'GRN_STOCK_MOVEMENT_INSERT_FAILED',
      totalValue: input.quantity * input.unitCost,
      unitCost: input.unitCost,
      warehouseId: input.warehouseId,
      warehouseResolved: true,
    },
    undefined,
    'Failed to insert stock movement.',
  );
}

async function findExistingGrnMovement(
  service: {
    from: (table: string) => any;
  },
  grnId: string,
) {
  const attempts = [
    () =>
      service
        .from('stock_movements')
        .select('id')
        .or(`reference_id.eq.${grnId},source_document_id.eq.${grnId}`)
        .limit(1),
    () =>
      service
        .from('stock_movements')
        .select('id')
        .eq('reference_id', grnId)
        .limit(1),
    () =>
      service
        .from('stock_movements')
        .select('id')
        .eq('source_document_id', grnId)
        .limit(1),
  ];

  for (const attempt of attempts) {
    const result = await attempt();
    if (!result.error) {
      const rows = (result.data ?? []) as Record<string, unknown>[];
      return rows[0] ?? null;
    }

    if (
      isMissingColumnError(result.error, 'stock_movements', 'source_document_id') ||
      isMissingColumnError(result.error, 'stock_movements', 'reference_id')
    ) {
      continue;
    }
  }

  return null;
}

async function findExistingGrnMovementForLine(
  service: {
    from: (table: string) => any;
  },
  input: {
    grnId: string;
    itemId: string;
    warehouseId: string;
  },
) {
  const attempts = [
    () =>
      service
        .from('stock_movements')
        .select('*')
        .eq('source_document_type', 'GRN')
        .eq('source_document_id', input.grnId)
        .eq('item_id', input.itemId)
        .eq('warehouse_id', input.warehouseId)
        .limit(1),
    () =>
      service
        .from('stock_movements')
        .select('*')
        .eq('reference_type', 'goods_received_note')
        .eq('reference_id', input.grnId)
        .eq('item_id', input.itemId)
        .eq('warehouse_id', input.warehouseId)
        .limit(1),
    () =>
      service
        .from('stock_movements')
        .select('*')
        .eq('source_document_id', input.grnId)
        .eq('item_id', input.itemId)
        .eq('warehouse_id', input.warehouseId)
        .limit(1),
    () =>
      service
        .from('stock_movements')
        .select('*')
        .eq('reference_id', input.grnId)
        .eq('item_id', input.itemId)
        .eq('warehouse_id', input.warehouseId)
        .limit(1),
  ];

  for (const attempt of attempts) {
    const result = await attempt();
    if (!result.error) {
      const rows = (result.data ?? []) as Record<string, unknown>[];
      return rows[0] ?? null;
    }

    if (
      isMissingColumnError(result.error, 'stock_movements', 'source_document_type') ||
      isMissingColumnError(result.error, 'stock_movements', 'source_document_id') ||
      isMissingColumnError(result.error, 'stock_movements', 'reference_type') ||
      isMissingColumnError(result.error, 'stock_movements', 'reference_id') ||
      isMissingColumnError(result.error, 'stock_movements', 'item_id') ||
      isMissingColumnError(result.error, 'stock_movements', 'warehouse_id')
    ) {
      continue;
    }
  }

  return null;
}

async function updatePostedGoodsReceivedNoteState(
  service: {
    from: (table: string) => any;
  },
  input: {
    currentStatus: unknown;
    grnId: string;
    inventoryValuePosted: number;
    itemCount?: number;
    postedAt: string;
    userId: string;
    warehouseResolved?: boolean;
  },
) {
  const basePayload: Record<string, unknown> = {
    approved_at: input.postedAt,
    approved_by: input.userId,
    posted_at: input.postedAt,
    posted_by: input.userId,
    inventory_value_posted: input.inventoryValuePosted,
    quality_status: 'APPROVED',
    stock_posted: true,
  };

  const tryUpdate = async (payload: Record<string, unknown>) => {
    let updatePayload = { ...payload };
    let result = await service
      .from('goods_received_notes')
      .update(updatePayload)
      .eq('id', input.grnId)
      .select()
      .single();

    if (result.error && isMissingColumnError(result.error, 'goods_received_notes', 'inventory_value_posted')) {
      updatePayload = { ...updatePayload };
      delete updatePayload.inventory_value_posted;
      result = await service
        .from('goods_received_notes')
        .update(updatePayload)
        .eq('id', input.grnId)
        .select()
        .single();
    }

    return result;
  };

  const preferredStatus = resolveCompatibleGrnPostedStatus(input.currentStatus);
  const statusCandidates = [
    preferredStatus,
    ...GRN_POSTED_STATUS_CANDIDATES.filter((status) => status !== preferredStatus),
  ];

  for (const status of statusCandidates) {
    const result = await tryUpdate({ ...basePayload, status });
    if (!result.error && result.data) {
      return result.data;
    }
    if (isInvalidGrnStatusEnumError(result.error)) {
      continue;
    }
    throw buildGrnPostingFailure(
      {
        grnId: input.grnId,
        itemCount: input.itemCount,
        stage: 'GRN_MARK_POSTED_FAILED',
        warehouseResolved: input.warehouseResolved,
      },
      result.error,
      'Failed to mark goods received note as posted.',
    );
  }

  const fallbackResult = await tryUpdate(basePayload);
  if (fallbackResult.error || !fallbackResult.data) {
    throw buildGrnPostingFailure(
      {
        grnId: input.grnId,
        itemCount: input.itemCount,
        stage: 'GRN_MARK_POSTED_FAILED',
        warehouseResolved: input.warehouseResolved,
      },
      fallbackResult.error,
      'Failed to mark goods received note as posted.',
    );
  }

  return fallbackResult.data;
}

export function buildGoodsReceivedNoteDetailItem(
  item: Record<string, unknown>,
  grnId: string,
) {
  const itemId = normalizeGoodsReceivedItemId({
    item_id: item.item_id,
    itemId: item.itemId,
    product_id: item.product_id,
    productId: item.productId,
    raw_material_id: item.raw_material_id,
    rawMaterialId: item.rawMaterialId,
  }) || null;
  const purchaseOrderItemId = resolveGrnItemPurchaseOrderItemId(item) || null;
  const goodsReceivedNoteId = String(
    item.goods_received_note_id ??
      item.goodsReceivedNoteId ??
      item.goods_received_id ??
      item.grn_id ??
      item.grnId ??
      grnId,
  ).trim() || grnId;
  const quantityReceived = toNumber(item.quantity_received ?? item.received_quantity ?? item.received_qty ?? item.quantity ?? item.qty);
  const receivedQuantity = toNumber(item.received_quantity ?? item.quantity_received ?? item.received_qty ?? quantityReceived);
  const quantity = toNumber(item.quantity ?? item.qty ?? quantityReceived);
  const unitCost = toNumber(item.unit_cost ?? item.unitCost ?? item.cost ?? item.unit_price ?? item.unitPrice);
  const lineTotal = toNumber(item.line_total ?? item.lineTotal ?? item.total_value ?? (quantityReceived * unitCost));

  return {
    ...item,
    goods_received_note_id: goodsReceivedNoteId,
    goodsReceivedNoteId: goodsReceivedNoteId,
    grnId: goodsReceivedNoteId,
    item_id: itemId,
    itemId,
    line_total: lineTotal,
    lineTotal: lineTotal,
    purchase_order_item_id: purchaseOrderItemId,
    purchaseOrderItemId: purchaseOrderItemId,
    quantity,
    quantityReceived,
    quantity_received: quantityReceived,
    receivedQuantity,
    received_quantity: receivedQuantity,
    unit_cost: unitCost,
    unitCost,
  };
}

export function buildGoodsReceivedNoteDetailPayload(
  grn: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
) {
  const warehouseId = String(grn.warehouse_id ?? grn.warehouseId ?? '').trim() || null;
  const receivingWarehouseId = resolveGrnHeaderWarehouseId(grn) || warehouseId;
  const purchaseOrderId = resolvePurchaseOrderId(grn) || null;
  const grnNumber = resolveGrnNumber(grn);
  const mappedItems = items.map((item) =>
    buildGoodsReceivedNoteDetailItem(item, String(grn.id ?? '').trim() || ''),
  );
  const stockPosted = grn.stock_posted === true || String(grn.status ?? '').trim().toUpperCase() === 'POSTED';

  return {
    ...grn,
    grn_number: grnNumber,
    grnNumber,
    items: mappedItems,
    line_items: mappedItems,
    lineItems: mappedItems,
    purchase_order_id: purchaseOrderId,
    purchaseOrderId: purchaseOrderId,
    receiving_warehouse_id: receivingWarehouseId,
    receivingWarehouseId,
    stock_posted: stockPosted,
    stockPosted: stockPosted,
    warehouse_id: warehouseId ?? receivingWarehouseId,
    warehouseId: warehouseId ?? receivingWarehouseId,
  };
}

export async function fetchGoodsReceivedNoteDetail(
  service: {
    from: (table: string) => any;
  },
  input: {
    grnId: string;
    organizationId: string;
  },
) {
  const grn = await loadCompatibleGrnHeader(service, input);

  let items: Record<string, unknown>[] = [];
  try {
    items = await loadCompatibleGrnItems(service, input.grnId);
  } catch {
    items = [];
  }

  return buildGoodsReceivedNoteDetailPayload(grn, items);
}

export async function postGoodsReceivedNoteToInventory(
  service: {
    from: (table: string) => any;
  },
  input: {
    grnId: string;
    organizationId: string;
    userId: string;
  },
) {
  const grn = await loadCompatibleGrnHeader(service, input);
  const warehouseId = resolveGrnHeaderWarehouseId(grn);
  const grnNumber = resolveGrnNumber(grn);
  const purchaseOrderId = resolvePurchaseOrderId(grn);

  if (!warehouseId) {
    throw buildGrnPostingFailure(
      {
        grnId: input.grnId,
        stage: 'GRN_WAREHOUSE_MISSING',
        warehouseResolved: false,
      },
      undefined,
      'Please select a receiving warehouse before posting GRN.',
    );
  }

  if (grn.stock_posted === true || String(grn.status ?? '').toUpperCase() === 'POSTED') {
    return updatePostedGoodsReceivedNoteState(service, {
      currentStatus: grn.status,
      grnId: input.grnId,
      inventoryValuePosted: toNumber(grn.inventory_value_posted),
      itemCount: 0,
      postedAt: new Date().toISOString(),
      userId: input.userId,
      warehouseResolved: true,
    });
  }

  const items = await loadCompatibleGrnItems(service, input.grnId);
  if (items.length === 0) {
    throw buildGrnPostingFailure(
      {
        grnId: input.grnId,
        itemCount: 0,
        stage: 'GRN_HAS_NO_ITEMS',
        warehouseResolved: true,
      },
      undefined,
      'Goods received note has no items to post.',
    );
  }

  const purchaseOrderItemIds = [
    ...new Set(items.map((item) => resolveGrnItemPurchaseOrderItemId(item)).filter(Boolean)),
  ];
  const poItemsById = await loadCompatiblePurchaseOrderItems(service, purchaseOrderId, purchaseOrderItemIds);
  const resolvedItemIds = [
    ...new Set(
      items
        .map((item) => {
          const purchaseOrderItemId = resolveGrnItemPurchaseOrderItemId(item);
          const poItem = purchaseOrderItemId ? poItemsById.get(purchaseOrderItemId) ?? null : null;
          return normalizeGoodsReceivedItemId({
            item_id: item.item_id ?? poItem?.item_id,
            itemId: item.itemId ?? poItem?.itemId,
            product_id: item.product_id ?? poItem?.product_id,
            productId: item.productId ?? poItem?.productId,
            raw_material_id: item.raw_material_id ?? poItem?.raw_material_id,
            rawMaterialId: item.rawMaterialId ?? poItem?.rawMaterialId,
          });
        })
        .filter(Boolean),
    ),
  ];
  const itemsById = await loadCompatibleItemMasters(service, resolvedItemIds);
  const headerOrganizationId = resolveGrnOrganizationId({
    fallbackOrganizationId: input.organizationId,
    grn,
  });
  const normalizedLines = normalizePostableGrnLines({
    fallbackOrganizationId: headerOrganizationId || input.organizationId,
    grn,
    itemMastersById: itemsById,
    poItemsById,
    rawLines: items,
  });
  if (normalizedLines.length === 0) {
    const existingMovement = await findExistingGrnMovement(service, input.grnId);
    if (existingMovement) {
      return updatePostedGoodsReceivedNoteState(service, {
        currentStatus: grn.status,
        grnId: input.grnId,
        inventoryValuePosted: toNumber(grn.inventory_value_posted),
        itemCount: 0,
        postedAt: new Date().toISOString(),
        userId: input.userId,
        warehouseResolved: true,
      });
    }

    throw buildGrnPostingFailure(
      {
        grnId: input.grnId,
        itemCount: 0,
        stage: 'GRN_HAS_NO_ITEMS',
        warehouseResolved: true,
      },
      undefined,
      'Goods received note has no postable items.',
    );
  }
  let inventoryValuePosted = 0;

  for (const normalizedLine of normalizedLines) {
    if (!normalizedLine.organizationId) {
      throw buildGrnPostingFailure(
        {
          grnId: input.grnId,
          itemCount: normalizedLines.length,
          itemId: normalizedLine.itemId,
          lineId: normalizedLine.lineId,
          operation: 'resolve_organization_id',
          purchaseOrderItemId: normalizedLine.purchaseOrderItemId,
          stage: 'GRN_ORGANIZATION_MISSING',
          warehouseId: normalizedLine.warehouseId,
          warehouseResolved: true,
        },
        undefined,
        'Goods received note is missing organization_id.',
      );
    }

    inventoryValuePosted += normalizedLine.receivedValue;

    const existingLineMovement = await findExistingGrnMovementForLine(service, {
      grnId: input.grnId,
      itemId: normalizedLine.itemId,
      warehouseId: normalizedLine.warehouseId,
    });
    if (existingLineMovement) {
      continue;
    }

    const updatedBalance = await createOrUpdateStockBalance(service, {
      grnId: input.grnId,
      itemId: normalizedLine.itemId,
      organizationId: normalizedLine.organizationId,
      quantity: normalizedLine.quantity,
      receivedValue: normalizedLine.receivedValue,
      unitCost: normalizedLine.unitCost,
      warehouseId: normalizedLine.warehouseId,
    });

    await insertCompatibleStockMovement(service, {
      batchNumber: normalizedLine.batchNumber,
      grnId: input.grnId,
      grnNumber,
      itemId: normalizedLine.itemId,
      notes: String(grn.notes ?? grn.approval_notes ?? ''),
      organizationId: normalizedLine.organizationId,
      quantity: normalizedLine.quantity,
      runningBalance: toNumber(updatedBalance.quantity_on_hand ?? updatedBalance.quantity),
      unitCost: normalizedLine.unitCost,
      userId: input.userId,
      warehouseId: normalizedLine.warehouseId,
    });

    if (normalizedLine.purchaseOrderItemId) {
      const poItemResult = await service
        .from('purchase_order_items')
        .select('*')
        .eq('id', normalizedLine.purchaseOrderItemId)
        .maybeSingle();
      if (!poItemResult.error && poItemResult.data) {
        const currentReceived = toNumber(poItemResult.data.quantity_received ?? poItemResult.data.received_qty);
        await updateWithMissingColumnFallback(
          service,
          'purchase_order_items',
          {
            quantity_received: currentReceived + normalizedLine.quantity,
            received_qty: currentReceived + normalizedLine.quantity,
          },
          (query) => query.eq('id', normalizedLine.purchaseOrderItemId),
        );
        poItemResult.data.quantity_received = currentReceived + normalizedLine.quantity;
      }
    }
  }

  if (purchaseOrderId) {
    const poItems = [...poItemsById.values()];
    const allReceived = poItems.length > 0 && poItems.every((item) => toNumber(item.quantity_received ?? item.received_qty) >= toNumber(item.quantity_ordered));
    const anyReceived = poItems.some((item) => toNumber(item.quantity_received ?? item.received_qty) > 0);
    await updateWithMissingColumnFallback(
      service,
      'purchase_orders',
      {
        status: allReceived ? 'FULLY_RECEIVED' : anyReceived ? 'PARTIAL_RECEIVED' : 'APPROVED',
      },
      (query) => query.eq('id', purchaseOrderId),
    );
  }

  const postedAt = new Date().toISOString();
  return updatePostedGoodsReceivedNoteState(service, {
    currentStatus: grn.status,
    grnId: input.grnId,
    inventoryValuePosted,
    itemCount: normalizedLines.length,
    postedAt,
    userId: input.userId,
    warehouseResolved: true,
  });
}
