import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildProductionSmokeSetupFailure,
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
  calculateProductionSmokeSeedQuantity,
  calculateProductivity,
  calculateYieldPercentage,
  getExistingWarehouseTypes,
  normalizeProductionStockReceiveItems,
  resolveWarehouseTypeCandidatesForLive,
  resolveWarehouseTypeForLive,
  validateRecipeImportRows,
  validateShiftTargetImportRows,
} from '../src/lib/production';

test('production order migration package stays schema-local and additive', () => {
  const migrationNames = [
    '035_production_order_workflow_foundation.sql',
    '036_production_issue_and_receipt_documents.sql',
    '037_production_order_planning_release_rpcs.sql',
    '038_production_order_transaction_rpcs.sql',
    '039_production_relationship_map_and_reporting.sql',
  ];

  const migrations = migrationNames.map((name) => fs.readFileSync(`migrations/${name}`, 'utf8')).join('\n');

  assert.match(migrations, /create table if not exists icecream_erp\.production_orders/i);
  assert.match(migrations, /create table if not exists icecream_erp\.production_order_components/i);
  assert.match(migrations, /create table if not exists icecream_erp\.production_issues/i);
  assert.match(migrations, /create table if not exists icecream_erp\.production_receipts/i);
  assert.match(migrations, /create or replace function icecream_erp\.release_production_order/i);
  assert.match(migrations, /create or replace function icecream_erp\.post_production_issue/i);
  assert.match(migrations, /create or replace function icecream_erp\.post_production_receipt/i);
  assert.match(migrations, /create or replace function icecream_erp\.close_production_order/i);
  assert.match(migrations, /for update/i);
  assert.match(migrations, /notify pgrst, 'reload schema'/i);
  assert.doesNotMatch(migrations, /alter role\s+authenticator/i);
  assert.doesNotMatch(migrations, /^\s*drop\s+table/im);
  assert.doesNotMatch(migrations, /^\s*truncate\s+table/im);
  assert.doesNotMatch(migrations, /create table\s+public\./i);
});

test('production order routes delegate workflow changes to RPC-backed helpers', () => {
  const releaseRoute = fs.readFileSync('src/app/api/production/orders/[id]/release/route.ts', 'utf8');
  const issueRoute = fs.readFileSync('src/app/api/production/orders/[id]/issue/route.ts', 'utf8');
  const receiptRoute = fs.readFileSync('src/app/api/production/orders/[id]/receipt/route.ts', 'utf8');
  const closeRoute = fs.readFileSync('src/app/api/production/orders/[id]/close/route.ts', 'utf8');
  const helper = fs.readFileSync('src/lib/production-orders-server.ts', 'utf8');

  assert.match(releaseRoute, /releaseProductionOrder/);
  assert.match(issueRoute, /postProductionIssue/);
  assert.match(receiptRoute, /postProductionReceipt/);
  assert.match(closeRoute, /closeProductionOrder/);
  assert.match(helper, /\.rpc\('release_production_order'/);
  assert.match(helper, /\.rpc\('post_production_issue'/);
  assert.match(helper, /\.rpc\('post_production_receipt'/);
  assert.match(helper, /\.rpc\('close_production_order'/);
});

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

test('production warehouse type resolver prefers PRODUCTION when available', () => {
  assert.equal(
    resolveWarehouseTypeForLive('production', ['PRODUCTION', 'RAW_MATERIALS']),
    'PRODUCTION',
  );
});

test('production warehouse type resolver falls back to WIP and GENERAL safely', () => {
  assert.equal(
    resolveWarehouseTypeForLive('production', ['WIP', 'RAW_MATERIALS']),
    'WIP',
  );
  assert.equal(resolveWarehouseTypeForLive('production', ['GENERAL']), 'GENERAL');
});

test('existing warehouse types normalize live compatibility aliases', () => {
  assert.deepEqual(
    getExistingWarehouseTypes([
      { warehouseType: 'PRODUCTION_MATERIALS' },
      { type: 'WIP' },
      { warehouse_type: 'RAW_MATERIALS' },
      { warehouseType: 'production_materials' },
    ]),
    ['PRODUCTION', 'WIP', 'RAW_MATERIALS'],
  );
});

test('production smoke warehouse type candidates create live-safe warehouses when none exist', () => {
  assert.deepEqual(resolveWarehouseTypeCandidatesForLive('production', []), [
    'PRODUCTION',
    'WIP',
    'GENERAL',
  ]);
  assert.deepEqual(resolveWarehouseTypeCandidatesForLive('raw', []), [
    'RAW_MATERIALS',
    'RAW_MATERIAL',
    'GENERAL',
  ]);
});

test('production smoke seed quantity does not require pre-existing source stock', () => {
  assert.equal(calculateProductionSmokeSeedQuantity(0, 5), 5);
  assert.equal(calculateProductionSmokeSeedQuantity(2, 5), 3);
  assert.equal(calculateProductionSmokeSeedQuantity(5, 5), 0);
});

test('production smoke setup failure exposes required stage codes', () => {
  const missingWarehouse = buildProductionSmokeSetupFailure({
    message: 'No raw warehouse could be resolved.',
    stage: 'WAREHOUSE_OR_SOURCE_STOCK_MISSING',
  });
  const seedUnavailable = buildProductionSmokeSetupFailure({
    message: 'Stock adjustment route is unavailable.',
    stage: 'SOURCE_STOCK_SEED_UNAVAILABLE',
  });

  assert.equal(missingWarehouse.code, 'PRODUCTION_SMOKE_SETUP_FAILED');
  assert.equal(missingWarehouse.stage, 'WAREHOUSE_OR_SOURCE_STOCK_MISSING');
  assert.equal(seedUnavailable.code, 'PRODUCTION_SMOKE_SETUP_FAILED');
  assert.equal(seedUnavailable.stage, 'SOURCE_STOCK_SEED_UNAVAILABLE');
});

test('production receive smoke setup sends explicit seed unitCost and totalValue while preserving zero', () => {
  const script = fs.readFileSync('scripts/smoke-production-receive.mjs', 'utf8');

  assert.match(script, /unitCost:\s*seedUnitCost/);
  assert.match(script, /totalValue:\s*seedTotalValue/);
  assert.match(script, /toNumber\(item\?\.unitCost \?\? item\?\.unit_cost, 0\)/);
});

test('production receive smoke checks existing source stock before reseeding', () => {
  const script = fs.readFileSync('scripts/smoke-production-receive.mjs', 'utf8');

  assert.match(script, /if \(currentAvailable >= TRANSFER_QUANTITY\)/);
  assert.match(script, /pass\('Source stock already available'\)/);
});
