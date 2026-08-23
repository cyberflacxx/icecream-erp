import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildExistingOpenShiftFilters, normalizeOptionalUuidFilter } from '../src/lib/branch-shift-open';

test('normalizeOptionalUuidFilter drops missing and stringified missing UUID values', () => {
  assert.equal(normalizeOptionalUuidFilter(undefined), null);
  assert.equal(normalizeOptionalUuidFilter(null), null);
  assert.equal(normalizeOptionalUuidFilter(''), null);
  assert.equal(normalizeOptionalUuidFilter('   '), null);
  assert.equal(normalizeOptionalUuidFilter('undefined'), null);
  assert.equal(normalizeOptionalUuidFilter(' UNDEFINED '), null);
  assert.equal(normalizeOptionalUuidFilter('null'), null);
  assert.equal(normalizeOptionalUuidFilter('  null  '), null);
  assert.equal(normalizeOptionalUuidFilter('d81ad59c-f207-40cd-8842-a0c6da10da1c'), 'd81ad59c-f207-40cd-8842-a0c6da10da1c');
});

test('buildExistingOpenShiftFilters keeps duplicate detection on live-supported fields only', () => {
  assert.deepEqual(buildExistingOpenShiftFilters({
    branchId: '7251396b-10ac-47e0-879b-aa9998510a5c',
    organizationId: 'undefined',
    shift: 'DAY',
    shiftDate: '2026-08-23',
  }), {
    branchId: '7251396b-10ac-47e0-879b-aa9998510a5c',
    organizationId: null,
    shift: 'DAY',
    shiftDate: '2026-08-23',
    status: 'OPEN',
  });
});

test('shift open route uses a controlled duplicate response ahead of warehouse and insert work', () => {
  const route = fs.readFileSync('src/app/api/branch-operations/[branchId]/shift-closes/route.ts', 'utf8');
  const wrapperRoute = fs.readFileSync('src/app/api/branches/[id]/shifts/open/route.ts', 'utf8');
  const duplicateIndex = route.indexOf('if (existingShiftId) return buildShiftConflictResponse(existingShiftId);');
  const warehouseIndex = route.indexOf('const warehouse = await getActiveBranchWarehouse(branchId);');
  const insertIndex = route.indexOf('const primaryInsert = await service', duplicateIndex);

  assert.equal(route.includes(".is('deleted_at', null)"), false);
  assert.match(route, /\.eq\('branch_id', filters\.branchId\)/);
  assert.match(route, /\.eq\('shift_date', filters\.shiftDate\)/);
  assert.match(route, /\.eq\('shift', filters\.shift\)/);
  assert.match(route, /\.eq\('status', filters\.status\)/);
  assert.match(route, /if \(filters\.organizationId\) \{\s*query = query\.eq\('organization_id', filters\.organizationId\);/);
  assert.match(route, /limit\(1\)/);
  assert.match(route, /status: 409/);
  assert.ok(duplicateIndex > -1);
  assert.ok(warehouseIndex > duplicateIndex);
  assert.ok(insertIndex > duplicateIndex);
  assert.match(route, /apiServerError\(\{\s*branchId,/);
  assert.match(wrapperRoute, /Promise\.resolve\(\{ branchId: id \}\)/);
  assert.doesNotMatch(wrapperRoute, /export \{ POST \}/);
});
