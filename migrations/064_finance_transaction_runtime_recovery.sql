-- Restore the minimum finance runtime foundation required after an operational reset.
-- Additive only. Does not alter shared schemas or other tenants.

begin;

-- Sales transaction RPCs require an open fiscal period. Full tenant resets clear
-- fiscal_periods while leaving the RPCs in place, which blocks invoicing and receipts.
insert into icecream_erp.fiscal_periods (
  organization_id,
  period_name,
  start_date,
  end_date,
  status,
  is_locked,
  created_at,
  updated_at
)
select
  org.id,
  'AUTO-' || extract(year from current_date)::int::text,
  date_trunc('year', current_date)::date,
  (date_trunc('year', current_date) + interval '1 year - 1 day')::date,
  'OPEN',
  false,
  now(),
  now()
from icecream_erp.organizations org
where not exists (
  select 1
  from icecream_erp.fiscal_periods period
  where period.organization_id = org.id
    and current_date between period.start_date and period.end_date
);

-- Normalize any null balances left by older compatibility schemas.
update icecream_erp.cash_accounts
set current_balance = coalesce(current_balance, opening_balance, 0),
    opening_balance = coalesce(opening_balance, current_balance, 0),
    updated_at = now()
where current_balance is null
   or opening_balance is null;

update icecream_erp.bank_accounts
set current_balance = coalesce(current_balance, opening_balance, 0),
    opening_balance = coalesce(opening_balance, current_balance, 0),
    updated_at = now()
where current_balance is null
   or opening_balance is null;

commit;

notify pgrst, 'reload schema';
