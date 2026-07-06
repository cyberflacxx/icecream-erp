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
  applyInventoryDelta,
  getBalance,
  recordStockMovement,
  requireItem,
  requireWarehouseAccess,
} from '@/lib/inventory-server';
import { normalizeTransferStatus, resolveTransferWriteStatus } from '@/lib/inventory';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'stock_transfer.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const status = searchParams.get('status') ?? '';
  const fromWarehouseId = searchParams.get('fromWarehouseId') ?? '';
  const toWarehouseId = searchParams.get('toWarehouseId') ?? '';

  let query = service
    .from('stock_transfers')
    .select(
      'id, transfer_number, transfer_date, status, notes, created_at, from_warehouse_id, to_warehouse_id',
      { count: 'exact' },
    )
    .eq('organization_id', ctx.organizationId);

  if (status) query = query.eq('status', status);
  if (fromWarehouseId) query = query.eq('from_warehouse_id', fromWarehouseId);
  if (toWarehouseId) query = query.eq('to_warehouse_id', toWarehouseId);

  if (ctx.isBranchScoped && ctx.branchId) {
    const { data: scopedWarehouses, error: scopedError } = await service
      .from('warehouses')
      .select('id')
      .eq('branch_id', ctx.branchId);

    if (scopedError) return serverError(scopedError.message);

    const ids = (scopedWarehouses ?? []).map((row) => row.id);

    query = ids.length
      ? query.or(`from_warehouse_id.in.(${ids.join(',')}),to_warehouse_id.in.(${ids.join(',')})`)
      : query.in('from_warehouse_id', ['00000000-0000-0000-0000-000000000000']);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return serverError(error.message);

  const warehouseIds = [
    ...new Set(
      (data ?? [])
        .flatMap((row) => [row.from_warehouse_id, row.to_warehouse_id])
        .map(String)
        .filter(Boolean),
    ),
  ];

  const transferIds = (data ?? []).map((row) => String(row.id));

  const [warehousesResult, itemsResult] = await Promise.all([
    warehouseIds.length
      ? service.from('warehouses').select('id, name').in('id', warehouseIds)
      : Promise.resolve({ data: [], error: null }),
    transferIds.length
      ? service.from('stock_transfer_items').select('id, transfer_id').in('transfer_id', transferIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (warehousesResult.error) return serverError(warehousesResult.error.message);
  if (itemsResult.error) return serverError(itemsResult.error.message);

  const warehouses = new Map((warehousesResult.data ?? []).map((row) => [String(row.id), row]));
  const itemsCount = new Map<string, number>();

  for (const item of itemsResult.data ?? []) {
    const key = String(item.transfer_id);
    itemsCount.set(key, (itemsCount.get(key) ?? 0) + 1);
  }

  const mapped = (data ?? []).map((row: Record<string, unknown>) => {
    const fromWarehouse = warehouses.get(String(row.from_warehouse_id ?? ''));
    const toWarehouse = warehouses.get(String(row.to_warehouse_id ?? ''));

    return {
      id: row.id,
      transferNumber: row.transfer_number,
      transferDate: row.transfer_date,
      status: normalizeTransferStatus(String(row.status ?? '')),
      notes: row.notes ?? null,
      fromWarehouse: fromWarehouse ? { id: fromWarehouse.id, name: fromWarehouse.name } : null,
      toWarehouse: toWarehouse ? { id: toWarehouse.id, name: toWarehouse.name } : null,
      itemsCount: itemsCount.get(String(row.id)) ?? 0,
    };
  });

  return NextResponse.json({
    data: mapped,
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.transfer.create', 'inventory.write', 'stock_transfer.create')) {
    return forbidden();
  }

  const service = createServiceRoleClient();

  try {
    const body = (await request.json()) as {
      destinationWarehouseId?: string;
      fromWarehouseId?: string;
      referenceNumber?: string;
      remarks?: string | null;
      sourceWarehouseId?: string;
      status?: string;
      transferDate?: string;
      toWarehouseId?: string;
      notes?: string | null;
      items?: Array<{
        batchNumber?: string | null;
        itemId: string;
        quantity: number;
        unitCost?: number | null;
      }>;
    };

    const fromWarehouseId = body.sourceWarehouseId ?? body.fromWarehouseId;
    const toWarehouseId = body.destinationWarehouseId ?? body.toWarehouseId;
    const items = body.items;
    const notes = body.remarks ?? body.notes ?? null;
    const normalizedStatus = normalizeTransferStatus(body.status ?? 'COMPLETED') || 'COMPLETED';
    const persistedStatus = resolveTransferWriteStatus(normalizedStatus) || 'COMPLETED';

    if (!fromWarehouseId || !toWarehouseId) {
      return badRequest('fromWarehouseId and toWarehouseId are required.');
    }

    if (!items || items.length === 0) {
      return badRequest('At least one item is required.');
    }

    if (fromWarehouseId === toWarehouseId) {
      return badRequest('Source and destination warehouses must be different.');
    }

    if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'CANCELLED'].includes(normalizedStatus)) {
      return badRequest('Unsupported transfer status.');
    }

    let transferUserAccountId = ctx.userAccountId;

    if (!transferUserAccountId) {
      const { data: userProfileAccount, error: userProfileAccountError } = await service
        .from('users')
        .select('user_account_id')
        .eq('id', ctx.userId)
        .maybeSingle();

      if (userProfileAccountError) return serverError(userProfileAccountError.message);

      transferUserAccountId = userProfileAccount?.user_account_id
        ? String(userProfileAccount.user_account_id)
        : null;
    }

    if (!transferUserAccountId && ctx.workId) {
      const { data: userProfileByWorkId, error: userProfileByWorkIdError } = await service
        .from('users')
        .select('user_account_id')
        .eq('work_id', ctx.workId)
        .maybeSingle();

      if (userProfileByWorkIdError) return serverError(userProfileByWorkIdError.message);

      transferUserAccountId = userProfileByWorkId?.user_account_id
        ? String(userProfileByWorkId.user_account_id)
        : null;
    }

    if (!transferUserAccountId) {
      return NextResponse.json(
        { error: 'Current user account could not be resolved for stock transfer.' },
        { status: 400 },
      );
    }

    const [fromWarehouse, toWarehouse] = await Promise.all([
      requireWarehouseAccess(
        service,
        fromWarehouseId,
        ctx.branchId,
        ctx.isBranchScoped,
        ctx.warehouseAssignments,
      ),
      requireWarehouseAccess(
        service,
        toWarehouseId,
        ctx.branchId,
        ctx.isBranchScoped,
        ctx.warehouseAssignments,
      ),
    ]);

    const requiresAvailableStock = normalizedStatus === 'COMPLETED';
    const validatedItems = [];

    for (const itemRow of items) {
      const qty = Number(itemRow.quantity);

      if (Number.isNaN(qty) || qty <= 0) {
        return badRequest(`Invalid quantity for item ${itemRow.itemId}.`);
      }

      const item = await requireItem(service, itemRow.itemId);

      if (requiresAvailableStock) {
        const sourceBalance = await getBalance(service, itemRow.itemId, fromWarehouseId);
        const sourceAvailable = Number(sourceBalance?.quantity_available ?? 0);

        if (sourceAvailable < qty) {
          return badRequest(
            `Insufficient stock for ${item.name}. Available: ${sourceAvailable.toFixed(3)}, Required: ${qty.toFixed(3)}`,
          );
        }
      }

      validatedItems.push({
        batchNumber: itemRow.batchNumber ?? null,
        item,
        quantity: qty,
        unitCost:
          itemRow.unitCost === null || itemRow.unitCost === undefined || Number.isNaN(Number(itemRow.unitCost))
            ? item.unit_cost ?? null
            : Number(itemRow.unitCost),
      });
    }

    let transferNumber = String(body.referenceNumber ?? '').trim();

    if (!transferNumber) {
      const { count: transferCount } = await service
        .from('stock_transfers')
        .select('id', { count: 'exact', head: true });

      const nextSeq = (transferCount ?? 0) + 1;
      transferNumber = `TRF-${String(nextSeq).padStart(5, '0')}`;
    }

    const { data: existingTransfer, error: existingTransferError } = await service
      .from('stock_transfers')
      .select('id, status')
      .eq('organization_id', ctx.organizationId)
      .eq('transfer_number', transferNumber)
      .maybeSingle();

    if (existingTransferError) return serverError(existingTransferError.message);

    if (existingTransfer) {
      return badRequest('Transfer reference number already exists.');
    }

    const { data: transfer, error: transferError } = await service
      .from('stock_transfers')
      .insert({
        transfer_number: transferNumber,
        organization_id: ctx.organizationId,
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        notes,
        status: persistedStatus,
        transfer_date: body.transferDate ? new Date(body.transferDate).toISOString() : new Date().toISOString(),
        requested_by: transferUserAccountId,
        approved_by:
          normalizedStatus === 'APPROVED' || normalizedStatus === 'COMPLETED'
            ? transferUserAccountId
            : null,
      })
      .select('id, transfer_number, status, transfer_date, notes')
      .single();

    if (transferError) return serverError(transferError.message);

    for (const validatedItem of validatedItems) {
      const { error: transferItemError } = await service.from('stock_transfer_items').insert({
        transfer_id: transfer.id,
        item_id: validatedItem.item.id,
        notes,
        quantity_requested: validatedItem.quantity,
        quantity_received: normalizedStatus === 'COMPLETED' ? validatedItem.quantity : 0,
        quantity_sent: normalizedStatus === 'COMPLETED' ? validatedItem.quantity : 0,
        unit_cost: validatedItem.unitCost,
      });

      if (transferItemError) return serverError(transferItemError.message);

      if (normalizedStatus !== 'COMPLETED') {
        continue;
      }

      await applyInventoryDelta(service, {
        itemId: validatedItem.item.id,
        organizationId: ctx.organizationId,
        quantityDelta: -validatedItem.quantity,
        warehouseId: fromWarehouseId,
      });

      await applyInventoryDelta(service, {
        itemId: validatedItem.item.id,
        organizationId: ctx.organizationId,
        quantityDelta: validatedItem.quantity,
        warehouseId: toWarehouseId,
      });

      await recordStockMovement(service, {
        batchNumber: validatedItem.batchNumber,
        createdBy: ctx.userId,
        destinationWarehouseId: toWarehouseId,
        itemId: validatedItem.item.id,
        movementType: 'TRANSFER_OUT',
        notes,
        organizationId: ctx.organizationId,
        quantity: validatedItem.quantity,
        referenceId: String(transfer.id),
        referenceType: 'stock_transfer',
        sourceWarehouseId: fromWarehouseId,
        warehouseId: fromWarehouseId,
      });

      await recordStockMovement(service, {
        batchNumber: validatedItem.batchNumber,
        createdBy: ctx.userId,
        destinationWarehouseId: toWarehouseId,
        itemId: validatedItem.item.id,
        movementType: 'TRANSFER_IN',
        notes,
        organizationId: ctx.organizationId,
        quantity: validatedItem.quantity,
        referenceId: String(transfer.id),
        referenceType: 'stock_transfer',
        sourceWarehouseId: fromWarehouseId,
        warehouseId: toWarehouseId,
      });
    }

    await recordAuditLog({
      action: normalizedStatus === 'COMPLETED' ? 'INVENTORY_TRANSFER_COMPLETED' : 'INVENTORY_TRANSFER_CREATED',
      entityId: String(transfer.id),
      entityType: 'stock_transfer',
      newValues: {
        fromWarehouseId,
        itemCount: validatedItems.length,
        status: normalizedStatus,
        toWarehouseId,
        transferNumber,
      },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(
      {
        id: transfer.id,
        transferNumber: transfer.transfer_number,
        transferDate: transfer.transfer_date,
        status: normalizeTransferStatus(String(transfer.status ?? '')),
        notes: transfer.notes,
        fromWarehouse: { id: fromWarehouse.id, name: fromWarehouse.name },
        toWarehouse: { id: toWarehouse.id, name: toWarehouse.name },
        items: validatedItems.map((validatedItem) => ({
          itemId: validatedItem.item.id,
          itemName: validatedItem.item.name,
          quantityReceived: normalizedStatus === 'COMPLETED' ? validatedItem.quantity : 0,
          quantityRequested: validatedItem.quantity,
          quantitySent: normalizedStatus === 'COMPLETED' ? validatedItem.quantity : 0,
          unitCost: validatedItem.unitCost,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to create stock transfer.');
  }
}