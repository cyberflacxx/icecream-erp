import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import {
  calculateStockBalanceValue,
  INVENTORY_WAREHOUSE_TYPES,
  isMissingTableColumnError,
  normalizeWarehouseCode,
  resolveWarehouseDisplayType,
  resolveWarehouseStorageType,
  toNumber,
} from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

const SUPPORTED_WAREHOUSE_TYPES = new Set([...INVENTORY_WAREHOUSE_TYPES, 'RAW_MATERIAL']);
const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

type BranchRelation = {
  id?: unknown;
  name?: unknown;
};

type ItemRelation = {
  reorder_level?: unknown;
  standard_cost?: unknown;
  unit_cost?: unknown;
};

type WarehouseRow = {
  address?: unknown;
  branch_id?: unknown;
  branches?: BranchRelation | BranchRelation[] | null;
  code?: unknown;
  created_at?: unknown;
  id?: unknown;
  is_active?: unknown;
  name?: unknown;
  type?: unknown;
  warehouse_type?: unknown;
};

type StockBalanceRow = {
  average_cost?: unknown;
  avg_cost?: unknown;
  item_id?: unknown;
  items?: ItemRelation | ItemRelation[] | null;
  quantity?: unknown;
  quantity_available?: unknown;
  quantity_on_hand?: unknown;
  total_value?: unknown;
  warehouse_id?: unknown;
};

function asRecordArray<T extends Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value)
    ? value.filter((row): row is T => Boolean(row) && typeof row === 'object')
    : [];
}

function firstRelation<T extends Record<string, unknown>>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeWarehouseTypeForWrite(value: unknown) {
  const warehouseType = normalizeWarehouseCode(String(value ?? ''));

  switch (warehouseType) {
    case 'PRODUCTION_MATERIAL':
    case 'PRODUCTION_MATERIALS':
    case 'PRODUCTION_MATERIALS_STORE':
    case 'PRODUCTION_WAREHOUSE':
      return 'PRODUCTION';
    case 'RAW_MATERIALS_STORE':
      return 'RAW_MATERIALS';
    default:
      return warehouseType;
  }
}

function warehouseTypeInvalidResponse(attemptedType: unknown, normalizedType: string | null) {
  return NextResponse.json(
    {
      code: 'WAREHOUSE_TYPE_INVALID',
      error: 'Warehouse type is not supported.',
      attemptedType: attemptedType == null ? null : String(attemptedType),
      normalizedType,
    },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.warehouse.view', 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const picker = searchParams.get('picker') === 'true';

  let query = service
    .from('warehouses')
    .select(
      `id, code, name, type, warehouse_type, is_active, address, branch_id, created_at,
       branches!branch_id(id, name)`,
    )
    .eq('organization_id', ctx.organizationId)
    .order('name', { ascending: true });

  if (ctx.isBranchScoped && ctx.branchId) {
    query = picker ? query.or(`branch_id.eq.${ctx.branchId},branch_id.is.null`) : query.eq('branch_id', ctx.branchId);
  }

  const primaryWarehouseResult = await query;
  let warehouses = asRecordArray<WarehouseRow>(primaryWarehouseResult.data);
  let error = primaryWarehouseResult.error;
  if (
    error &&
    (isMissingTableColumnError(error, 'warehouses', 'is_active') ||
      isMissingTableColumnError(error, 'warehouses', 'warehouse_type') ||
      isMissingTableColumnError(error, 'warehouses', 'type') ||
      isMissingTableColumnError(error, 'warehouses', 'branch_id'))
  ) {
    let fallbackQuery = service
      .from('warehouses')
      .select('id, code, name')
      .eq('organization_id', ctx.organizationId)
      .order('name', { ascending: true });

    if (ctx.isBranchScoped && ctx.branchId && !picker) {
      fallbackQuery = fallbackQuery.eq('branch_id', ctx.branchId);
    }

    const fallback = await fallbackQuery;
    warehouses = asRecordArray<WarehouseRow>(fallback.data);
    error = fallback.error;
  }

  if (error) return serverError(error.message);

  const normalizedWarehouses = warehouses
    .filter((warehouse) => {
      if (warehouse.is_active === false) return false;
      return true;
    })
    .map((warehouse) => {
      const code = String(warehouse.code ?? '').trim();
      const name = String(warehouse.name ?? '').trim();
      const branchId = warehouse.branch_id ? String(warehouse.branch_id) : null;
      const warehouseType = warehouse.warehouse_type ? String(warehouse.warehouse_type) : null;
      const type = warehouse.type ? String(warehouse.type) : null;
      return {
        id: String(warehouse.id),
        code,
        name,
        branchId,
        branch_id: branchId,
        type,
        warehouseType,
        warehouse_type: warehouseType,
        status: warehouse.is_active === false ? 'INACTIVE' : 'ACTIVE',
        label: code ? `${code} - ${name}` : name,
        raw: warehouse,
      };
    });

  if (picker) {
    return NextResponse.json({
      success: true,
      data: normalizedWarehouses.map((warehouse) => ({
        branch_id: warehouse.branch_id,
        branchId: warehouse.branchId,
        code: warehouse.code,
        id: warehouse.id,
        label: warehouse.label,
        name: warehouse.name,
        status: warehouse.status,
        type: warehouse.type,
        warehouse_type: warehouse.warehouse_type,
        warehouseType: warehouse.warehouseType,
      })),
    });
  }

  // Fetch stock balances summary per warehouse
  const warehouseIds = normalizedWarehouses.map((w) => w.id);

  let balancesData: StockBalanceRow[] = [];

  if (warehouseIds.length > 0) {
    const primaryBalancesResult = await service
      .from('stock_balances')
      .select('warehouse_id, quantity_on_hand, quantity_available, quantity, total_value, average_cost, avg_cost, item_id, items!item_id(unit_cost, standard_cost, reorder_level)')
      .eq('organization_id', ctx.organizationId)
      .in('warehouse_id', warehouseIds);
    let balancesRows: unknown = primaryBalancesResult.data;
    let balancesError = primaryBalancesResult.error;

    if (
      balancesError &&
      (
        isMissingTableColumnError(balancesError, 'stock_balances', 'total_value') ||
        isMissingTableColumnError(balancesError, 'stock_balances', 'average_cost') ||
        isMissingTableColumnError(balancesError, 'stock_balances', 'avg_cost') ||
        isMissingTableColumnError(balancesError, 'stock_balances', 'quantity_available')
      )
    ) {
      const fallbackBalancesResult = await service
        .from('stock_balances')
        .select('warehouse_id, quantity_on_hand, quantity, item_id, items!item_id(unit_cost, standard_cost, reorder_level)')
        .eq('organization_id', ctx.organizationId)
        .in('warehouse_id', warehouseIds);
      balancesRows = fallbackBalancesResult.data;
      balancesError = fallbackBalancesResult.error;
    }

    if (balancesError) return serverError(balancesError.message);
    balancesData = asRecordArray<StockBalanceRow>(balancesRows);
  }

  const balancesByWarehouse = new Map<
    string,
    Array<{ isLowStock: boolean; quantityOnHand: number; stockValue: number }>
  >();
  for (const b of balancesData) {
    const warehouseId = String(b.warehouse_id ?? '');
    if (!warehouseId) continue;

    const item = firstRelation(b.items);
    const quantityOnHand = toNumber(b.quantity_on_hand ?? b.quantity);
    const quantityAvailable = toNumber(b.quantity_available ?? quantityOnHand);
    const reorderLevel = toNumber(item?.reorder_level);
    const stockValue = calculateStockBalanceValue({ ...b, items: item });
    const existing = balancesByWarehouse.get(warehouseId) ?? [];
    existing.push({
      isLowStock: reorderLevel > 0 && quantityAvailable <= reorderLevel,
      quantityOnHand,
      stockValue,
    });
    balancesByWarehouse.set(warehouseId, existing);
  }

  const result = normalizedWarehouses.map((warehouse) => {
    const balances = balancesByWarehouse.get(warehouse.id) ?? [];
    const itemCount = balances.filter((b) => b.quantityOnHand > 0).length;
    const stockQuantity = balances.reduce((sum, b) => sum + b.quantityOnHand, 0);
    const totalValue = balances.reduce((sum, b) => sum + b.stockValue, 0);
    const lowStockCount = balances.filter((b) => b.isLowStock).length;
    const branch = firstRelation(warehouse.raw.branches);

    return {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      type: resolveWarehouseDisplayType({
        code: warehouse.code,
        type: warehouse.type,
        warehouseType: warehouse.warehouseType,
      }),
      isActive: warehouse.status === 'ACTIVE',
      address: warehouse.raw.address ? String(warehouse.raw.address) : null,
      branch: branch ? { id: String(branch.id ?? ''), name: String(branch.name ?? '') } : null,
      itemCount,
      lowStockCount,
      stockQuantity,
      totalValue,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.warehouse.create', 'inventory.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = (await request.json()) as {
    code?: string;
    name?: string;
    type?: string;
    warehouseType?: string;
    isActive?: boolean;
    address?: string | null;
    branchId?: string | null;
  };

  const code = normalizeWarehouseCode(body.code);
  const name = String(body.name ?? '').trim();
  const attemptedType = body.warehouseType ?? body.type;
  const type = normalizeWarehouseTypeForWrite(attemptedType);

  if (!code || !name || !type) {
    return badRequest('code, name, and type are required.');
  }
  if (!SUPPORTED_WAREHOUSE_TYPES.has(type)) {
    return warehouseTypeInvalidResponse(attemptedType, type || null);
  }

  const { data: duplicateWarehouse, error: duplicateError } = await service
    .from('warehouses')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .eq('code', code)
    .maybeSingle();

  if (duplicateError) return serverError(duplicateError.message);
  if (duplicateWarehouse) return badRequest('Warehouse code already exists.');

  // If branchId provided, verify it exists
  if (body.branchId) {
    const { data: branch } = await service
      .from('branches')
      .select('id')
      .eq('id', body.branchId)
      .single();
    if (!branch) return badRequest('Branch not found.');
  }

  const { data, error } = await service
    .from('warehouses')
    .insert({
      organization_id: ctx.organizationId,
      code,
      name,
      type: resolveWarehouseStorageType(type),
      warehouse_type: type,
      is_active: body.isActive ?? true,
      address: body.address ?? null,
      branch_id: body.branchId ?? null,
    })
    .select(
      `id, code, name, type, warehouse_type, is_active, address, branch_id, created_at,
       branches!branch_id(id, name)`,
    )
    .single();

  if (error) {
    const message = String(error.message ?? '');
    if (message.toLowerCase().includes('invalid input value for enum warehouse_type')) {
      return warehouseTypeInvalidResponse(attemptedType, type);
    }
    return serverError(message);
  }
  return NextResponse.json({
    ...data,
    type: resolveWarehouseDisplayType({
      code: String(data.code ?? ''),
      type: data.type ? String(data.type) : null,
      warehouseType: data.warehouse_type ? String(data.warehouse_type) : null,
    }),
  }, { status: 201 });
}
