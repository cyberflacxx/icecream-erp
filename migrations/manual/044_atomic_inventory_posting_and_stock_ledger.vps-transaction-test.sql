-- VPS transaction smoke tests for 044_atomic_inventory_posting_and_stock_ledger.sql
-- Intended for psql. Fill variables before execution.
-- This script rolls back at the end.

-- Example:
-- \set org_id '00000000-0000-0000-0000-000000000000'
-- \set actor_user_id '00000000-0000-0000-0000-000000000000'
-- \set branch_id '00000000-0000-0000-0000-000000000000'
-- \set warehouse_id '00000000-0000-0000-0000-000000000000'
-- \set item_id '00000000-0000-0000-0000-000000000000'
-- \set adjustment_id '00000000-0000-0000-0000-000000000000'
-- \set grn_id '00000000-0000-0000-0000-000000000000'
-- \set transfer_id '00000000-0000-0000-0000-000000000000'
-- \set account_inventory '00000000-0000-0000-0000-000000000000'
-- \set account_variance '00000000-0000-0000-0000-000000000000'

begin;

\echo 'SMOKE 044: inventory adjustment atomic posting'
select icecream_erp.post_inventory_adjustment_atomic(
  :'org_id'::uuid,
  :'adjustment_id'::uuid,
  :'branch_id'::uuid,
  :'actor_user_id'::uuid,
  'STOCK_ADJUSTMENT_GAIN',
  1,
  10,
  'VPS smoke test only',
  :'warehouse_id'::uuid,
  'FINANCE',
  current_date,
  jsonb_build_array(
    jsonb_build_object(
      'accountId', :'account_inventory'::uuid,
      'branchId', :'branch_id'::uuid,
      'costCenterCode', 'FINANCE',
      'debitAmount', 10,
      'creditAmount', 0,
      'description', 'Inventory gain smoke test'
    ),
    jsonb_build_object(
      'accountId', :'account_variance'::uuid,
      'branchId', :'branch_id'::uuid,
      'costCenterCode', 'FINANCE',
      'debitAmount', 0,
      'creditAmount', 10,
      'description', 'Variance gain smoke test'
    )
  ),
  'smoke-adjustment-044'
);

\echo 'SMOKE 044: transfer dispatch idempotency'
select icecream_erp.dispatch_stock_transfer_atomic(
  :'org_id'::uuid,
  :'transfer_id'::uuid,
  :'branch_id'::uuid,
  :'actor_user_id'::uuid,
  'FINANCE',
  current_date,
  jsonb_build_array(),
  'smoke-transfer-dispatch-044'
);

select icecream_erp.dispatch_stock_transfer_atomic(
  :'org_id'::uuid,
  :'transfer_id'::uuid,
  :'branch_id'::uuid,
  :'actor_user_id'::uuid,
  'FINANCE',
  current_date,
  jsonb_build_array(),
  'smoke-transfer-dispatch-044'
);

\echo 'SMOKE 044: GRN idempotency'
select icecream_erp.post_goods_received_note_atomic(
  :'org_id'::uuid,
  :'grn_id'::uuid,
  :'branch_id'::uuid,
  :'actor_user_id'::uuid,
  'FINANCE',
  current_date,
  'VPS smoke test only',
  jsonb_build_array(),
  'smoke-grn-044'
);

select icecream_erp.post_goods_received_note_atomic(
  :'org_id'::uuid,
  :'grn_id'::uuid,
  :'branch_id'::uuid,
  :'actor_user_id'::uuid,
  'FINANCE',
  current_date,
  'VPS smoke test only',
  jsonb_build_array(),
  'smoke-grn-044'
);

rollback;
