import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateBaseFromPurchase,
  calculatePurchaseEquivalent,
  calculateTheoreticalOutputFromBase,
  calculateTheoreticalOutputFromPurchase,
  calculateYieldVariance,
  isProductionRawMaterialCategory,
  normalizeProductionRawMaterialConversion,
} from '../src/lib/production-raw-material-conversions';

const profile = {
  conversionQuantity: 20,
  conversionUomId: 'litres',
  productionOutputQuantity: 320,
  productionOutputUomId: 'cones',
  purchaseQuantity: 1,
  purchaseUomId: 'bucket',
};

test('production raw-material conversion calculates purchase, base, and yield quantities', () => {
  assert.equal(calculateBaseFromPurchase(profile, 1), 20);
  assert.equal(calculateBaseFromPurchase(profile, 2), 40);
  assert.equal(calculateBaseFromPurchase(profile, 0.5), 10);
  assert.equal(calculatePurchaseEquivalent(profile, 100), 5);
  assert.equal(calculateTheoreticalOutputFromBase(profile, 40), 640);
  assert.equal(calculateTheoreticalOutputFromPurchase(profile, 5), 1600);
});

test('production raw-material conversion rejects invalid quantities and UOMs', () => {
  assert.throws(() => normalizeProductionRawMaterialConversion({ ...profile, purchaseQuantity: 0 }), /greater than zero/);
  assert.throws(() => normalizeProductionRawMaterialConversion({ ...profile, conversionQuantity: -1 }), /greater than zero/);
  assert.throws(() => normalizeProductionRawMaterialConversion({ ...profile, productionOutputUomId: '' }), /UOMs are required/);
});

test('yield variance is informational and does not create output stock', () => {
  assert.deepEqual(calculateYieldVariance(625, 640), { variance: -15, yieldPercentage: 97.65625 });
});

test('production conversion gating uses the stable category code', () => {
  assert.equal(isProductionRawMaterialCategory('RAW_MATERIAL_PRODUCTION'), true);
  assert.equal(isProductionRawMaterialCategory('Raw Material - Production'), false);
  assert.equal(isProductionRawMaterialCategory('PACKAGING_MATERIAL'), false);
});
