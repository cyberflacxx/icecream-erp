import {
  ensureNonNegative,
  ensurePositiveQuantity,
  isInvoiceApprovedForDispatch,
  normalizeDate,
  toNumber,
} from '@/lib/inventory';

type ServiceClient = {
  from: (table: string) => any;
};

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
    .select('id, name, branch_id, is_active')
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
    .select('id, code, name, item_type, unit_cost, reorder_level, deleted_at')
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
    .select('id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, last_updated')
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
    quantityDelta: number;
    warehouseId: string;
  },
) {
  const quantityDelta = toNumber(params.quantityDelta);
  const current = await getBalance(service, params.itemId, params.warehouseId);
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
    createdBy: string;
    itemId: string;
    movementType: string;
    notes?: string | null;
    quantity: number;
    referenceId?: string | null;
    referenceType?: string | null;
    warehouseId: string;
  },
) {
  const item = await requireItem(service, params.itemId);
  const balance = await getBalance(service, params.itemId, params.warehouseId);
  const quantity = ensurePositiveQuantity(params.quantity);
  const unitCost = toNumber(item.unit_cost);
  const totalCost = unitCost * quantity;

  const { data, error } = await service
    .from('stock_movements')
    .insert({
      item_id: params.itemId,
      warehouse_id: params.warehouseId,
      movement_type: params.movementType,
      quantity,
      running_balance: toNumber(balance?.quantity_on_hand),
      unit_cost: unitCost || null,
      total_cost: totalCost || null,
      reference_id: params.referenceId ?? null,
      reference_type: params.referenceType ?? null,
      notes: params.notes ?? null,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to record stock movement.');
  }

  return data;
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
    quantity: number;
    reason: string;
    warehouseId: string;
  },
) {
  const item = await requireItem(service, params.itemId);
  const balance = await getBalance(service, params.itemId, params.warehouseId);
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
      organization_id: 'absolute-ice-cream',
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
