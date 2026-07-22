import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import {
  applyInventoryDelta,
  generateDocumentNumber,
  getBalance,
  recordStockMovement,
  requireItem,
  requireWarehouseAccess,
} from '@/lib/inventory-server';
import {
  buildProductionStockReceiveFailure,
  buildProductionStockReceiveSignature,
} from '@/lib/production';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

const RAW_MATERIAL_TRANSFER_NOTE = '[production_raw_material_transfer]';
const PRODUCTION_RECEIVE_CODE = 'PRODUCTION_STOCK_RECEIVE_FAILED';

type ReceiveFailureContext = {
  destinationWarehouseId: string | null;
  itemId: string | null;
  productionOrderId: string | null;
  quantity: number | null;
  sourceWarehouseId: string | null;
};

type ValidatedTransferItem = {
  item: Awaited<ReturnType<typeof requireItem>>;
  quantity: number;
  unitCost: number;
};

function buildReceiveFailureResponse(
  stage: string,
  message: string,
  details: ReceiveFailureContext,
  status: number,
  dbMessage?: string | null,
) {
  return NextResponse.json(
    buildProductionStockReceiveFailure({
      dbMessage,
      destinationWarehouseId: details.destinationWarehouseId,
      itemId: details.itemId,
      message,
      productionOrderId: details.productionOrderId,
      quantity: details.quantity,
      sourceWarehouseId: details.sourceWarehouseId,
      stage,
    }),
    { status },
  );
}

function createReceiveIdempotencyKey(input: {
  destinationWarehouseId: string;
  items: Array<{ itemId: string; quantity: number; unitCost?: number | null }>;
  notes?: string | null;
  sourceWarehouseId: string;
  transferDate?: string;
}) {
  return createHash('sha256')
    .update(
      buildProductionStockReceiveSignature({
        destinationWarehouseId: input.destinationWarehouseId,
        items: input.items,
        notes: input.notes ?? null,
        sourceWarehouseId: input.sourceWarehouseId,
        transferDate: input.transferDate ?? null,
      }),
    )
    .digest('hex')
    .slice(0, 24);
}

async function loadExistingReceiveTransfer(
  service: ReturnType<typeof productionService>,
  ctx: Awaited<ReturnType<typeof getAuthContext>>,
  input: {
    destinationWarehouseId: string;
    idempotencyMarker: string;
    sourceWarehouseId: string;
    transferDate: string;
    validatedItems: ValidatedTransferItem[];
  },
) {
  if (!ctx) {
    return null;
  }

  const { data: transfer, error: transferError } = await service
    .from('stock_transfers')
    .select('id, transfer_number, transfer_date, status, notes')
    .eq('organization_id', ctx.organizationId)
    .eq('from_warehouse_id', input.sourceWarehouseId)
    .eq('to_warehouse_id', input.destinationWarehouseId)
    .eq('transfer_date', input.transferDate)
    .ilike('notes', `%${input.idempotencyMarker}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (transferError || !transfer) {
    return null;
  }

  const { data: transferItems, error: itemError } = await service
    .from('stock_transfer_items')
    .select('item_id, quantity_requested, quantity_received')
    .eq('transfer_id', transfer.id);

  if (itemError) {
    return null;
  }

  const existingItems = new Map<string, number>();
  for (const line of transferItems ?? []) {
    const itemId = String(line.item_id ?? '').trim();
    const quantity = Number(line.quantity_received ?? line.quantity_requested ?? 0);
    if (itemId) {
      existingItems.set(itemId, (existingItems.get(itemId) ?? 0) + quantity);
    }
  }

  const matchesEveryLine =
    existingItems.size === input.validatedItems.length &&
    input.validatedItems.every((line) => Math.abs((existingItems.get(line.item.id) ?? 0) - line.quantity) < 0.0001);

  if (!matchesEveryLine) {
    return null;
  }

  return transfer;
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read', 'inventory.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('stock_transfers')
      .select('id, transfer_number, transfer_date, status, notes, from_warehouse_id, to_warehouse_id, created_at')
      .eq('organization_id', ctx.organizationId)
      .ilike('notes', `%${RAW_MATERIAL_TRANSFER_NOTE}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const transferIds = (data ?? []).map((row) => String(row.id));
    const warehouseIds = [
      ...new Set(
        (data ?? [])
          .flatMap((row) => [row.from_warehouse_id, row.to_warehouse_id])
          .map((id) => String(id ?? ''))
          .filter(Boolean),
      ),
    ];

    const [warehousesResult, itemsResult] = await Promise.all([
      warehouseIds.length
        ? service.from('warehouses').select('id, code, name').in('id', warehouseIds)
        : Promise.resolve({ data: [], error: null }),
      transferIds.length
        ? service.from('stock_transfer_items').select('transfer_id, quantity_requested').in('transfer_id', transferIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (warehousesResult.error) throw warehousesResult.error;
    if (itemsResult.error) throw itemsResult.error;

    const warehouses = new Map((warehousesResult.data ?? []).map((row) => [String(row.id), row]));
    const quantities = new Map<string, number>();
    for (const item of itemsResult.data ?? []) {
      const transferId = String(item.transfer_id ?? '');
      quantities.set(transferId, (quantities.get(transferId) ?? 0) + Number(item.quantity_requested ?? 0));
    }

    return NextResponse.json((data ?? []).map((row) => ({
      id: row.id,
      quantityTransferred: quantities.get(String(row.id)) ?? 0,
      sourceWarehouse: warehouses.get(String(row.from_warehouse_id ?? '')) ?? null,
      status: row.status,
      transferDate: row.transfer_date,
      transferNumber: row.transfer_number,
      destinationWarehouse: warehouses.get(String(row.to_warehouse_id ?? '')) ?? null,
    })));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write', 'inventory.write', 'stock_transfer.create')) return forbidden();

  let stage = 'READ_REQUEST';
  const failureContext: ReceiveFailureContext = {
    destinationWarehouseId: null,
    itemId: null,
    productionOrderId: null,
    quantity: null,
    sourceWarehouseId: null,
  };

  try {
    const body = await request.json() as {
      destinationWarehouseId: string;
      items: Array<{ itemId: string; quantity: number; unitCost?: number | null }>;
      notes?: string | null;
      sourceWarehouseId: string;
      transferDate?: string;
    };
    stage = 'VALIDATE_REQUEST';
    failureContext.sourceWarehouseId = body.sourceWarehouseId ? String(body.sourceWarehouseId) : null;
    failureContext.destinationWarehouseId = body.destinationWarehouseId ? String(body.destinationWarehouseId) : null;

    if (!body.sourceWarehouseId || !body.destinationWarehouseId) {
      return buildReceiveFailureResponse(
        stage,
        'sourceWarehouseId and destinationWarehouseId are required.',
        failureContext,
        400,
      );
    }
    if (body.sourceWarehouseId === body.destinationWarehouseId) {
      return buildReceiveFailureResponse(
        stage,
        'Source and production warehouses must be different.',
        failureContext,
        400,
      );
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return buildReceiveFailureResponse(
        stage,
        'At least one raw material is required.',
        failureContext,
        400,
      );
    }

    const service = productionService();
    stage = 'LOAD_WAREHOUSES';
    const [sourceWarehouse, destinationWarehouse] = await Promise.all([
      requireWarehouseAccess(service, body.sourceWarehouseId, ctx.branchId, ctx.isBranchScoped, ctx.warehouseAssignments),
      requireWarehouseAccess(service, body.destinationWarehouseId, ctx.branchId, ctx.isBranchScoped, ctx.warehouseAssignments),
    ]);

    const validatedItems: ValidatedTransferItem[] = [];
    for (const line of body.items) {
      failureContext.itemId = line.itemId ? String(line.itemId) : null;
      failureContext.quantity = Number(line.quantity ?? 0);
      stage = 'VALIDATE_ITEM';
      const quantity = ensurePositiveQuantity(line.quantity, 'transfer quantity');
      stage = 'LOAD_ITEM';
      const item = await requireItem(service, line.itemId);
      stage = 'CHECK_SOURCE_STOCK';
      const sourceBalance = await getBalance(service, item.id, body.sourceWarehouseId);
      const available = Number(sourceBalance?.quantity_available ?? sourceBalance?.quantity_on_hand ?? 0);

      if (available < quantity) {
        return buildReceiveFailureResponse(
          stage,
          `Insufficient HQ/main stock for ${item.name}. Available ${available.toFixed(3)}, requested ${quantity.toFixed(3)}.`,
          failureContext,
          400,
        );
      }

      validatedItems.push({
        item,
        quantity,
        unitCost: Number(line.unitCost ?? item.unit_cost ?? 0),
      });
    }

    const normalizedTransferDate = body.transferDate ?? new Date().toISOString().slice(0, 10);
    const idempotencyKey = createReceiveIdempotencyKey({
      destinationWarehouseId: body.destinationWarehouseId,
      items: body.items,
      notes: body.notes,
      sourceWarehouseId: body.sourceWarehouseId,
      transferDate: normalizedTransferDate,
    });
    const idempotencyMarker = `[production_stock_receive:${idempotencyKey}]`;
    const existingTransfer = await loadExistingReceiveTransfer(service, ctx, {
      destinationWarehouseId: body.destinationWarehouseId,
      idempotencyMarker,
      sourceWarehouseId: body.sourceWarehouseId,
      transferDate: normalizedTransferDate,
      validatedItems,
    });
    if (existingTransfer) {
      return NextResponse.json(
        {
          ...existingTransfer,
          code: PRODUCTION_RECEIVE_CODE,
          destinationWarehouse: { id: destinationWarehouse.id, name: destinationWarehouse.name },
          idempotentReplay: true,
          sourceWarehouse: { id: sourceWarehouse.id, name: sourceWarehouse.name },
        },
        { status: 200 },
      );
    }

    stage = 'CREATE_TRANSFER_HEADER';
    const transferNumber = await generateDocumentNumber(service, 'stock_transfers', 'PRM');
    const notes = `${RAW_MATERIAL_TRANSFER_NOTE} ${idempotencyMarker} ${body.notes ?? 'Raw materials moved from HQ/main stock to production inventory.'}`.trim();

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
        transfer_date: normalizedTransferDate,
        transfer_number: transferNumber,
      })
      .select('id, transfer_number, transfer_date, status, notes')
      .single();
    if (transferError || !transfer) throw transferError ?? new Error('Failed to create raw material transfer.');

    for (const line of validatedItems) {
      stage = 'CREATE_TRANSFER_LINE';
      failureContext.itemId = line.item.id;
      failureContext.quantity = line.quantity;
      const { error: itemError } = await service
        .from('stock_transfer_items')
        .insert({
          item_id: line.item.id,
          notes,
          quantity_received: line.quantity,
          quantity_requested: line.quantity,
          quantity_sent: line.quantity,
          transfer_id: transfer.id,
          unit_cost: line.unitCost,
        });
      if (itemError) throw itemError;

      stage = 'UPDATE_SOURCE_BALANCE';
      await applyInventoryDelta(service, {
        itemId: line.item.id,
        organizationId: ctx.organizationId,
        quantityDelta: -line.quantity,
        unitCost: line.unitCost,
        warehouseId: body.sourceWarehouseId,
      });
      stage = 'UPDATE_DESTINATION_BALANCE';
      await applyInventoryDelta(service, {
        itemId: line.item.id,
        organizationId: ctx.organizationId,
        quantityDelta: line.quantity,
        unitCost: line.unitCost,
        warehouseId: body.destinationWarehouseId,
      });

      stage = 'CREATE_SOURCE_MOVEMENT';
      await recordStockMovement(service, {
        createdBy: ctx.userId,
        destinationWarehouseId: body.destinationWarehouseId,
        itemId: line.item.id,
        movementType: 'TRANSFER_OUT',
        notes,
        organizationId: ctx.organizationId,
        quantity: line.quantity,
        referenceId: String(transfer.id),
        referenceType: 'stock_transfer',
        sourceWarehouseId: body.sourceWarehouseId,
        unitCost: line.unitCost,
        warehouseId: body.sourceWarehouseId,
      });
      stage = 'CREATE_DESTINATION_MOVEMENT';
      await recordStockMovement(service, {
        createdBy: ctx.userId,
        destinationWarehouseId: body.destinationWarehouseId,
        itemId: line.item.id,
        movementType: 'TRANSFER_IN',
        notes,
        organizationId: ctx.organizationId,
        quantity: line.quantity,
        referenceId: String(transfer.id),
        referenceType: 'stock_transfer',
        sourceWarehouseId: body.sourceWarehouseId,
        unitCost: line.unitCost,
        warehouseId: body.destinationWarehouseId,
      });
    }

    stage = 'WRITE_AUDIT_LOG';
    await writeProductionAuditLog('PRODUCTION_RAW_MATERIALS_RECEIVED', String(transfer.id), ctx.userId, {
      destinationWarehouseId: destinationWarehouse.id,
      itemCount: validatedItems.length,
      sourceWarehouseId: sourceWarehouse.id,
      transferNumber,
    }, 'stock_transfer');

    return NextResponse.json({
      ...transfer,
      destinationWarehouse: { id: destinationWarehouse.id, name: destinationWarehouse.name },
      sourceWarehouse: { id: sourceWarehouse.id, name: sourceWarehouse.name },
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to receive raw materials into production.';
    console.error('Production stock receive failed.', {
      code: PRODUCTION_RECEIVE_CODE,
      details: failureContext,
      message,
      stage,
    });
    return buildReceiveFailureResponse(
      stage,
      message,
      failureContext,
      stage === 'VALIDATE_REQUEST' || stage === 'VALIDATE_ITEM' || stage === 'CHECK_SOURCE_STOCK' ? 400 : 500,
      message,
    );
  }
}
