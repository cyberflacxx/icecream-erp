import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { ensureNonNegative } from '@/lib/inventory';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      materials: Array<{
        id: string;
        note?: string;
        quantityActual: number;
        quantityIssued?: number;
        unitCost?: number;
      }>;
      closingStocks?: Array<{
        additionalQuantity?: number;
        closingQuantity: number;
        itemId: string;
        notes?: string;
        openingQuantity?: number;
        remainingQuantity?: number;
        unitCost?: number;
        usedQuantity?: number;
        warehouseId?: string;
      }>;
    };

    if (!Array.isArray(body.materials) || body.materials.length === 0) {
      return badRequest('materials are required.');
    }

    const service = productionService();
    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select('id, status, warehouse_id')
      .eq('id', id)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return notFound('Production batch not found.');
    if (['COMPLETED', 'CANCELLED'].includes(String(batch.status))) {
      return badRequest('Completed or cancelled batches cannot be edited.');
    }

    for (const material of body.materials) {
      const actual = ensureNonNegative(material.quantityActual, 'quantityActual');
      const issued = material.quantityIssued !== undefined
        ? ensureNonNegative(material.quantityIssued, 'quantityIssued')
        : actual;
      const unitCost = material.unitCost !== undefined
        ? ensureNonNegative(material.unitCost, 'unitCost')
        : undefined;
      const remaining = Math.max(0, issued - actual);

      const { data: existing } = await service
        .from('production_batch_materials')
        .select('item_id, quantity_required, unit_cost')
        .eq('id', material.id)
        .eq('batch_id', id)
        .maybeSingle();

      const resolvedUnitCost = unitCost ?? Number(existing?.unit_cost ?? 0);
      const totalCost = actual * resolvedUnitCost;
      await service
        .from('production_batch_materials')
        .update({
          notes: material.note ?? null,
          quantity_actual: actual,
          quantity_issued: issued,
          quantity_remaining: remaining,
          total_cost: totalCost,
          unit_cost: resolvedUnitCost,
          variance: actual - Number(existing?.quantity_required ?? 0),
        })
        .eq('id', material.id)
        .eq('batch_id', id);

      if (unitCost !== undefined && existing?.item_id) {
        await service.from('production_cost_overrides').insert({
          adjusted_by: ctx.userId,
          adjusted_unit_cost: resolvedUnitCost,
          batch_id: id,
          item_id: existing.item_id,
          material_id: material.id,
          organization_id: ctx.organizationId,
          previous_unit_cost: Number(existing.unit_cost ?? 0),
        });
      }
    }

    for (const closure of body.closingStocks ?? []) {
      const closingQuantity = ensureNonNegative(closure.closingQuantity, 'closingQuantity');
      const warehouseId = closure.warehouseId ?? String(batch.warehouse_id ?? '');
      if (!closure.itemId || !warehouseId) continue;

      await service.from('production_stock_closures').insert({
        additional_quantity: ensureNonNegative(closure.additionalQuantity ?? 0, 'additionalQuantity'),
        batch_id: id,
        closing_quantity: closingQuantity,
        item_id: closure.itemId,
        notes: closure.notes ?? null,
        opening_quantity: ensureNonNegative(closure.openingQuantity ?? 0, 'openingQuantity'),
        organization_id: ctx.organizationId,
        recorded_by: ctx.userId,
        remaining_quantity: ensureNonNegative(closure.remainingQuantity ?? closingQuantity, 'remainingQuantity'),
        unit_cost: ensureNonNegative(closure.unitCost ?? 0, 'unitCost'),
        used_quantity: ensureNonNegative(closure.usedQuantity ?? 0, 'usedQuantity'),
        warehouse_id: warehouseId,
      });

      const { data: balance } = await service
        .from('stock_balances')
        .select('id, quantity_reserved')
        .eq('item_id', closure.itemId)
        .eq('warehouse_id', warehouseId)
        .maybeSingle();

      if (balance) {
        const reserved = Number(balance.quantity_reserved ?? 0);
        await service
          .from('stock_balances')
          .update({
            last_updated: new Date().toISOString(),
            quantity_available: Math.max(0, closingQuantity - reserved),
            quantity_on_hand: closingQuantity,
          })
          .eq('id', balance.id);
      }
    }

    const { data: materials } = await service
      .from('production_batch_materials')
      .select('total_cost')
      .eq('batch_id', id);
    const materialCost = (materials ?? []).reduce((sum, row) => sum + Number(row.total_cost ?? 0), 0);

    await service
      .from('production_batches')
      .update({
        material_cost: materialCost,
        status: ['IN_PROGRESS', 'MATERIALS_RESERVED', 'MATERIALS_ISSUED'].includes(String(batch.status))
          ? 'WIP'
          : batch.status,
      })
      .eq('id', id);

    await writeProductionAuditLog('PRODUCTION_BATCH_MATERIAL_USAGE_RECORDED', id, ctx.userId, {
      materialCount: body.materials.length,
      materialCost,
    }, 'production_batch');

    return NextResponse.json({ updated: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
