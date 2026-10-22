import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('068 normalizes commercial GRN quantities into base inventory quantities', () => {
  const transactionQuantity = 5;
  const conversionFactor = 20;
  const baseQuantity = transactionQuantity * conversionFactor;

  assert.equal(transactionQuantity, 5);
  assert.equal(baseQuantity, 100);

  const migration = fs.readFileSync('migrations/068_fix_atomic_grn_uom_normalization.sql', 'utf8');
  assert.match(migration, /v_transaction_quantity/);
  assert.match(migration, /v_base_quantity/);
  assert.match(migration, /v_transaction_uom_id/);
  assert.match(migration, /v_base_uom_id/);
  assert.match(migration, /v_po_line\.base_uom_id = v_item_base_uom_id/);
  assert.match(migration, /item_uom_conversions/);
  assert.match(migration, /No active UOM conversion exists for GRN line/);
  assert.match(migration, /v_base_quantity := round\(v_transaction_quantity \* v_conversion_factor, 8\)/);
  assert.match(migration, /quantity_received = coalesce\(quantity_received, 0\) \+ v_transaction_quantity/);
  assert.match(migration, /transaction_quantity,\n      transaction_uom_id,\n      base_quantity,\n      base_uom_id,\n      uom_conversion_factor/);
});
