import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areUomDimensionsCompatible,
  convertQuantity,
  normalizeCommercialQuantityToBase,
  subtractBaseQuantity,
} from '../src/lib/uom';

test('UOM conversion normalizes bucket procurement to litre inventory', () => {
  const result = normalizeCommercialQuantityToBase({
    baseUnitId: 'litre',
    conversions: [
      {
        conversion_factor: 20,
        from_unit_id: 'bucket',
        item_id: 'milk-mix',
        is_active: true,
        to_unit_id: 'litre',
      },
    ],
    itemId: 'milk-mix',
    quantity: 10,
    totalCost: 500,
    transactionUnitId: 'bucket',
  });

  assert.equal(result.transactionQuantity, 10);
  assert.equal(result.baseQuantity, 200);
  assert.equal(result.conversionFactor, 20);
  assert.equal(result.transactionUnitCost, 50);
  assert.equal(result.baseUnitCost, 2.5);
});

test('UOM conversion supports production consumption from normalized stock', () => {
  assert.equal(convertQuantity(10, 20), 200);
  assert.equal(subtractBaseQuantity(200, 35), 165);
});

test('UOM conversion keeps decimal precision for fractional conversions', () => {
  assert.equal(convertQuantity(2.5, 0.75), 1.875);
});

test('UOM dimension compatibility rejects unsafe cross-dimension conversions', () => {
  assert.equal(
    areUomDimensionsCompatible({
      from: { code: 'KG', unit_type: 'MASS' },
      to: { code: 'L', unit_type: 'VOLUME' },
    }),
    false,
  );
  assert.equal(
    areUomDimensionsCompatible({
      allowItemSpecificContainer: true,
      from: { code: 'BUCKET', unit_type: 'CONTAINER' },
      to: { code: 'L', unit_type: 'VOLUME' },
    }),
    true,
  );
});
