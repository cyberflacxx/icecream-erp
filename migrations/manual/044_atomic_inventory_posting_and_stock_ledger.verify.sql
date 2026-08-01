-- Phase 1F verification for 044_atomic_inventory_posting_and_stock_ledger.sql
-- Safe inspection only. No writes.

\echo 'VERIFY 044: structure and grants'

do $$
declare
  v_missing_functions text[];
  v_missing_tables text[];
  v_missing_indexes text[];
  v_missing_columns text[];
begin
  select array_agg(required.function_name order by required.function_name)
  into v_missing_functions
  from (
    values
      ('inventory_next_document_number'),
      ('inventory_advisory_lock'),
      ('inventory_create_posted_journal'),
      ('post_goods_received_note_atomic'),
      ('post_inventory_adjustment_atomic'),
      ('post_inventory_stock_take_atomic'),
      ('post_inventory_write_off_atomic'),
      ('dispatch_stock_transfer_atomic'),
      ('receive_stock_transfer_atomic')
  ) as required(function_name)
  where not exists (
    select 1
    from pg_proc proc
    where proc.pronamespace = 'icecream_erp'::regnamespace
      and proc.proname = required.function_name
  );

  if coalesce(array_length(v_missing_functions, 1), 0) > 0 then
    raise exception 'VERIFY 044 failed: missing functions: %', array_to_string(v_missing_functions, ', ');
  end if;

  select array_agg(required.table_name order by required.table_name)
  into v_missing_tables
  from (
    values
      ('inventory_posting_runs'),
      ('inventory_document_relationships')
  ) as required(table_name)
  where to_regclass('icecream_erp.' || required.table_name) is null;

  if coalesce(array_length(v_missing_tables, 1), 0) > 0 then
    raise exception 'VERIFY 044 failed: missing tables: %', array_to_string(v_missing_tables, ', ');
  end if;

  select array_agg(required.index_name order by required.index_name)
  into v_missing_indexes
  from (
    values
      ('idx_stock_movements_posting_date'),
      ('idx_stock_movements_ledger_filters'),
      ('idx_stock_movements_journal_entry'),
      ('idx_stock_movements_reversal_of'),
      ('idx_inventory_stock_takes_document_number'),
      ('idx_inventory_stock_takes_idempotency'),
      ('idx_inventory_stock_takes_branch_status'),
      ('idx_stock_adjustments_idempotency'),
      ('idx_goods_received_notes_idempotency'),
      ('idx_inventory_posting_runs_document'),
      ('idx_inventory_posting_runs_idempotency'),
      ('idx_inventory_document_relationships_unique')
  ) as required(index_name)
  where not exists (
    select 1
    from pg_indexes idx
    where idx.schemaname = 'icecream_erp'
      and idx.indexname = required.index_name
  );

  if coalesce(array_length(v_missing_indexes, 1), 0) > 0 then
    raise exception 'VERIFY 044 failed: missing indexes: %', array_to_string(v_missing_indexes, ', ');
  end if;

  select array_agg(required.table_name || '.' || required.column_name order by required.table_name, required.column_name)
  into v_missing_columns
  from (
    values
      ('stock_balances', 'average_cost'),
      ('stock_balances', 'total_value'),
      ('stock_movements', 'total_value'),
      ('stock_movements', 'movement_number'),
      ('stock_movements', 'source_document_number'),
      ('stock_movements', 'posting_date'),
      ('stock_movements', 'posting_status'),
      ('stock_movements', 'journal_entry_id'),
      ('stock_movements', 'branch_id'),
      ('stock_movements', 'source_branch_id'),
      ('stock_movements', 'destination_branch_id'),
      ('stock_movements', 'running_value'),
      ('stock_movements', 'reversal_of_movement_id'),
      ('stock_movements', 'reversal_reference'),
      ('inventory_stock_takes', 'organization_id'),
      ('inventory_stock_takes', 'branch_id'),
      ('inventory_stock_takes', 'document_number'),
      ('inventory_stock_takes', 'count_date'),
      ('inventory_stock_takes', 'posted_by'),
      ('inventory_stock_takes', 'posted_at'),
      ('inventory_stock_takes', 'idempotency_key'),
      ('inventory_stock_take_items', 'unit_cost'),
      ('inventory_stock_take_items', 'variance_value'),
      ('inventory_stock_take_items', 'posted_movement_id'),
      ('stock_adjustments', 'idempotency_key'),
      ('stock_adjustments', 'posted_at'),
      ('stock_adjustments', 'posted_by'),
      ('stock_adjustments', 'reversal_reason'),
      ('stock_adjustments', 'journal_entry_id'),
      ('goods_received_notes', 'idempotency_key'),
      ('goods_received_notes', 'journal_entry_id'),
      ('stock_transfers', 'dispatched_at'),
      ('stock_transfers', 'dispatched_by'),
      ('stock_transfers', 'received_at'),
      ('stock_transfers', 'received_by'),
      ('stock_transfers', 'dispatch_journal_entry_id'),
      ('stock_transfers', 'receipt_journal_entry_id'),
      ('stock_transfers', 'reversal_reason')
  ) as required(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns cols
    where cols.table_schema = 'icecream_erp'
      and cols.table_name = required.table_name
      and cols.column_name = required.column_name
  );

  if coalesce(array_length(v_missing_columns, 1), 0) > 0 then
    raise exception 'VERIFY 044 failed: missing columns: %', array_to_string(v_missing_columns, ', ');
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges priv
    where priv.specific_schema = 'icecream_erp'
      and priv.routine_name in (
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
      and priv.grantee in ('PUBLIC', 'anon', 'authenticated')
      and priv.privilege_type = 'EXECUTE'
  ) then
    raise exception 'VERIFY 044 failed: PUBLIC, anon, or authenticated still has EXECUTE on privileged inventory posting functions.';
  end if;
end $$;

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
