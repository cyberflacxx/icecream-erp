import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  void request;
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();

  let query = service
    .from('warehouses')
    .select(
      `id, code, name, type, is_active, address, branch_id, created_at,
       branches!branch_id(id, name)`,
    )
    .order('name', { ascending: true });

  if (ctx.isBranchScoped && ctx.branchId) {
    query = query.eq('branch_id', ctx.branchId);
  }

  const { data: warehouses, error } = await query;
  if (error) return serverError(error.message);

  // Fetch stock balances summary per warehouse
  const warehouseIds = (warehouses ?? []).map((w) => w.id);

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

  const result = (warehouses ?? []).map((warehouse) => {
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
      type: warehouse.type,
      isActive: warehouse.is_active,
      address: warehouse.address ?? null,
      branch: (() => {
        const raw = warehouse.branches as { id: string; name: string } | Array<{ id: string; name: string }> | null;
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
  if (!can(ctx, 'inventory.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = (await request.json()) as {
    code?: string;
    name?: string;
    type?: string;
    isActive?: boolean;
    address?: string | null;
    branchId?: string | null;
  };

  const { code, name, type } = body;
  if (!code || !name || !type) {
    return badRequest('code, name, and type are required.');
  }

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
      code,
      name,
      type,
      is_active: body.isActive ?? true,
      address: body.address ?? null,
      branch_id: body.branchId ?? null,
    })
    .select(
      `id, code, name, type, is_active, address, branch_id, created_at,
       branches!branch_id(id, name)`,
    )
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
