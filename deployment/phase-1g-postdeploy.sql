-- Phase 1G post-deployment validation
-- Safe read-only checks.

\echo 'POSTDEPLOY: required functions'
select proname, pg_get_function_identity_arguments(oid) as identity_args
from pg_proc
where pronamespace = 'icecream_erp'::regnamespace
  and proname in (
    'post_goods_received_note_atomic',
    'post_inventory_adjustment_atomic',
    'post_inventory_write_off_atomic',
    'dispatch_stock_transfer_atomic',
    'receive_stock_transfer_atomic',
    'reverse_goods_received_note_atomic',
    'reverse_inventory_adjustment_atomic',
    'reverse_inventory_write_off_atomic',
    'reverse_stock_transfer_dispatch_atomic',
    'reverse_stock_transfer_receipt_atomic'
  )
order by proname;

\echo 'POSTDEPLOY: service_role execute grants'
select routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'icecream_erp'
  and grantee = 'service_role'
  and routine_name in (
    'post_goods_received_note_atomic',
    'post_inventory_adjustment_atomic',
    'post_inventory_write_off_atomic',
    'dispatch_stock_transfer_atomic',
    'receive_stock_transfer_atomic',
    'reverse_goods_received_note_atomic',
    'reverse_inventory_adjustment_atomic',
    'reverse_inventory_write_off_atomic',
    'reverse_stock_transfer_dispatch_atomic',
    'reverse_stock_transfer_receipt_atomic'
  )
order by routine_name;

\echo 'POSTDEPLOY: posting and reversal counters'
select
  (select count(*) from icecream_erp.inventory_posting_runs) as posting_runs,
  (select count(*) from icecream_erp.inventory_reversal_runs) as reversal_runs,
  (select count(*) from icecream_erp.inventory_document_relationships) as relationship_rows;
