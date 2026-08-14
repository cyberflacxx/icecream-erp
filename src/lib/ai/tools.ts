import { checkDatabaseHealth } from '@/lib/health';
import { filterAuthorizedWarehouses, getAuthorizedBranchIds, getAuthorizedWarehouseIds } from '@/lib/branch-access';
import { can } from '@/lib/api-auth';
import { findOpenFiscalPeriod, listFinanceOpeningBalances, loadFinanceMetaResources } from '@/lib/finance-foundation-server';
import { normalizeStockMovementType, STOCK_IN_MOVEMENT_TYPES, STOCK_OUT_MOVEMENT_TYPES, toNumber } from '@/lib/inventory';
import { listCompatibleStockMovements, mapCompatibleStockMovementRows } from '@/lib/inventory-server';
import { isMissingRelationshipError } from '@/lib/postgrest-compat';
import { loadProductionReportBatches } from '@/lib/production-server';
import { fetchGoodsReceivedNoteDetail } from '@/lib/procurement-goods-received';
import { createServiceRoleClient } from '@/lib/supabase/server';

import type { AuthContext } from '@/lib/api-auth';
import type {
  AbsoluteAiHealthCard,
  AbsoluteAiToolDefinition,
  AbsoluteAiToolExecutionContext,
  AbsoluteAiToolResult,
} from './types';
import {
  ABSOLUTE_AI_DIAGNOSTIC_CACHE_TTL_MS,
  ABSOLUTE_AI_MAX_RESULT_ROWS,
  ABSOLUTE_AI_ROLE_CACHE_TTL_MS,
} from './types';

type ToolRecord = {
  allowed: (auth: AuthContext) => boolean;
  definition: AbsoluteAiToolDefinition;
  execute: (context: AbsoluteAiToolExecutionContext, args: Record<string, unknown>) => Promise<AbsoluteAiToolResult>;
};

type ItemRecord = {
  code?: string | null;
  id: string;
  item_type?: string | null;
  name?: string | null;
  organization_id: string;
};

type WarehouseRecord = {
  branchId: string | null;
  code?: string | null;
  id: string;
  isActive?: boolean | null;
  name?: string | null;
  organizationId: string;
};

const diagnosticCache = new Map<string, { expiresAt: number; value: AbsoluteAiToolResult | AbsoluteAiHealthCard[] }>();

async function getCachedDiagnostic<T extends AbsoluteAiToolResult | AbsoluteAiHealthCard[]>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = diagnosticCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const value = await loader();
  diagnosticCache.set(key, { expiresAt: now + ttlMs, value });

  for (const [entryKey, entry] of diagnosticCache) {
    if (entry.expiresAt <= now) {
      diagnosticCache.delete(entryKey);
    }
  }

  return value;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function maybeDate(value: unknown) {
  const normalized = stringValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, '\\$&');
}

function buildScopeSummary(auth: AuthContext) {
  return {
    authorizedBranchIds: getAuthorizedBranchIds(auth),
    authorizedWarehouseIds: getAuthorizedWarehouseIds(auth),
    branchId: auth.branchId,
    isBranchScoped: auth.isBranchScoped,
  };
}

function matchByText(values: Array<string | null | undefined>, needle: string) {
  const normalizedNeedle = needle.trim().toLowerCase();
  return values.some((value) => String(value ?? '').trim().toLowerCase() === normalizedNeedle);
}

async function loadAuthorizedWarehouses(auth: AuthContext) {
  const service = createServiceRoleClient().schema('icecream_erp');
  const result = await service
    .from('warehouses')
    .select('id, code, name, branch_id, is_active, organization_id')
    .eq('organization_id', auth.organizationId);

  if (result.error) throw result.error;
  const rows = (result.data ?? []).map((row) => ({
    branchId: row.branch_id ? String(row.branch_id) : null,
    code: row.code ? String(row.code) : null,
    id: String(row.id),
    isActive: row.is_active !== false,
    name: row.name ? String(row.name) : null,
    organizationId: String(row.organization_id),
  })) as WarehouseRecord[];
  return filterAuthorizedWarehouses(auth, rows);
}

async function resolveItem(auth: AuthContext, args: Record<string, unknown>) {
  const service = createServiceRoleClient().schema('icecream_erp');
  const itemId = stringValue(args.itemId);
  const itemCode = stringValue(args.itemCode);
  const itemName = stringValue(args.itemName);

  if (!itemId && !itemCode && !itemName) {
    throw new Error('An itemId, itemCode, or itemName is required.');
  }

  let query = service
    .from('items')
    .select('id, code, name, item_type, organization_id')
    .eq('organization_id', auth.organizationId)
    .limit(10);

  if (itemId) {
    query = query.eq('id', itemId);
  } else if (itemCode) {
    query = query.eq('code', itemCode);
  } else {
    query = query.ilike('name', `%${escapeIlike(itemName)}%`);
  }

  const result = await query;
  if (result.error) throw result.error;

  const rows = (result.data ?? []) as ItemRecord[];
  const exact =
    rows.find((row) => row.id === itemId) ??
    rows.find((row) => matchByText([row.code], itemCode)) ??
    rows.find((row) => matchByText([row.name], itemName)) ??
    rows[0] ??
    null;

  if (!exact) {
    throw new Error('The requested item was not found.');
  }

  return {
    item: exact,
    matches: rows.slice(0, 5).map((row) => ({
      code: row.code ?? null,
      id: row.id,
      name: row.name ?? null,
    })),
  };
}

async function resolveWarehouse(auth: AuthContext, args: Record<string, unknown>) {
  const warehouses = await loadAuthorizedWarehouses(auth);
  const warehouseId = stringValue(args.warehouseId);
  const warehouseCode = stringValue(args.warehouseCode);
  const warehouseName = stringValue(args.warehouseName);
  const branchId = stringValue(args.branchId);
  const branchName = stringValue(args.branchName);

  const filteredByBranch = warehouses.filter((warehouse) => {
    if (branchId && warehouse.branchId !== branchId) return false;
    return !branchName || matchByText([warehouse.branchId, warehouse.name, warehouse.code], branchName);
  });

  const matches = (filteredByBranch.length > 0 ? filteredByBranch : warehouses).filter((warehouse) => {
    if (warehouseId && warehouse.id === warehouseId) return true;
    if (warehouseCode && matchByText([warehouse.code], warehouseCode)) return true;
    if (warehouseName && matchByText([warehouse.name], warehouseName)) return true;
    return !warehouseId && !warehouseCode && !warehouseName;
  });

  return {
    matches: matches.slice(0, 5).map((row) => ({
      branchId: row.branchId,
      code: row.code ?? null,
      id: row.id,
      name: row.name ?? null,
    })),
    warehouse: matches[0] ?? null,
  };
}

async function resolveGrnIdentifier(auth: AuthContext, args: Record<string, unknown>) {
  const service = createServiceRoleClient().schema('icecream_erp');
  const grnId = stringValue(args.grnId);
  const grnNumber = stringValue(args.grnNumber);

  if (!grnId && !grnNumber) {
    throw new Error('A grnId or grnNumber is required.');
  }

  let query = service
    .from('goods_received_notes')
    .select('id, grn_number, status, supplier_id, purchase_order_id, warehouse_id, organization_id, stock_posted, inventory_value_posted, branch_id, received_date, posted_at, created_at')
    .eq('organization_id', auth.organizationId)
    .limit(1);

  query = grnId ? query.eq('id', grnId) : query.eq('grn_number', grnNumber);

  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error('The requested GRN was not found.');
  return result.data as Record<string, unknown>;
}

function classifySalesStockDeduction(stockMovementCount: number) {
  if (stockMovementCount <= 0) return 'zero times';
  if (stockMovementCount === 1) return 'once';
  return 'multiple times';
}

export function describeFiscalPeriodAvailability(period: Record<string, unknown> | null, effectiveDate: string) {
  if (!period) {
    return {
      detail: `No open fiscal period covers ${effectiveDate}.`,
      mayPost: false,
      status: 'problem',
    } as const;
  }

  return {
    detail: `${String(period.period_name ?? 'Open period')} covers ${effectiveDate}.`,
    mayPost: true,
    status: 'healthy',
  } as const;
}

export function isAbsoluteAiWriteIntent(prompt: string) {
  return /\b(post|approve|create|delete|remove|edit|update|reverse|restart|insert|run sql|execute sql|change|write)\b/i.test(prompt);
}

async function getGrnStatus(context: AbsoluteAiToolExecutionContext, args: Record<string, unknown>) {
  const auth = context.auth;
  const service = createServiceRoleClient().schema('icecream_erp');
  const grn = await resolveGrnIdentifier(auth, args);
  const detail = await fetchGoodsReceivedNoteDetail(service, {
    grnId: String(grn.id),
    organizationId: auth.organizationId,
  });

  return {
    data: {
      grnId: grn.id,
      grnNumber: grn.grn_number ?? null,
      itemCount: Array.isArray(detail.items) ? detail.items.length : 0,
      status: grn.status ?? null,
      stockPosted: grn.stock_posted === true,
    },
    summary: `GRN ${String(grn.grn_number ?? grn.id)} is ${String(grn.status ?? 'UNKNOWN')}.`,
  };
}

async function diagnoseGrn(context: AbsoluteAiToolExecutionContext, args: Record<string, unknown>) {
  const auth = context.auth;
  const service = createServiceRoleClient().schema('icecream_erp');
  const grn = await resolveGrnIdentifier(auth, args);
  const detail = await fetchGoodsReceivedNoteDetail(service, {
    grnId: String(grn.id),
    organizationId: auth.organizationId,
  });

  const [supplierResult, poResult, warehouseResult, branchResult, movementsResult, balancesResult, postingRunsResult] = await Promise.all([
    grn.supplier_id
      ? service.from('suppliers').select('id, name').eq('id', String(grn.supplier_id)).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    grn.purchase_order_id
      ? service.from('purchase_orders').select('id, po_number, status').eq('id', String(grn.purchase_order_id)).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    grn.warehouse_id
      ? service.from('warehouses').select('id, code, name, branch_id').eq('id', String(grn.warehouse_id)).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    grn.branch_id
      ? service.from('branches').select('id, code, name').eq('id', String(grn.branch_id)).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    service
      .from('stock_movements')
      .select('id, item_id, warehouse_id, movement_type, quantity, total_value, created_at, reference_id, reference_type, source_document_id, source_document_type, reference_number')
      .eq('organization_id', auth.organizationId)
      .or(`reference_id.eq.${String(grn.id)},source_document_id.eq.${String(grn.id)}`)
      .limit(ABSOLUTE_AI_MAX_RESULT_ROWS),
    service
      .from('stock_balances')
      .select('item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value')
      .eq('organization_id', auth.organizationId)
      .eq('warehouse_id', String(grn.warehouse_id ?? '')),
    service
      .from('inventory_posting_runs')
      .select('id, operation_type, posting_status, source_document_type, source_document_id, created_at, completed_at, notes')
      .eq('organization_id', auth.organizationId)
      .eq('source_document_id', String(grn.id))
      .limit(5),
  ]);

  if (supplierResult.error) throw supplierResult.error;
  if (poResult.error) throw poResult.error;
  if (warehouseResult.error) throw warehouseResult.error;
  if (branchResult.error) throw branchResult.error;
  if (movementsResult.error) throw movementsResult.error;
  if (balancesResult.error) throw balancesResult.error;
  if (postingRunsResult.error && !/Could not find the table|schema cache/i.test(String(postingRunsResult.error.message ?? ''))) {
    throw postingRunsResult.error;
  }

  const itemIds = new Set(
    (Array.isArray(detail.items) ? detail.items : [])
      .map((item) => String((item as Record<string, unknown>).item_id ?? (item as Record<string, unknown>).itemId ?? ''))
      .filter(Boolean),
  );
  const relatedBalances = (balancesResult.data ?? []).filter((row) => itemIds.has(String(row.item_id ?? '')));
  const effectiveDate = String(grn.received_date ?? grn.created_at ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const fiscalPeriod = await findOpenFiscalPeriod(auth.organizationId, effectiveDate);
  const likelyBlocker =
    grn.stock_posted === true
      ? null
      : !grn.warehouse_id
        ? 'Receiving warehouse is missing on the GRN.'
        : !Array.isArray(detail.items) || detail.items.length === 0
          ? 'The GRN has no receivable item lines.'
          : !fiscalPeriod
            ? `No open fiscal period covers ${effectiveDate}.`
            : (movementsResult.data ?? []).length === 0
              ? 'No stock movement exists yet for this GRN.'
              : null;

  return {
    data: {
      acceptedQuantities: (detail.items ?? []).map((item) => ({
        acceptedQuantity: (item as Record<string, unknown>).accepted_quantity ?? (item as Record<string, unknown>).quantityReceived ?? null,
        itemId: (item as Record<string, unknown>).item_id ?? (item as Record<string, unknown>).itemId ?? null,
        lineTotal: (item as Record<string, unknown>).line_total ?? null,
      })),
      branch: branchResult.data ?? null,
      grn: {
        grnId: grn.id,
        grnNumber: grn.grn_number ?? null,
        inventoryValuePosted: grn.inventory_value_posted ?? null,
        likelyBlocker,
        status: grn.status ?? null,
        stockPosted: grn.stock_posted === true,
      },
      itemLines: detail.items ?? [],
      postingRun: postingRunsResult.data ?? [],
      purchaseOrder: poResult.data ?? null,
      relatedStockBalanceEffects: relatedBalances,
      relatedStockMovements: movementsResult.data ?? [],
      scope: buildScopeSummary(auth),
      supplier: supplierResult.data ?? null,
      warehouse: warehouseResult.data ?? null,
    },
    summary: likelyBlocker
      ? `GRN ${String(grn.grn_number ?? grn.id)} is not fully posted. ${likelyBlocker}`
      : `GRN ${String(grn.grn_number ?? grn.id)} has inventory posting evidence.`,
  };
}

function summarizeStockBalanceRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    averageCost: row.average_cost ?? null,
    quantityAvailable: row.quantity_available ?? null,
    quantityOnHand: row.quantity_on_hand ?? row.quantity ?? null,
    quantityReserved: row.quantity_reserved ?? null,
    totalValue: row.total_value ?? null,
    warehouseId: row.warehouse_id ?? null,
  }));
}

async function getStockBalance(context: AbsoluteAiToolExecutionContext, args: Record<string, unknown>) {
  const auth = context.auth;
  const service = createServiceRoleClient().schema('icecream_erp');
  const { item, matches } = await resolveItem(auth, args);
  const { warehouse } = await resolveWarehouse(auth, args);
  const warehouseIds = warehouse ? [warehouse.id] : (await loadAuthorizedWarehouses(auth)).map((entry) => entry.id);

  const result = await service
    .from('stock_balances')
    .select('item_id, warehouse_id, quantity, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_updated')
    .eq('organization_id', auth.organizationId)
    .eq('item_id', item.id)
    .in('warehouse_id', warehouseIds.slice(0, ABSOLUTE_AI_MAX_RESULT_ROWS));

  if (result.error) throw result.error;

  const warehouses = await loadAuthorizedWarehouses(auth);
  const warehousesById = new Map(warehouses.map((entry) => [entry.id, entry]));
  const rows = summarizeStockBalanceRows((result.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    warehouse: warehousesById.get(String(row.warehouseId ?? '')) ?? null,
  }));

  return {
    data: {
      item: {
        code: item.code ?? null,
        id: item.id,
        itemType: item.item_type ?? null,
        name: item.name ?? null,
      },
      matches,
      scope: buildScopeSummary(auth),
      stockBalances: rows,
    },
    summary: rows.length > 0
      ? `${item.name ?? item.code ?? item.id} has ${rows.length} visible stock balance row(s).`
      : `${item.name ?? item.code ?? item.id} has no visible stock balance rows.`,
  };
}

async function getStockMovements(context: AbsoluteAiToolExecutionContext, args: Record<string, unknown>) {
  const auth = context.auth;
  const service = createServiceRoleClient().schema('icecream_erp');
  const { item } = await resolveItem(auth, args);
  const { warehouse } = await resolveWarehouse(auth, args);

  const movementRows = await listCompatibleStockMovements(service, {
    branchId: auth.branchId,
    endDate: maybeDate(args.endDate) ?? undefined,
    isBranchScoped: auth.isBranchScoped,
    itemId: item.id,
    page: 1,
    pageSize: Math.min(
      ABSOLUTE_AI_MAX_RESULT_ROWS,
      Math.max(1, Number(args.limit ?? ABSOLUTE_AI_MAX_RESULT_ROWS)),
    ),
    startDate: maybeDate(args.startDate) ?? undefined,
    warehouseId: warehouse?.id ?? undefined,
  });
  const mapped = await mapCompatibleStockMovementRows(service, movementRows.rows);

  return {
    data: {
      item: {
        code: item.code ?? null,
        id: item.id,
        name: item.name ?? null,
      },
      scope: buildScopeSummary(auth),
      stockMovements: mapped,
      warehouse: warehouse ?? null,
    },
    summary: `Loaded ${mapped.length} stock movement(s) for ${item.name ?? item.code ?? item.id}.`,
  };
}

async function diagnoseSalesStock(context: AbsoluteAiToolExecutionContext, args: Record<string, unknown>) {
  const auth = context.auth;
  const service = createServiceRoleClient().schema('icecream_erp');
  const invoiceId = stringValue(args.invoiceId);
  const invoiceNumber = stringValue(args.invoiceNumber);
  const dispatchId = stringValue(args.dispatchId);
  const dispatchNumber = stringValue(args.dispatchNumber);
  const orderId = stringValue(args.salesOrderId);
  const orderNumber = stringValue(args.salesOrderNumber);

  let invoice: Record<string, unknown> | null = null;
  let dispatch: Record<string, unknown> | null = null;
  let order: Record<string, unknown> | null = null;

  if (invoiceId || invoiceNumber) {
    const result = await service
      .from('invoices')
      .select('id, invoice_number, sales_order_id, warehouse_id, branch_id, status, approved_at, posted_at')
      .eq('organization_id', auth.organizationId)
      .eq(invoiceId ? 'id' : 'invoice_number', invoiceId || invoiceNumber)
      .maybeSingle();
    if (result.error) throw result.error;
    invoice = (result.data ?? null) as Record<string, unknown> | null;
  }

  if (dispatchId || dispatchNumber) {
    const result = await service
      .from('sales_dispatch_notes')
      .select('id, dispatch_note_number, invoice_id, warehouse_id, status, posted_at, dispatch_date')
      .eq(dispatchId ? 'id' : 'dispatch_note_number', dispatchId || dispatchNumber)
      .maybeSingle();
    if (result.error && !/Could not find the table/i.test(String(result.error.message ?? ''))) {
      throw result.error;
    }
    dispatch = (result.data ?? null) as Record<string, unknown> | null;
  }

  if (orderId || orderNumber || invoice?.sales_order_id) {
    const orderLookupId = orderId || stringValue(invoice?.sales_order_id) || orderNumber;
    const result = await service
      .from('sales_orders')
      .select('id, order_number, warehouse_id, branch_id, status')
      .eq('organization_id', auth.organizationId)
      .eq(orderId || invoice?.sales_order_id ? 'id' : 'order_number', orderLookupId)
      .maybeSingle();
    if (result.error) throw result.error;
    order = (result.data ?? null) as Record<string, unknown> | null;
  }

  if (!dispatch && invoice?.id) {
    const dispatchResult = await service
      .from('sales_dispatch_notes')
      .select('id, dispatch_note_number, invoice_id, warehouse_id, status, posted_at, dispatch_date')
      .eq('invoice_id', String(invoice.id))
      .limit(1)
      .maybeSingle();
    if (dispatchResult.error && !/Could not find the table/i.test(String(dispatchResult.error.message ?? ''))) {
      throw dispatchResult.error;
    }
    dispatch = (dispatchResult.data ?? null) as Record<string, unknown> | null;
  }

  const movementReferenceIds = [dispatch?.id, invoice?.id, order?.id].filter(Boolean).map(String);
  let movements: Array<Record<string, unknown>> = [];
  let balances: Array<Record<string, unknown>> = [];

  if (movementReferenceIds.length > 0) {
    const [movementResult, balanceResult] = await Promise.all([
      service
        .from('stock_movements')
        .select('id, item_id, warehouse_id, movement_type, quantity, total_value, created_at, reference_id, reference_type, reference_number')
        .eq('organization_id', auth.organizationId)
        .in('reference_id', movementReferenceIds),
      dispatch?.warehouse_id
        ? service
          .from('stock_balances')
          .select('item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, total_value')
          .eq('organization_id', auth.organizationId)
          .eq('warehouse_id', String(dispatch.warehouse_id))
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (movementResult.error) throw movementResult.error;
    if (balanceResult.error) throw balanceResult.error;

    movements = (movementResult.data ?? []) as Array<Record<string, unknown>>;
    balances = (balanceResult.data ?? []) as Array<Record<string, unknown>>;
  }

  const physicalIssues = movements.filter((row) => normalizeStockMovementType(String(row.movement_type ?? '')) === 'SALES_ISSUE');
  const deductionCount = classifySalesStockDeduction(physicalIssues.length);

  return {
    data: {
      branchId: invoice?.branch_id ?? order?.branch_id ?? null,
      currentBalances: balances,
      dispatch: dispatch ?? null,
      invoice: invoice ?? null,
      physicalStockDeducted: deductionCount,
      salesOrder: order ?? null,
      stockMovements: movements,
      warehouseId: dispatch?.warehouse_id ?? invoice?.warehouse_id ?? order?.warehouse_id ?? null,
    },
    summary: physicalIssues.length > 0
      ? `Sales stock was deducted ${deductionCount}.`
      : 'No physical stock deduction movement was found for the requested sales transaction.',
  };
}

async function reconcileInventoryBalance(context: AbsoluteAiToolExecutionContext, args: Record<string, unknown>) {
  const auth = context.auth;
  const service = createServiceRoleClient().schema('icecream_erp');
  const { item } = await resolveItem(auth, args);
  const { warehouse } = await resolveWarehouse(auth, args);

  if (!warehouse) {
    throw new Error('A warehouseId, warehouseCode, or warehouseName is required for reconciliation.');
  }

  const [balanceResult, movementResult] = await Promise.all([
    service
      .from('stock_balances')
      .select('item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, total_value')
      .eq('organization_id', auth.organizationId)
      .eq('item_id', item.id)
      .eq('warehouse_id', warehouse.id)
      .maybeSingle(),
    service
      .from('stock_movements')
      .select('id, movement_type, quantity, total_value, created_at')
      .eq('organization_id', auth.organizationId)
      .eq('item_id', item.id)
      .eq('warehouse_id', warehouse.id)
      .order('created_at', { ascending: true }),
  ]);

  if (balanceResult.error) throw balanceResult.error;
  if (movementResult.error) throw movementResult.error;

  const startDate = maybeDate(args.startDate);
  const endDate = maybeDate(args.endDate);
  const allMovements = (movementResult.data ?? []) as Array<Record<string, unknown>>;
  const beforeStart = startDate
    ? allMovements.filter((row) => String(row.created_at ?? '').slice(0, 10) < startDate)
    : [];
  const inRange = allMovements.filter((row) => {
    const movementDate = String(row.created_at ?? '').slice(0, 10);
    if (startDate && movementDate < startDate) return false;
    if (endDate && movementDate > endDate) return false;
    return true;
  });

  const accumulateQuantity = (rows: Array<Record<string, unknown>>) => rows.reduce((sum, row) => {
    const movementType = normalizeStockMovementType(String(row.movement_type ?? ''));
    if (STOCK_IN_MOVEMENT_TYPES.has(movementType)) return sum + toNumber(row.quantity);
    if (STOCK_OUT_MOVEMENT_TYPES.has(movementType)) return sum - toNumber(row.quantity);
    return sum;
  }, 0);

  const openingQuantity = accumulateQuantity(beforeStart);
  const movementQuantity = accumulateQuantity(inRange);
  const expectedQuantity = openingQuantity + movementQuantity;
  const currentQuantity = toNumber(balanceResult.data?.quantity_on_hand ?? 0);

  return {
    data: {
      currentQuantity,
      discrepancy: currentQuantity - expectedQuantity,
      expectedQuantity,
      item: {
        code: item.code ?? null,
        id: item.id,
        name: item.name ?? null,
      },
      movementCount: inRange.length,
      openingQuantity,
      rangeEnd: endDate ?? null,
      rangeStart: startDate ?? null,
      warehouse: {
        code: warehouse.code ?? null,
        id: warehouse.id,
        name: warehouse.name ?? null,
      },
    },
    summary: `Expected quantity is ${expectedQuantity} and current on-hand is ${currentQuantity}.`,
  };
}

async function checkFiscalPeriod(context: AbsoluteAiToolExecutionContext, args: Record<string, unknown>) {
  const auth = context.auth;
  const effectiveDate = maybeDate(args.date) ?? new Date().toISOString().slice(0, 10);
  return getCachedDiagnostic(
    `fiscal-period:${auth.organizationId}:${effectiveDate}`,
    ABSOLUTE_AI_DIAGNOSTIC_CACHE_TTL_MS,
    async () => {
      const period = await findOpenFiscalPeriod(auth.organizationId, effectiveDate);
      const availability = describeFiscalPeriodAvailability(period as Record<string, unknown> | null, effectiveDate);

      return {
        data: {
          date: effectiveDate,
          mayPost: availability.mayPost,
          period: period ? {
            endDate: period.end_date ?? null,
            id: period.id ?? null,
            periodName: period.period_name ?? null,
            startDate: period.start_date ?? null,
            status: period.status ?? null,
          } : null,
        },
        summary: availability.detail,
      };
    },
  );
}

async function checkRolePermissions(context: AbsoluteAiToolExecutionContext, args: Record<string, unknown>) {
  const auth = context.auth;
  const service = createServiceRoleClient().schema('icecream_erp');
  const roleId = stringValue(args.roleId);
  const roleName = stringValue(args.roleName);
  const roleCode = stringValue(args.roleCode);

  let roleQuery = service
    .from('roles')
    .select('id, name, code, description')
    .eq('organization_id', auth.organizationId)
    .limit(1);

  if (roleId) roleQuery = roleQuery.eq('id', roleId);
  else if (roleCode) roleQuery = roleQuery.eq('code', roleCode);
  else if (roleName) roleQuery = roleQuery.eq('name', roleName);
  else throw new Error('A roleId, roleCode, or roleName is required.');

  const roleResult = await roleQuery.maybeSingle();
  if (roleResult.error) throw roleResult.error;
  if (!roleResult.data) throw new Error('The requested role was not found.');

  const role = roleResult.data as Record<string, unknown>;
  return getCachedDiagnostic(
    `role-permissions:${auth.organizationId}:${String(role.id)}`,
    ABSOLUTE_AI_ROLE_CACHE_TTL_MS,
    async () => {
      const [rolePermissionsResult, permissionsResult] = await Promise.all([
        service.from('role_permissions').select('permission_id').eq('role_id', String(role.id)),
        service.from('permissions').select('id, code, module_name, action_name'),
      ]);

      if (rolePermissionsResult.error) throw rolePermissionsResult.error;
      if (permissionsResult.error) throw permissionsResult.error;

      const permissionIds = new Set((rolePermissionsResult.data ?? []).map((row) => String(row.permission_id ?? '')));
      const permissions = (permissionsResult.data ?? [])
        .filter((row) => permissionIds.has(String(row.id ?? '')))
        .map((row) => ({
          action: row.action_name ?? null,
          code: row.code ?? null,
          module: row.module_name ?? null,
        }));

      return {
        data: {
          permissionCount: permissions.length,
          permissions: permissions.slice(0, ABSOLUTE_AI_MAX_RESULT_ROWS),
          role: {
            code: role.code ?? null,
            description: role.description ?? null,
            id: role.id,
            name: role.name ?? null,
          },
          suspiciousMissingAccess: permissions.length === 0 ? ['Role has no permissions assigned.'] : [],
        },
        summary: `${String(role.name ?? role.id)} has ${permissions.length} assigned permission(s).`,
      };
    },
  );
}

function mapHealthStatus(status: AbsoluteAiHealthCard['status']) {
  return status;
}

async function buildSystemDoctorSummary(auth: AuthContext): Promise<AbsoluteAiHealthCard[]> {
  const service = createServiceRoleClient().schema('icecream_erp');
  const today = new Date().toISOString().slice(0, 10);
  const [database, period, roleCount, branchCount, warehouseCount, unpostedGrnCount, negativeBalanceCount] = await Promise.all([
    checkDatabaseHealth(),
    findOpenFiscalPeriod(auth.organizationId, today),
    service.from('roles').select('id', { count: 'exact', head: true }).eq('organization_id', auth.organizationId),
    service.from('branches').select('id', { count: 'exact', head: true }).eq('organization_id', auth.organizationId).is('deleted_at', null),
    service.from('warehouses').select('id', { count: 'exact', head: true }).eq('organization_id', auth.organizationId),
    service.from('goods_received_notes').select('id', { count: 'exact', head: true }).eq('organization_id', auth.organizationId).eq('status', 'RECEIVED').or('stock_posted.is.false,stock_posted.is.null'),
    service.from('stock_balances').select('id', { count: 'exact', head: true }).eq('organization_id', auth.organizationId).lt('quantity_on_hand', 0),
  ]);

  const cards: AbsoluteAiHealthCard[] = [
    {
      detail: database.ok ? 'Database connectivity is healthy.' : database.error ?? 'Database health could not be confirmed.',
      key: 'database',
      status: database.ok ? 'healthy' : 'problem',
      title: 'Database',
    },
    {
      detail: period ? `Open through ${String(period.end_date ?? '')}.` : `No open fiscal period covers ${today}.`,
      key: 'fiscal-period',
      status: period ? 'healthy' : 'problem',
      title: 'Fiscal Period',
    },
    {
      detail: (unpostedGrnCount.count ?? 0) > 0
        ? `${unpostedGrnCount.count ?? 0} received GRN(s) still need posting review.`
        : 'No received-but-unposted GRNs were found.',
      key: 'grn-posting',
      status: (unpostedGrnCount.count ?? 0) > 0 ? 'warning' : 'healthy',
      title: 'GRN Posting',
    },
    {
      detail: (negativeBalanceCount.count ?? 0) > 0
        ? `${negativeBalanceCount.count ?? 0} negative stock balance row(s) were found.`
        : 'No negative stock balances were detected.',
      key: 'inventory',
      status: (negativeBalanceCount.count ?? 0) > 0 ? 'problem' : 'healthy',
      title: 'Inventory',
    },
    {
      detail: `${branchCount.count ?? 0} branch(es) and ${warehouseCount.count ?? 0} warehouse(s) are visible in scope.`,
      key: 'sales-inventory',
      status: (branchCount.count ?? 0) > 0 && (warehouseCount.count ?? 0) > 0 ? 'healthy' : 'warning',
      title: 'Sales -> Inventory',
    },
    {
      detail: `${roleCount.count ?? 0} role(s) are configured.`,
      key: 'roles-rbac',
      status: (roleCount.count ?? 0) > 0 ? 'healthy' : 'problem',
      title: 'Roles/RBAC',
    },
  ];

  return cards.map((card) => ({ ...card, status: mapHealthStatus(card.status) }));
}

async function systemHealth(context: AbsoluteAiToolExecutionContext) {
  const auth = context.auth;
  return getCachedDiagnostic(
    `system-health:${auth.organizationId}:${auth.branchId ?? 'all'}:${auth.isBranchScoped ? 'scoped' : 'global'}`,
    ABSOLUTE_AI_DIAGNOSTIC_CACHE_TTL_MS,
    async () => {
      const openingBalances = await listFinanceOpeningBalances(auth.organizationId).catch(() => []);
      const cards = await buildSystemDoctorSummary(auth);

      return {
        data: {
          openingBalanceDrafts: openingBalances.slice(0, 5),
          scope: buildScopeSummary(auth),
          summary: cards,
        },
        summary: cards.map((card) => `${card.title}: ${card.status}`).join(' | '),
      };
    },
  );
}

async function diagnoseProductionReports(context: AbsoluteAiToolExecutionContext) {
  const auth = context.auth;
  const service = createServiceRoleClient().schema('icecream_erp');

  return getCachedDiagnostic(
    `production-reports:${auth.organizationId}:${auth.branchId ?? 'all'}:${auth.isBranchScoped ? 'scoped' : 'global'}`,
    ABSOLUTE_AI_DIAGNOSTIC_CACHE_TTL_MS,
    async () => {
      const relationshipIssues: string[] = [];
      const probes = [
        {
          key: 'production_batch_materials',
          query: service.from('production_batches').select('id, production_batch_materials(quantity_required)').limit(1),
        },
        {
          key: 'production_batch_outputs',
          query: service.from('production_batches').select('id, production_batch_outputs(expected_quantity)').limit(1),
        },
        {
          key: 'production_worker_assignments',
          query: service.from('production_batches').select('id, production_worker_assignments(employee_id)').limit(1),
        },
      ];

      for (const probe of probes) {
        const result = await probe.query;
        if (result.error) {
          if (isMissingRelationshipError(result.error, 'production_batches', probe.key)) {
            relationshipIssues.push(probe.key);
            continue;
          }
          throw result.error;
        }
      }

      const reportData = await loadProductionReportBatches({
        branchId: auth.isBranchScoped ? auth.branchId : null,
      });

      return {
        data: {
          compatibilityMode: relationshipIssues.length > 0,
          directQueryIssues: relationshipIssues,
          emptyReportIsValid: reportData.batches.length === 0,
          scope: buildScopeSummary(auth),
          visibleBatchCount: reportData.batches.length,
        },
        summary: relationshipIssues.length > 0
          ? `Production Reports is running in compatibility mode because direct batch relationships are missing for ${relationshipIssues.join(', ')}.`
          : `Production Reports direct query path is healthy with ${reportData.batches.length} visible batch row(s).`,
      };
    },
  );
}

async function diagnoseFinanceOpeningBalances(context: AbsoluteAiToolExecutionContext) {
  const auth = context.auth;
  const service = createServiceRoleClient().schema('icecream_erp');

  return getCachedDiagnostic(
    `finance-opening-balances:${auth.organizationId}`,
    ABSOLUTE_AI_DIAGNOSTIC_CACHE_TTL_MS,
    async () => {
      const issues: string[] = [];
      const cashAccountsProbe = await service
        .from('cash_accounts')
        .select('id, name, account_name, branch_id, balance, current_balance')
        .eq('organization_id', auth.organizationId)
        .limit(1);

      if (cashAccountsProbe.error) {
        const message = String(cashAccountsProbe.error.message ?? '');
        if (
          /column cash_accounts\.(name|branch_id|current_balance) does not exist/i.test(message)
        ) {
          issues.push(message);
        } else {
          throw cashAccountsProbe.error;
        }
      }

      const [meta, openingBalances] = await Promise.all([
        loadFinanceMetaResources(auth.organizationId),
        listFinanceOpeningBalances(auth.organizationId),
      ]);

      return {
        data: {
          compatibilityIssues: issues,
          cashAccountCount: meta.cashAccounts.length,
          fiscalPeriodCount: meta.fiscalPeriods.length,
          openingBalanceCount: openingBalances.length,
          scope: buildScopeSummary(auth),
        },
        summary: issues.length > 0
          ? 'Finance opening-balance configuration required compatibility handling for legacy cash_accounts columns.'
          : 'Finance opening-balance configuration is healthy.',
      };
    },
  );
}

function detectInventoryAnomalies(input: {
  balances: Array<Record<string, unknown>>;
  dispatchMovements: Array<Record<string, unknown>>;
  grns: Array<Record<string, unknown>>;
  movements: Array<Record<string, unknown>>;
}) {
  const anomalies: Array<Record<string, unknown>> = [];
  for (const balance of input.balances) {
    if (toNumber(balance.quantity_on_hand) < 0) {
      anomalies.push({
        issueType: 'NEGATIVE_STOCK',
        reference: balance.id ?? null,
      });
    }

    const onHand = toNumber(balance.quantity_on_hand);
    const reserved = toNumber(balance.quantity_reserved);
    const available = toNumber(balance.quantity_available);
    if (Math.abs((onHand - reserved) - available) > 0.0001) {
      anomalies.push({
        issueType: 'AVAILABLE_MISMATCH',
        reference: balance.id ?? null,
      });
    }
  }

  for (const grn of input.grns) {
    if (String(grn.status ?? '').toUpperCase() !== 'POSTED') continue;
    const related = input.movements.some((row) =>
      String(row.reference_id ?? row.source_document_id ?? '') === String(grn.id),
    );
    if (!related) {
      anomalies.push({
        issueType: 'GRN_POSTED_WITHOUT_LEDGER',
        reference: grn.grn_number ?? grn.id ?? null,
      });
    }
  }

  for (const movement of input.dispatchMovements) {
    const key = `sales_dispatch:${movement.reference_id}:${movement.item_id}:${movement.warehouse_id}:SALES_ISSUE`;
    const duplicates = input.dispatchMovements.filter((row) =>
      `sales_dispatch:${row.reference_id}:${row.item_id}:${row.warehouse_id}:SALES_ISSUE` === key,
    );
    if (duplicates.length > 1) {
      anomalies.push({
        issueType: 'DISPATCH_DUPLICATE_STOCK_ISSUE',
        reference: movement.reference_id ?? null,
      });
    }
  }

  return anomalies;
}

async function findInventoryAnomalies(context: AbsoluteAiToolExecutionContext) {
  const auth = context.auth;
  const service = createServiceRoleClient().schema('icecream_erp');
  const warehouses = await loadAuthorizedWarehouses(auth);
  const warehouseIds = warehouses.map((row) => row.id);
  const scopedIds = warehouseIds.length > 0 ? warehouseIds : ['00000000-0000-0000-0000-000000000000'];
  const [balancesResult, movementsResult, grnResult] = await Promise.all([
    service
      .from('stock_balances')
      .select('id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved')
      .eq('organization_id', auth.organizationId)
      .in('warehouse_id', scopedIds),
    service
      .from('stock_movements')
      .select('id, item_id, warehouse_id, movement_type, reference_id, reference_type, source_document_id')
      .eq('organization_id', auth.organizationId)
      .in('warehouse_id', scopedIds),
    service
      .from('goods_received_notes')
      .select('id, grn_number, status')
      .eq('organization_id', auth.organizationId),
  ]);

  if (balancesResult.error) throw balancesResult.error;
  if (movementsResult.error) throw movementsResult.error;
  if (grnResult.error) throw grnResult.error;

  const movementRows = (movementsResult.data ?? []) as Array<Record<string, unknown>>;
  const anomalies = detectInventoryAnomalies({
    balances: (balancesResult.data ?? []) as Array<Record<string, unknown>>,
    dispatchMovements: movementRows.filter((row) => String(row.reference_type ?? '').toLowerCase() === 'sales_dispatch'),
    grns: (grnResult.data ?? []) as Array<Record<string, unknown>>,
    movements: movementRows,
  });

  return {
    data: {
      anomalies: anomalies.slice(0, ABSOLUTE_AI_MAX_RESULT_ROWS),
      scope: buildScopeSummary(auth),
      total: anomalies.length,
    },
    summary: anomalies.length > 0
      ? `${anomalies.length} inventory anomaly signal(s) were found.`
      : 'No inventory anomaly signals were found in the visible scope.',
  };
}

const TOOL_REGISTRY: Record<string, ToolRecord> = {
  diagnose_grn: {
    allowed: (auth) => can(auth, 'stores.grn.view', 'procurement.read'),
    definition: {
      description: 'Diagnose a GRN and explain whether inventory posting artifacts exist.',
      friendlyName: 'Checking GRN',
      name: 'diagnose_grn',
      parameters: {
        properties: {
          grnId: { type: 'string' },
          grnNumber: { type: 'string' },
        },
        required: [],
        type: 'object',
      },
    },
    execute: diagnoseGrn,
  },
  get_grn_status: {
    allowed: (auth) => can(auth, 'stores.grn.view', 'procurement.read'),
    definition: {
      description: 'Return concise GRN status information.',
      friendlyName: 'Checking GRN status',
      name: 'get_grn_status',
      parameters: {
        properties: {
          grnId: { type: 'string' },
          grnNumber: { type: 'string' },
        },
        required: [],
        type: 'object',
      },
    },
    execute: getGrnStatus,
  },
  get_stock_balance: {
    allowed: (auth) => can(auth, 'inventory.read', 'sales.read', 'procurement.read'),
    definition: {
      description: 'Return visible stock balance information for an item and optional warehouse.',
      friendlyName: 'Checking stock balance',
      name: 'get_stock_balance',
      parameters: {
        properties: {
          itemCode: { type: 'string' },
          itemId: { type: 'string' },
          itemName: { type: 'string' },
          warehouseCode: { type: 'string' },
          warehouseId: { type: 'string' },
          warehouseName: { type: 'string' },
        },
        required: ['itemName'],
        type: 'object',
      },
    },
    execute: getStockBalance,
  },
  get_stock_movements: {
    allowed: (auth) => can(auth, 'inventory.read', 'sales.read', 'procurement.read'),
    definition: {
      description: 'Return recent stock movements for an item and optional warehouse/date range.',
      friendlyName: 'Tracing stock movements',
      name: 'get_stock_movements',
      parameters: {
        properties: {
          endDate: { type: 'string' },
          itemCode: { type: 'string' },
          itemId: { type: 'string' },
          itemName: { type: 'string' },
          limit: { type: 'number' },
          startDate: { type: 'string' },
          warehouseCode: { type: 'string' },
          warehouseId: { type: 'string' },
          warehouseName: { type: 'string' },
        },
        required: ['itemName'],
        type: 'object',
      },
    },
    execute: getStockMovements,
  },
  diagnose_sales_stock: {
    allowed: (auth) => can(auth, 'sales.read', 'inventory.read', 'finance.read'),
    definition: {
      description: 'Trace a sales order, invoice, or dispatch to its stock deduction evidence.',
      friendlyName: 'Tracing sales stock',
      name: 'diagnose_sales_stock',
      parameters: {
        properties: {
          dispatchId: { type: 'string' },
          dispatchNumber: { type: 'string' },
          invoiceId: { type: 'string' },
          invoiceNumber: { type: 'string' },
          salesOrderId: { type: 'string' },
          salesOrderNumber: { type: 'string' },
        },
        required: [],
        type: 'object',
      },
    },
    execute: diagnoseSalesStock,
  },
  reconcile_inventory_balance: {
    allowed: (auth) => can(auth, 'inventory.read', 'finance.read', 'reports.read'),
    definition: {
      description: 'Reconcile expected inventory quantity against the current stock balance.',
      friendlyName: 'Reconciling inventory',
      name: 'reconcile_inventory_balance',
      parameters: {
        properties: {
          endDate: { type: 'string' },
          itemCode: { type: 'string' },
          itemId: { type: 'string' },
          itemName: { type: 'string' },
          startDate: { type: 'string' },
          warehouseCode: { type: 'string' },
          warehouseId: { type: 'string' },
          warehouseName: { type: 'string' },
        },
        required: ['itemName', 'warehouseName'],
        type: 'object',
      },
    },
    execute: reconcileInventoryBalance,
  },
  check_fiscal_period: {
    allowed: (auth) => can(auth, 'finance.read', 'inventory.read', 'procurement.read', 'sales.read'),
    definition: {
      description: 'Check whether a date falls inside an open fiscal period.',
      friendlyName: 'Checking fiscal period',
      name: 'check_fiscal_period',
      parameters: {
        properties: {
          date: { type: 'string' },
        },
        required: [],
        type: 'object',
      },
    },
    execute: checkFiscalPeriod,
  },
  check_role_permissions: {
    allowed: (auth) => can(auth, 'settings.manage', 'audit_log.read'),
    definition: {
      description: 'Check a role and summarize its assigned permissions.',
      friendlyName: 'Checking role permissions',
      name: 'check_role_permissions',
      parameters: {
        properties: {
          roleCode: { type: 'string' },
          roleId: { type: 'string' },
          roleName: { type: 'string' },
        },
        required: [],
        type: 'object',
      },
    },
    execute: checkRolePermissions,
  },
  diagnose_production_reports: {
    allowed: (auth) => can(auth, 'production.read', 'reports.read'),
    definition: {
      description: 'Check whether Production Reports can load and summarize any compatibility issue safely.',
      friendlyName: 'Checking Production Reports',
      name: 'diagnose_production_reports',
      parameters: {
        properties: {},
        required: [],
        type: 'object',
      },
    },
    execute: diagnoseProductionReports,
  },
  diagnose_finance_opening_balances: {
    allowed: (auth) => can(auth, 'finance.read', 'reports.read'),
    definition: {
      description: 'Check whether Finance Opening Balances can load and summarize any safe configuration issue.',
      friendlyName: 'Checking opening balances',
      name: 'diagnose_finance_opening_balances',
      parameters: {
        properties: {},
        required: [],
        type: 'object',
      },
    },
    execute: diagnoseFinanceOpeningBalances,
  },
  system_health: {
    allowed: (auth) => can(auth, 'dashboard.read', 'inventory.read', 'sales.read', 'finance.read', 'procurement.read', 'reports.read'),
    definition: {
      description: 'Return a compact operational health summary for the visible ERP scope.',
      friendlyName: 'Checking system health',
      name: 'system_health',
      parameters: {
        properties: {},
        required: [],
        type: 'object',
      },
    },
    execute: systemHealth,
  },
  find_inventory_anomalies: {
    allowed: (auth) => can(auth, 'inventory.read', 'finance.read', 'audit_log.read', 'reports.read'),
    definition: {
      description: 'Find visible inventory anomaly signals such as negative balances or posted GRNs without ledger movement.',
      friendlyName: 'Scanning inventory anomalies',
      name: 'find_inventory_anomalies',
      parameters: {
        properties: {},
        required: [],
        type: 'object',
      },
    },
    execute: findInventoryAnomalies,
  },
};

export function getAbsoluteAiToolDefinitions(auth: AuthContext) {
  return Object.values(TOOL_REGISTRY)
    .filter((tool) => tool.allowed(auth))
    .map((tool) => tool.definition);
}

export async function executeAbsoluteAiTool(
  context: AbsoluteAiToolExecutionContext,
  name: string,
  args: Record<string, unknown>,
) {
  const tool = TOOL_REGISTRY[name];
  if (!tool) {
    throw new Error(`Absolute AI tool ${name} is not registered.`);
  }
  if (!tool.allowed(context.auth)) {
    throw new Error(`Absolute AI tool ${name} is not allowed for this user.`);
  }
  return tool.execute(context, args);
}

export async function getAbsoluteAiSystemDoctor(auth: AuthContext) {
  return getCachedDiagnostic(
    `system-doctor:${auth.organizationId}:${auth.branchId ?? 'all'}:${auth.isBranchScoped ? 'scoped' : 'global'}`,
    ABSOLUTE_AI_DIAGNOSTIC_CACHE_TTL_MS,
    () => buildSystemDoctorSummary(auth),
  );
}
