import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { normalizeWarehouseCode, normalizeWarehouseType, resolveWarehouseDisplayType, resolveWarehouseStorageType } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.warehouse.view', 'inventory.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  let query = service
    .from('warehouses')
    .select(
      `id, code, name, type, warehouse_type, is_active, address, branch_id, created_at, updated_at,
       branches!branch_id(id, name)`,
    )
    .eq('organization_id', ctx.organizationId)
    .eq('id', id);

  if (ctx.isBranchScoped && ctx.branchId) {
    query = query.eq('branch_id', ctx.branchId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) return serverError(error.message);
  if (!data) return notFound('Warehouse not found.');

  return NextResponse.json({
    ...data,
    type: resolveWarehouseDisplayType({
      code: String(data.code ?? ''),
      type: data.type ? String(data.type) : null,
      warehouseType: data.warehouse_type ? String(data.warehouse_type) : null,
    }),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.warehouse.edit', 'inventory.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    name?: string;
    type?: string;
    warehouseType?: string;
    isActive?: boolean;
    address?: string | null;
    branchId?: string | null;
  };

  const { data: existing, error: existingError } = await service
    .from('warehouses')
    .select('id, code, branch_id')
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .maybeSingle();

  if (existingError) return serverError(existingError.message);
  if (!existing) return notFound('Warehouse not found.');
  if (ctx.isBranchScoped && ctx.branchId && existing.branch_id !== ctx.branchId) return forbidden();

  const nextCode = body.code !== undefined ? normalizeWarehouseCode(body.code) : undefined;
  if (body.code !== undefined && !nextCode) return badRequest('Warehouse code is required.');

  if (nextCode && nextCode !== existing.code) {
    const { data: duplicate, error: duplicateError } = await service
      .from('warehouses')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('code', nextCode)
      .neq('id', id)
      .maybeSingle();

    if (duplicateError) return serverError(duplicateError.message);
    if (duplicate) return badRequest('Warehouse code already exists.');
  }

  if (body.branchId) {
    const { data: branch, error: branchError } = await service
      .from('branches')
      .select('id')
      .eq('id', body.branchId)
      .maybeSingle();
    if (branchError) return serverError(branchError.message);
    if (!branch) return badRequest('Branch not found.');
  }

  const updates: Record<string, unknown> = {};

  if (nextCode !== undefined) updates.code = nextCode;
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.address !== undefined) updates.address = body.address ?? null;
  if (body.branchId !== undefined) updates.branch_id = body.branchId ?? null;
  if (body.isActive !== undefined) updates.is_active = body.isActive;
  if (body.type !== undefined || body.warehouseType !== undefined) {
    const nextType = normalizeWarehouseType(body.warehouseType ?? body.type);
    if (!nextType) return badRequest('Warehouse type is required.');
    updates.type = resolveWarehouseStorageType(nextType);
    updates.warehouse_type = resolveWarehouseStorageType(nextType);
  }

  const { data, error } = await service
    .from('warehouses')
    .update(updates)
    .eq('id', id)
    .select(
      `id, code, name, type, warehouse_type, is_active, address, branch_id, created_at, updated_at,
       branches!branch_id(id, name)`,
    )
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json({
    ...data,
    type: resolveWarehouseDisplayType({
      code: String(data.code ?? ''),
      type: data.type ? String(data.type) : null,
      warehouseType: data.warehouse_type ? String(data.warehouse_type) : null,
    }),
  });
}
