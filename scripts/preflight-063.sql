-- Read-only preflight for migration 063_sales_invoice_dispatch_reversal.sql.
-- Run against the target database before applying migration 063.
-- Expected result: every required object/column returns `present = true`.

set search_path = icecream_erp, public;

with required_columns(table_name, column_name) as (
  values
    ('invoices', 'id'),
    ('invoices', 'organization_id'),
    ('invoices', 'status'),
    ('invoices', 'customer_id'),
    ('invoices', 'amount_paid'),
    ('invoices', 'paid_amount'),
    ('invoices', 'balance_due'),
    ('invoices', 'void_reason'),
    ('invoices', 'voided_at'),
    ('invoices', 'voided_by'),
    ('sales_dispatch_notes', 'id'),
    ('sales_dispatch_notes', 'organization_id'),
    ('sales_dispatch_notes', 'invoice_id'),
    ('sales_dispatch_notes', 'status'),
    ('sales_dispatch_notes', 'void_reason'),
    ('sales_dispatch_notes', 'voided_at'),
    ('sales_dispatch_notes', 'voided_by'),
    ('stock_movements', 'id'),
    ('stock_movements', 'organization_id'),
    ('stock_movements', 'item_id'),
    ('stock_movements', 'warehouse_id'),
    ('stock_movements', 'movement_type'),
    ('stock_movements', 'quantity'),
    ('stock_movements', 'unit_cost'),
    ('stock_movements', 'total_cost'),
    ('stock_movements', 'total_value'),
    ('stock_movements', 'reference_type'),
    ('stock_movements', 'reference_id'),
    ('stock_movements', 'source_document_type'),
    ('stock_movements', 'source_document_id'),
    ('stock_movements', 'reversal_of_movement_id'),
    ('stock_movements', 'reversal_reference'),
    ('stock_balances', 'organization_id'),
    ('stock_balances', 'item_id'),
    ('stock_balances', 'warehouse_id'),
    ('stock_balances', 'quantity'),
    ('stock_balances', 'quantity_on_hand'),
    ('stock_balances', 'quantity_available'),
    ('stock_balances', 'total_value'),
    ('journal_entries', 'id'),
    ('journal_entries', 'organization_id'),
    ('journal_entries', 'reference_type'),
    ('journal_entries', 'reference_id'),
    ('journal_entries', 'total_debit'),
    ('journal_entries', 'total_credit'),
    ('journal_entry_lines', 'journal_entry_id'),
    ('journal_entry_lines', 'account_id'),
    ('journal_entry_lines', 'debit_amount'),
    ('journal_entry_lines', 'credit_amount'),
    ('payments', 'invoice_id'),
    ('payments', 'status'),
    ('payments', 'amount'),
    ('payments', 'deleted_at'),
    ('sales_payment_allocations', 'invoice_id'),
    ('sales_payment_allocations', 'payment_id'),
    ('sales_payment_allocations', 'allocated_amount'),
    ('customers', 'current_balance'),
    ('customers', 'outstanding_balance'),
    ('audit_logs', 'action'),
    ('sales_document_relationships', 'relationship_type')
)
select
  required_columns.table_name,
  required_columns.column_name,
  exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'icecream_erp'
      and c.table_name = required_columns.table_name
      and c.column_name = required_columns.column_name
  ) as present
from required_columns
order by required_columns.table_name, required_columns.column_name;

select
  'stock_movement_type RETURN_IN' as check_name,
  exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'icecream_erp'
      and t.typname = 'stock_movement_type'
      and e.enumlabel = 'RETURN_IN'
  ) as present;

select
  'sales_next_document_number' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'icecream_erp'
      and p.proname = 'sales_next_document_number'
  ) as present;
