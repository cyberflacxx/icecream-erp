import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { resolveInventoryPostingMappingKey } from '@/lib/finance-integration';
import {
  STOCK_IN_MOVEMENT_TYPES,
  STOCK_OUT_MOVEMENT_TYPES,
  calculateStockBalanceValue,
  normalizeStockMovementType,
  toNumber,
} from '@/lib/inventory';
import { financeService, mapNestedRow } from '@/lib/finance-server';

type BalanceRow = Record<string, unknown>;

function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundValue(value: number) {
  return Math.round(value * 100) / 100;
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read')) return forbidden();

  try {
    const service = financeService();
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId') ?? undefined;
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;

    let scopedWarehouseIds: string[] | null = null;
    if (branchId) {
      const warehousesResult = await service.from('warehouses').select('id').eq('branch_id', branchId);
      if (warehousesResult.error) throw warehousesResult.error;
      scopedWarehouseIds = (warehousesResult.data ?? [])
        .map((row: { id?: unknown }) => String(row.id ?? ''))
        .filter(Boolean);
    }

    let balancesQuery = service
      .from('stock_balances')
      .select(
        'item_id, warehouse_id, quantity_on_hand, quantity_available, total_value, average_cost, avg_cost, items(id, code, name, item_type, item_categories(name)), warehouses(id, name, branch_id, branches(id, name))',
      )
      .eq('organization_id', ctx.organizationId);
    let movementsQuery = service
      .from('stock_movements')
      .select('item_id, warehouse_id, movement_type, quantity, total_value, total_cost, journal_entry_id, created_at')
      .eq('organization_id', ctx.organizationId);

    if (scopedWarehouseIds) {
      const warehouseFilter = scopedWarehouseIds.length
        ? scopedWarehouseIds
        : ['00000000-0000-0000-0000-000000000000'];
      balancesQuery = balancesQuery.in('warehouse_id', warehouseFilter);
      movementsQuery = movementsQuery.in('warehouse_id', warehouseFilter);
    }

    const [balancesResult, movementsResult, mappingsResult] = await Promise.all([
      balancesQuery,
      movementsQuery.order('created_at', { ascending: true }),
      service
        .from('erp_account_mappings')
        .select('mapping_key, branch_id, is_active')
        .eq('organization_id', ctx.organizationId)
        .eq('is_active', true),
    ]);

    if (balancesResult.error) throw balancesResult.error;
    if (movementsResult.error) throw movementsResult.error;
    if (mappingsResult.error) throw mappingsResult.error;

    const movementSummary = new Map<string, { glValue: number; quantity: number; value: number }>();
    for (const row of (movementsResult.data ?? []) as Array<Record<string, unknown>>) {
      const key = `${String(row.item_id ?? '')}:${String(row.warehouse_id ?? '')}`;
      const entry = movementSummary.get(key) ?? { glValue: 0, quantity: 0, value: 0 };
      const movementType = normalizeStockMovementType(String(row.movement_type ?? ''));
      const quantity = toNumber(row.quantity);
      const movementValue = toNumber(row.total_value ?? row.total_cost);
      const direction = STOCK_IN_MOVEMENT_TYPES.has(movementType) ? 1 : STOCK_OUT_MOVEMENT_TYPES.has(movementType) ? -1 : 0;

      entry.quantity += direction * quantity;
      entry.value += direction * movementValue;
      if (row.journal_entry_id) {
        entry.glValue += direction * movementValue;
      }
      movementSummary.set(key, entry);
    }

    const mappingKeys = new Set(
      ((mappingsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => `${String(row.mapping_key ?? '')}:${String(row.branch_id ?? '')}`),
    );
    const rows = ((balancesResult.data ?? []) as BalanceRow[]).map((row) => {
      const item = mapNestedRow(row.items as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const warehouse = mapNestedRow(row.warehouses as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const branch = warehouse
        ? mapNestedRow((warehouse.branches as Record<string, unknown> | Array<Record<string, unknown>> | null) ?? null)
        : null;
      const category = item
        ? mapNestedRow((item.item_categories as Record<string, unknown> | Array<Record<string, unknown>> | null) ?? null)
        : null;
      const summaryKey = `${String(row.item_id ?? '')}:${String(row.warehouse_id ?? '')}`;
      const movement = movementSummary.get(summaryKey) ?? { glValue: 0, quantity: 0, value: 0 };
      const stockQuantity = toNumber(row.quantity_on_hand);
      const stockBalanceValue = roundValue(calculateStockBalanceValue(row));
      const movementQuantity = roundQuantity(movement.quantity);
      const movementValue = roundValue(movement.value);
      const glValue = roundValue(movement.glValue);
      const quantityVariance = roundQuantity(stockQuantity - movementQuantity);
      const valueVariance = roundValue(stockBalanceValue - movementValue);
      const glVariance = roundValue(movementValue - glValue);
      const unitCost = toNumber(row.average_cost ?? row.avg_cost);
      const mappingKey = resolveInventoryPostingMappingKey({
        itemCategoryName: category?.name ? String(category.name) : null,
        itemType: item?.item_type ? String(item.item_type) : null,
      });
      const branchMappingKey = `${mappingKey}:${String(branch?.id ?? warehouse?.branch_id ?? '')}`;
      const defaultMappingKey = `${mappingKey}:`;
      const hasMapping = mappingKeys.has(branchMappingKey) || mappingKeys.has(defaultMappingKey);

      let status: 'GL_VARIANCE' | 'MATCHED' | 'MISSING_COST' | 'MISSING_MAPPING' | 'QUANTITY_VARIANCE' | 'VALUE_VARIANCE' = 'MATCHED';
      if (stockQuantity > 0 && unitCost <= 0) {
        status = 'MISSING_COST';
      } else if (!hasMapping) {
        status = 'MISSING_MAPPING';
      } else if (Math.abs(quantityVariance) > 0.0001) {
        status = 'QUANTITY_VARIANCE';
      } else if (Math.abs(valueVariance) > 0.01) {
        status = 'VALUE_VARIANCE';
      } else if (Math.abs(glVariance) > 0.01) {
        status = 'GL_VARIANCE';
      }

      return {
        branch: branch?.name ?? 'Unknown branch',
        branchId: branch?.id ?? warehouse?.branch_id ?? null,
        generalLedgerValue: glValue,
        item: `${String(item?.code ?? '')} ${String(item?.name ?? 'Unknown item')}`.trim(),
        itemCode: String(item?.code ?? ''),
        itemId: String(row.item_id ?? ''),
        itemName: String(item?.name ?? 'Unknown item'),
        mappingKey,
        movementDerivedValue: movementValue,
        quantityVariance,
        status,
        stockBalanceValue,
        stockQuantity: roundQuantity(stockQuantity),
        valueVariance,
        warehouse: warehouse?.name ?? 'Unknown warehouse',
        warehouseId: warehouse?.id ?? row.warehouse_id ?? null,
      };
    });

    const summary = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      filters: {
        branchId: branchId ?? null,
      },
      rows,
      summary,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load inventory reconciliation.');
  }
}
