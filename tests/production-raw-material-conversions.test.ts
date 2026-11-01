import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  assert.equal(calculatePurchaseEquivalent(profile, 5), 0.25);
  assert.equal(calculatePurchaseEquivalent(profile, 10), 0.5);
  assert.equal(calculatePurchaseEquivalent(profile, 100), 5);
  assert.equal(calculateTheoreticalOutputFromBase(profile, 5), 80);
  assert.equal(calculateTheoreticalOutputFromBase(profile, 10), 160);
  assert.equal(calculateTheoreticalOutputFromBase(profile, 40), 640);
  assert.equal(calculateTheoreticalOutputFromBase(profile, 100), 1600);
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

test('production issue preview is display-only and preserves the base-unit issue payload', () => {
  const page = fs.readFileSync('src/app/(dashboard)/production/orders/[id]/page.tsx', 'utf8');
  const previewStart = page.indexOf('function ProductionIssueConversionPreview');
  const preview = page.slice(previewStart, page.indexOf('function DocumentCard', previewStart));

  assert.ok(previewStart >= 0);
  assert.match(preview, /baseQuantity > availableQuantity/);
  assert.doesNotMatch(preview, /fetch\(|request\(|<select\b|Finished Goods/i);
  assert.match(page, /componentId: component\.id/);
  assert.match(page, /currentIssueQuantity: Number\(issueQuantities/);
  assert.match(page, /unitCost: Number\(component\.unit_cost_snapshot \?\? 0\)/);
  assert.match(page, /warehouseId: component\.warehouse_id \? String\(component\.warehouse_id\) : null/);
});
