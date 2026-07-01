import {
  ensureNonNegative,
  ensurePositiveQuantity,
  isInvoiceApprovedForDispatch,
  normalizeDate,
  normalizeStockMovementType,
  toNumber,
} from '@/lib/inventory';

type ServiceClient = {
  from: (table: string) => any;
};

const OPTIONAL_STOCK_MOVEMENT_COLUMNS = new Set([
  'batch_number',
  'destination_warehouse_id',
  'source_warehouse_id',
]);

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
) {
  const { data, error } = await service
    .from('warehouses')
    .select('id, name, branch_id, is_active, organization_id')
    .eq('id', warehouseId)
    .single();

  if (error || !data || !data.is_active) {
    throw new Error('Warehouse not found or inactive.');
  }

  if (isBranchScoped && branchId && data.branch_id !== branchId) {
    throw new Error('This action is outside the current branch scope.');
  }

  return data;
}

export async function requireItem(
  service: ServiceClient,
  itemId: string,
) {
  const { data, error } = await service
    .from('items')
    .select('id, code, name, item_type, unit_cost, reorder_level, deleted_at, organization_id')
    .eq('id', itemId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    throw new Error('Inventory item not found.');
  }

  return data;
}

export async function getBalance(
  service: ServiceClient,
  itemId: string,
  warehouseId: string,
) {
  const { data, error } = await service
    .from('stock_balances')
    .select('id, organization_id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, last_updated')
    .eq('item_id', itemId)
    .eq('warehouse_id', warehouseId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function applyInventoryDelta(
  service: ServiceClient,
  params: {
    itemId: string;
    organizationId?: string;
    quantityDelta: number;
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

  ensureNonNegative(nextOnHand, 'stock balance');
  ensureNonNegative(nextAvailable, 'available stock');

  if (current) {
    const { data, error } = await service
      .from('stock_balances')
      .update({
        quantity_on_hand: nextOnHand,
        quantity_available: nextAvailable,
        quantity_reserved: quantityReserved,
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
      organization_id: organizationId,
      item_id: params.itemId,
      warehouse_id: params.warehouseId,
      quantity_on_hand: nextOnHand,
      quantity_available: nextAvailable,
      quantity_reserved: quantityReserved,
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
    warehouseId: string;
  },
) {
  const item = await requireItem(service, params.itemId);
  const balance = await getBalance(service, params.itemId, params.warehouseId);
  const quantity = ensurePositiveQuantity(params.quantity);
  const unitCost = toNumber(item.unit_cost);
  const totalCost = unitCost * quantity;
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
    unit_cost: unitCost || null,
    total_cost: totalCost || null,
    reference_id: params.referenceId ?? null,
    reference_type: params.referenceType ?? null,
    batch_number: params.batchNumber ?? null,
    source_warehouse_id: params.sourceWarehouseId ?? null,
    destination_warehouse_id: params.destinationWarehouseId ?? null,
    notes: params.notes ?? null,
    created_by: params.createdBy,
  };

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
    createdBy: string;
    itemId: string;
    movementType: string;
    organizationId?: string;
    quantity: number;
    reason: string;
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
      adjustment_date: new Date().toISOString().slice(0, 10),
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
      unit_cost: toNumber(item.unit_cost),
      movement_type: params.movementType,
      reason: params.reason,
    });

  if (lineError) {
    throw new Error(lineError.message);
  }

  return adjustment;
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
