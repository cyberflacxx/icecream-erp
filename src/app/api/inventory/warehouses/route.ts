import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { INVENTORY_WAREHOUSE_TYPES, isMissingTableColumnError, normalizeWarehouseCode, resolveWarehouseDisplayType, resolveWarehouseStorageType } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

const SUPPORTED_WAREHOUSE_TYPES = new Set([...INVENTORY_WAREHOUSE_TYPES, 'RAW_MATERIAL']);

function normalizeWarehouseTypeForWrite(value: unknown) {
  const warehouseType = normalizeWarehouseCode(value);

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

  let { data: warehouses, error } = await query;
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
    warehouses = fallback.data as typeof warehouses;
    error = fallback.error;
  }

  if (error) return serverError(error.message);

  const normalizedWarehouses = (warehouses ?? [])
    .filter((warehouse) => {
      if (warehouse.is_active === false) return false;
      return true;
    })
    .map((warehouse) => {
      const code = String(warehouse.code ?? '').trim();
      const name = String(warehouse.name ?? '').trim();
      const branchId = 'branch_id' in warehouse && warehouse.branch_id ? String(warehouse.branch_id) : null;
      const warehouseType = 'warehouse_type' in warehouse && warehouse.warehouse_type ? String(warehouse.warehouse_type) : null;
      const type = 'type' in warehouse && warehouse.type ? String(warehouse.type) : null;
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

  let balancesData: Array<{
    warehouse_id: string;
    quantity_on_hand: number;
    item_id: string;
    items: { unit_cost: number | null } | null;
  }> = [];

  if (warehouseIds.length > 0) {
    const { data: balances } = await service
      .from('stock_balances')
      .select('warehouse_id, quantity_on_hand, item_id, items!item_id(unit_cost)')
      .in('warehouse_id', warehouseIds);
    balancesData = (balances ?? []) as unknown as typeof balancesData;
  }

  const balancesByWarehouse = new Map<
    string,
    Array<{ quantity_on_hand: number; unit_cost: number | null }>
  >();
  for (const b of balancesData) {
    const rawItems = b.items as { unit_cost?: unknown } | Array<{ unit_cost?: unknown }> | null;
    const itemObj = Array.isArray(rawItems) ? (rawItems[0] ?? null) : rawItems;
    const unitCost = itemObj?.unit_cost !== undefined ? (itemObj.unit_cost as number | null) : null;
    const existing = balancesByWarehouse.get(b.warehouse_id) ?? [];
    existing.push({ quantity_on_hand: Number(b.quantity_on_hand), unit_cost: unitCost });
    balancesByWarehouse.set(b.warehouse_id, existing);
  }

  const result = normalizedWarehouses.map((warehouse) => {
    const balances = balancesByWarehouse.get(warehouse.id) ?? [];
    const itemCount = balances.filter((b) => b.quantity_on_hand > 0).length;
    const totalValue = balances.reduce((sum, b) => {
      const cost = b.unit_cost ?? 0;
      return sum + b.quantity_on_hand * cost;
    }, 0);

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
      address: ('address' in warehouse.raw ? warehouse.raw.address : null) ?? null,
      branch: (() => {
        const raw = ('branches' in warehouse.raw ? warehouse.raw.branches : null) as { id: string; name: string } | Array<{ id: string; name: string }> | null;
        const b = Array.isArray(raw) ? (raw[0] ?? null) : raw;
        return b ? { id: b.id, name: b.name } : null;
      })(),
      itemCount,
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
