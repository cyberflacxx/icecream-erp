import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService } from '@/lib/finance-server';
import { buildProductionCostSummary, summarizeBatchLabour, summarizeProductionMaterialCosts } from '@/lib/red-module-costing';

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapByStringKey(rows: Array<Record<string, unknown>>, key: string) {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const value = String(row[key] ?? '').trim();
    if (value && !map.has(value)) map.set(value, row);
  }
  return map;
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read', 'production.read')) return forbidden();

  try {
    const service = financeService();
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId') ?? undefined;
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;
    let query = service
      .from('production_receipt_lines')
      .select('production_receipt_id, production_order_id, finished_product_id, current_completed_quantity, current_rejected_quantity, current_wastage_quantity, unit_production_cost, total_production_cost, batch_number, production_receipts!inner(receipt_number, receipt_date, branch_id)')
      .order('created_at', { ascending: false });
    if (branchId) {
      query = query.eq('production_receipts.branch_id', branchId);
    }
    const { data, error } = await query;
    if (error) throw error;

    const receiptLines = (data ?? []) as Array<Record<string, unknown>>;
    const batchNumbers = [...new Set(receiptLines.map((row) => String(row.batch_number ?? '').trim()).filter(Boolean))];

    const batchesResult = batchNumbers.length
      ? await service
          .from('production_batches')
          .select('id, batch_number, actual_output, actual_qty, actual_quantity, material_cost, total_material_cost, labour_cost, total_labour_cost, overhead_cost, total_overhead_cost, wastage_qty, wastage_quantity, cost_per_unit')
          .in('batch_number', batchNumbers)
      : { data: [], error: null };
    if (batchesResult.error) throw batchesResult.error;

    const batches = ((batchesResult.data ?? []) as Array<Record<string, unknown>>);
    const batchByNumber = mapByStringKey(batches, 'batch_number');
    const batchIds = batches.map((row) => String(row.id ?? '')).filter(Boolean);

    const [labourResult, assignmentResult, materialResult] = await Promise.all([
      batchIds.length
        ? service
            .from('hr_labour_cost_allocations')
            .select('batch_id, employee_id, rate, rate_type, hours_worked, labour_cost, total_cost')
            .in('batch_id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      batchIds.length
        ? service
            .from('production_worker_assignments')
            .select('batch_id, employee_id')
            .in('batch_id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      batchIds.length
        ? service
            .from('production_batch_materials')
            .select('batch_id, quantity_actual, quantity_issued, quantity_required, unit_cost, total_cost, material_type, is_packaging, items(unit_cost, standard_cost, item_type, type, stock_type, production_category, name, code)')
            .in('batch_id', batchIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (labourResult.error && !String(labourResult.error.message ?? '').includes('does not exist')) throw labourResult.error;
    if (assignmentResult.error && !String(assignmentResult.error.message ?? '').includes('does not exist')) throw assignmentResult.error;
    if (materialResult.error && !String(materialResult.error.message ?? '').includes('does not exist')) throw materialResult.error;

    const labourByBatchId = new Map<string, Array<Record<string, unknown>>>();
    for (const row of ((labourResult.data ?? []) as Array<Record<string, unknown>>)) {
      const batchId = String(row.batch_id ?? '');
      const next = labourByBatchId.get(batchId) ?? [];
      next.push(row);
      labourByBatchId.set(batchId, next);
    }

    const assignmentsByBatchId = new Map<string, Array<Record<string, unknown>>>();
    for (const row of ((assignmentResult.data ?? []) as Array<Record<string, unknown>>)) {
      const batchId = String(row.batch_id ?? '');
      const next = assignmentsByBatchId.get(batchId) ?? [];
      next.push(row);
      assignmentsByBatchId.set(batchId, next);
    }

    const materialsByBatchId = new Map<string, Array<Record<string, unknown>>>();
    for (const row of ((materialResult.data ?? []) as Array<Record<string, unknown>>)) {
      const batchId = String(row.batch_id ?? '');
      const next = materialsByBatchId.get(batchId) ?? [];
      next.push(row);
      materialsByBatchId.set(batchId, next);
    }

    const rows = receiptLines.map((row) => {
      const receipt = Array.isArray(row.production_receipts) ? row.production_receipts[0] : row.production_receipts;
      const batch = batchByNumber.get(String(row.batch_number ?? '').trim()) ?? {};
      const batchId = String(batch.id ?? '');
      const goodUnitsProduced = toNumber(row.current_completed_quantity);
      const labour = summarizeBatchLabour({
        assignments: assignmentsByBatchId.get(batchId) ?? [],
        goodUnitsProduced,
        labourAllocations: labourByBatchId.get(batchId) ?? [],
      });
      const batchLabourCost = toNumber(batch.total_labour_cost ?? batch.labour_cost);
      const materialCosts = summarizeProductionMaterialCosts(materialsByBatchId.get(batchId) ?? []);
      const productionCost = buildProductionCostSummary({
        goodUnitsProduced,
        labourCost: labour.totalLabourCost > 0 ? labour.totalLabourCost : batchLabourCost,
        overheadCost: batch.total_overhead_cost ?? batch.overhead_cost,
        packagingCost: materialCosts.packagingCost,
        rawMaterialCost: materialCosts.rawMaterialCost || batch.total_material_cost || batch.material_cost,
        receiptUnitCost: row.unit_production_cost,
        totalProductionCost: row.total_production_cost,
        wastageCost: toNumber(row.current_wastage_quantity) * toNumber(row.unit_production_cost),
      });
      const missingComponents = [...new Set([...productionCost.missingComponents, ...labour.missingComponents])];
      return {
        assignedWorkers: labour.assignedWorkers,
        acceptedQuantity: productionCost.goodUnitsProduced,
        batchNumber: row.batch_number ?? null,
        branchId: receipt && typeof receipt === 'object' ? (receipt as Record<string, unknown>).branch_id ?? null : null,
        costPerUnit: productionCost.costPerGoodUnit,
        costStatus: missingComponents.length === 0 ? productionCost.costStatus : productionCost.costStatus === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'PARTIAL',
        finishedGoodsValue: productionCost.finishedGoodsValue,
        goodUnitsProduced: productionCost.goodUnitsProduced,
        labourCost: productionCost.labourCost,
        labourCostPerUnit: labour.labourCostPerUnit,
        missingComponents,
        overheadCost: productionCost.overheadCost,
        packagingCost: productionCost.packagingCost,
        productionOrderId: row.production_order_id ?? null,
        rawMaterialCost: productionCost.rawMaterialCost,
        receiptDate: receipt && typeof receipt === 'object' ? (receipt as Record<string, unknown>).receipt_date ?? null : null,
        receiptNumber: receipt && typeof receipt === 'object' ? (receipt as Record<string, unknown>).receipt_number ?? null : null,
        rejectedQuantity: Number(row.current_rejected_quantity ?? 0),
        totalCost: productionCost.totalProductionCost,
        totalLabourHours: labour.totalLabourHours,
        unitsPerWorker: labour.unitsPerWorker,
        wastageCost: productionCost.wastageCost,
        wastageQuantity: Number(row.current_wastage_quantity ?? 0),
      };
    });
    return NextResponse.json({
      filters: {
        branchId: branchId ?? null,
      },
      rows,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
