import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProductionStockReceiveFailure,
  buildProductionStockReceiveSignature,
  buildCostingRows,
  buildProductivityRows,
  buildShiftPerformanceRows,
  buildVarianceRows,
  buildYieldRows,
  calculateScaledMaterialRequirement,
  calculateScalingFactor,
  calculateRequiredMaterials,
  calculateCostPerUnit,
  calculateProductivity,
  calculateYieldPercentage,
  normalizeProductionStockReceiveItems,
  validateRecipeImportRows,
  validateShiftTargetImportRows,
} from '../src/lib/production';

test('calculateRequiredMaterials scales ingredient demand and shortages', () => {
  const rows = calculateRequiredMaterials(
    [
      {
        item_id: 'item-1',
        items: { code: 'MIX-01', name: 'Ice cream mix' },
        quantity_required: 10,
        units_of_measure: { abbreviation: 'kg' },
        wastage_allowance_percent: 5,
      },
    ],
    200,
    100,
    new Map([['item-1', 15]]),
  );

  assert.equal(rows[0]?.requiredQuantity, 21);
  assert.equal(rows[0]?.shortageQuantity, 6);
});

test('BOM scaling helpers support lower and higher plan volumes', () => {
  assert.equal(calculateScalingFactor(5000, 10000), 0.5);
  assert.equal(calculateScalingFactor(20000, 10000), 2);

  const halfBatch = calculateScaledMaterialRequirement({
    plannedQuantity: 5000,
    quantityRequired: 100,
    standardOutputQuantity: 10000,
    standardUnitCost: 2.5,
  });
  const doubleBatch = calculateScaledMaterialRequirement({
    plannedQuantity: 20000,
    quantityRequired: 100,
    standardOutputQuantity: 10000,
    standardUnitCost: 2.5,
  });

  assert.equal(halfBatch.requiredQuantity, 50);
  assert.equal(halfBatch.estimatedMaterialCost, 125);
  assert.equal(doubleBatch.requiredQuantity, 200);
  assert.equal(doubleBatch.estimatedMaterialCost, 500);
});

test('variance, yield, productivity, and costing rows derive batch KPIs', () => {
  const batches = [
    {
      id: 'batch-1',
      actual_output: 180,
      batch_number: 'PB-001',
      expected_output: 200,
      production_batch_materials: [
        { items: { name: 'Ice cream mix', unit_cost: 3 }, quantity_actual: 40, quantity_required: 35 },
      ],
      recipes: { finished_item: { name: 'Chocolate Cone' } },
      shift: 'DAY',
    },
  ];

  const varianceRows = buildVarianceRows(batches);
  const yieldRows = buildYieldRows(batches);
  const productivityRows = buildProductivityRows(batches, new Map([['batch-1', 6]]));
  const costingRows = buildCostingRows(batches);

  assert.equal(varianceRows[0]?.outputVariance, -20);
  assert.equal(varianceRows[0]?.materialVariance, 5);
  assert.equal(yieldRows[0]?.yieldPercentage, 450);
  assert.equal(productivityRows[0]?.outputPerWorker, 30);
  assert.equal(costingRows[0]?.costPerUnit, 2 / 3);
});

test('shift performance merges actual output with targets', () => {
  const rows = buildShiftPerformanceRows(
    [
      { actual_output: 140, id: 'batch-1', production_date: '2026-06-12', shift: 'DAY' },
      { actual_output: 60, id: 'batch-2', production_date: '2026-06-12', shift: 'DAY' },
    ],
    [
      { shift: 'DAY', target_date: '2026-06-12', target_output_quantity: 250, target_workers: 8 },
    ],
    new Map([['batch-1', 3], ['batch-2', 4]]),
  );

  assert.equal(rows[0]?.actualOutput, 200);
  assert.equal(rows[0]?.targetOutput, 250);
  assert.equal(rows[0]?.workerCount, 8);
});

test('direct calculation helpers expose finance and workforce metrics', () => {
  assert.equal(calculateYieldPercentage(500, 100), 500);
  assert.equal(calculateProductivity(240, 8), 30);
  assert.equal(calculateCostPerUnit(600, 200), 3);
});

test('recipe import validation returns row level errors', () => {
  const result = validateRecipeImportRows([
    { ingredientCode: '', ingredientQuantity: 0, productCode: 'CONE', recipeCode: '' },
    { ingredientCode: 'MIX-01', ingredientQuantity: 4, productCode: 'CONE', recipeCode: 'RCP-1' },
  ]);

  assert.equal(result.errors.length, 3);
  assert.equal(result.rows.length, 1);
});

test('shift target import validation blocks invalid rows', () => {
  const result = validateShiftTargetImportRows([
    { productCode: '', targetOutputQuantity: 0, targetWorkers: 0 },
    { productCode: 'CONE', targetOutputQuantity: 120, targetWorkers: 4 },
  ]);

  assert.equal(result.errors.length, 3);
  assert.equal(result.rows.length, 1);
});

test('production stock receive helpers build stable request signatures and sort normalized items', () => {
  const normalized = normalizeProductionStockReceiveItems([
    { itemId: ' item-b ', quantity: '2', unitCost: '1.5' },
    { itemId: 'item-a', quantity: 5, unitCost: 2 },
    { itemId: 'item-b', quantity: 0, unitCost: 3 },
  ]);

  assert.deepEqual(normalized, [
    { itemId: 'item-a', quantity: 5, unitCost: 2 },
    { itemId: 'item-b', quantity: 2, unitCost: 1.5 },
  ]);

  const left = buildProductionStockReceiveSignature({
    destinationWarehouseId: 'prod-wh',
    items: [
      { itemId: 'item-b', quantity: 2, unitCost: 1.5 },
      { itemId: 'item-a', quantity: 5, unitCost: 2 },
    ],
    notes: 'Launch transfer',
    sourceWarehouseId: 'main-wh',
    transferDate: '2026-07-22',
  });
  const right = buildProductionStockReceiveSignature({
    destinationWarehouseId: 'prod-wh',
    items: [
      { itemId: 'item-a', quantity: 5, unitCost: 2 },
      { itemId: 'item-b', quantity: 2, unitCost: 1.5 },
    ],
    notes: 'Launch transfer',
    sourceWarehouseId: 'main-wh',
    transferDate: '2026-07-22',
  });

  assert.equal(left, right);
});

test('production stock receive failure payload keeps stage and db diagnostics', () => {
  const failure = buildProductionStockReceiveFailure({
    dbMessage: 'Warehouse not found or inactive.',
    destinationWarehouseId: 'prod-wh',
    itemId: 'item-1',
    message: 'Warehouse access denied.',
    quantity: 50,
    sourceWarehouseId: 'main-wh',
    stage: 'LOAD_WAREHOUSES',
  });

  assert.equal(failure.success, false);
  assert.equal(failure.code, 'PRODUCTION_STOCK_RECEIVE_FAILED');
  assert.equal(failure.stage, 'LOAD_WAREHOUSES');
  assert.equal(failure.message, 'LOAD_WAREHOUSES: Warehouse access denied.');
  assert.equal(failure.details.destinationWarehouseId, 'prod-wh');
  assert.equal(failure.details.quantity, 50);
  assert.equal(failure.details.dbMessage, 'Warehouse not found or inactive.');
});
