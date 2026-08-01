-- Phase 1H finance enum prerequisite
-- Apply and commit this file before 043_finance_chart_of_accounts_foundation.sql.
-- PostgreSQL 15 does not allow a newly-added enum label to be added and used in the same transaction.

do $$
begin
  if to_regtype('icecream_erp.account_type') is null then
    raise exception 'Missing enum icecream_erp.account_type. Apply the base finance schema before 042a_finance_account_type_enum_prerequisites.sql.';
  end if;
end $$;

alter type icecream_erp.account_type add value if not exists 'HEADER';
alter type icecream_erp.account_type add value if not exists 'CONTRA_ASSET';
alter type icecream_erp.account_type add value if not exists 'CONTRA_REVENUE';
alter type icecream_erp.account_type add value if not exists 'OTHER_INCOME';

notify pgrst, 'reload schema';
