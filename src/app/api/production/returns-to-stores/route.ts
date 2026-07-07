import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import {
  applyInventoryDelta,
  generateDocumentNumber,
  getBalance,
  recordStockMovement,
  requireItem,
  requireWarehouseAccess,
  writeInventoryAuditLog,
} from '@/lib/inventory-server';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

const PRODUCTION_RETURN_NOTE = '[production_return]';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read', 'inventory.read')) return forbidden();

  try {
    const service = productionService();
    const { data: transfers, error: transferError } = await service
      .from('stock_transfers')
      .select('id, transfer_number, transfer_date, status, notes, created_at, from_warehouse_id, to_warehouse_id')
      .eq('organization_id', ctx.organizationId)
      .ilike('notes', `%${PRODUCTION_RETURN_NOTE}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (transferError) throw transferError;

    const transferIds = (transfers ?? []).map((row) => String(row.id));
    const warehouseIds = [
      ...new Set(
        (transfers ?? [])
          .flatMap((row) => [row.from_warehouse_id, row.to_warehouse_id])
          .map((value) => String(value ?? ''))
          .filter(Boolean),
      ),
    ];

    const [warehousesResult, transferItemsResult] = await Promise.all([
      warehouseIds.length
        ? service.from('warehouses').select('id, code, name').in('id', warehouseIds)
        : Promise.resolve({ data: [], error: null }),
      transferIds.length
        ? service.from('stock_transfer_items').select('transfer_id, item_id, quantity_requested').in('transfer_id', transferIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (warehousesResult.error) throw warehousesResult.error;
    if (transferItemsResult.error) throw transferItemsResult.error;

    const warehousesById = new Map((warehousesResult.data ?? []).map((row) => [String(row.id), row]));
    const quantityByTransfer = new Map<string, number>();
    for (const item of transferItemsResult.data ?? []) {
      const key = String(item.transfer_id ?? '');
      quantityByTransfer.set(key, (quantityByTransfer.get(key) ?? 0) + Number(item.quantity_requested ?? 0));
    }

    return NextResponse.json((transfers ?? []).map((row) => ({
      id: row.id,
      notes: row.notes,
      quantityReturned: quantityByTransfer.get(String(row.id)) ?? 0,
      returnDate: row.transfer_date,
      returnNumber: row.transfer_number,
      sourceWarehouse: warehousesById.get(String(row.from_warehouse_id ?? '')) ?? null,
      status: row.status,
      storeWarehouse: warehousesById.get(String(row.to_warehouse_id ?? '')) ?? null,
    })));
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load production returns.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write', 'inventory.write')) return forbidden();

  try {
    const body = await request.json() as {
      destinationWarehouseId?: string;
      items?: Array<{ itemId: string; quantity: number }>;
      notes?: string | null;
      productionBatchId?: string | null;
      reason?: string;
      returnDate?: string | null;
      sourceWarehouseId?: string;
    };

    if (!body.sourceWarehouseId || !body.destinationWarehouseId) {
      return badRequest('sourceWarehouseId and destinationWarehouseId are required.');
    }
    if (body.sourceWarehouseId === body.destinationWarehouseId) {
      return badRequest('Source and destination warehouses must be different.');
    }
    if (!body.reason?.trim()) {
      return badRequest('reason is required.');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return badRequest('At least one surplus item is required.');
    }

    const service = productionService();
    const [sourceWarehouse, destinationWarehouse] = await Promise.all([
      requireWarehouseAccess(service, body.sourceWarehouseId, ctx.branchId, ctx.isBranchScoped, ctx.warehouseAssignments),
      requireWarehouseAccess(service, body.destinationWarehouseId, ctx.branchId, ctx.isBranchScoped, ctx.warehouseAssignments),
    ]);

    const validatedItems = [];
    for (const line of body.items) {
      const quantity = ensurePositiveQuantity(line.quantity, 'return quantity');
      const item = await requireItem(service, line.itemId);
      const balance = await getBalance(service, line.itemId, body.sourceWarehouseId);
      const available = Number(balance?.quantity_available ?? balance?.quantity_on_hand ?? 0);

      if (available < quantity) {
        return badRequest(`Insufficient production stock for ${item.name}. Available ${available.toFixed(3)}, requested ${quantity.toFixed(3)}.`);
      }

      validatedItems.push({ item, quantity });
    }

    const returnNumber = await generateDocumentNumber(service, 'stock_transfers', 'PRTN');
    const notes = `${PRODUCTION_RETURN_NOTE} ${body.reason.trim()}${body.notes ? ` | ${body.notes}` : ''}${body.productionBatchId ? ` | batch:${body.productionBatchId}` : ''}`;
    const returnDate = body.returnDate ? new Date(body.returnDate) : new Date();
    if (Number.isNaN(returnDate.getTime())) {
      return badRequest('returnDate must be a valid date.');
    }

    const { data: transfer, error: transferError } = await service
      .from('stock_transfers')
      .insert({
        approved_by: ctx.userId,
        from_warehouse_id: body.sourceWarehouseId,
        notes,
        organization_id: ctx.organizationId,
        requested_by: ctx.userId,
        status: 'COMPLETED',
        to_warehouse_id: body.destinationWarehouseId,
        transfer_date: returnDate.toISOString().slice(0, 10),
        transfer_number: returnNumber,
      })
      .select('id, transfer_number, transfer_date, status, notes')
      .single();
    if (transferError || !transfer) throw transferError ?? new Error('Failed to create production return.');

    for (const line of validatedItems) {
      const { error: itemError } = await service
        .from('stock_transfer_items')
        .insert({
          item_id: line.item.id,
          notes,
          quantity_received: line.quantity,
          quantity_requested: line.quantity,
          quantity_sent: line.quantity,
          transfer_id: transfer.id,
          unit_cost: line.item.unit_cost ?? null,
        });
      if (itemError) throw itemError;

      await applyInventoryDelta(service, {
        itemId: line.item.id,
        organizationId: ctx.organizationId,
        quantityDelta: -line.quantity,
        warehouseId: body.sourceWarehouseId,
      });
      await applyInventoryDelta(service, {
        itemId: line.item.id,
        organizationId: ctx.organizationId,
        quantityDelta: line.quantity,
        warehouseId: body.destinationWarehouseId,
      });

      await recordStockMovement(service, {
        createdAt: returnDate.toISOString(),
        createdBy: ctx.userId,
        destinationWarehouseId: body.destinationWarehouseId,
        itemId: line.item.id,
        movementType: 'TRANSFER_OUT',
        notes,
        organizationId: ctx.organizationId,
        quantity: line.quantity,
        referenceId: String(transfer.id),
        referenceType: 'production_return',
        sourceWarehouseId: body.sourceWarehouseId,
        warehouseId: body.sourceWarehouseId,
      });
      await recordStockMovement(service, {
        createdAt: returnDate.toISOString(),
        createdBy: ctx.userId,
        destinationWarehouseId: body.destinationWarehouseId,
        itemId: line.item.id,
        movementType: 'PRODUCTION_RETURN',
        notes,
        organizationId: ctx.organizationId,
        quantity: line.quantity,
        referenceId: String(transfer.id),
        referenceType: 'production_return',
        sourceWarehouseId: body.sourceWarehouseId,
        warehouseId: body.destinationWarehouseId,
      });
    }

    await writeProductionAuditLog(
      'PRODUCTION_SURPLUS_RETURNED',
      String(transfer.id),
      ctx.userId,
      {
        destinationWarehouseId: destinationWarehouse.id,
        itemCount: validatedItems.length,
        productionBatchId: body.productionBatchId ?? null,
        quantityReturned: validatedItems.reduce((sum, line) => sum + line.quantity, 0),
        reason: body.reason.trim(),
        sourceWarehouseId: sourceWarehouse.id,
      },
      'stock_transfer',
    );

    await writeInventoryAuditLog(service, {
      action: 'PRODUCTION_RETURN_POSTED',
      details: {
        destinationWarehouseName: destinationWarehouse.name,
        productionBatchId: body.productionBatchId ?? null,
        reason: body.reason.trim(),
        returnNumber,
        sourceWarehouseName: sourceWarehouse.name,
      },
      entityId: String(transfer.id),
      entityType: 'stock_transfer',
      userProfileId: ctx.userId,
    });

    return NextResponse.json({
      ...transfer,
      quantityReturned: validatedItems.reduce((sum, line) => sum + line.quantity, 0),
      sourceWarehouse: { id: sourceWarehouse.id, name: sourceWarehouse.name },
      storeWarehouse: { id: destinationWarehouse.id, name: destinationWarehouse.name },
    }, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to post production return.');
  }
}
