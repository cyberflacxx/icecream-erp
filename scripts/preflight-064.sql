\pset pager off

select 'organization' as check_name, count(*)::text as value
from icecream_erp.organizations;

select 'open_fiscal_period_today' as check_name, count(*)::text as value
from icecream_erp.fiscal_periods
where current_date between start_date and end_date
  and upper(status) = 'OPEN'
  and is_locked = false;

select 'cash_accounts' as check_name, count(*)::text as value
from icecream_erp.cash_accounts
where is_active = true;

select 'bank_accounts' as check_name, count(*)::text as value
from icecream_erp.bank_accounts
where is_active = true;

select 'required_finance_mappings' as check_name, count(*)::text as value
from icecream_erp.erp_account_mappings
where is_active = true
  and mapping_key in (
    'CASH_ACCOUNT',
    'BANK_ACCOUNT',
    'PETTY_CASH_ACCOUNT',
    'ACCOUNTS_RECEIVABLE',
    'RAW_MATERIAL_INVENTORY',
    'SUPPLIER_PAYABLES',
    'DEFAULT_SALES_REVENUE',
    'COST_OF_GOODS_SOLD'
  );

select
  mapping.mapping_key,
  account.code as account_code,
  account.name as account_name,
  mapping.is_active
from icecream_erp.erp_account_mappings mapping
join icecream_erp.accounts account on account.id = mapping.account_id
where mapping.mapping_key in (
  'CASH_ACCOUNT',
  'BANK_ACCOUNT',
  'PETTY_CASH_ACCOUNT',
  'ACCOUNTS_RECEIVABLE',
  'RAW_MATERIAL_INVENTORY',
  'SUPPLIER_PAYABLES',
  'DEFAULT_SALES_REVENUE',
  'COST_OF_GOODS_SOLD'
)
order by mapping.mapping_key;

select
  to_regprocedure('icecream_erp.post_sales_invoice_transaction(uuid,uuid,jsonb)') is not null
    as sales_invoice_rpc_available,
  to_regprocedure('icecream_erp.post_sales_payment_transaction(uuid,uuid,jsonb)') is not null
    as sales_payment_rpc_available;

select
  'cash_balance_nulls' as check_name,
  count(*)::text as value
from icecream_erp.cash_accounts
where current_balance is null or opening_balance is null;

select
  'bank_balance_nulls' as check_name,
  count(*)::text as value
from icecream_erp.bank_accounts
where current_balance is null or opening_balance is null;
