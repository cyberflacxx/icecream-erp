-- Atomic customer receipt and supplier payment posting.
-- Scope is intentionally limited to icecream_erp. Run scripts/preflight-065.sql
-- and take a database backup before applying this migration in production.

set search_path = icecream_erp, public;

alter table if exists icecream_erp.payments
  add column if not exists cash_account_id uuid null,
  add column if not exists bank_account_id uuid null,
  add column if not exists journal_entry_id uuid null;

alter table if exists icecream_erp.supplier_payments
  add column if not exists branch_id uuid null,
  add column if not exists cash_account_id uuid null,
  add column if not exists bank_account_id uuid null,
  add column if not exists journal_entry_id uuid null,
  add column if not exists cash_transaction_id uuid null,
  add column if not exists bank_transaction_id uuid null,
  add column if not exists idempotency_payload_hash text null;

alter table if exists icecream_erp.cash_transactions
  add column if not exists branch_id uuid null,
  add column if not exists source_document_type text null,
  add column if not exists source_document_id uuid null,
  add column if not exists journal_entry_id uuid null;

alter table if exists icecream_erp.cash_accounts
  add column if not exists branch_id uuid null;

alter table if exists icecream_erp.bank_accounts
  add column if not exists branch_id uuid null;

alter table if exists icecream_erp.sales_payment_allocations
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by uuid null,
  add column if not exists void_reason text null;

alter table if exists icecream_erp.bank_transactions
  add column if not exists branch_id uuid null,
  add column if not exists source_document_type text null,
  add column if not exists source_document_id uuid null,
  add column if not exists journal_entry_id uuid null;

create index if not exists idx_cash_transactions_source_lookup
  on icecream_erp.cash_transactions (organization_id, cash_account_id, source)
  where source is not null;

create index if not exists idx_bank_transactions_source_lookup
  on icecream_erp.bank_transactions (organization_id, bank_account_id, source_document)
  where source_document is not null;

create index if not exists idx_supplier_payments_journal_entry
  on icecream_erp.supplier_payments (journal_entry_id)
  where journal_entry_id is not null;

create index if not exists idx_cash_accounts_branch_active
  on icecream_erp.cash_accounts (organization_id, branch_id)
  where coalesce(is_active, true);

create index if not exists idx_bank_accounts_branch_active
  on icecream_erp.bank_accounts (organization_id, branch_id)
  where coalesce(is_active, true);

create or replace function icecream_erp.recalculate_cash_account_balance(
  p_cash_account_id uuid
) returns numeric
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_balance numeric(24,4);
begin
  select coalesce(account.opening_balance, 0) + coalesce(sum(
    case
      when upper(coalesce(tx.status, 'POSTED')) in ('VOID', 'VOIDED', 'CANCELLED', 'REVERSED', 'FAILED') then 0
      when upper(coalesce(tx.transaction_type, '')) like '%OUT%'
        or upper(coalesce(tx.transaction_type, '')) like '%PAYMENT%'
        or upper(coalesce(tx.transaction_type, '')) like '%WITHDRAW%'
        or upper(coalesce(tx.transaction_type, '')) like '%DISBURSE%' then -coalesce(tx.amount, 0)
      else coalesce(tx.amount, 0)
    end
  ), 0)
  into v_balance
  from icecream_erp.cash_accounts account
  left join icecream_erp.cash_transactions tx on tx.cash_account_id = account.id
  where account.id = p_cash_account_id
  group by account.id, account.opening_balance;

  if v_balance is null then
    raise exception 'Cash account was not found.' using errcode = 'P0001';
  end if;

  update icecream_erp.cash_accounts
  set current_balance = v_balance,
      updated_at = now()
  where id = p_cash_account_id;
  return v_balance;
end;
$$;

create or replace function icecream_erp.recalculate_bank_account_balance(
  p_bank_account_id uuid
) returns numeric
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_balance numeric(24,4);
begin
  select coalesce(account.opening_balance, 0) + coalesce(sum(
    case
      when upper(coalesce(tx.status, 'POSTED')) in ('VOID', 'VOIDED', 'CANCELLED', 'REVERSED', 'FAILED') then 0
      when upper(coalesce(tx.transaction_type, '')) like '%OUT%'
        or upper(coalesce(tx.transaction_type, '')) like '%PAYMENT%'
        or upper(coalesce(tx.transaction_type, '')) like '%WITHDRAW%'
        or upper(coalesce(tx.transaction_type, '')) like '%DISBURSE%' then -coalesce(tx.amount, 0)
      else coalesce(tx.amount, 0)
    end
  ), 0)
  into v_balance
  from icecream_erp.bank_accounts account
  left join icecream_erp.bank_transactions tx on tx.bank_account_id = account.id
  where account.id = p_bank_account_id
  group by account.id, account.opening_balance;

  if v_balance is null then
    raise exception 'Bank account was not found.' using errcode = 'P0001';
  end if;

  update icecream_erp.bank_accounts
  set current_balance = v_balance,
      updated_at = now()
  where id = p_bank_account_id;
  return v_balance;
end;
$$;

create or replace function icecream_erp.post_sales_payment_transaction_v2(
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_payment_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_bank_account record;
  v_bank_account_id uuid := nullif(p_payment_payload ->> 'bankAccountId', '')::uuid;
  v_cash_account record;
  v_cash_account_id uuid := nullif(p_payment_payload ->> 'cashAccountId', '')::uuid;
  v_method text := upper(coalesce(nullif(p_payment_payload ->> 'paymentMethod', ''), 'CASH'));
  v_payment record;
  v_result jsonb;
  v_source text;
  v_tender jsonb;
  v_tender_method text;
begin
  if v_method = 'BANK_TRANSFER' then v_method := 'BANK'; end if;
  if v_method = 'CREDIT' then
    raise exception 'New credit receipts are disabled. Record a cash or bank receipt against an issued invoice.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_payment_payload -> 'tenders') = 'array' and jsonb_array_length(p_payment_payload -> 'tenders') > 0 then
    for v_tender in select value from jsonb_array_elements(p_payment_payload -> 'tenders')
    loop
      v_tender_method := upper(coalesce(v_tender ->> 'paymentMethod', v_method));
      if v_tender_method = 'BANK_TRANSFER' then v_tender_method := 'BANK'; end if;
      if v_tender_method <> v_method then
        raise exception 'Mixed-tender receipts require an account selected for each tender and cannot be posted safely.' using errcode = 'P0001';
      end if;
    end loop;
  end if;
  if v_method in ('CASH', 'PETTY_CASH') and v_cash_account_id is null then
    raise exception 'cashAccountId is required for cash receipts.' using errcode = 'P0001';
  end if;
  if v_method = 'BANK' and v_bank_account_id is null then
    raise exception 'bankAccountId is required for bank receipts.' using errcode = 'P0001';
  end if;

  if v_cash_account_id is not null then
    select * into v_cash_account
    from icecream_erp.cash_accounts
    where id = v_cash_account_id and organization_id = p_organization_id
    for update;
    if v_cash_account.id is null or coalesce(v_cash_account.is_active, true) = false or v_cash_account.account_id is null then
      raise exception 'Selected cash account is unavailable, inactive, or missing its linked ledger account.' using errcode = 'P0001';
    end if;
  end if;

  if v_bank_account_id is not null then
    select * into v_bank_account
    from icecream_erp.bank_accounts
    where id = v_bank_account_id and organization_id = p_organization_id
    for update;
    if v_bank_account.id is null or coalesce(v_bank_account.is_active, true) = false or v_bank_account.account_id is null then
      raise exception 'Selected bank account is unavailable, inactive, or missing its linked ledger account.' using errcode = 'P0001';
    end if;
  end if;

  v_result := icecream_erp.post_sales_payment_transaction(p_organization_id, p_actor_user_profile_id, p_payment_payload);

  select * into v_payment
  from icecream_erp.payments
  where id = (v_result ->> 'paymentId')::uuid
    and organization_id = p_organization_id
  for update;
  if v_payment.id is null then
    raise exception 'Customer receipt was not created.' using errcode = 'P0001';
  end if;

  if v_method in ('CASH', 'PETTY_CASH')
     and v_payment.branch_id is not null
     and v_cash_account.branch_id is not null
     and v_cash_account.branch_id <> v_payment.branch_id then
    raise exception 'Selected cash account is not authorized for the receipt branch.' using errcode = 'P0001';
  end if;
  if v_method = 'BANK'
     and v_payment.branch_id is not null
     and v_bank_account.branch_id is not null
     and v_bank_account.branch_id <> v_payment.branch_id then
    raise exception 'Selected bank account is not authorized for the receipt branch.' using errcode = 'P0001';
  end if;

  update icecream_erp.payments
  set cash_account_id = case when v_method in ('CASH', 'PETTY_CASH') then v_cash_account_id else null end,
      bank_account_id = case when v_method = 'BANK' then v_bank_account_id else null end,
      journal_entry_id = nullif(v_result ->> 'journalId', '')::uuid,
      updated_at = now()
  where id = v_payment.id;

  -- The original engine creates the receipt journal. Replace the debit tender
  -- line with the actual selected account rather than a generic control account.
  if v_method in ('CASH', 'PETTY_CASH') then
    update icecream_erp.journal_entry_lines
    set account_id = v_cash_account.account_id
    where journal_entry_id = nullif(v_result ->> 'journalId', '')::uuid
      and debit_amount > 0;
  elsif v_method = 'BANK' then
    update icecream_erp.journal_entry_lines
    set account_id = v_bank_account.account_id
    where journal_entry_id = nullif(v_result ->> 'journalId', '')::uuid
      and debit_amount > 0;
  end if;

  v_source := 'sales:invoice_payment:' || v_payment.id::text;
  if v_method in ('CASH', 'PETTY_CASH') then
    if not exists (
      select 1 from icecream_erp.cash_transactions
      where organization_id = p_organization_id and cash_account_id = v_cash_account_id and source = v_source
    ) then
      insert into icecream_erp.cash_transactions (
        organization_id, cash_account_id, branch_id, transaction_date, transaction_type, amount,
        source, source_document_type, source_document_id, reference, counterparty, remarks,
        journal_entry_id, status, created_by, posted_by, posted_at
      ) values (
        p_organization_id, v_cash_account_id, v_payment.branch_id, v_payment.payment_date,
        case when v_method = 'PETTY_CASH' then 'PETTY_CASH_IN' else 'RECEIPT' end, v_payment.amount,
        v_source, 'invoice_payment', v_payment.id, v_payment.reference_number,
        'Customer receipt', v_payment.notes, nullif(v_result ->> 'journalId', '')::uuid,
        'POSTED', v_payment.created_by, v_payment.created_by, now()
      );
    end if;
    perform icecream_erp.recalculate_cash_account_balance(v_cash_account_id);
  elsif v_method = 'BANK' then
    if not exists (
      select 1 from icecream_erp.bank_transactions
      where organization_id = p_organization_id and bank_account_id = v_bank_account_id and source_document = v_source
    ) then
      insert into icecream_erp.bank_transactions (
        organization_id, bank_account_id, branch_id, transaction_date, transaction_type, amount,
        source_document, source_document_type, source_document_id, reference_number, description,
        journal_entry_id, status, created_by, posted_by, posted_at
      ) values (
        p_organization_id, v_bank_account_id, v_payment.branch_id, v_payment.payment_date,
        'RECEIPT', v_payment.amount, v_source, 'invoice_payment', v_payment.id,
        v_payment.reference_number, v_payment.notes, nullif(v_result ->> 'journalId', '')::uuid,
        'POSTED', v_payment.created_by, v_payment.created_by, now()
      );
    end if;
    perform icecream_erp.recalculate_bank_account_balance(v_bank_account_id);
  end if;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  ) values (
    p_organization_id, v_payment.created_by, p_actor_user_profile_id, 'SALES_RECEIPT_CASH_BANK_POSTED',
    'payments', v_payment.id, 'payment', v_payment.id,
    jsonb_build_object('cashAccountId', v_cash_account_id, 'bankAccountId', v_bank_account_id, 'journalId', v_result ->> 'journalId')
  );

  return v_result || jsonb_build_object('cashAccountId', v_cash_account_id, 'bankAccountId', v_bank_account_id, 'sourceReference', v_source);
end;
$$;

create or replace function icecream_erp.post_supplier_payment_transaction(
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_payment_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_actor_user_account_id uuid;
  v_amount numeric(24,4) := coalesce((p_payment_payload ->> 'amountPaid')::numeric, (p_payment_payload ->> 'amount')::numeric, 0);
  v_bank record;
  v_bank_id uuid := nullif(coalesce(p_payment_payload ->> 'bankAccountId', p_payment_payload ->> 'bank_account_id'), '')::uuid;
  v_branch_id uuid := nullif(coalesce(p_payment_payload ->> 'branchId', p_payment_payload ->> 'branch_id'), '')::uuid;
  v_cash record;
  v_cash_id uuid := nullif(coalesce(p_payment_payload ->> 'cashAccountId', p_payment_payload ->> 'cash_account_id'), '')::uuid;
  v_cash_transaction_id uuid;
  v_bank_transaction_id uuid;
  v_hash text;
  v_idempotency_key text := nullif(p_payment_payload ->> 'idempotencyKey', '');
  v_invoice record;
  v_journal_id uuid;
  v_journal_number text;
  v_method text := upper(replace(coalesce(p_payment_payload ->> 'paymentMethod', p_payment_payload ->> 'paymentSourceType', ''), '-', '_'));
  v_outstanding numeric(24,4);
  v_payment record;
  v_payable_account_id uuid;
  v_source text;
  v_supplier record;
  v_tender_account_id uuid;
begin
  if v_method = 'BANK_TRANSFER' then v_method := 'BANK'; end if;
  if v_method not in ('CASH', 'BANK', 'MOBILE_MONEY', 'PETTY_CASH') then
    raise exception 'Payment source must be CASH, BANK, MOBILE_MONEY, or PETTY_CASH.' using errcode = 'P0001';
  end if;
  if v_amount <= 0 then raise exception 'Supplier payment amount must be greater than zero.' using errcode = 'P0001'; end if;
  if v_idempotency_key is null then raise exception 'idempotencyKey is required for supplier payments.' using errcode = 'P0001'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_idempotency_key, 0));

  select user_account_id into v_actor_user_account_id
  from icecream_erp.users where id = p_actor_user_profile_id and status = 'active' limit 1;
  if v_actor_user_account_id is null and exists (select 1 from icecream_erp.user_accounts where id = p_actor_user_profile_id and organization_id = p_organization_id) then
    v_actor_user_account_id := p_actor_user_profile_id;
  end if;
  if v_actor_user_account_id is null then raise exception 'Active actor account was not found.' using errcode = 'P0001'; end if;

  v_hash := encode(extensions.digest(convert_to(p_payment_payload::text, 'UTF8'), 'sha256'), 'hex');
  select * into v_payment from icecream_erp.supplier_payments
  where organization_id = p_organization_id and idempotency_key = v_idempotency_key limit 1;
  if v_payment.id is not null then
    if v_payment.idempotency_payload_hash is not null and v_payment.idempotency_payload_hash <> v_hash then
      raise exception 'Idempotency key was already used with a different supplier payment payload.' using errcode = 'P0001';
    end if;
    if upper(coalesce(v_payment.status, '')) = 'POSTED' then
      return jsonb_build_object('success', true, 'idempotentReplay', true, 'paymentId', v_payment.id, 'journalId', v_payment.journal_entry_id, 'sourceReference', 'procurement:supplier_payment:' || v_payment.id::text);
    end if;
    raise exception 'A supplier payment with this idempotency key is pending or failed and requires review.' using errcode = 'P0001';
  end if;

  select * into v_invoice from icecream_erp.supplier_invoices
  where id = (p_payment_payload ->> 'supplierInvoiceId')::uuid and organization_id = p_organization_id and deleted_at is null
  for update;
  if v_invoice.id is null then raise exception 'Supplier invoice not found.' using errcode = 'P0001'; end if;
  if upper(coalesce(v_invoice.status, '')) in ('CANCELLED', 'VOIDED') then raise exception 'Cannot pay a cancelled supplier invoice.' using errcode = 'P0001'; end if;
  if nullif(p_payment_payload ->> 'supplierId', '')::uuid is distinct from v_invoice.supplier_id then raise exception 'Selected supplier invoice does not belong to the selected supplier.' using errcode = 'P0001'; end if;
  perform icecream_erp.sales_assert_open_period(
    p_organization_id,
    coalesce(nullif(p_payment_payload ->> 'paymentDate', '')::date, current_date)
  );

  select * into v_supplier from icecream_erp.suppliers where id = v_invoice.supplier_id and organization_id = p_organization_id for update;
  if v_supplier.id is null then raise exception 'Supplier not found.' using errcode = 'P0001'; end if;
  v_outstanding := coalesce(v_invoice.outstanding_amount, v_invoice.invoice_total, 0);
  if v_amount > v_outstanding then raise exception 'Supplier payment amount exceeds the invoice balance.' using errcode = 'P0001'; end if;

  if v_method = 'BANK' then
    if v_bank_id is null then raise exception 'bankAccountId is required for bank supplier payments.' using errcode = 'P0001'; end if;
    select * into v_bank from icecream_erp.bank_accounts where id = v_bank_id and organization_id = p_organization_id for update;
    if v_bank.id is null or coalesce(v_bank.is_active, true) = false or v_bank.account_id is null then raise exception 'Selected bank account is unavailable, inactive, or missing its linked ledger account.' using errcode = 'P0001'; end if;
    if v_branch_id is not null and v_bank.branch_id is not null and v_bank.branch_id <> v_branch_id then raise exception 'Selected bank account is not authorized for the payment branch.' using errcode = 'P0001'; end if;
    v_tender_account_id := v_bank.account_id;
  elsif v_method in ('CASH', 'MOBILE_MONEY') then
    if v_cash_id is null then raise exception 'cashAccountId is required for cash supplier payments.' using errcode = 'P0001'; end if;
    select * into v_cash from icecream_erp.cash_accounts where id = v_cash_id and organization_id = p_organization_id for update;
    if v_cash.id is null or coalesce(v_cash.is_active, true) = false or v_cash.account_id is null then raise exception 'Selected cash account is unavailable, inactive, or missing its linked ledger account.' using errcode = 'P0001'; end if;
    if v_branch_id is not null and v_cash.branch_id is not null and v_cash.branch_id <> v_branch_id then raise exception 'Selected cash account is not authorized for the payment branch.' using errcode = 'P0001'; end if;
    if coalesce(v_cash.current_balance, v_cash.opening_balance, 0) < v_amount then raise exception 'Insufficient cash balance in the selected cash account.' using errcode = 'P0001'; end if;
    v_tender_account_id := v_cash.account_id;
  else
    raise exception 'Petty cash supplier payments require a configured petty-cash payment workflow.' using errcode = 'P0001';
  end if;

  select id into v_payable_account_id from icecream_erp.accounts
  where organization_id = p_organization_id and code = '2110' and is_active = true limit 1;
  if v_payable_account_id is null then raise exception 'Active Supplier Payables account 2110 is not configured.' using errcode = 'P0001'; end if;

  v_journal_number := icecream_erp.sales_next_document_number(p_organization_id, 'JOURNAL_ENTRY', 'JE');
  insert into icecream_erp.supplier_payments (
    organization_id, supplier_id, supplier_invoice_id, branch_id, payment_date, payment_method, payment_source_type,
    reference_number, amount_paid, status, purchase_order_id, goods_received_note_id, grn_id,
    cash_account_id, bank_account_id, idempotency_key, idempotency_payload_hash, remarks, created_by, updated_by
  ) values (
    p_organization_id, v_invoice.supplier_id, v_invoice.id, v_branch_id,
    coalesce(nullif(p_payment_payload ->> 'paymentDate', '')::date, current_date), v_method, v_method,
    nullif(p_payment_payload ->> 'referenceNumber', ''), v_amount, 'POSTED',
    coalesce(nullif(p_payment_payload ->> 'purchaseOrderId', '')::uuid, v_invoice.purchase_order_id),
    coalesce(nullif(p_payment_payload ->> 'goodsReceivedNoteId', '')::uuid, v_invoice.goods_received_note_id),
    coalesce(nullif(p_payment_payload ->> 'grnId', '')::uuid, v_invoice.grn_id),
    case when v_method in ('CASH', 'MOBILE_MONEY') then v_cash_id else null end,
    case when v_method = 'BANK' then v_bank_id else null end,
    v_idempotency_key, v_hash, nullif(p_payment_payload ->> 'remarks', ''), v_actor_user_account_id, v_actor_user_account_id
  ) returning * into v_payment;

  insert into icecream_erp.journal_entries (
    organization_id, entry_number, entry_date, description, reference, reference_type, reference_id, branch_id,
    status, is_posted, posted_by, posted_at, created_by, approved_by, total_debit, total_credit
  ) values (
    p_organization_id, v_journal_number, v_payment.payment_date, 'Supplier payment ' || coalesce(v_payment.reference_number, v_payment.id::text),
    'procurement:supplier_payment:' || v_payment.id::text, 'supplier_payment', v_payment.id::text, v_branch_id,
    'POSTED', true, v_actor_user_account_id, now(), v_actor_user_account_id, v_actor_user_account_id, v_amount, v_amount
  ) returning id into v_journal_id;

  insert into icecream_erp.journal_entry_lines (journal_entry_id, account_id, branch_id, description, debit_amount, credit_amount)
  values
    (v_journal_id, v_payable_account_id, v_branch_id, 'Reduce accounts payable for supplier invoice ' || v_invoice.invoice_number, v_amount, 0),
    (v_journal_id, v_tender_account_id, v_branch_id, 'Supplier payment via ' || v_method, 0, v_amount);

  v_source := 'procurement:supplier_payment:' || v_payment.id::text;
  if v_method in ('CASH', 'MOBILE_MONEY') then
    insert into icecream_erp.cash_transactions (
      organization_id, cash_account_id, branch_id, transaction_date, transaction_type, amount, source,
      source_document_type, source_document_id, reference, counterparty, remarks, journal_entry_id,
      status, created_by, posted_by, posted_at
    ) values (
      p_organization_id, v_cash_id, v_branch_id, v_payment.payment_date, 'PAYMENT_OUT', v_amount, v_source,
      'supplier_payment', v_payment.id, v_payment.reference_number, 'Supplier payment', v_payment.remarks, v_journal_id,
      'POSTED', v_actor_user_account_id, v_actor_user_account_id, now()
    ) returning id into v_cash_transaction_id;
    perform icecream_erp.recalculate_cash_account_balance(v_cash_id);
  else
    insert into icecream_erp.bank_transactions (
      organization_id, bank_account_id, branch_id, transaction_date, transaction_type, amount, source_document,
      source_document_type, source_document_id, reference_number, description, journal_entry_id,
      status, created_by, posted_by, posted_at
    ) values (
      p_organization_id, v_bank_id, v_branch_id, v_payment.payment_date, 'PAYMENT_OUT', v_amount, v_source,
      'supplier_payment', v_payment.id, v_payment.reference_number, 'Supplier payment', v_journal_id,
      'POSTED', v_actor_user_account_id, v_actor_user_account_id, now()
    ) returning id into v_bank_transaction_id;
    perform icecream_erp.recalculate_bank_account_balance(v_bank_id);
  end if;

  update icecream_erp.supplier_invoices
  set outstanding_amount = greatest(0, v_outstanding - v_amount),
      status = case when greatest(0, v_outstanding - v_amount) = 0 then 'PAID' else 'PARTIAL_PAID' end,
      updated_at = now()
  where id = v_invoice.id;
  update icecream_erp.suppliers
  set current_balance = greatest(0, coalesce(current_balance, 0) - v_amount), updated_at = now()
  where id = v_supplier.id;
  update icecream_erp.supplier_payments
  set journal_entry_id = v_journal_id,
      cash_transaction_id = v_cash_transaction_id,
      bank_transaction_id = v_bank_transaction_id,
      updated_at = now()
  where id = v_payment.id;

  insert into icecream_erp.audit_logs (organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values)
  values (
    p_organization_id, v_actor_user_account_id, p_actor_user_profile_id, 'SUPPLIER_PAYMENT_TRANSACTION_POSTED',
    'supplier_payments', v_payment.id, 'supplier_payment', v_payment.id,
    jsonb_build_object('invoiceId', v_invoice.id, 'journalId', v_journal_id, 'cashAccountId', v_cash_id, 'bankAccountId', v_bank_id, 'amount', v_amount)
  );

  return jsonb_build_object('success', true, 'paymentId', v_payment.id, 'journalId', v_journal_id, 'journalNumber', v_journal_number, 'sourceReference', v_source);
end;
$$;

create or replace function icecream_erp.void_sales_payment_transaction(
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_payment_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_actor_user_account_id uuid;
  v_bank record;
  v_cash record;
  v_customer record;
  v_invoice record;
  v_line record;
  v_original_journal record;
  v_payment record;
  v_reversal_journal_id uuid;
  v_reversal_journal_number text;
  v_remaining_paid numeric(24,4);
  v_remaining_balance numeric(24,4);
  v_status text;
  v_source text;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'A reason is required to void a posted receipt.' using errcode = 'P0001';
  end if;

  select user_account_id into v_actor_user_account_id
  from icecream_erp.users where id = p_actor_user_profile_id and status = 'active' limit 1;
  if v_actor_user_account_id is null and exists (
    select 1 from icecream_erp.user_accounts where id = p_actor_user_profile_id and organization_id = p_organization_id
  ) then
    v_actor_user_account_id := p_actor_user_profile_id;
  end if;
  if v_actor_user_account_id is null then
    raise exception 'Active actor account was not found.' using errcode = 'P0001';
  end if;

  select * into v_payment
  from icecream_erp.payments
  where id = p_payment_id and organization_id = p_organization_id
  for update;
  if v_payment.id is null then raise exception 'Receipt was not found.' using errcode = 'P0001'; end if;
  if upper(coalesce(v_payment.status, '')) in ('VOID', 'VOIDED', 'CANCELLED', 'REVERSED') then
    raise exception 'Receipt is already voided.' using errcode = 'P0001';
  end if;
  if upper(coalesce(v_payment.status, '')) <> 'PAID' then
    raise exception 'Only posted receipts can be voided.' using errcode = 'P0001';
  end if;
  perform icecream_erp.sales_assert_open_period(p_organization_id, current_date);

  select * into v_invoice from icecream_erp.invoices
  where id = v_payment.invoice_id and organization_id = p_organization_id
  for update;
  if v_invoice.id is null then raise exception 'Receipt invoice was not found.' using errcode = 'P0001'; end if;
  select * into v_customer from icecream_erp.customers
  where id = v_payment.customer_id and organization_id = p_organization_id
  for update;
  if v_customer.id is null then raise exception 'Receipt customer was not found.' using errcode = 'P0001'; end if;

  select * into v_original_journal
  from icecream_erp.journal_entries
  where id = v_payment.journal_entry_id
    and organization_id = p_organization_id
  limit 1;
  if v_original_journal.id is null then
    select * into v_original_journal
    from icecream_erp.journal_entries
    where organization_id = p_organization_id
      and reference_type = 'invoice_payment'
      and reference_id = v_payment.id::text
    order by created_at desc
    limit 1;
  end if;
  if v_original_journal.id is null then
    raise exception 'Receipt journal was not found; the receipt cannot be voided safely.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from icecream_erp.journal_entries
    where organization_id = p_organization_id
      and reference_type = 'invoice_payment_void'
      and reference_id = v_payment.id::text
  ) then
    raise exception 'Receipt journal reversal already exists.' using errcode = 'P0001';
  end if;

  v_reversal_journal_number := icecream_erp.sales_next_document_number(p_organization_id, 'JOURNAL_ENTRY', 'JE');
  insert into icecream_erp.journal_entries (
    organization_id, entry_number, entry_date, description, reference, reference_type, reference_id, branch_id,
    status, is_posted, posted_by, posted_at, created_by, approved_by, total_debit, total_credit
  ) values (
    p_organization_id, v_reversal_journal_number, current_date,
    'Void customer receipt ' || coalesce(v_payment.payment_number, v_payment.id::text),
    'sales:invoice_payment_void:' || v_payment.id::text, 'invoice_payment_void', v_payment.id::text, v_payment.branch_id,
    'POSTED', true, v_actor_user_account_id, now(), v_actor_user_account_id, v_actor_user_account_id,
    v_original_journal.total_credit, v_original_journal.total_debit
  ) returning id into v_reversal_journal_id;

  for v_line in
    select * from icecream_erp.journal_entry_lines where journal_entry_id = v_original_journal.id order by created_at, id
  loop
    insert into icecream_erp.journal_entry_lines (
      journal_entry_id, account_id, branch_id, department_id, cost_center_code, description, debit_amount, credit_amount
    ) values (
      v_reversal_journal_id, v_line.account_id, v_line.branch_id, v_line.department_id, v_line.cost_center_code,
      'Reversal: ' || coalesce(v_line.description, 'Customer receipt'), coalesce(v_line.credit_amount, 0), coalesce(v_line.debit_amount, 0)
    );
  end loop;

  if v_payment.cash_account_id is not null then
    select * into v_cash from icecream_erp.cash_accounts
    where id = v_payment.cash_account_id and organization_id = p_organization_id for update;
    if v_cash.id is null then raise exception 'Receipt cash account was not found.' using errcode = 'P0001'; end if;
    v_source := 'sales:invoice_payment_void:' || v_payment.id::text;
    if not exists (select 1 from icecream_erp.cash_transactions where organization_id = p_organization_id and cash_account_id = v_cash.id and source = v_source) then
      insert into icecream_erp.cash_transactions (
        organization_id, cash_account_id, branch_id, transaction_date, transaction_type, amount, source,
        source_document_type, source_document_id, reference, counterparty, remarks, journal_entry_id,
        status, created_by, posted_by, posted_at
      ) values (
        p_organization_id, v_cash.id, v_payment.branch_id, current_date, 'PAYMENT_OUT', v_payment.amount, v_source,
        'invoice_payment_void', v_payment.id, v_payment.reference_number, 'Customer receipt void', p_reason,
        v_reversal_journal_id, 'POSTED', v_actor_user_account_id, v_actor_user_account_id, now()
      );
    end if;
    perform icecream_erp.recalculate_cash_account_balance(v_cash.id);
  elsif v_payment.bank_account_id is not null then
    select * into v_bank from icecream_erp.bank_accounts
    where id = v_payment.bank_account_id and organization_id = p_organization_id for update;
    if v_bank.id is null then raise exception 'Receipt bank account was not found.' using errcode = 'P0001'; end if;
    v_source := 'sales:invoice_payment_void:' || v_payment.id::text;
    if not exists (select 1 from icecream_erp.bank_transactions where organization_id = p_organization_id and bank_account_id = v_bank.id and source_document = v_source) then
      insert into icecream_erp.bank_transactions (
        organization_id, bank_account_id, branch_id, transaction_date, transaction_type, amount, source_document,
        source_document_type, source_document_id, reference_number, description, journal_entry_id,
        status, created_by, posted_by, posted_at
      ) values (
        p_organization_id, v_bank.id, v_payment.branch_id, current_date, 'PAYMENT_OUT', v_payment.amount, v_source,
        'invoice_payment_void', v_payment.id, v_payment.reference_number, 'Customer receipt void: ' || p_reason,
        v_reversal_journal_id, 'POSTED', v_actor_user_account_id, v_actor_user_account_id, now()
      );
    end if;
    perform icecream_erp.recalculate_bank_account_balance(v_bank.id);
  else
    raise exception 'Receipt is not linked to a cash or bank account and cannot be voided safely.' using errcode = 'P0001';
  end if;

  update icecream_erp.sales_payment_allocations
  set voided_at = now(), voided_by = v_actor_user_account_id, void_reason = p_reason
  where payment_id = v_payment.id and voided_at is null;

  v_remaining_paid := greatest(0, coalesce(v_invoice.amount_paid, v_invoice.paid_amount, 0) - v_payment.amount);
  v_remaining_balance := greatest(0, coalesce(v_invoice.total, v_invoice.total_amount, 0) - v_remaining_paid);
  v_status := case when v_remaining_paid > 0 then 'PARTIAL_PAID' else 'SENT' end;
  update icecream_erp.invoices
  set amount_paid = v_remaining_paid, paid_amount = v_remaining_paid, balance_due = v_remaining_balance,
      status = v_status::icecream_erp.invoice_status, updated_at = now()
  where id = v_invoice.id;
  update icecream_erp.customers
  set current_balance = coalesce(current_balance, 0) + v_payment.amount,
      outstanding_balance = coalesce(outstanding_balance, 0) + v_payment.amount,
      updated_at = now()
  where id = v_customer.id;
  update icecream_erp.payments
  set status = 'VOIDED', notes = concat_ws(E'\n', notes, 'VOIDED: ' || p_reason), updated_at = now()
  where id = v_payment.id;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  ) values (
    p_organization_id, v_actor_user_account_id, p_actor_user_profile_id, 'SALES_RECEIPT_VOIDED',
    'payments', v_payment.id, 'payment', v_payment.id,
    jsonb_build_object('reason', p_reason, 'reversalJournalId', v_reversal_journal_id, 'cashAccountId', v_payment.cash_account_id, 'bankAccountId', v_payment.bank_account_id)
  );

  return jsonb_build_object('success', true, 'paymentId', v_payment.id, 'reversalJournalId', v_reversal_journal_id, 'reversalJournalNumber', v_reversal_journal_number);
end;
$$;

revoke all on function icecream_erp.recalculate_cash_account_balance(uuid) from public;
revoke all on function icecream_erp.recalculate_bank_account_balance(uuid) from public;
revoke all on function icecream_erp.post_sales_payment_transaction_v2(uuid, uuid, jsonb) from public;
revoke all on function icecream_erp.post_supplier_payment_transaction(uuid, uuid, jsonb) from public;
revoke all on function icecream_erp.void_sales_payment_transaction(uuid, uuid, uuid, text) from public;
grant execute on function icecream_erp.recalculate_cash_account_balance(uuid) to service_role;
grant execute on function icecream_erp.recalculate_bank_account_balance(uuid) to service_role;
grant execute on function icecream_erp.post_sales_payment_transaction_v2(uuid, uuid, jsonb) to service_role;
grant execute on function icecream_erp.post_supplier_payment_transaction(uuid, uuid, jsonb) to service_role;
grant execute on function icecream_erp.void_sales_payment_transaction(uuid, uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
