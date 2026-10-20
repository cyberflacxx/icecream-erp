-- Read-only preflight for migration 066_atomic_expense_cash_posting.sql.
set search_path = icecream_erp, public;

select id, account_name, branch_id, account_id, current_balance, opening_balance, is_active
from icecream_erp.cash_accounts
where coalesce(is_active, true)
order by branch_id nulls first, account_name;

select id, status, branch_id, cash_account_id, bank_account_id, amount
from icecream_erp.finance_expenses
where deleted_at is null and upper(coalesce(status, '')) in ('APPROVED', 'POSTED')
order by expense_date desc;

select table_name, column_name, exists (
  select 1 from information_schema.columns column_info
  where column_info.table_schema = 'icecream_erp'
    and column_info.table_name = required.table_name
    and column_info.column_name = required.column_name
) as present
from (values
  ('finance_expenses', 'cash_account_id'), ('finance_expenses', 'bank_account_id'),
  ('cash_accounts', 'branch_id'), ('cash_accounts', 'account_id'), ('cash_accounts', 'current_balance'),
  ('cash_transactions', 'source'), ('cash_transactions', 'journal_entry_id'),
  ('journal_entries', 'reference_type'), ('journal_entry_lines', 'account_id')
) as required(table_name, column_name)
order by table_name, column_name;

select grn.id, grn.grn_number, grn.status, grn.stock_posted, grn.warehouse_id
from icecream_erp.goods_received_notes grn
where (coalesce(grn.stock_posted, false) and upper(coalesce(grn.status::text, '')) <> 'POSTED')
   or (not coalesce(grn.stock_posted, false) and upper(coalesce(grn.status::text, '')) = 'POSTED');

select account.id, account.account_name, account.current_balance,
  coalesce(account.opening_balance, 0) + coalesce(sum(case
    when upper(coalesce(tx.status, 'POSTED')) in ('VOID', 'VOIDED', 'CANCELLED', 'REVERSED', 'FAILED') then 0
    when upper(coalesce(tx.transaction_type, '')) like '%OUT%' or upper(coalesce(tx.transaction_type, '')) like '%PAYMENT%' then -coalesce(tx.amount, 0)
    else coalesce(tx.amount, 0) end), 0) as recomputed_balance
from icecream_erp.cash_accounts account
left join icecream_erp.cash_transactions tx on tx.cash_account_id = account.id
group by account.id, account.account_name, account.current_balance, account.opening_balance
having account.current_balance is distinct from coalesce(account.opening_balance, 0) + coalesce(sum(case
  when upper(coalesce(tx.status, 'POSTED')) in ('VOID', 'VOIDED', 'CANCELLED', 'REVERSED', 'FAILED') then 0
  when upper(coalesce(tx.transaction_type, '')) like '%OUT%' or upper(coalesce(tx.transaction_type, '')) like '%PAYMENT%' then -coalesce(tx.amount, 0)
  else coalesce(tx.amount, 0) end), 0);

