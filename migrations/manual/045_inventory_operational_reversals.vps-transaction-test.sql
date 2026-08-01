-- VPS transaction smoke tests for 045_inventory_operational_reversals.sql
-- Intended for psql against an isolated database only.
-- Fill variables before execution.
-- This script rolls back at the end.

-- Example:
-- \set org_id '00000000-0000-0000-0000-000000000000'
-- \set actor_user_id '00000000-0000-0000-0000-000000000000'
-- \set branch_id '00000000-0000-0000-0000-000000000000'
-- \set grn_id '00000000-0000-0000-0000-000000000000'
-- \set adjustment_id '00000000-0000-0000-0000-000000000000'
-- \set writeoff_batch_id '00000000-0000-0000-0000-000000000000'
-- \set transfer_id '00000000-0000-0000-0000-000000000000'

begin;

\echo 'SMOKE 045: GRN reversal idempotency'
select icecream_erp.reverse_goods_received_note_atomic(
  :'org_id'::uuid,
  :'grn_id'::uuid,
  :'actor_user_id'::uuid,
  :'branch_id'::uuid,
  'PROCUREMENT',
  current_date,
  'Phase 1G isolated smoke test',
  'smoke-grn-reverse-045'
);

\echo 'SMOKE 045: stock adjustment reversal'
select icecream_erp.reverse_inventory_adjustment_atomic(
  :'org_id'::uuid,
  :'adjustment_id'::uuid,
  :'actor_user_id'::uuid,
  :'branch_id'::uuid,
  'STORES',
  current_date,
  'Phase 1G isolated smoke test',
  'smoke-adjustment-reverse-045'
);

\echo 'SMOKE 045: write-off reversal'
select icecream_erp.reverse_inventory_write_off_atomic(
  :'org_id'::uuid,
  :'writeoff_batch_id'::uuid,
  :'actor_user_id'::uuid,
  :'branch_id'::uuid,
  'STORES',
  current_date,
  'Phase 1G isolated smoke test',
  'smoke-writeoff-reverse-045'
);

\echo 'SMOKE 045: transfer receipt reversal'
select icecream_erp.reverse_stock_transfer_receipt_atomic(
  :'org_id'::uuid,
  :'transfer_id'::uuid,
  :'actor_user_id'::uuid,
  :'branch_id'::uuid,
  'STORES',
  current_date,
  'Phase 1G isolated smoke test',
  'smoke-transfer-receipt-reverse-045'
);

\echo 'SMOKE 045: transfer dispatch reversal'
select icecream_erp.reverse_stock_transfer_dispatch_atomic(
  :'org_id'::uuid,
  :'transfer_id'::uuid,
  :'actor_user_id'::uuid,
  :'branch_id'::uuid,
  'STORES',
  current_date,
  'Phase 1G isolated smoke test',
  'smoke-transfer-dispatch-reverse-045'
);

rollback;
