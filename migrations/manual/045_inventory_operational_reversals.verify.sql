-- Phase 1G verification for 045_inventory_operational_reversals.sql
-- Safe inspection only. No writes.

\echo 'VERIFY 045: reversal functions'
select
  proname,
  prosecdef,
  pg_get_function_identity_arguments(oid) as identity_args
from pg_proc
where pronamespace = 'icecream_erp'::regnamespace
  and proname in (
    'inventory_assert_open_fiscal_period',
    'inventory_reverse_posted_journal',
    'reverse_goods_received_note_atomic',
    'reverse_inventory_adjustment_atomic',
    'reverse_inventory_write_off_atomic',
    'reverse_stock_transfer_dispatch_atomic',
    'reverse_stock_transfer_receipt_atomic'
  )
order by proname;

\echo 'VERIFY 045: reversal tables and columns'
select table_name, column_name
from information_schema.columns
where table_schema = 'icecream_erp'
  and (
    (table_name = 'inventory_reversal_runs')
    or (table_name = 'goods_received_notes' and column_name in ('reversed_at', 'reversed_by', 'reversal_reason'))
  )
order by table_name, column_name;

\echo 'VERIFY 045: reversal indexes'
select schemaname, tablename, indexname
from pg_indexes
where schemaname = 'icecream_erp'
  and indexname in (
    'idx_inventory_reversal_runs_operation_document',
    'idx_inventory_reversal_runs_idempotency',
    'idx_inventory_reversal_runs_document_lookup'
  )
order by indexname;

\echo 'VERIFY 045: grants'
select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'icecream_erp'
  and routine_name in (
    'inventory_assert_open_fiscal_period',
    'inventory_reverse_posted_journal',
    'reverse_goods_received_note_atomic',
    'reverse_inventory_adjustment_atomic',
    'reverse_inventory_write_off_atomic',
    'reverse_stock_transfer_dispatch_atomic',
    'reverse_stock_transfer_receipt_atomic'
  )
order by routine_name, grantee, privilege_type;

\echo 'VERIFY 045: relationship coverage'
select
  source_document_type,
  related_document_type,
  relationship_type,
  count(*) as relationship_count
from icecream_erp.inventory_document_relationships
where source_document_type in ('goods_received_note', 'inventory_reversal', 'stock_transfer', 'stock_adjustment', 'inventory_write_off')
group by source_document_type, related_document_type, relationship_type
order by source_document_type, related_document_type, relationship_type;
