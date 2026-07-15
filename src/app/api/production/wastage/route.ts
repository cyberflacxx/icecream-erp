import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensureNonNegative } from '@/lib/inventory';
import { applyInventoryDelta, recordStockMovement } from '@/lib/inventory-server';
import { isMissingProductionTable, productionErrorMessage, productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('production_wastage')
      .select(`
        id, production_batch_id, item_id, wastage_type, quantity, unit_cost, total_cost, reason, created_at,
        production_batches(batch_number),
        items(code, name)
      `)
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (isMissingProductionTable(err)) return NextResponse.json([]);
    return serverError(productionErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      itemId: string;
      productionBatchId: string;
      quantity: number;
      reason?: string;
      unitCost?: number;
      wastageType: string;
    };

    if (!body.productionBatchId) return badRequest('productionBatchId is required.');
    if (!body.itemId) return badRequest('itemId is required.');
    const quantity = ensureNonNegative(body.quantity, 'quantity');
    const unitCost = ensureNonNegative(body.unitCost ?? 0, 'unitCost');

    const service = productionService();
    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select('id, batch_number, organization_id, warehouse_id')
      .eq('id', body.productionBatchId)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return badRequest('Production batch not found.');

    const { data: balance, error: balanceError } = await service
      .from('stock_balances')
      .select('quantity_on_hand, quantity_available')
      .eq('item_id', body.itemId)
      .eq('warehouse_id', batch.warehouse_id)
      .maybeSingle();
    if (balanceError) throw balanceError;

    const available = Number(balance?.quantity_available ?? balance?.quantity_on_hand ?? 0);
    if (available < quantity) {
      return badRequest(`Insufficient stock to record damaged quantity. Available ${available.toFixed(3)}, reported ${quantity.toFixed(3)}.`);
    }

    const { data, error } = await service
      .from('production_wastage')
      .insert({
        organization_id: String(batch.organization_id ?? ctx.organizationId),
        item_id: body.itemId,
        production_batch_id: body.productionBatchId,
        quantity,
        reason: body.reason ?? null,
        reported_by: ctx.userId,
        total_cost: quantity * unitCost,
        unit_cost: unitCost,
        wastage_type: body.wastageType,
      })
      .select()
      .single();
    if (error) throw error;

    await applyInventoryDelta(service, {
      itemId: body.itemId,
      organizationId: String(batch.organization_id ?? ''),
      quantityDelta: -quantity,
      warehouseId: String(batch.warehouse_id),
    });

    await recordStockMovement(service, {
      createdBy: ctx.userId,
      itemId: body.itemId,
      movementType: body.wastageType?.toUpperCase().includes('DAMAGE') ? 'DAMAGE' : 'WASTAGE',
      notes: body.reason ?? null,
      organizationId: String(batch.organization_id ?? ''),
      quantity,
      referenceId: String(data.id),
      referenceType: 'production_wastage',
      warehouseId: String(batch.warehouse_id),
    });

    await writeProductionAuditLog('PRODUCTION_WASTAGE_RECORDED', String(data.id), ctx.userId, {
      itemId: body.itemId,
      productionBatchId: body.productionBatchId,
      quantity,
      reason: body.reason ?? null,
      warehouseId: batch.warehouse_id,
      wastageType: body.wastageType,
    }, 'production_wastage');

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
