import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCustomerStatement,
  buildProductionCostSummary,
  calculateWorkerLabourCost,
  classifyProductionMaterial,
  resolveLabourRate,
  summarizeBatchLabour,
  summarizeProductionMaterialCosts,
} from '../src/lib/red-module-costing';

test('labour costing uses actual hours and configured hourly rate', () => {
  assert.deepEqual(resolveLabourRate({ hourly_rate: 2.5 }), { rate: 2.5, rateType: 'HOURLY' });
  assert.equal(calculateWorkerLabourCost({ hoursWorked: 3, rate: 2.5 }), 7.5);
});

test('labour costing reports not configured when rate is missing', () => {
  const summary = summarizeBatchLabour({
    assignments: [{ employee_id: 'emp-1' }],
    goodUnitsProduced: 10,
    labourAllocations: [{ employee_id: 'emp-1', hours_worked: 4 }],
  });

  assert.equal(summary.labourStatus, 'NOT_CONFIGURED');
  assert.equal(summary.totalLabourCost, 0);
  assert.deepEqual(summary.missingComponents, ['LABOUR_RATE']);
});

test('batch labour exposes workers, hours, cost per unit, and units per worker', () => {
  const summary = summarizeBatchLabour({
    assignments: [{ employee_id: 'emp-1' }, { employee_id: 'emp-2' }],
    goodUnitsProduced: 20,
    labourAllocations: [
      { employee_id: 'emp-1', hours_worked: 2, rate: 3 },
      { employee_id: 'emp-2', hours_worked: 3, rate: 4 },
    ],
  });

  assert.equal(summary.assignedWorkers, 2);
  assert.equal(summary.totalLabourHours, 5);
  assert.equal(summary.totalLabourCost, 18);
  assert.equal(summary.labourCostPerUnit, 0.9);
  assert.equal(summary.unitsPerWorker, 10);
});

test('production costing marks complete and partial batches without inventing overhead', () => {
  const complete = buildProductionCostSummary({
    goodUnitsProduced: 10,
    labourCost: 10,
    overheadCost: 5,
    packagingCost: 2,
    rawMaterialCost: 20,
    wastageCost: 3,
  });

  assert.equal(complete.costStatus, 'COMPLETE');
  assert.equal(complete.totalProductionCost, 40);
  assert.equal(complete.costPerGoodUnit, 4);

  const partial = buildProductionCostSummary({
    goodUnitsProduced: 10,
    rawMaterialCost: 20,
  });

  assert.equal(partial.costStatus, 'PARTIAL');
  assert.ok(partial.missingComponents.includes('OVERHEAD_NOT_CONFIGURED'));
  assert.ok(partial.missingComponents.includes('DIRECT_LABOUR_COST'));
});

test('production material costing separates raw materials from packaging inputs', () => {
  const rows = [
    {
      is_packaging: false,
      material_type: 'RAW_MATERIAL',
      quantity_actual: 2,
      unit_cost: 3,
    },
    {
      is_packaging: true,
      material_type: 'PACKAGING',
      quantity_actual: 10,
      unit_cost: 0.2,
    },
    {
      items: { item_type: 'PACKAGING_MATERIAL', unit_cost: 0.5 },
      quantity_issued: 4,
    },
  ];

  assert.equal(classifyProductionMaterial(rows[1]), 'PACKAGING');
  assert.deepEqual(summarizeProductionMaterialCosts(rows), {
    packagingCost: 4,
    rawMaterialCost: 6,
    totalMaterialCost: 10,
  });
});

test('customer statement calculates opening, period movement, running, and closing balances', () => {
  const statement = buildCustomerStatement({
    fromDate: '2026-08-01',
    toDate: '2026-08-31',
    entries: [
      { credit: 0, date: '2026-07-30', debit: 10, documentId: 'old-inv', documentNumber: 'INV-OLD', referenceType: 'invoice', type: 'INVOICE' },
      { credit: 0, date: '2026-08-02', debit: 5, documentId: 'inv-1', documentNumber: 'INV-1', referenceType: 'invoice', type: 'INVOICE' },
      { credit: 3, date: '2026-08-03', debit: 0, documentId: 'pay-1', documentNumber: 'PAY-1', referenceType: 'payment', type: 'PAYMENT' },
      { credit: 1, date: '2026-08-04', debit: 0, documentId: 'cn-1', documentNumber: 'CN-1', referenceType: 'credit_note', type: 'CREDIT_NOTE' },
    ],
  });

  assert.equal(statement.openingBalance, 10);
  assert.equal(statement.periodDebits, 5);
  assert.equal(statement.periodCredits, 4);
  assert.equal(statement.closingBalance, 11);
  assert.deepEqual(statement.periodEntries.map((entry) => entry.runningBalance), [15, 12, 11]);
});

test('customer statement includes attributed branch credit sales as debits', () => {
  const statement = buildCustomerStatement({
    entries: [
      { credit: 0, date: '2026-08-02', debit: 5, documentId: 'branch-sale-1', documentNumber: 'BS-00001', paymentMethod: 'CREDIT', referenceType: 'branch_sale', type: 'BRANCH_CREDIT_SALE' },
      { credit: 2, date: '2026-08-03', debit: 0, documentId: 'pay-1', documentNumber: 'PAY-1', referenceType: 'payment', type: 'PAYMENT' },
    ],
  });

  assert.equal(statement.periodDebits, 5);
  assert.equal(statement.periodCredits, 2);
  assert.equal(statement.closingBalance, 3);
});
