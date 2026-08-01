-- Phase 1G verification for 045_inventory_operational_reversals.sql
-- Safe inspection only. No writes.

\echo 'VERIFY 045: reversals and grants'

do $$
declare
  v_missing_functions text[];
  v_missing_indexes text[];
  v_missing_columns text[];
begin
  if to_regclass('icecream_erp.inventory_document_relationships') is null then
    raise exception 'VERIFY 045 failed: missing dependency table icecream_erp.inventory_document_relationships.';
  end if;

  if to_regclass('icecream_erp.inventory_reversal_runs') is null then
    raise exception 'VERIFY 045 failed: missing table icecream_erp.inventory_reversal_runs.';
  end if;

  select array_agg(required.function_name order by required.function_name)
  into v_missing_functions
  from (
    values
      ('inventory_assert_open_fiscal_period'),
      ('inventory_reverse_posted_journal'),
      ('reverse_goods_received_note_atomic'),
      ('reverse_inventory_adjustment_atomic'),
      ('reverse_inventory_write_off_atomic'),
      ('reverse_stock_transfer_dispatch_atomic'),
      ('reverse_stock_transfer_receipt_atomic')
  ) as required(function_name)
  where not exists (
    select 1
    from pg_proc proc
    where proc.pronamespace = 'icecream_erp'::regnamespace
      and proc.proname = required.function_name
  );

  if coalesce(array_length(v_missing_functions, 1), 0) > 0 then
    raise exception 'VERIFY 045 failed: missing functions: %', array_to_string(v_missing_functions, ', ');
  end if;

  select array_agg(required.index_name order by required.index_name)
  into v_missing_indexes
  from (
    values
      ('idx_inventory_reversal_runs_operation_document'),
      ('idx_inventory_reversal_runs_idempotency'),
      ('idx_inventory_reversal_runs_document_lookup')
  ) as required(index_name)
  where not exists (
    select 1
    from pg_indexes idx
    where idx.schemaname = 'icecream_erp'
      and idx.indexname = required.index_name
  );

  if coalesce(array_length(v_missing_indexes, 1), 0) > 0 then
    raise exception 'VERIFY 045 failed: missing indexes: %', array_to_string(v_missing_indexes, ', ');
  end if;

  select array_agg(required.table_name || '.' || required.column_name order by required.table_name, required.column_name)
  into v_missing_columns
  from (
    values
      ('goods_received_notes', 'reversed_at'),
      ('goods_received_notes', 'reversed_by'),
      ('goods_received_notes', 'reversal_reason')
  ) as required(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns cols
    where cols.table_schema = 'icecream_erp'
      and cols.table_name = required.table_name
      and cols.column_name = required.column_name
  );

  if coalesce(array_length(v_missing_columns, 1), 0) > 0 then
    raise exception 'VERIFY 045 failed: missing columns: %', array_to_string(v_missing_columns, ', ');
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges priv
    where priv.specific_schema = 'icecream_erp'
      and priv.routine_name in (
        'inventory_assert_open_fiscal_period',
        'inventory_reverse_posted_journal',
        'reverse_goods_received_note_atomic',
        'reverse_inventory_adjustment_atomic',
        'reverse_inventory_write_off_atomic',
        'reverse_stock_transfer_dispatch_atomic',
        'reverse_stock_transfer_receipt_atomic'
      )
      and priv.grantee in ('PUBLIC', 'anon', 'authenticated')
      and priv.privilege_type = 'EXECUTE'
  ) then
    raise exception 'VERIFY 045 failed: PUBLIC, anon, or authenticated still has EXECUTE on privileged inventory reversal functions.';
  end if;
end $$;

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
