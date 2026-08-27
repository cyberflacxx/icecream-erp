-- Final operational correction: finance expenses must retain the selected cash/bank account.
-- Scoped to icecream_erp only. Do not alter shared public/auth/PostgREST role settings.

alter table if exists icecream_erp.finance_expenses
  add column if not exists cash_account_id uuid null,
  add column if not exists bank_account_id uuid null;

do $$
begin
  if to_regclass('icecream_erp.finance_expenses') is not null
     and to_regclass('icecream_erp.cash_accounts') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'finance_expenses_cash_account_id_fkey'
         and conrelid = 'icecream_erp.finance_expenses'::regclass
     ) then
    alter table icecream_erp.finance_expenses
      add constraint finance_expenses_cash_account_id_fkey
      foreign key (cash_account_id) references icecream_erp.cash_accounts(id);
  end if;

  if to_regclass('icecream_erp.finance_expenses') is not null
     and to_regclass('icecream_erp.bank_accounts') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'finance_expenses_bank_account_id_fkey'
         and conrelid = 'icecream_erp.finance_expenses'::regclass
     ) then
    alter table icecream_erp.finance_expenses
      add constraint finance_expenses_bank_account_id_fkey
      foreign key (bank_account_id) references icecream_erp.bank_accounts(id);
  end if;
end $$;

create index if not exists idx_finance_expenses_cash_account_id
  on icecream_erp.finance_expenses(cash_account_id)
  where cash_account_id is not null;

create index if not exists idx_finance_expenses_bank_account_id
  on icecream_erp.finance_expenses(bank_account_id)
  where bank_account_id is not null;

notify pgrst, 'reload schema';
