import type { AuthContext } from '@/lib/api-auth';
import {
  authorizeProductionOrderForWrite,
  resolveProductionCreateBranchAuthorization,
  resolveProductionUpdateBranchAuthorization,
  type ProductionAuthorizationContext,
  type ProductionAuthorizationResult,
  type ProductionBranchAuthorizationRecord,
  type ProductionOrderAuthorizationRecord,
} from './production-order-authorization';
import { isMissingColumnError, isMissingRelationshipError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

export function productionService() {
  return createServiceRoleClient().schema('icecream_erp');
}

function toProductionAuthorizationContext(ctx: AuthContext): ProductionAuthorizationContext {
  return {
    branchAssignments: ctx.branchAssignments,
    branchId: ctx.branchId,
    isBranchScoped: ctx.isBranchScoped,
    organizationId: ctx.organizationId,
    permissions: ctx.permissions,
  };
}

export function productionErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

export interface ProductionDocumentAuthorizationRecord {
  id: string;
  organizationId: string;
  postingStatus: string | null;
  productionOrderId: string;
}

export function isMissingProductionTable(error: unknown) {
  const message = productionErrorMessage(error);
  return (
    message.includes("Could not find the table 'icecream_erp.") ||
    message.includes('Could not find a relationship between') ||
    message.includes('does not exist')
  );
}

export async function loadProductionOrderAuthorizationRecord(
  orderId: string,
  organizationId: string,
): Promise<ProductionOrderAuthorizationRecord | null> {
  const service = productionService();
  const { data, error } = await service
    .from('production_orders')
    .select('id, organization_id, branch_id, status, is_locked')
    .eq('organization_id', organizationId)
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    branchId: data.branch_id ? String(data.branch_id) : null,
    id: String(data.id),
    isLocked: Boolean(data.is_locked),
    organizationId: String(data.organization_id),
    status: data.status ? String(data.status) : null,
  };
}

export async function loadProductionBranchAuthorizationRecord(
  branchId: string,
  organizationId: string,
): Promise<ProductionBranchAuthorizationRecord | null> {
  const service = productionService();
  const { data, error } = await service
    .from('branches')
    .select('id, organization_id, status')
    .eq('organization_id', organizationId)
    .eq('id', branchId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    status: data.status ? String(data.status) : null,
  };
}

async function loadProductionDocumentAuthorizationRecord(
  table: 'production_issues' | 'production_receipts',
  documentId: string,
  organizationId: string,
): Promise<ProductionDocumentAuthorizationRecord | null> {
  const service = productionService();
  const { data, error } = await service
    .from(table)
    .select('id, organization_id, posting_status, production_order_id')
    .eq('organization_id', organizationId)
    .eq('id', documentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    postingStatus: data.posting_status ? String(data.posting_status) : null,
    productionOrderId: String(data.production_order_id),
  };
}

export async function loadProductionIssueAuthorizationRecord(
  issueId: string,
  organizationId: string,
) {
  return loadProductionDocumentAuthorizationRecord('production_issues', issueId, organizationId);
}

export async function loadProductionReceiptAuthorizationRecord(
  receiptId: string,
  organizationId: string,
) {
  return loadProductionDocumentAuthorizationRecord('production_receipts', receiptId, organizationId);
}

export async function authorizeProductionOrderWriteAccess(
  orderId: string,
  ctx: AuthContext,
): Promise<ProductionAuthorizationResult<ProductionOrderAuthorizationRecord>> {
  const order = await loadProductionOrderAuthorizationRecord(orderId, ctx.organizationId);
  return authorizeProductionOrderForWrite(toProductionAuthorizationContext(ctx), order);
}

export async function resolveAuthorizedProductionCreateBranchId(
  requestedBranchId: string | null | undefined,
  ctx: AuthContext,
): Promise<ProductionAuthorizationResult<{ branchId: string | null }>> {
  const branch = !ctx.isBranchScoped && requestedBranchId
    ? await loadProductionBranchAuthorizationRecord(requestedBranchId, ctx.organizationId)
    : null;

  return resolveProductionCreateBranchAuthorization(
    toProductionAuthorizationContext(ctx),
    requestedBranchId,
    branch,
  );
}

export async function resolveAuthorizedProductionUpdateBranchId(input: {
  ctx: AuthContext;
  orderId: string;
  requestedBranchId: string | null | undefined;
}): Promise<ProductionAuthorizationResult<{ branchId: string | null; order: ProductionOrderAuthorizationRecord }>> {
  const order = await loadProductionOrderAuthorizationRecord(input.orderId, input.ctx.organizationId);
  const orderAuthorization = authorizeProductionOrderForWrite(
    toProductionAuthorizationContext(input.ctx),
    order,
  );
  if (!orderAuthorization.ok) return orderAuthorization;

  const branch = !input.ctx.isBranchScoped && input.requestedBranchId
    ? await loadProductionBranchAuthorizationRecord(input.requestedBranchId, input.ctx.organizationId)
    : null;

  return resolveProductionUpdateBranchAuthorization({
    branch,
    ctx: toProductionAuthorizationContext(input.ctx),
    order: orderAuthorization.value,
    requestedBranchId: input.requestedBranchId,
  });
}

export async function resolveBranchWarehouseIds(branchId: string | null) {
  if (!branchId) return null;

  const service = productionService();
  const { data, error } = await service
    .from('warehouses')
    .select('id')
    .eq('branch_id', branchId);

  if (error) throw error;
  return (data ?? []).map((row: { id: string }) => row.id);
}

export async function fetchStockBalanceMap(warehouseIds?: string[] | null) {
  const service = productionService();
  let query = service
    .from('stock_balances')
    .select('item_id, quantity_available');

  if (warehouseIds && warehouseIds.length > 0) {
    query = query.in('warehouse_id', warehouseIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const itemId = String(row.item_id);
    map.set(itemId, (map.get(itemId) ?? 0) + Number(row.quantity_available ?? 0));
  }

  return map;
}

export async function generateReferenceNumber(
  table: string,
  prefix: string,
  column = 'id',
) {
  const service = productionService();
  const { count, error } = await service
    .from(table)
    .select(column, { count: 'exact', head: true });

  if (error) throw error;
  return `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`;
}

export async function writeProductionAuditLog(
  action: string,
  entityId: string,
  userProfileId: string,
  details: Record<string, unknown>,
  entityType = 'production',
) {
  const service = productionService();

  await service.from('audit_logs').insert({
    action,
    entity_id: entityId,
    entity_type: entityType,
    new_values: details,
    user_profile_id: userProfileId,
  });
}

export async function loadProductionReportBatches(filters: {
  branchId?: string | null;
  endDate?: string | undefined;
  startDate?: string | undefined;
  status?: string | undefined;
}) {
  const service = productionService();
  const warehouseIds = await resolveBranchWarehouseIds(filters.branchId ?? null);

  let query = service
    .from('production_batches')
    .select(`
      id, batch_number, production_date, shift, status, expected_output, actual_output, warehouse_id,
      recipes(name, finished_item:items(name)),
      production_batch_materials(quantity_required, quantity_issued, quantity_actual, unit_cost, items(name, unit_cost)),
      production_batch_outputs(expected_quantity, actual_quantity, wastage_quantity),
      production_worker_assignments(employee_id)
    `)
    .is('deleted_at', null)
    .order('production_date', { ascending: false });

  if (filters.startDate) {
    query = query.gte('production_date', `${filters.startDate}T00:00:00.000Z`);
  }
  if (filters.endDate) {
    query = query.lte('production_date', `${filters.endDate}T23:59:59.999Z`);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (warehouseIds && warehouseIds.length > 0) {
    query = query.in('warehouse_id', warehouseIds);
  }

  let result = await query;

  if (
    result.error &&
    (
      isMissingColumnError(result.error, 'production_batches', 'deleted_at') ||
      isMissingRelationshipError(result.error, 'production_batches', 'production_batch_materials') ||
      isMissingRelationshipError(result.error, 'production_batches', 'production_batch_outputs') ||
      isMissingRelationshipError(result.error, 'production_batches', 'production_worker_assignments') ||
      isMissingRelationshipError(result.error, 'production_batches', 'recipes') ||
      isMissingRelationshipError(result.error, 'production_batch_materials', 'items') ||
      isMissingRelationshipError(result.error, 'recipes', 'items')
    )
  ) {
    let fallbackQuery = service
      .from('production_batches')
      .select('id, batch_number, production_date, shift, status, expected_output, actual_output, warehouse_id, recipe_id')
      .order('production_date', { ascending: false });

    if (filters.startDate) {
      fallbackQuery = fallbackQuery.gte('production_date', `${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      fallbackQuery = fallbackQuery.lte('production_date', `${filters.endDate}T23:59:59.999Z`);
    }
    if (filters.status) {
      fallbackQuery = fallbackQuery.eq('status', filters.status);
    }
    if (warehouseIds && warehouseIds.length > 0) {
      fallbackQuery = fallbackQuery.in('warehouse_id', warehouseIds);
    }

    const batchResult = await fallbackQuery;
    if (batchResult.error) throw batchResult.error;

    const batchRows = (batchResult.data ?? []) as Array<Record<string, unknown>>;
    const batchIds = batchRows.map((row) => String(row.id ?? '')).filter(Boolean);
    const recipeIds = [...new Set(batchRows.map((row) => String(row.recipe_id ?? '')).filter(Boolean))];

    const [materialsResult, outputsResult, workerAssignmentsResult, recipesResult] = await Promise.all([
      batchIds.length
        ? service
            .from('production_batch_materials')
            .select('batch_id, quantity_required, quantity_issued, quantity_actual, unit_cost, item_id')
            .in('batch_id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      batchIds.length
        ? service
            .from('production_batch_outputs')
            .select('batch_id, expected_quantity, actual_quantity, wastage_quantity')
            .in('batch_id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      batchIds.length
        ? service
            .from('production_worker_assignments')
            .select('batch_id, employee_id')
            .in('batch_id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      recipeIds.length
        ? service
            .from('recipes')
            .select('id, name, finished_item_id')
            .in('id', recipeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (materialsResult.error && !isMissingProductionTable(materialsResult.error)) throw materialsResult.error;
    if (outputsResult.error && !isMissingProductionTable(outputsResult.error)) throw outputsResult.error;
    if (workerAssignmentsResult.error && !isMissingProductionTable(workerAssignmentsResult.error)) throw workerAssignmentsResult.error;
    if (recipesResult.error && !isMissingProductionTable(recipesResult.error)) throw recipesResult.error;

    const materialRows = (materialsResult.data ?? []) as Array<Record<string, unknown>>;
    const materialItemIds = [...new Set(materialRows.map((row) => String(row.item_id ?? '')).filter(Boolean))];
    const finishedItemIds = [...new Set(((recipesResult.data ?? []) as Array<Record<string, unknown>>).map((row) => String(row.finished_item_id ?? '')).filter(Boolean))];
    const itemIds = [...new Set([...materialItemIds, ...finishedItemIds])];
    const itemsResult = itemIds.length
      ? await service.from('items').select('id, name, unit_cost').in('id', itemIds)
      : { data: [], error: null };
    if (itemsResult.error) throw itemsResult.error;

    const itemsById = new Map(
      ((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id ?? ''), row] as const),
    );
    const recipesById = new Map(
      ((recipesResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id ?? ''), row] as const),
    );
    const materialsByBatchId = new Map<string, Array<Record<string, unknown>>>();
    for (const row of materialRows) {
      const batchId = String(row.batch_id ?? '');
      const next = materialsByBatchId.get(batchId) ?? [];
      next.push({
        ...row,
        items: row.item_id ? itemsById.get(String(row.item_id)) ?? null : null,
      });
      materialsByBatchId.set(batchId, next);
    }
    const outputsByBatchId = new Map<string, Array<Record<string, unknown>>>();
    for (const row of ((outputsResult.data ?? []) as Array<Record<string, unknown>>)) {
      const batchId = String(row.batch_id ?? '');
      const next = outputsByBatchId.get(batchId) ?? [];
      next.push(row);
      outputsByBatchId.set(batchId, next);
    }
    const workersByBatchId = new Map<string, Array<Record<string, unknown>>>();
    for (const row of ((workerAssignmentsResult.data ?? []) as Array<Record<string, unknown>>)) {
      const batchId = String(row.batch_id ?? '');
      const next = workersByBatchId.get(batchId) ?? [];
      next.push(row);
      workersByBatchId.set(batchId, next);
    }

    result = {
      data: batchRows.map((row) => {
        const recipe = row.recipe_id ? recipesById.get(String(row.recipe_id)) ?? null : null;
        const finishedItem = recipe?.finished_item_id ? itemsById.get(String(recipe.finished_item_id)) ?? null : null;
        return {
          ...row,
          production_batch_materials: materialsByBatchId.get(String(row.id ?? '')) ?? [],
          production_batch_outputs: outputsByBatchId.get(String(row.id ?? '')) ?? [],
          production_worker_assignments: workersByBatchId.get(String(row.id ?? '')) ?? [],
          recipes: recipe
            ? {
                ...recipe,
                finished_item: finishedItem ? { name: String(finishedItem.name ?? '') } : null,
              }
            : null,
        };
      }),
      error: null,
    } as unknown as typeof result;
  }

  if (result.error) throw result.error;
  const data = result.data ?? [];

  const workerCounts = new Map<string, number>();
  for (const batch of data ?? []) {
    const assignments = Array.isArray(batch.production_worker_assignments)
      ? batch.production_worker_assignments
      : [];
    workerCounts.set(String(batch.id), assignments.length);
  }

  return {
    batches: (data ?? []) as Array<Record<string, unknown>>,
    workerCounts,
  };
}

export async function loadShiftTargetRows(branchId?: string | null) {
  const service = productionService();

  let directQuery = service
    .from('production_shift_targets')
    .select(`
      id, target_date, shift, product_id, target_output_quantity, target_workers, target_production_time_hours, target_material_usage, approved_by, created_at,
      items(id, code, name)
    `)
    .order('target_date', { ascending: false });

  if (branchId) {
    directQuery = directQuery.eq('branch_id', branchId);
  }

  const direct = await directQuery;
  if (!direct.error) {
    return (direct.data ?? []) as Array<Record<string, unknown>>;
  }

  if (!isMissingProductionTable(direct.error)) {
    throw direct.error;
  }

  let fallbackQuery = service
    .from('shift_reports')
    .select(`
      id, report_date, shift_type, status, notes, created_at, production_batch_id,
      production_batches(expected_output, actual_output, worker_count, recipe_id, recipes(name, finished_item:items(id, code, name)))
    `)
    .is('deleted_at', null)
    .order('report_date', { ascending: false });

  if (branchId) {
    fallbackQuery = fallbackQuery.eq('branch_id', branchId);
  }

  const fallback = await fallbackQuery;
  if (fallback.error) throw fallback.error;

  return (fallback.data ?? []).map((row: Record<string, unknown>) => {
    const batch = Array.isArray(row.production_batches) ? row.production_batches[0] : row.production_batches;
    const batchRecord = batch && typeof batch === 'object' ? batch as Record<string, unknown> : null;
    const recipe = batchRecord
      ? (Array.isArray(batchRecord.recipes)
        ? batchRecord.recipes[0]
        : batchRecord.recipes)
      : null;
    const recipeRecord = recipe && typeof recipe === 'object' ? recipe as Record<string, unknown> : null;
    const finishedItem = recipeRecord
      ? (Array.isArray(recipeRecord.finished_item)
        ? recipeRecord.finished_item[0]
        : recipeRecord.finished_item)
      : null;
    const finishedItemRecord = finishedItem && typeof finishedItem === 'object' ? finishedItem as Record<string, unknown> : null;

    return {
      id: row.id,
      target_date: row.report_date,
      shift: row.shift_type,
      product_id: finishedItemRecord?.id ?? null,
      target_output_quantity: Number(
        batchRecord
          ? batchRecord.expected_output ?? batchRecord.actual_output ?? 0
          : 0,
      ),
      target_workers: Number(batchRecord?.worker_count ?? 0),
      target_production_time_hours: 0,
      target_material_usage: 0,
      approved_by: null,
      created_at: row.created_at,
      items: finishedItemRecord
        ? {
            id: finishedItemRecord.id ?? null,
            code: finishedItemRecord.code ?? null,
            name: finishedItemRecord.name ?? recipeRecord?.name ?? 'Unknown product',
          }
        : null,
      source_status: row.status ?? null,
    };
  });
}
