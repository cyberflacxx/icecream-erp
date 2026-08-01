-- Phase 1G pre-deployment inspection
-- Safe read-only checks.

\echo 'PREDEPLOY: current migrations'
select filename, applied_at
from public.schema_migrations
where filename like '043_%'
   or filename like '044_%'
   or filename like '045_%'
order by filename;

\echo 'PREDEPLOY: chart, posting, and reversal function inventory'
select proname
from pg_proc
where pronamespace = 'icecream_erp'::regnamespace
  and proname in (
    'inventory_create_posted_journal',
    'post_goods_received_note_atomic',
    'dispatch_stock_transfer_atomic',
    'receive_stock_transfer_atomic',
    'reverse_goods_received_note_atomic',
    'reverse_inventory_adjustment_atomic',
    'reverse_inventory_write_off_atomic',
    'reverse_stock_transfer_dispatch_atomic',
    'reverse_stock_transfer_receipt_atomic'
  )
order by proname;

\echo 'PREDEPLOY: posting and reversal tables'
select table_name
from information_schema.tables
where table_schema = 'icecream_erp'
  and table_name in ('inventory_posting_runs', 'inventory_document_relationships', 'inventory_reversal_runs')
order by table_name;
