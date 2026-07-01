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
      .select('id, organization_id, status, warehouse_id')
      .eq('id', id)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return notFound('Production batch not found.');
    if (['COMPLETED', 'CANCELLED'].includes(String(batch.status))) {
      return badRequest('Completed or cancelled batches cannot be edited.');
    }

    let materialCost = 0;
    for (const material of body.materials) {
      const actual = ensureNonNegative(material.quantityActual, 'quantityActual');
      const issued = material.quantityIssued !== undefined
        ? ensureNonNegative(material.quantityIssued, 'quantityIssued')
        : actual;
      const unitCost = material.unitCost !== undefined
        ? ensureNonNegative(material.unitCost, 'unitCost')
        : undefined;

      const { data: existing } = await service
        .from('production_batch_materials')
        .select('item_id, quantity_required, items(unit_cost)')
        .eq('id', material.id)
        .eq('batch_id', id)
        .maybeSingle();

      const resolvedUnitCost = unitCost ?? Number((existing?.items as { unit_cost?: unknown } | null)?.unit_cost ?? 0);
      materialCost += actual * resolvedUnitCost;
      await service
        .from('production_batch_materials')
        .update({
          notes: material.note ?? null,
          quantity_actual: actual,
          quantity_issued: issued,
          variance: actual - Number(existing?.quantity_required ?? 0),
        })
        .eq('id', material.id)
        .eq('batch_id', id);
    }

    for (const closure of body.closingStocks ?? []) {
      const closingQuantity = ensureNonNegative(closure.closingQuantity, 'closingQuantity');
      const warehouseId = closure.warehouseId ?? String(batch.warehouse_id ?? '');
      if (!closure.itemId || !warehouseId) continue;

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
      } else {
        await service
          .from('stock_balances')
          .insert({
            item_id: closure.itemId,
            organization_id: String(batch.organization_id),
            quantity_available: closingQuantity,
            quantity_on_hand: closingQuantity,
            quantity_reserved: 0,
            warehouse_id: warehouseId,
          });
      }
    }

    await service
      .from('production_batches')
      .update({
        material_cost: materialCost,
        status: ['IN_PROGRESS', 'MATERIALS_RESERVED', 'MATERIALS_APPROVED'].includes(String(batch.status))
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
