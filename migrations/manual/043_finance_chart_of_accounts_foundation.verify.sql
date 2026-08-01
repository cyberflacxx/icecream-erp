-- Verification companion for 043_finance_chart_of_accounts_foundation.sql

select
  organization_id,
  count(*) as total_accounts,
  count(*) filter (where upper(type::text) = 'HEADER' or allow_posting = false) as header_accounts,
  count(*) filter (where allow_posting = true) as posting_accounts
from icecream_erp.accounts
group by organization_id
order by organization_id;

select
  organization_id,
  code,
  count(*) as duplicate_count
from icecream_erp.accounts
group by organization_id, code
having count(*) > 1
order by organization_id, code;

select
  organization_id,
  code,
  name,
  type,
  allow_posting,
  normal_balance,
  parent_id
from icecream_erp.accounts
where code in ('1000', '1100', '1110', '1120', '1130', '1140', '1200', '1210', '1240', '2000', '2100', '2110', '4000', '4120', '5000', '5110', '7000', '7040', '8000', '8020')
order by organization_id, code;

select
  mapping.organization_id,
  mapping.mapping_key,
  account.code as account_code,
  account.name as account_name,
  account.type::text as account_type,
  account.allow_posting,
  mapping.branch_id
from icecream_erp.erp_account_mappings mapping
join icecream_erp.accounts account
  on account.id = mapping.account_id
order by mapping.organization_id, mapping.mapping_key, mapping.branch_id nulls first;

select
  organization_id,
  count(*) as cost_centre_count,
  count(*) filter (where branch_id is not null) as branch_cost_centre_count
from icecream_erp.cost_centres
group by organization_id
order by organization_id;

select
  organization_id,
  effective_date,
  posting_status,
  count(*) as opening_balance_rows
from icecream_erp.opening_account_balances
group by organization_id, effective_date, posting_status
order by organization_id, effective_date, posting_status;

select
  organization_id,
  sum(debit_amount) as total_debit,
  sum(credit_amount) as total_credit,
  sum(debit_amount) - sum(credit_amount) as variance
from icecream_erp.opening_account_balances
where posting_status = 'DRAFT'
group by organization_id
order by organization_id;
