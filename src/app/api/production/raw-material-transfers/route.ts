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
} from '@/lib/inventory-server';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

const RAW_MATERIAL_TRANSFER_NOTE = '[production_raw_material_transfer]';

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

  try {
    const body = await request.json() as {
      destinationWarehouseId: string;
      items: Array<{ itemId: string; quantity: number; unitCost?: number | null }>;
      notes?: string | null;
      sourceWarehouseId: string;
      transferDate?: string;
    };

    if (!body.sourceWarehouseId || !body.destinationWarehouseId) {
      return badRequest('sourceWarehouseId and destinationWarehouseId are required.');
    }
    if (body.sourceWarehouseId === body.destinationWarehouseId) {
      return badRequest('Source and production warehouses must be different.');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return badRequest('At least one raw material is required.');
    }

    const service = productionService();
    const [sourceWarehouse, destinationWarehouse] = await Promise.all([
      requireWarehouseAccess(service, body.sourceWarehouseId, ctx.branchId, ctx.isBranchScoped),
      requireWarehouseAccess(service, body.destinationWarehouseId, ctx.branchId, ctx.isBranchScoped),
    ]);

    const validatedItems = [];
    for (const line of body.items) {
      const quantity = ensurePositiveQuantity(line.quantity, 'transfer quantity');
      const item = await requireItem(service, line.itemId);
      const sourceBalance = await getBalance(service, item.id, body.sourceWarehouseId);
      const available = Number(sourceBalance?.quantity_available ?? 0);

      if (available < quantity) {
        return badRequest(`Insufficient HQ/main stock for ${item.name}. Available ${available.toFixed(3)}, requested ${quantity.toFixed(3)}.`);
      }

      validatedItems.push({
        item,
        quantity,
        unitCost: line.unitCost ?? item.unit_cost ?? null,
      });
    }

    const transferNumber = await generateDocumentNumber(service, 'stock_transfers', 'PRM');
    const notes = `${RAW_MATERIAL_TRANSFER_NOTE} ${body.notes ?? 'Raw materials moved from HQ/main stock to production inventory.'}`.trim();

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
        transfer_date: body.transferDate ?? new Date().toISOString().slice(0, 10),
        transfer_number: transferNumber,
      })
      .select('id, transfer_number, transfer_date, status, notes')
      .single();
    if (transferError || !transfer) throw transferError ?? new Error('Failed to create raw material transfer.');

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
          unit_cost: line.unitCost,
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
        warehouseId: body.sourceWarehouseId,
      });
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
        warehouseId: body.destinationWarehouseId,
      });
    }

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
    return serverError(err instanceof Error ? err.message : 'Failed to receive raw materials into production.');
  }
}
