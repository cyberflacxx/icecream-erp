import {
  buildInventoryAdjustmentFailure,
  ensureNonNegative,
  ensurePositiveQuantity,
  isInvoiceApprovedForDispatch,
  normalizeDate,
  normalizeStockMovementType,
  resolveInventoryUnitCost,
  resolveInventoryValue,
  toNumber,
} from './inventory';

type ServiceClient = {
  from: (table: string) => any;
};

const OPTIONAL_STOCK_MOVEMENT_COLUMNS = new Set([
  'batch_number',
  'destination_warehouse_id',
  'reference_number',
  'source_document_id',
  'source_document_type',
  'source_warehouse_id',
  'total_value',
]);

const STOCK_MOVEMENT_LIST_COLUMNS = [
  'id',
  'item_id',
  'warehouse_id',
  'movement_type',
  'quantity',
  'running_balance',
  'unit_cost',
  'total_cost',
  'total_value',
  'reference_id',
  'reference_type',
  'source_document_id',
  'source_document_type',
  'reference_number',
  'notes',
  'created_by',
  'created_at',
] as const;

export function buildStockMovementListSelectClause(columns: readonly string[] = STOCK_MOVEMENT_LIST_COLUMNS) {
  return columns.join(', ');
}

export async function generateDocumentNumber(
  service: ServiceClient,
  table: string,
  prefix: string,
) {
  const { count, error } = await service
    .from(table)
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw new Error(error.message);
  }

  return `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`;
}

export async function requireWarehouseAccess(
  service: ServiceClient,
  warehouseId: string,
  branchId: string | null,
  isBranchScoped: boolean,
  warehouseAssignments: string[] = [],
) {
  const { data, error } = await service
    .from('warehouses')
    .select('id, name, branch_id, is_active, organization_id')
    .eq('id', warehouseId)
    .single();

  if (error || !data || !data.is_active) {
    throw new Error('Warehouse not found or inactive.');
  }

  if (isBranchScoped && branchId) {
    const warehouseBranchId = data.branch_id ? String(data.branch_id) : null;
    const hasWarehouseAssignment = warehouseAssignments.includes(warehouseId);

    if (warehouseBranchId) {
      if (warehouseBranchId !== branchId && !hasWarehouseAssignment) {
        throw new Error('This action is outside the current branch scope.');
      }
    } else if (warehouseAssignments.length > 0 && !hasWarehouseAssignment) {
      throw new Error('This action is outside the current branch scope.');
    }
  }

  return data;
}

export async function requireItem(
  service: ServiceClient,
  itemId: string,
) {
  const primary = await service
    .from('items')
    .select('id, code, name, item_type, unit_cost, reorder_level, deleted_at, organization_id')
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!primary.error && primary.data) {
    return primary.data;
  }

  const missingDeletedAt = (primary.error?.message ?? '').includes('column items.deleted_at does not exist');
  if (!missingDeletedAt) {
    throw new Error(primary.error?.message ?? 'Inventory item not found.');
  }

  const fallback = await service
    .from('items')
    .select('id, code, name, item_type, unit_cost, reorder_level, organization_id')
    .eq('id', itemId)
    .maybeSingle();

  if (fallback.error || !fallback.data) {
    throw new Error(fallback.error?.message ?? 'Inventory item not found.');
  }

  return fallback.data;
}

export async function getBalance(
  service: ServiceClient,
  itemId: string,
  warehouseId: string,
) {
  const { data, error } = await service
    .from('stock_balances')
    .select('id, organization_id, item_id, warehouse_id, quantity, quantity_on_hand, quantity_available, quantity_reserved, avg_cost, average_cost, total_value, updated_at, last_updated')
    .eq('item_id', itemId)
    .eq('warehouse_id', warehouseId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function applyStockMovementListFilters(
  query: any,
  input: {
    endDate?: string;
    itemId?: string;
    scopedWarehouseIds?: string[] | null;
    startDate?: string;
    type?: string;
    warehouseId?: string;
  },
) {
  let nextQuery = query;

  if (input.itemId) nextQuery = nextQuery.eq('item_id', input.itemId);
  if (input.warehouseId) nextQuery = nextQuery.eq('warehouse_id', input.warehouseId);
  if (input.type) nextQuery = nextQuery.eq('movement_type', input.type);
  if (input.startDate) nextQuery = nextQuery.gte('created_at', `${input.startDate}T00:00:00.000Z`);
  if (input.endDate) nextQuery = nextQuery.lte('created_at', `${input.endDate}T23:59:59.999Z`);
  if (input.scopedWarehouseIds) {
    nextQuery = input.scopedWarehouseIds.length
      ? nextQuery.in('warehouse_id', input.scopedWarehouseIds)
      : nextQuery.in('warehouse_id', ['00000000-0000-0000-0000-000000000000']);
  }

  return nextQuery;
}

export async function listCompatibleStockMovements(
  service: ServiceClient,
  input: {
    branchId?: string | null;
    endDate?: string;
    isBranchScoped?: boolean;
    itemId?: string;
    page: number;
    pageSize: number;
    startDate?: string;
    type?: string;
    warehouseId?: string;
  },
) {
  let scopedWarehouseIds: string[] | null = null;

  if (input.isBranchScoped && input.branchId) {
    const warehousesResult = await service
      .from('warehouses')
      .select('id')
      .eq('branch_id', input.branchId);

    if (warehousesResult.error) {
      throw new Error(warehousesResult.error.message);
    }

    scopedWarehouseIds = (warehousesResult.data ?? []).map((row: { id?: unknown }) => String(row.id ?? '')).filter(Boolean);
  }

  const from = (input.page - 1) * input.pageSize;
  let columns = [...STOCK_MOVEMENT_LIST_COLUMNS] as string[];
  const removedColumns = new Set<string>();

  for (let attempt = 0; attempt <= STOCK_MOVEMENT_LIST_COLUMNS.length; attempt += 1) {
    let query = service
      .from('stock_movements')
      .select(buildStockMovementListSelectClause(columns), { count: 'exact' });

    query = applyStockMovementListFilters(query, {
      endDate: input.endDate,
      itemId: input.itemId,
      scopedWarehouseIds,
      startDate: input.startDate,
      type: input.type,
      warehouseId: input.warehouseId,
    });

    const result = await query
      .order('created_at', { ascending: false })
      .range(from, from + input.pageSize - 1);

    if (!result.error) {
      return {
        count: result.count ?? 0,
        rows: (result.data ?? []) as Array<Record<string, unknown>>,
      };
    }

    const missingColumn = extractMissingColumnName(result.error, 'stock_movements');
    if (!missingColumn || removedColumns.has(missingColumn) || !columns.includes(missingColumn)) {
      throw new Error(result.error.message ?? 'Failed to load stock movements.');
    }

    removedColumns.add(missingColumn);
    columns = columns.filter((column) => column !== missingColumn);
  }

  throw new Error('Failed to load stock movements.');
}

export async function mapCompatibleStockMovementRows(
  service: ServiceClient,
  rows: Array<Record<string, unknown>>,
) {
  const itemIds = [...new Set(rows.map((row) => String(row.item_id ?? '')).filter(Boolean))];
  const warehouseIds = [...new Set(rows.map((row) => String(row.warehouse_id ?? '')).filter(Boolean))];
  const userIds = [...new Set(rows.map((row) => String(row.created_by ?? '')).filter(Boolean))];

  const [itemsResult, warehousesResult, usersResult] = await Promise.all([
    itemIds.length
      ? service.from('items').select('id, code, name').in('id', itemIds)
      : Promise.resolve({ data: [], error: null }),
    warehouseIds.length
      ? service.from('warehouses').select('id, name').in('id', warehouseIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? service.from('users').select('id, first_name, last_name').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const items = new Map<string, Record<string, unknown>>(
    ((itemsResult.error ? [] : itemsResult.data) ?? []).map((row: Record<string, unknown>) => [String(row.id ?? ''), row] as const),
  );
  const warehouses = new Map<string, Record<string, unknown>>(
    ((warehousesResult.error ? [] : warehousesResult.data) ?? []).map((row: Record<string, unknown>) => [String(row.id ?? ''), row] as const),
  );
  const users = new Map<string, Record<string, unknown>>(
    ((usersResult.error ? [] : usersResult.data) ?? []).map((row: Record<string, unknown>) => [String(row.id ?? ''), row] as const),
  );

  return rows.map((row) => {
    const itemId = String(row.item_id ?? '').trim() || null;
    const warehouseId = String(row.warehouse_id ?? '').trim() || null;
    const createdById = String(row.created_by ?? '').trim() || null;
    const user = createdById ? (users.get(createdById) ?? null) as Record<string, unknown> | null : null;
    const item = itemId ? (items.get(itemId) ?? null) as Record<string, unknown> | null : null;
    const warehouse = warehouseId ? (warehouses.get(warehouseId) ?? null) as Record<string, unknown> | null : null;

    return {
      createdBy: createdById
        ? {
            id: createdById,
            name: user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Unknown user' : 'Unknown user',
          }
        : null,
      date: row.created_at ?? null,
      id: row.id,
      item: item
        ? {
            code: String(item.code ?? '--'),
            id: String(item.id ?? ''),
            name: String(item.name ?? 'Unknown item'),
          }
        : { code: '--', id: itemId ?? '', name: 'Unknown item' },
      item_id: itemId,
      itemId,
      notes: row.notes ?? null,
      quantity: toNumber(row.quantity),
      reference: {
        id: row.source_document_id ? String(row.source_document_id) : row.reference_id ? String(row.reference_id) : null,
        number: row.reference_number ? String(row.reference_number) : null,
        type: row.source_document_type ? String(row.source_document_type) : row.reference_type ? String(row.reference_type) : 'UNKNOWN',
      },
      runningBalance: toNumber(row.running_balance),
      source_document_id: row.source_document_id ? String(row.source_document_id) : row.reference_id ? String(row.reference_id) : null,
      sourceDocumentId: row.source_document_id ? String(row.source_document_id) : row.reference_id ? String(row.reference_id) : null,
      source_document_type: row.source_document_type ? String(row.source_document_type) : row.reference_type ? String(row.reference_type) : 'UNKNOWN',
      sourceDocumentType: row.source_document_type ? String(row.source_document_type) : row.reference_type ? String(row.reference_type) : 'UNKNOWN',
      totalCost: toNumber(row.total_value ?? row.total_cost),
      totalValue: toNumber(row.total_value ?? row.total_cost),
      type: String(row.movement_type ?? 'UNKNOWN'),
      unitCost: toNumber(row.unit_cost),
      warehouse: warehouse
        ? {
            id: String(warehouse.id ?? ''),
            name: String(warehouse.name ?? 'Unknown warehouse'),
          }
        : { id: warehouseId ?? '', name: 'Unknown warehouse' },
      warehouse_id: warehouseId,
      warehouseId,
    };
  });
}

export async function applyInventoryDelta(
  service: ServiceClient,
  params: {
    itemId: string;
    organizationId?: string;
    quantityDelta: number;
    totalValue?: number | null;
    unitCost?: number | null;
    warehouseId: string;
  },
) {
  const quantityDelta = toNumber(params.quantityDelta);
  const current = await getBalance(service, params.itemId, params.warehouseId);
  const organizationId = await resolveInventoryOrganizationId(service, {
    explicitOrganizationId: params.organizationId,
    fallbackOrganizationId: current?.organization_id ? String(current.organization_id) : null,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
  });
  const quantityReserved = toNumber(current?.quantity_reserved);
  const nextOnHand = toNumber(current?.quantity_on_hand) + quantityDelta;
  const nextAvailable = nextOnHand - quantityReserved;
  const currentLegacyQuantity = toNumber(current?.quantity ?? current?.quantity_on_hand);
  const nextLegacyQuantity = currentLegacyQuantity + quantityDelta;
  const currentAverageCost = toNumber(current?.average_cost ?? current?.avg_cost);
  const currentTotalValue = toNumber(current?.total_value ?? (toNumber(current?.quantity_on_hand) * currentAverageCost));
  const resolvedUnitCost = params.unitCost == null ? currentAverageCost : toNumber(params.unitCost);
  const movementValue =
    params.totalValue == null
      ? Math.abs(quantityDelta) * resolvedUnitCost
      : Math.max(0, toNumber(params.totalValue));
  const nextTotalValue =
    quantityDelta >= 0
      ? currentTotalValue + movementValue
      : Math.max(0, currentTotalValue - movementValue);
  const nextAverageCost = nextOnHand > 0 ? nextTotalValue / nextOnHand : 0;

  ensureNonNegative(nextOnHand, 'stock balance');
  ensureNonNegative(nextAvailable, 'available stock');
  ensureNonNegative(nextLegacyQuantity, 'legacy stock balance');

  if (current) {
    const { data, error } = await service
      .from('stock_balances')
      .update({
        avg_cost: nextAverageCost,
        average_cost: nextAverageCost,
        quantity: nextLegacyQuantity,
        quantity_on_hand: nextOnHand,
        quantity_available: nextAvailable,
        quantity_reserved: quantityReserved,
        reserved_qty: quantityReserved,
        total_value: nextTotalValue,
        updated_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      })
      .eq('id', current.id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to update stock balance.');
    }

    return data;
  }

  const { data, error } = await service
    .from('stock_balances')
    .insert({
      avg_cost: resolvedUnitCost,
      average_cost: resolvedUnitCost,
      organization_id: organizationId,
      item_id: params.itemId,
      quantity: nextLegacyQuantity,
      warehouse_id: params.warehouseId,
      quantity_on_hand: nextOnHand,
      quantity_available: nextAvailable,
      quantity_reserved: quantityReserved,
      reserved_qty: quantityReserved,
      total_value: Math.max(0, nextTotalValue),
      updated_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create stock balance.');
  }

  return data;
}

export async function recordStockMovement(
  service: ServiceClient,
  params: {
    batchNumber?: string | null;
    createdAt?: string | null;
    createdBy: string;
    destinationWarehouseId?: string | null;
    itemId: string;
    movementType: string;
    notes?: string | null;
    organizationId?: string;
    quantity: number;
    referenceId?: string | null;
    referenceType?: string | null;
    sourceWarehouseId?: string | null;
    stockValue?: number | null;
    totalCost?: number | null;
    totalValue?: number | null;
    unitCost?: number | null;
    value?: number | null;
    warehouseId: string;
  },
) {
  const item = await requireItem(service, params.itemId);
  const balance = await getBalance(service, params.itemId, params.warehouseId);
  const quantity = ensurePositiveQuantity(params.quantity);
  const unitCost = resolveInventoryUnitCost(
    {
      unitCost: params.unitCost,
      unit_cost: params.unitCost,
    },
    toNumber(item.unit_cost),
  );
  const totalValue = Math.max(
    0,
    resolveInventoryValue(
      {
        stockValue: params.stockValue,
        totalCost: params.totalCost,
        totalValue: params.totalValue,
        value: params.value,
      },
      quantity * unitCost,
    ),
  );
  const totalCost = totalValue;
  const organizationId = await resolveInventoryOrganizationId(service, {
    explicitOrganizationId: params.organizationId,
    fallbackOrganizationId: balance?.organization_id
      ? String(balance.organization_id)
      : item.organization_id
        ? String(item.organization_id)
        : null,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
  });
  const movementType = normalizeStockMovementType(params.movementType);
  const payload: Record<string, unknown> = {
    organization_id: organizationId,
    item_id: params.itemId,
    warehouse_id: params.warehouseId,
    movement_type: movementType,
    quantity,
    running_balance: toNumber(balance?.quantity_on_hand),
    unit_cost: unitCost,
    total_cost: totalCost,
    total_value: totalValue,
    reference_id: params.referenceId ?? null,
    reference_type: params.referenceType ?? null,
    source_document_id: params.referenceId ?? null,
    source_document_type: params.referenceType === 'goods_received_note' ? 'GRN' : params.referenceType ?? null,
    reference_number: params.referenceType === 'goods_received_note' ? params.referenceId ?? null : params.referenceId ?? null,
    batch_number: params.batchNumber ?? null,
    source_warehouse_id: params.sourceWarehouseId ?? null,
    destination_warehouse_id: params.destinationWarehouseId ?? null,
    notes: params.notes ?? null,
    created_by: params.createdBy,
    created_at: params.createdAt ?? undefined,
  };
  if (!params.createdAt) {
    delete payload.created_at;
  }

  for (let attempt = 0; attempt < OPTIONAL_STOCK_MOVEMENT_COLUMNS.size + 1; attempt += 1) {
    const { data, error } = await service
      .from('stock_movements')
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      return data;
    }

    const missingColumn = extractMissingColumnName(error, 'stock_movements');
    if (!missingColumn || !OPTIONAL_STOCK_MOVEMENT_COLUMNS.has(missingColumn)) {
      throw new Error(error?.message ?? 'Failed to record stock movement.');
    }

    delete payload[missingColumn];
  }

  throw new Error('Failed to record stock movement.');
}

export async function writeInventoryAuditLog(
  service: ServiceClient,
  params: {
    action: string;
    details: Record<string, unknown>;
    entityId: string;
    entityType?: string;
    userProfileId: string;
  },
) {
  const { error } = await service
    .from('audit_logs')
    .insert({
      action: params.action,
      entity_id: params.entityId,
      entity_type: params.entityType ?? 'inventory',
      new_values: params.details,
      user_profile_id: params.userProfileId,
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function verifyApprovedInvoice(
  service: ServiceClient,
  invoiceId: string,
) {
  const { data, error } = await service
    .from('invoices')
    .select('id, invoice_number, status, customer_id, sales_order_id')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    throw new Error('Invoice not found.');
  }

  if (!isInvoiceApprovedForDispatch(String(data.status ?? ''))) {
    throw new Error('Dispatch requires an approved invoice.');
  }

  return data;
}

export async function createInventoryAdjustmentRecord(
  service: ServiceClient,
  params: {
    adjustmentDate?: string | null;
    createdBy: string;
    itemId: string;
    movementType: string;
    organizationId?: string;
    quantity: number;
    reason: string;
    unitCost?: number | null;
    warehouseId: string;
  },
) {
  const item = await requireItem(service, params.itemId);
  const balance = await getBalance(service, params.itemId, params.warehouseId);
  const organizationId = await resolveInventoryOrganizationId(service, {
    explicitOrganizationId: params.organizationId,
    fallbackOrganizationId: balance?.organization_id
      ? String(balance.organization_id)
      : item.organization_id
        ? String(item.organization_id)
        : null,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
  });
  const quantityBefore = toNumber(balance?.quantity_on_hand);
  const quantityAdjusted = ensurePositiveQuantity(params.quantity);
  const quantityAfter =
    params.movementType === 'ADJUSTMENT_IN'
      ? quantityBefore + quantityAdjusted
      : quantityBefore - quantityAdjusted;

  ensureNonNegative(quantityAfter, 'quantityAfter');

  const adjustmentNumber = await generateDocumentNumber(service, 'stock_adjustments', 'ADJ');
  const { data: adjustment, error: adjustmentError } = await service
    .from('stock_adjustments')
    .insert({
      adjustment_number: adjustmentNumber,
      warehouse_id: params.warehouseId,
      adjustment_date: (params.adjustmentDate ?? new Date().toISOString()).slice(0, 10),
      reason: params.reason,
      status: 'POSTED',
      created_by: params.createdBy,
      approved_by: params.createdBy,
      organization_id: organizationId,
    })
    .select()
    .single();

  if (adjustmentError || !adjustment) {
    throw new Error(adjustmentError?.message ?? 'Failed to create stock adjustment.');
  }

  const { error: lineError } = await service
    .from('stock_adjustment_items')
    .insert({
      adjustment_id: adjustment.id,
      item_id: params.itemId,
      quantity_before: quantityBefore,
      quantity_adjusted: quantityAdjusted,
      quantity_after: quantityAfter,
      unit_cost: resolveInventoryUnitCost(
        {
          unitCost: params.unitCost,
          unit_cost: params.unitCost,
        },
        toNumber(item.unit_cost),
      ),
      movement_type: params.movementType,
      reason: params.reason,
    });

  if (lineError) {
    throw new Error(lineError.message);
  }

  return adjustment;
}

export function buildInventoryAdjustmentFailureResponse(input: {
  dbMessage?: string | null;
  itemId?: string | null;
  quantity?: number | null;
  stage: string;
  totalValue?: number | null;
  unitCost?: number | null;
  warehouseId?: string | null;
}) {
  return buildInventoryAdjustmentFailure(input);
}

export function normalizeMovementDate(value: string | null | undefined) {
  return normalizeDate(value);
}

export function quantityOrThrow(value: unknown, field = 'quantity') {
  return ensurePositiveQuantity(value, field);
}

async function resolveInventoryOrganizationId(
  service: ServiceClient,
  params: {
    explicitOrganizationId?: string;
    fallbackOrganizationId?: string | null;
    itemId: string;
    warehouseId: string;
  },
) {
  if (params.explicitOrganizationId) {
    return params.explicitOrganizationId;
  }

  if (params.fallbackOrganizationId) {
    return params.fallbackOrganizationId;
  }

  const { data: warehouse, error: warehouseError } = await service
    .from('warehouses')
    .select('organization_id')
    .eq('id', params.warehouseId)
    .maybeSingle();

  if (warehouseError) {
    throw new Error(warehouseError.message);
  }

  const warehouseOrganizationId = warehouse?.organization_id ? String(warehouse.organization_id) : '';
  if (warehouseOrganizationId) {
    return warehouseOrganizationId;
  }

  const { data: item, error: itemError } = await service
    .from('items')
    .select('organization_id')
    .eq('id', params.itemId)
    .maybeSingle();

  if (itemError) {
    throw new Error(itemError.message);
  }

  const itemOrganizationId = item?.organization_id ? String(item.organization_id) : '';
  if (itemOrganizationId) {
    return itemOrganizationId;
  }

  throw new Error('Unable to resolve organization for inventory transaction.');
}

function extractMissingColumnName(
  error: { message?: string } | null | undefined,
  table: string,
) {
  const message = error?.message ?? '';
  const match = message.match(new RegExp(`column\\s+${table}\\.([a-z_]+)\\s+does not exist`, 'i'));
  return match?.[1] ?? null;
}
