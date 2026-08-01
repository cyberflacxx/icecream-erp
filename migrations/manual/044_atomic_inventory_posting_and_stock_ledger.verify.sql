-- Phase 1F verification for 044_atomic_inventory_posting_and_stock_ledger.sql
-- Safe inspection only. No writes.

\echo 'VERIFY 044: functions'
select
  proname,
  prosecdef,
  pg_get_function_identity_arguments(oid) as identity_args
from pg_proc
where pronamespace = 'icecream_erp'::regnamespace
  and proname in (
    'inventory_next_document_number',
    'inventory_advisory_lock',
    'inventory_create_posted_journal',
    'post_goods_received_note_atomic',
    'post_inventory_adjustment_atomic',
    'post_inventory_stock_take_atomic',
    'post_inventory_write_off_atomic',
    'dispatch_stock_transfer_atomic',
    'receive_stock_transfer_atomic'
  )
order by proname;

\echo 'VERIFY 044: tables'
select table_name
from information_schema.tables
where table_schema = 'icecream_erp'
  and table_name in (
    'inventory_posting_runs',
    'inventory_document_relationships'
  )
order by table_name;

\echo 'VERIFY 044: key columns'
select table_name, column_name
from information_schema.columns
where table_schema = 'icecream_erp'
  and (
    (table_name = 'stock_balances' and column_name in ('average_cost', 'total_value'))
    or (table_name = 'stock_movements' and column_name in (
      'total_value',
      'movement_number',
      'source_document_number',
      'posting_date',
      'posting_status',
      'journal_entry_id',
      'branch_id',
      'source_branch_id',
      'destination_branch_id',
      'running_value',
      'reversal_of_movement_id',
      'reversal_reference'
    ))
    or (table_name = 'inventory_stock_takes' and column_name in (
      'organization_id',
      'branch_id',
      'document_number',
      'count_date',
      'posted_by',
      'posted_at',
      'idempotency_key'
    ))
    or (table_name = 'inventory_stock_take_items' and column_name in (
      'unit_cost',
      'variance_value',
      'posted_movement_id'
    ))
    or (table_name = 'stock_adjustments' and column_name in (
      'idempotency_key',
      'posted_at',
      'posted_by',
      'reversal_reason',
      'journal_entry_id'
    ))
    or (table_name = 'goods_received_notes' and column_name in (
      'idempotency_key',
      'journal_entry_id'
    ))
    or (table_name = 'stock_transfers' and column_name in (
      'dispatched_at',
      'dispatched_by',
      'received_at',
      'received_by',
      'dispatch_journal_entry_id',
      'receipt_journal_entry_id',
      'reversal_reason'
    ))
  )
order by table_name, column_name;

\echo 'VERIFY 044: indexes'
select schemaname, tablename, indexname
from pg_indexes
where schemaname = 'icecream_erp'
  and indexname in (
    'idx_stock_movements_posting_date',
    'idx_stock_movements_ledger_filters',
    'idx_stock_movements_journal_entry',
    'idx_stock_movements_reversal_of',
    'idx_inventory_stock_takes_document_number',
    'idx_inventory_stock_takes_idempotency',
    'idx_inventory_stock_takes_branch_status',
    'idx_stock_adjustments_idempotency',
    'idx_goods_received_notes_idempotency'
  )
order by indexname;

\echo 'VERIFY 044: grants'
select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'icecream_erp'
  and routine_name in (
    'inventory_next_document_number',
    'inventory_advisory_lock',
    'inventory_create_posted_journal',
    'post_goods_received_note_atomic',
    'post_inventory_adjustment_atomic',
    'post_inventory_stock_take_atomic',
    'post_inventory_write_off_atomic',
    'dispatch_stock_transfer_atomic',
    'receive_stock_transfer_atomic'
  )
order by routine_name, grantee, privilege_type;
