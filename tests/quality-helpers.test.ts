import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDamageValue,
  calculateFailureRate,
  calculateFailedQuantity,
  calculateReturnRate,
  calculateReusablePercentage,
  calculateWasteValue,
  validateInspectionQuantities,
  validateQualityTemplateImportRows,
  validateReturnClassification,
} from '../src/lib/quality';

test('quality helpers calculate inspection, return, and damage metrics', () => {
  assert.equal(calculateFailedQuantity(100, 92), 8);
  assert.equal(calculateFailureRate(100, 8), 8);
  assert.equal(calculateReusablePercentage(20, 5), 25);
  assert.equal(calculateDamageValue(4, 2.5), 10);
  assert.equal(calculateWasteValue(3, 7), 21);
  assert.equal(calculateReturnRate(5, 100), 5);
});

test('quality validators reject invalid inspection and classification totals', () => {
  assert.equal(validateInspectionQuantities(10, 11, 0), 'quantityPassed must not exceed quantityInspected');
  assert.equal(
    validateReturnClassification({
      quantityDamaged: 4,
      quantityExpired: 4,
      quantityReturned: 5,
      quantityReusable: 1,
      quantityRework: 0,
      quantityWaste: 0,
    }),
    'classification totals must not exceed quantityReturned',
  );
});

test('quality template import validation returns row level errors', () => {
  const result = validateQualityTemplateImportRows([
    { inspectionType: 'INVALID', parameterName: '', templateName: '' },
    { inspectionType: 'RAW_MATERIAL_RECEIPT', parameterName: 'Temperature', templateName: 'Incoming Cold Chain' },
  ]);

  assert.equal(result.errors.length, 3);
  assert.equal(result.rows.length, 1);
});
