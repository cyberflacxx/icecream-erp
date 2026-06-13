import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDocumentNumber,
  validateCodeAndName,
  validateImportRows,
  validateNumberSequenceNextNumber,
  validateShiftWindow,
  validateTaxRate,
  validateUnitConversionFactor,
} from '../src/lib/settings';

test('coded master data requires code and name', () => {
  assert.equal(validateCodeAndName({ code: '', name: 'Unit' }), 'code is required.');
  assert.equal(validateCodeAndName({ code: 'KG', name: '' }), 'name is required.');
  assert.equal(validateCodeAndName({ code: 'KG', name: 'Kilogram' }), null);
});

test('unit conversion and tax validations reject invalid values', () => {
  assert.equal(validateUnitConversionFactor(0), 'conversion factor must be greater than zero.');
  assert.equal(validateUnitConversionFactor(2.5), null);
  assert.equal(validateTaxRate(-1), 'tax rate must not be negative.');
  assert.equal(validateTaxRate(15), null);
});

test('number sequences generate padded document numbers and validate next number', () => {
  assert.equal(buildDocumentNumber('PO-', 12, 5), 'PO-00012');
  assert.equal(validateNumberSequenceNextNumber(0), 'next number must be greater than zero.');
  assert.equal(validateNumberSequenceNextNumber(3), null);
});

test('shift validation blocks equal start and end times', () => {
  assert.equal(validateShiftWindow('06:00', '06:00'), 'shift end time must not equal shift start time.');
  assert.equal(validateShiftWindow('06:00', '18:00'), null);
});

test('import validation returns row-level errors for duplicates, missing columns, bad foreign keys, and negatives', () => {
  const result = validateImportRows(
    [
      { code: 'FG-001', name: 'Cone', category_code: 'CAT-FG', price: 1.2 },
      { code: 'FG-001', name: '', category_code: 'BAD', price: -1 },
    ],
    {
      existingCodes: ['FG-000'],
      nonNegativeColumns: ['price'],
      requiredColumns: ['code', 'name', 'category_code'],
      validForeignKeys: { category_code: ['CAT-FG'] },
    },
  );

  assert.equal(result.errors.length, 4);
  assert.equal(result.errors.some((error) => error.message.includes('Duplicate code')), true);
  assert.equal(result.errors.some((error) => error.field === 'name'), true);
  assert.equal(result.errors.some((error) => error.field === 'category_code'), true);
  assert.equal(result.errors.some((error) => error.field === 'price'), true);
});
