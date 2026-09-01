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
        isPackaging?: boolean;
        materialType?: string;
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
    if ((body.closingStocks ?? []).length > 0) {
      return badRequest('Stock balances must be changed through production issue, reversal, or inventory adjustment posting.');
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
        .select('item_id, quantity_required, unit_cost, items(unit_cost)')
        .eq('id', material.id)
        .eq('batch_id', id)
        .maybeSingle();

      const resolvedUnitCost = unitCost ?? Number(existing?.unit_cost ?? (existing?.items as { unit_cost?: unknown } | null)?.unit_cost ?? 0);
      materialCost += actual * resolvedUnitCost;
      const materialUpdate: Record<string, unknown> = {
        notes: material.note ?? null,
        quantity_actual: actual,
        quantity_issued: issued,
        variance: actual - Number(existing?.quantity_required ?? 0),
      };
      if (material.materialType !== undefined) {
        materialUpdate.material_type = String(material.materialType).trim().toUpperCase() || null;
      }
      if (material.isPackaging !== undefined) {
        materialUpdate.is_packaging = Boolean(material.isPackaging);
      }
      if (unitCost !== undefined) {
        materialUpdate.unit_cost = resolvedUnitCost;
      }
      materialUpdate.total_cost = actual * resolvedUnitCost;
      await service
        .from('production_batch_materials')
        .update(materialUpdate)
        .eq('id', material.id)
        .eq('batch_id', id);
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
