-- Atomic finance-expense payment posting. Scoped to icecream_erp only.
-- Run scripts/preflight-066.sql and take an icecream_erp backup before production use.

set search_path = icecream_erp, public;

alter table if exists icecream_erp.finance_expenses
  add column if not exists journal_entry_id uuid null,
  add column if not exists cash_transaction_id uuid null,
  add column if not exists bank_transaction_id uuid null,
  add column if not exists idempotency_key text null;

create unique index if not exists finance_expenses_org_idempotency_key_uq
  on icecream_erp.finance_expenses (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_finance_expenses_journal_entry
  on icecream_erp.finance_expenses (journal_entry_id)
  where journal_entry_id is not null;

create or replace function icecream_erp.post_finance_expense_payment(
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_expense_id uuid,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_actor_user_account_id uuid;
  v_bank record;
  v_bank_transaction_id uuid;
  v_cash record;
  v_cash_transaction_id uuid;
  v_expense record;
  v_journal_id uuid;
  v_journal_number text;
  v_method text;
  v_source text;
begin
  select user_account_id into v_actor_user_account_id
  from icecream_erp.users where id = p_actor_user_profile_id and status = 'active' limit 1;
  if v_actor_user_account_id is null and exists (
    select 1 from icecream_erp.user_accounts where id = p_actor_user_profile_id and organization_id = p_organization_id
  ) then
    v_actor_user_account_id := p_actor_user_profile_id;
  end if;
  if v_actor_user_account_id is null then raise exception 'Active actor account was not found.' using errcode = 'P0001'; end if;

  select * into v_expense
  from icecream_erp.finance_expenses
  where id = p_expense_id and organization_id = p_organization_id and deleted_at is null
  for update;
  if v_expense.id is null then raise exception 'Expense was not found.' using errcode = 'P0001'; end if;
  if upper(coalesce(v_expense.status, '')) = 'POSTED' then
    return jsonb_build_object('success', true, 'idempotentReplay', true, 'expenseId', v_expense.id, 'journalId', v_expense.journal_entry_id);
  end if;
  if upper(coalesce(v_expense.status, '')) <> 'APPROVED' then
    raise exception 'Expense must be approved before payment can be posted.' using errcode = 'P0001';
  end if;
  if coalesce(v_expense.amount, 0) <= 0 then raise exception 'Expense amount must be greater than zero.' using errcode = 'P0001'; end if;
  if v_expense.account_id is null then raise exception 'Expense account is required before posting.' using errcode = 'P0001'; end if;
  perform icecream_erp.sales_assert_open_period(p_organization_id, v_expense.expense_date);

  v_method := upper(replace(coalesce(v_expense.payment_method, 'CASH'), '-', '_'));
  if v_method = 'BANK_TRANSFER' then v_method := 'BANK'; end if;
  if v_method = 'BANK' then
    if v_expense.bank_account_id is null then raise exception 'Select a bank account before posting this expense.' using errcode = 'P0001'; end if;
    select * into v_bank from icecream_erp.bank_accounts
    where id = v_expense.bank_account_id and organization_id = p_organization_id for update;
    if v_bank.id is null or coalesce(v_bank.is_active, true) = false or v_bank.account_id is null then
      raise exception 'Selected bank account is unavailable, inactive, or missing its linked ledger account.' using errcode = 'P0001';
    end if;
    if v_expense.branch_id is not null and v_bank.branch_id is not null and v_bank.branch_id <> v_expense.branch_id then
      raise exception 'Selected bank account does not belong to this branch.' using errcode = 'P0001';
    end if;
  else
    if v_expense.cash_account_id is null then raise exception 'Select a cash account before posting this expense.' using errcode = 'P0001'; end if;
    select * into v_cash from icecream_erp.cash_accounts
    where id = v_expense.cash_account_id and organization_id = p_organization_id for update;
    if v_cash.id is null or coalesce(v_cash.is_active, true) = false or v_cash.account_id is null then
      raise exception 'Selected cash account is unavailable, inactive, or missing its linked ledger account.' using errcode = 'P0001';
    end if;
    if v_expense.branch_id is not null and v_cash.branch_id is not null and v_cash.branch_id <> v_expense.branch_id then
      raise exception 'Selected cash account does not belong to this branch.' using errcode = 'P0001';
    end if;
    if coalesce(v_cash.current_balance, v_cash.opening_balance, 0) < v_expense.amount then
      raise exception 'Insufficient cash. Available: %, required: %.', coalesce(v_cash.current_balance, v_cash.opening_balance, 0), v_expense.amount using errcode = 'P0001';
    end if;
  end if;

  v_journal_number := icecream_erp.sales_next_document_number(p_organization_id, 'JOURNAL_ENTRY', 'JE');
  insert into icecream_erp.journal_entries (
    organization_id, entry_number, entry_date, description, reference, reference_type, reference_id, branch_id,
    status, is_posted, posted_by, posted_at, created_by, approved_by, total_debit, total_credit
  ) values (
    p_organization_id, v_journal_number, v_expense.expense_date, coalesce(v_expense.description, 'Expense payment'),
    'finance:expense:' || v_expense.id::text, 'finance_expense', v_expense.id::text, v_expense.branch_id,
    'POSTED', true, v_actor_user_account_id, now(), v_actor_user_account_id, v_actor_user_account_id,
    v_expense.amount, v_expense.amount
  ) returning id into v_journal_id;

  insert into icecream_erp.journal_entry_lines (journal_entry_id, account_id, branch_id, description, debit_amount, credit_amount)
  values
    (v_journal_id, v_expense.account_id, v_expense.branch_id, 'Expense payment', v_expense.amount, 0),
    (v_journal_id, case when v_method = 'BANK' then v_bank.account_id else v_cash.account_id end, v_expense.branch_id, 'Expense payment via ' || v_method, 0, v_expense.amount);

  v_source := 'finance:expense:' || v_expense.id::text;
  if v_method = 'BANK' then
    insert into icecream_erp.bank_transactions (
      organization_id, bank_account_id, branch_id, transaction_date, transaction_type, amount, source_document,
      source_document_type, source_document_id, reference_number, description, journal_entry_id,
      status, created_by, posted_by, posted_at
    ) values (
      p_organization_id, v_bank.id, v_expense.branch_id, v_expense.expense_date, 'PAYMENT_OUT', v_expense.amount, v_source,
      'finance_expense', v_expense.id, v_journal_number, v_expense.description, v_journal_id,
      'POSTED', v_actor_user_account_id, v_actor_user_account_id, now()
    ) returning id into v_bank_transaction_id;
    perform icecream_erp.recalculate_bank_account_balance(v_bank.id);
  else
    insert into icecream_erp.cash_transactions (
      organization_id, cash_account_id, branch_id, transaction_date, transaction_type, amount, source,
      source_document_type, source_document_id, reference, counterparty, remarks, journal_entry_id,
      status, created_by, posted_by, posted_at
    ) values (
      p_organization_id, v_cash.id, v_expense.branch_id, v_expense.expense_date, 'PAYMENT_OUT', v_expense.amount, v_source,
      'finance_expense', v_expense.id, v_journal_number, 'Expense payment', v_expense.description, v_journal_id,
      'POSTED', v_actor_user_account_id, v_actor_user_account_id, now()
    ) returning id into v_cash_transaction_id;
    perform icecream_erp.recalculate_cash_account_balance(v_cash.id);
  end if;

  update icecream_erp.finance_expenses
  set status = 'POSTED', posted_at = now(), posted_by = v_actor_user_account_id, updated_at = now(), updated_by = v_actor_user_account_id,
      journal_entry_id = v_journal_id, cash_transaction_id = v_cash_transaction_id, bank_transaction_id = v_bank_transaction_id,
      idempotency_key = coalesce(p_idempotency_key, idempotency_key)
  where id = v_expense.id;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  ) values (
    p_organization_id, v_actor_user_account_id, p_actor_user_profile_id, 'FINANCE_EXPENSE_PAYMENT_POSTED',
    'finance_expenses', v_expense.id, 'finance_expense', v_expense.id,
    jsonb_build_object('journalId', v_journal_id, 'cashAccountId', v_expense.cash_account_id, 'bankAccountId', v_expense.bank_account_id, 'amount', v_expense.amount)
  );

  return jsonb_build_object('success', true, 'expenseId', v_expense.id, 'journalId', v_journal_id, 'journalNumber', v_journal_number, 'cashTransactionId', v_cash_transaction_id, 'bankTransactionId', v_bank_transaction_id);
end;
$$;

revoke all on function icecream_erp.post_finance_expense_payment(uuid, uuid, uuid, text) from public;
grant execute on function icecream_erp.post_finance_expense_payment(uuid, uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
