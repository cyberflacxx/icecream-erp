-- VPS concurrency probes for 045_inventory_operational_reversals.sql
-- Intended for psql against an isolated database only.
-- Fill variables before execution.
-- Run this file in two separate sessions to verify duplicate and race protection.

-- Example:
-- \set org_id '00000000-0000-0000-0000-000000000000'
-- \set actor_user_id '00000000-0000-0000-0000-000000000000'
-- \set branch_id '00000000-0000-0000-0000-000000000000'
-- \set transfer_id '00000000-0000-0000-0000-000000000000'
-- \set grn_id '00000000-0000-0000-0000-000000000000'

begin;

\echo 'CONCURRENCY 045: hold GRN reversal lock for overlap testing'
select pg_backend_pid() as session_pid;
select icecream_erp.reverse_goods_received_note_atomic(
  :'org_id'::uuid,
  :'grn_id'::uuid,
  :'actor_user_id'::uuid,
  :'branch_id'::uuid,
  'PROCUREMENT',
  current_date,
  'Phase 1G concurrency probe',
  'concurrency-grn-reverse-045'
);
select pg_sleep(10);

\echo 'CONCURRENCY 045: dispatch reversal duplicate/race test'
select icecream_erp.reverse_stock_transfer_dispatch_atomic(
  :'org_id'::uuid,
  :'transfer_id'::uuid,
  :'actor_user_id'::uuid,
  :'branch_id'::uuid,
  'STORES',
  current_date,
  'Phase 1G concurrency probe',
  'concurrency-transfer-dispatch-reverse-045'
);
select pg_sleep(10);

rollback;
