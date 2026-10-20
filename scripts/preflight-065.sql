-- Read-only preflight for migration 065_atomic_receipts_and_supplier_payments.sql.
-- Every row must report present = true before applying migration 065.
set search_path = icecream_erp, public;

with required_tables(table_name) as (
  values ('payments'), ('supplier_payments'), ('supplier_invoices'), ('suppliers'), ('cash_accounts'),
         ('bank_accounts'), ('cash_transactions'), ('bank_transactions'), ('accounts'), ('journal_entries'),
         ('journal_entry_lines'), ('audit_logs'), ('users'), ('user_accounts'), ('sales_payment_allocations')
)
select table_name, to_regclass('icecream_erp.' || table_name) is not null as present
from required_tables
order by table_name;

with required_columns(table_name, column_name) as (
  values
    ('cash_accounts', 'account_id'), ('cash_accounts', 'opening_balance'), ('cash_accounts', 'current_balance'), ('cash_accounts', 'is_active'),
    ('bank_accounts', 'account_id'), ('bank_accounts', 'opening_balance'), ('bank_accounts', 'current_balance'), ('bank_accounts', 'is_active'),
    ('payments', 'idempotency_key'), ('payments', 'branch_id'), ('payments', 'amount'), ('payments', 'payment_date'), ('payments', 'status'),
    ('supplier_payments', 'idempotency_key'), ('supplier_payments', 'amount_paid'), ('supplier_payments', 'payment_date'), ('supplier_payments', 'payment_source_type'),
    ('supplier_invoices', 'outstanding_amount'), ('supplier_invoices', 'invoice_total'), ('supplier_invoices', 'supplier_id'), ('supplier_invoices', 'purchase_order_id'), ('supplier_invoices', 'goods_received_note_id'), ('supplier_invoices', 'grn_id'),
    ('accounts', 'code'), ('accounts', 'is_active'),
    ('journal_entries', 'reference_type'), ('journal_entries', 'reference_id'),
    ('journal_entry_lines', 'debit_amount'), ('journal_entry_lines', 'credit_amount')
)
select table_name, column_name, exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'icecream_erp' and c.table_name = required_columns.table_name and c.column_name = required_columns.column_name
) as present
from required_columns
order by table_name, column_name;

select p.proname as required_function, true as present
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'icecream_erp' and p.proname in ('post_sales_payment_transaction', 'sales_assert_open_period', 'sales_next_document_number');

-- Must return zero rows before applying; duplicate source references need remediation first.
select organization_id, cash_account_id, source, count(*) as duplicate_count
from icecream_erp.cash_transactions
where source is not null
group by organization_id, cash_account_id, source
having count(*) > 1;
