import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildInventoryAdjustmentFailure,
  buildOpeningClosingRows,
  calculateStockBalanceValue,
  calculateTotalStockValue,
  calculateAcceptedQuantity,
  calculateShortageQuantity,
  deriveSupplierShortages,
  findMissingDefaultWarehouses,
  getItemReorderQuantity,
  isPendingInventoryApprovalStatus,
  isProcessedInventoryApprovalStatus,
  isMissingTableColumnError,
  isInvoiceApprovedForDispatch,
  normalizeInventoryApprovalStatus,
  normalizeStockMovementType,
  normalizeTransferStatus,
  normalizeWarehouseCode,
  normalizeWarehouseType,
  resolveInventoryUnitCost,
  resolveInventoryValue,
  resolveWarehouseDisplayType,
  resolveWarehouseStorageType,
  summarizeInventoryByType,
} from '../src/lib/inventory';
import {
  applyInventoryDelta,
  buildInventoryAdjustmentFailureResponse,
  buildStockMovementListSelectClause,
  listCompatibleStockMovements,
  mapCompatibleStockMovementRows,
  recordStockMovement,
} from '../src/lib/inventory-server';
import {
  buildItemSelectorLabel,
  buildItemSelectorOptions,
} from '../src/lib/item-selector';

test('deriveSupplierShortages returns open shortages from ordered versus received quantities', () => {
  const rows = deriveSupplierShortages([
    {
      id: 'po-1',
      po_number: 'PO-001',
      suppliers: { id: 'sup-1', name: 'Cold Chain Supplies' },
      purchase_order_items: [
        {
          item_id: 'item-1',
          quantity_ordered: 100,
          quantity_received: 80,
          items: { id: 'item-1', code: 'MIX-001', name: 'Ice cream mix' },
        },
      ],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.shortageQuantity, 20);
  assert.equal(rows[0]?.supplierName, 'Cold Chain Supplies');
});

test('buildOpeningClosingRows derives period movement totals', () => {
  const rows = buildOpeningClosingRows([
    {
      item_id: 'item-1',
      warehouse_id: 'wh-1',
      movement_type: 'PURCHASE_RECEIPT',
      quantity: 10,
      unit_cost: 2,
      created_at: '2026-06-01T08:00:00.000Z',
      items: { code: 'MIX-001', name: 'Ice cream mix', item_type: 'RAW_MATERIAL', unit_cost: 2 },
      warehouses: { name: 'Main Stores' },
    },
    {
      item_id: 'item-1',
      warehouse_id: 'wh-1',
      movement_type: 'PRODUCTION_ISSUE',
      quantity: 3,
      unit_cost: 2,
      created_at: '2026-06-03T08:00:00.000Z',
      items: { code: 'MIX-001', name: 'Ice cream mix', item_type: 'RAW_MATERIAL', unit_cost: 2 },
      warehouses: { name: 'Main Stores' },
    },
  ], '2026-06-02', '2026-06-30');

  assert.equal(rows[0]?.openingStock, 10);
  assert.equal(rows[0]?.stockOut, 3);
  assert.equal(rows[0]?.closingStock, 7);
});

test('isInvoiceApprovedForDispatch only allows non-draft invoice statuses', () => {
  assert.equal(isInvoiceApprovedForDispatch('draft'), false);
  assert.equal(isInvoiceApprovedForDispatch('sent'), true);
  assert.equal(isInvoiceApprovedForDispatch('paid'), true);
});

test('normalizeStockMovementType maps legacy aliases onto schema enums', () => {
  assert.equal(normalizeStockMovementType('purchase_receipt'), 'PURCHASE_RECEIVE');
  assert.equal(normalizeStockMovementType('finished_goods_receipt'), 'PRODUCTION_OUTPUT');
  assert.equal(normalizeStockMovementType('sales_dispatch'), 'SALES_ISSUE');
  assert.equal(normalizeStockMovementType('transfer_out'), 'TRANSFER_OUT');
});

test('warehouse helpers normalize codes and types expected by inventory stores', () => {
  assert.equal(normalizeWarehouseCode(' Raw Store '), 'RAW_STORE');
  assert.equal(normalizeWarehouseType('raw_store'), 'RAW_MATERIALS');
  assert.equal(resolveWarehouseStorageType('raw_store'), 'MAIN');
  assert.equal(resolveWarehouseDisplayType({ code: 'RAW_STORE', type: 'MAIN' }), 'RAW_MATERIALS');
  assert.equal(normalizeWarehouseType('production_materials'), 'PRODUCTION');
  assert.equal(resolveWarehouseDisplayType({ code: 'PROD_MATERIALS', type: 'MAIN' }), 'PRODUCTION');
  assert.equal(normalizeWarehouseType('fg warehouse'), 'FINISHED_GOODS');
  assert.equal(normalizeTransferStatus('posted'), 'COMPLETED');
});

test('GRN quantity helpers derive accepted and shortage quantities safely', () => {
  assert.equal(
    calculateAcceptedQuantity({
      damagedQuantity: 3,
      receivedQuantity: 20,
      rejectedQuantity: 2,
    }),
    15,
  );
  assert.equal(
    calculateShortageQuantity({
      orderedQuantity: 30,
      receivedQuantity: 24,
    }),
    6,
  );
  assert.throws(
    () =>
      calculateAcceptedQuantity({
        damagedQuantity: 12,
        receivedQuantity: 10,
        rejectedQuantity: 0,
      }),
    /acceptedQuantity must not be negative/,
  );
});

test('findMissingDefaultWarehouses returns only missing warehouse seeds', () => {
  const missing = findMissingDefaultWarehouses(['RAW_STORE', 'FG_WAREHOUSE']);

  assert.deepEqual(
    missing.map((warehouse) => warehouse.code),
    ['PROD_MATERIALS', 'PRODUCTION_FINISHED_GOODS', 'DISPATCH_WAREHOUSE', 'RETURNS_WAREHOUSE'],
  );
});

test('legacy reorder helpers use reorder_qty and detect missing modern column errors', () => {
  assert.equal(getItemReorderQuantity({ reorder_qty: 24 }), 24);
  assert.equal(getItemReorderQuantity({ reorder_quantity: 18, reorder_qty: 24 }), 18);
  assert.equal(
    isMissingTableColumnError(
      new Error('column items.reorder_quantity does not exist'),
      'items',
      'reorder_quantity',
    ),
    true,
  );
  assert.equal(
    isMissingTableColumnError(
      new Error('column items.standard_cost does not exist'),
      'items',
      'reorder_quantity',
    ),
    false,
  );
});

test('inventory valuation summaries prefer posted total_value and average_cost aliases', () => {
  const summary = summarizeInventoryByType([
    {
      average_cost: 2,
      quantity_on_hand: 50,
      total_value: 100,
      items: {
        item_type: 'RAW_MATERIAL',
        unit_cost: 0,
      },
    },
    {
      avg_cost: 3,
      quantity: 10,
      items: {
        item_type: 'PACKAGING_MATERIAL',
      },
    },
  ]);

  assert.equal(summary.rawMaterialValue, 100);
  assert.equal(summary.packagingMaterialValue, 30);
  assert.equal(summary.totalStockValue, 130);
});

test('resolveInventoryValue accepts live alias fields and preserves zero values', () => {
  assert.equal(resolveInventoryValue({ total_value: 125 }), 125);
  assert.equal(resolveInventoryValue({ stock_value: 85 }), 85);
  assert.equal(resolveInventoryValue({ inventory_value_posted: 42.5 }), 42.5);
  assert.equal(resolveInventoryValue({ line_total: 12.25 }), 12.25);
  assert.equal(resolveInventoryValue({ value: 14.75 }), 14.75);
  assert.equal(resolveInventoryValue({ totalValue: 9.5 }), 9.5);
  assert.equal(resolveInventoryValue({ stockValue: 0 }), 0);
  assert.equal(resolveInventoryValue({}, 7), 7);
});

test('resolveInventoryUnitCost preserves explicit zero values and safe aliases', () => {
  assert.equal(resolveInventoryUnitCost({ unitCost: 0 }, 9), 0);
  assert.equal(resolveInventoryUnitCost({ unit_cost: 4.5 }, 0), 4.5);
  assert.equal(resolveInventoryUnitCost({ standard_cost: 3 }, 0), 3);
});

test('calculateStockBalanceValue falls back through live balance quantity and cost aliases', () => {
  assert.equal(calculateStockBalanceValue({ quantity_on_hand: 8, average_cost: 2.5 }), 20);
  assert.equal(calculateStockBalanceValue({ quantity: 5, avg_cost: 3 }), 15);
  assert.equal(calculateStockBalanceValue({ quantity_on_hand: 7, items: { unit_cost: 4 } }), 28);
  assert.equal(calculateStockBalanceValue({ quantity_on_hand: 7, items: { standard_cost: 6 } }), 42);
  assert.equal(calculateStockBalanceValue({ quantity_on_hand: 7, total_value: 0, avg_cost: 6 }), 0);
  assert.equal(calculateStockBalanceValue({ quantity_on_hand: 0, avg_cost: 6 }), 0);
});

test('calculateTotalStockValue sums current balances without transfer double-counting', () => {
  const before = [
    { organization_id: 'org-1', warehouse_id: 'wh-a', quantity_on_hand: 10, avg_cost: 2 },
    { organization_id: 'org-1', warehouse_id: 'wh-b', quantity_on_hand: 5, avg_cost: 2 },
  ];
  const afterTransfer = [
    { organization_id: 'org-1', warehouse_id: 'wh-a', quantity_on_hand: 7, avg_cost: 2 },
    { organization_id: 'org-1', warehouse_id: 'wh-b', quantity_on_hand: 8, avg_cost: 2 },
  ];

  assert.equal(calculateTotalStockValue(before), 30);
  assert.equal(calculateTotalStockValue(afterTransfer), 30);
  assert.equal(
    calculateTotalStockValue([
      ...afterTransfer,
      { organization_id: 'org-2', warehouse_id: 'wh-x', quantity_on_hand: 100, avg_cost: 9 },
    ], { organizationId: 'org-1' }),
    30,
  );
  assert.equal(calculateTotalStockValue(afterTransfer, { warehouseIds: ['wh-b'] }), 16);
});

test('inventory approval status helpers share a case-insensitive pending definition', () => {
  for (const status of ['PENDING', 'pending_approval', ' submitted ', 'Awaiting Approval']) {
    assert.equal(isPendingInventoryApprovalStatus(status), true);
  }

  assert.equal(normalizeInventoryApprovalStatus('pending-approval'), 'PENDING_APPROVAL');
  assert.equal(isPendingInventoryApprovalStatus('APPROVED'), false);
  assert.equal(isPendingInventoryApprovalStatus('REJECTED'), false);
  assert.equal(isProcessedInventoryApprovalStatus('approved'), true);
  assert.equal(isProcessedInventoryApprovalStatus(' rejected '), true);
});

test('atomic inventory approval migration locks the request and writes status action and audit together', () => {
  const migration = fs.readFileSync('migrations/034_atomic_inventory_approval_processing.sql', 'utf8');

  assert.match(migration, /create or replace function icecream_erp\.process_inventory_approval/i);
  assert.match(migration, /set search_path = icecream_erp, pg_temp/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /update icecream_erp\.approval_requests/i);
  assert.match(migration, /insert into icecream_erp\.approval_actions/i);
  assert.match(migration, /insert into icecream_erp\.audit_logs/i);
  assert.match(migration, /already_processed/i);
  assert.match(migration, /inventoryPostingApplied', false/i);
  assert.match(migration, /grant execute on function icecream_erp\.process_inventory_approval/i);
  assert.doesNotMatch(migration, /exception\s+when/i);
});

test('inventory approval routes delegate processing to the atomic RPC wrapper only', () => {
  const approveRoute = fs.readFileSync('src/app/api/inventory/approvals/[id]/approve/route.ts', 'utf8');
  const rejectRoute = fs.readFileSync('src/app/api/inventory/approvals/[id]/reject/route.ts', 'utf8');
  const rpcWrapper = fs.readFileSync('src/lib/inventory-approvals-server.ts', 'utf8');

  for (const route of [approveRoute, rejectRoute]) {
    assert.match(route, /processInventoryApproval/);
    assert.doesNotMatch(route, /\.from\('approval_requests'\)\s*[\s\S]*\.update/);
    assert.doesNotMatch(route, /\.from\('approval_actions'\)\s*[\s\S]*\.insert/);
    assert.doesNotMatch(route, /recordAuditLog/);
  }

  assert.match(rpcWrapper, /\.rpc\('process_inventory_approval'/);
  assert.match(rpcWrapper, /p_organization_id: input\.organizationId/);
  assert.match(rpcWrapper, /p_actor_user_id: input\.userId/);
});

test('buildStockMovementListSelectClause keeps source document fields and never embeds users', () => {
  const clause = buildStockMovementListSelectClause();

  assert.match(clause, /source_document_id/);
  assert.match(clause, /source_document_type/);
  assert.match(clause, /reference_number/);
  assert.doesNotMatch(clause, /users!created_by/);
});

test('listCompatibleStockMovements uses raw stock movement columns and mapping preserves proof fields', async () => {
  const selectClauses: string[] = [];

  const service = {
    from(table: string) {
      return {
        select(columns: string) {
          selectClauses.push(`${table}:${columns}`);

          if (table === 'stock_movements') {
            const chain = {
              eq(column: string, value: string) {
                assert.equal(column, 'item_id');
                assert.equal(value, 'item-1');
                return chain;
              },
              order(_column: string, _options: { ascending: boolean }) {
                return {
                  range(_from: number, _to: number) {
                    return Promise.resolve({
                      count: 1,
                      data: [
                        {
                          id: 'move-1',
                          item_id: 'item-1',
                          warehouse_id: 'wh-1',
                          movement_type: 'PURCHASE_RECEIVE',
                          quantity: 50,
                          unit_cost: 0,
                          total_value: 0,
                          source_document_id: 'grn-1',
                          source_document_type: 'GRN',
                          reference_number: 'GRN-00001',
                          created_by: 'user-1',
                          created_at: '2026-07-22T08:00:00.000Z',
                        },
                      ],
                      error: null,
                    });
                  },
                };
              },
            };
            return chain;
          }

          if (table === 'items' || table === 'warehouses' || table === 'users') {
            return {
              in(_column: string, values: string[]) {
                if (table === 'items') {
                  assert.deepEqual(values, ['item-1']);
                  return Promise.resolve({
                    data: [{ id: 'item-1', code: 'RAW-1', name: 'Raw Mix' }],
                    error: null,
                  });
                }
                if (table === 'warehouses') {
                  assert.deepEqual(values, ['wh-1']);
                  return Promise.resolve({
                    data: [{ id: 'wh-1', name: 'Main Warehouse' }],
                    error: null,
                  });
                }
                assert.deepEqual(values, ['user-1']);
                return Promise.resolve({
                  data: [{ id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' }],
                  error: null,
                });
              },
            };
          }

          throw new Error(`Unhandled select for ${table}`);
        },
      };
    },
  };

  const result = await listCompatibleStockMovements(service as any, {
    itemId: 'item-1',
    page: 1,
    pageSize: 20,
  });
  const mapped = await mapCompatibleStockMovementRows(service as any, result.rows);

  assert.equal(result.count, 1);
  assert.equal(selectClauses[0]?.startsWith('stock_movements:'), true);
  assert.doesNotMatch(selectClauses[0] ?? '', /users!created_by/);
  assert.equal(mapped[0]?.source_document_id, 'grn-1');
  assert.equal(mapped[0]?.sourceDocumentType, 'GRN');
  assert.equal(mapped[0]?.item_id, 'item-1');
  assert.equal(mapped[0]?.warehouse_id, 'wh-1');
  assert.equal(mapped[0]?.quantity, 50);
  assert.equal(mapped[0]?.unitCost, 0);
  assert.equal(mapped[0]?.totalValue, 0);
  assert.equal(mapped[0]?.createdBy?.name, 'Ada Lovelace');
});

test('recordStockMovement includes numeric total_value when unit cost is zero', async () => {
  const movementPayloads: Array<Record<string, unknown>> = [];

  const service = {
    from(table: string) {
      if (table === 'items') {
        return {
          select() {
            return {
              eq(column: string, value: string) {
                assert.equal(column, 'id');
                assert.equal(value, 'item-zero');
                return {
                  is(nextColumn: string, nextValue: null) {
                    assert.equal(nextColumn, 'deleted_at');
                    assert.equal(nextValue, null);
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'item-zero',
                            code: 'ZERO-1',
                            name: 'Zero Cost Item',
                            item_type: 'RAW_MATERIAL',
                            unit_cost: 0,
                            organization_id: 'org-1',
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'stock_balances') {
        return {
          select() {
            return {
              eq(column: string, value: string) {
                assert.equal(column, 'item_id');
                assert.equal(value, 'item-zero');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'warehouse_id');
                    assert.equal(nextValue, 'wh-1');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'bal-1',
                            organization_id: 'org-1',
                            quantity_on_hand: 5,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'stock_movements') {
        return {
          insert(payload: Record<string, unknown>) {
            movementPayloads.push({ ...payload });
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: { id: 'move-zero', ...payload },
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unhandled table ${table}`);
    },
  };

  await recordStockMovement(service as any, {
    createdBy: 'user-1',
    itemId: 'item-zero',
    movementType: 'ADJUSTMENT_IN',
    organizationId: 'org-1',
    quantity: 5,
    referenceId: 'adj-1',
    referenceType: 'stock_adjustment',
    totalValue: 0,
    unitCost: 0,
    warehouseId: 'wh-1',
  });

  assert.equal(movementPayloads[0]?.unit_cost, 0);
  assert.equal(movementPayloads[0]?.total_cost, 0);
  assert.equal(movementPayloads[0]?.total_value, 0);
  assert.notEqual(movementPayloads[0]?.total_value, null);
});

test('recordStockMovement computes total_value from quantity and unit cost', async () => {
  const movementPayloads: Array<Record<string, unknown>> = [];

  const service = {
    from(table: string) {
      if (table === 'items') {
        return {
          select() {
            return {
              eq() {
                return {
                  is() {
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'item-valued',
                            code: 'VAL-1',
                            name: 'Valued Item',
                            item_type: 'RAW_MATERIAL',
                            unit_cost: 2.5,
                            organization_id: 'org-1',
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'stock_balances') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'bal-2',
                            organization_id: 'org-1',
                            quantity_on_hand: 10,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'stock_movements') {
        return {
          insert(payload: Record<string, unknown>) {
            movementPayloads.push({ ...payload });
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: { id: 'move-valued', ...payload },
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unhandled table ${table}`);
    },
  };

  await recordStockMovement(service as any, {
    createdBy: 'user-1',
    itemId: 'item-valued',
    movementType: 'ADJUSTMENT_IN',
    organizationId: 'org-1',
    quantity: 4,
    referenceId: 'adj-2',
    referenceType: 'stock_adjustment',
    unitCost: 2.5,
    warehouseId: 'wh-2',
  });

  assert.equal(movementPayloads[0]?.unit_cost, 2.5);
  assert.equal(movementPayloads[0]?.total_value, 10);
  assert.equal(movementPayloads[0]?.total_cost, 10);
});

test('applyInventoryDelta increases stock balance value and average cost safely', async () => {
  const updatePayloads: Array<Record<string, unknown>> = [];

  const service = {
    from(table: string) {
      assert.equal(table, 'stock_balances');
      return {
        select() {
          return {
            eq(column: string, value: string) {
              assert.equal(column, 'item_id');
              assert.equal(value, 'item-balance');
              return {
                eq(nextColumn: string, nextValue: string) {
                  assert.equal(nextColumn, 'warehouse_id');
                  assert.equal(nextValue, 'wh-balance');
                  return {
                    maybeSingle() {
                      return Promise.resolve({
                        data: {
                          id: 'bal-3',
                          organization_id: 'org-1',
                          quantity_on_hand: 10,
                          quantity_available: 10,
                          quantity_reserved: 0,
                          average_cost: 1,
                          total_value: 10,
                        },
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          updatePayloads.push({ ...payload });
          return {
            eq(column: string, value: string) {
              assert.equal(column, 'id');
              assert.equal(value, 'bal-3');
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({
                        data: { id: 'bal-3', ...payload },
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  await applyInventoryDelta(service as any, {
    itemId: 'item-balance',
    organizationId: 'org-1',
    quantityDelta: 4,
    totalValue: 20,
    unitCost: 5,
    warehouseId: 'wh-balance',
  });

  assert.equal(updatePayloads[0]?.quantity_on_hand, 14);
  assert.equal(updatePayloads[0]?.quantity_available, 14);
  assert.equal(updatePayloads[0]?.total_value, 30);
  assert.equal(updatePayloads[0]?.average_cost, 30 / 14);
});

test('inventory adjustment failure helper returns staged stock movement diagnostics', () => {
  const failure = buildInventoryAdjustmentFailureResponse({
    dbMessage: 'null value in column "total_value" violates not-null constraint',
    itemId: 'item-1',
    quantity: 5,
    stage: 'STOCK_MOVEMENT_INSERT_FAILED',
    totalValue: 0,
    unitCost: 0,
    warehouseId: 'wh-1',
  });

  assert.deepEqual(
    failure,
    buildInventoryAdjustmentFailure({
      dbMessage: 'null value in column "total_value" violates not-null constraint',
      itemId: 'item-1',
      quantity: 5,
      stage: 'STOCK_MOVEMENT_INSERT_FAILED',
      totalValue: 0,
      unitCost: 0,
      warehouseId: 'wh-1',
    }),
  );
  assert.equal(failure.code, 'INVENTORY_ADJUSTMENT_FAILED');
  assert.equal(failure.stage, 'STOCK_MOVEMENT_INSERT_FAILED');
  assert.equal(failure.details.totalValue, 0);
});

test('inventory adjustment route no longer references undefined serverError and supports reload fallback', () => {
  const route = fs.readFileSync('src/app/api/inventory/adjustments/route.ts', 'utf8');

  assert.doesNotMatch(route, /return serverError\(/);
  assert.match(route, /warning:\s*'Stock adjustment posted but updated balance could not be fully reloaded'/);
  assert.match(route, /adjustmentPosted:\s*true/);
});

test('inventory adjustment route does not emit serverError is not defined in failure payloads', () => {
  const route = fs.readFileSync('src/app/api/inventory/adjustments/route.ts', 'utf8');

  assert.doesNotMatch(route, /serverError is not defined/);
  assert.match(route, /const dbMessage = error instanceof Error \? error\.message/);
});

test('item selector helper preserves missing cost and price values while aggregating stock by branch and warehouse', () => {
  const options = buildItemSelectorOptions({
    branchId: 'branch-1',
    items: [
      {
        categoryId: 'cat-1',
        categoryName: 'Raw Materials',
        code: 'RAW-001',
        currentInventoryCost: null,
        id: 'item-1',
        isActive: true,
        itemType: 'RAW_MATERIAL',
        name: 'Milk Base',
        sellingPrice: null,
        unitAbbreviation: 'kg',
        unitId: 'uom-1',
        unitName: 'Kilogram',
      },
    ],
    stockRows: [
      {
        averageCost: 4.25,
        itemId: 'item-1',
        quantityAvailable: 12,
        quantityOnHand: 12,
        warehouseId: 'wh-1',
      },
    ],
    warehouseId: 'wh-1',
    warehousesById: new Map([
      ['wh-1', { branchId: 'branch-1', id: 'wh-1' }],
    ]),
  });

  assert.equal(options[0]?.branchQuantity, 12);
  assert.equal(options[0]?.warehouseQuantity, 12);
  assert.equal(options[0]?.currentInventoryCost, 4.25);
  assert.equal(options[0]?.sellingPrice, null);
  assert.match(options[0]?.label ?? '', /Stock 12\.000/);
});

test('item selector label shows missing configuration explicitly instead of masking it with zeroes', () => {
  const label = buildItemSelectorLabel({
    branchQuantity: null,
    code: 'FG-001',
    currentInventoryCost: null,
    itemType: 'FINISHED_GOOD',
    name: 'Vanilla Tub',
    sellingPrice: null,
    unitAbbreviation: 'ea',
    unitName: 'Each',
    warehouseQuantity: null,
  });

  assert.match(label, /Stock n\/a/);
  assert.match(label, /Cost n\/a/);
  assert.match(label, /Price n\/a/);
});

test('inventory items route exposes selector mode with branch and warehouse aware filters', () => {
  const route = fs.readFileSync('src/app/api/inventory/items/route.ts', 'utf8');

  assert.match(route, /selector/);
  assert.match(route, /resolveRequestedBranchId/);
  assert.match(route, /include_stock/);
  assert.match(route, /warehouse_id/);
  assert.match(route, /buildItemSelectorOptions/);
});

test('inventory stores and transfers pages use the shared selector hook and searchable item field', () => {
  const storesPage = fs.readFileSync('src/app/(dashboard)/inventory/stores/page.tsx', 'utf8');
  const transfersPage = fs.readFileSync('src/app/(dashboard)/inventory/transfers/page.tsx', 'utf8');

  assert.match(storesPage, /useItemSelectorOptions/);
  assert.match(storesPage, /ItemSelectorField/);
  assert.match(storesPage, /Select a warehouse first\./);
  assert.match(transfersPage, /useItemSelectorOptions/);
  assert.match(transfersPage, /ItemSelectorField/);
});
