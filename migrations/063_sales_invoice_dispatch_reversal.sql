-- Atomic posted sales invoice / dispatch cancellation and reversal.
-- Additive only. Do not execute before review and production backup.

set search_path = icecream_erp, public;

create or replace function icecream_erp.cancel_sales_invoice_transaction(
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_invoice_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_actor_user_account_id uuid;
  v_dispatch record;
  v_dispatch_count integer := 0;
  v_duplicate_journal_count integer := 0;
  v_duplicate_stock_count integer := 0;
  v_invoice record;
  v_invoice_journal record;
  v_line record;
  v_movement record;
  v_original_journal_ids uuid[] := array[]::uuid[];
  v_original_movement_ids uuid[] := array[]::uuid[];
  v_payment_count integer := 0;
  v_reversal_journal_id uuid;
  v_reversal_journal_number text;
  v_reversal_movement_ids uuid[] := array[]::uuid[];
  v_reversal_movement_id uuid;
  v_total_credit numeric(18,4) := 0;
  v_total_debit numeric(18,4) := 0;
begin
  if p_organization_id is null or p_actor_user_profile_id is null or p_invoice_id is null then
    raise exception 'Organization, actor, and invoice are required.' using errcode = 'P0001';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Cancellation reason is required.' using errcode = 'P0001';
  end if;

  select user_account_id
    into v_actor_user_account_id
  from icecream_erp.users
  where id = p_actor_user_profile_id
    and status = 'active'
  limit 1;

  if v_actor_user_account_id is null
     and exists (select 1 from icecream_erp.user_accounts where id = p_actor_user_profile_id and organization_id = p_organization_id) then
    v_actor_user_account_id := p_actor_user_profile_id;
  end if;

  if v_actor_user_account_id is null then
    raise exception 'Active actor account was not found.' using errcode = 'P0001';
  end if;

  select *
    into v_invoice
  from icecream_erp.invoices
  where id = p_invoice_id
    and organization_id = p_organization_id
  for update;

  if v_invoice.id is null then
    raise exception 'Invoice not found.' using errcode = 'P0002';
  end if;

  if upper(coalesce(v_invoice.status::text, '')) in ('CANCELLED', 'VOIDED', 'REVERSED') then
    raise exception 'Invoice has already been cancelled.' using errcode = 'P0001';
  end if;

  select count(*)
    into v_payment_count
  from icecream_erp.payments pay
  where pay.organization_id = p_organization_id
    and pay.invoice_id = p_invoice_id
    and coalesce(pay.deleted_at, 'infinity'::timestamptz) = 'infinity'::timestamptz
    and upper(coalesce(pay.status, '')) not in ('CANCELLED', 'VOIDED', 'REVERSED', 'DELETED')
    and coalesce(pay.amount, 0) > 0;

  v_payment_count := v_payment_count + (
    select count(*)
    from icecream_erp.sales_payment_allocations allocation
    join icecream_erp.payments payment on payment.id = allocation.payment_id
    where allocation.organization_id = p_organization_id
      and allocation.invoice_id = p_invoice_id
      and upper(coalesce(payment.status, '')) not in ('CANCELLED', 'VOIDED', 'REVERSED', 'DELETED')
      and coalesce(allocation.allocated_amount, 0) > 0
  );

  if v_payment_count > 0 or coalesce(v_invoice.amount_paid, v_invoice.paid_amount, 0) > 0 then
    raise exception 'This invoice has posted payments. Reverse or unallocate the payments before cancelling the invoice.' using errcode = 'P0001';
  end if;

  select *
    into v_invoice_journal
  from icecream_erp.journal_entries
  where organization_id = p_organization_id
    and reference_type = 'sales_invoice'
    and reference_id = p_invoice_id::text
  order by created_at desc
  limit 1;

  if v_invoice_journal.id is not null then
    v_original_journal_ids := array_append(v_original_journal_ids, v_invoice_journal.id);
  end if;

  for v_dispatch in
    select *
    from icecream_erp.sales_dispatch_notes
    where organization_id = p_organization_id
      and invoice_id = p_invoice_id
      and upper(coalesce(status, '')) not in ('CANCELLED', 'VOIDED', 'REVERSED')
    for update
  loop
    v_dispatch_count := v_dispatch_count + 1;

    for v_movement in
      select *
      from icecream_erp.stock_movements
      where organization_id = p_organization_id
        and movement_type = 'SALES_ISSUE'
        and (
          (reference_type = 'sales_dispatch' and reference_id = v_dispatch.id) or
          (source_document_type = 'sales_dispatch' and source_document_id = v_dispatch.id)
        )
        and reversal_of_movement_id is null
      for update
    loop
      v_original_movement_ids := array_append(v_original_movement_ids, v_movement.id);
    end loop;

    if upper(coalesce(v_dispatch.status, '')) = 'POSTED'
       and not exists (
         select 1
         from icecream_erp.stock_movements
         where organization_id = p_organization_id
           and movement_type = 'SALES_ISSUE'
           and (
             (reference_type = 'sales_dispatch' and reference_id = v_dispatch.id) or
             (source_document_type = 'sales_dispatch' and source_document_id = v_dispatch.id)
           )
       ) then
      raise exception 'Posted dispatch is missing linked stock movement and cannot be cancelled safely.' using errcode = 'P0001';
    end if;

    select id
      into v_invoice_journal
    from icecream_erp.journal_entries
    where organization_id = p_organization_id
      and reference_type = 'sales_dispatch'
      and reference_id = v_dispatch.id::text
    order by created_at desc
    limit 1;

    if v_invoice_journal.id is not null then
      v_original_journal_ids := array_append(v_original_journal_ids, v_invoice_journal.id);
    elsif upper(coalesce(v_dispatch.status, '')) = 'POSTED' then
      raise exception 'Posted dispatch is missing linked journal and cannot be cancelled safely.' using errcode = 'P0001';
    end if;
  end loop;

  for v_movement in
    select *
    from icecream_erp.stock_movements
    where organization_id = p_organization_id
      and movement_type = 'SALES_ISSUE'
      and (
        (reference_type = 'sales_invoice' and reference_id = p_invoice_id) or
        (source_document_type = 'sales_invoice' and source_document_id = p_invoice_id)
      )
      and reversal_of_movement_id is null
    for update
  loop
    v_original_movement_ids := array_append(v_original_movement_ids, v_movement.id);
  end loop;

  if v_original_journal_ids = array[]::uuid[]
     and upper(coalesce(v_invoice.status::text, '')) not in ('DRAFT', 'PENDING') then
    raise exception 'Original invoice journal was not found.' using errcode = 'P0001';
  end if;

  if v_original_movement_ids <> array[]::uuid[] then
    select count(*)
      into v_duplicate_stock_count
    from icecream_erp.stock_movements
    where organization_id = p_organization_id
      and reversal_of_movement_id = any(v_original_movement_ids);
    if v_duplicate_stock_count > 0 then
      raise exception 'Stock reversal already exists for this invoice.' using errcode = 'P0001';
    end if;
  end if;

  select count(*)
    into v_duplicate_journal_count
  from icecream_erp.journal_entries
  where organization_id = p_organization_id
    and reference_type = 'sales_invoice_cancellation'
    and reference_id = p_invoice_id::text;
  if v_duplicate_journal_count > 0 then
    raise exception 'Journal reversal already exists for this invoice.' using errcode = 'P0001';
  end if;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id, v_actor_user_account_id, p_actor_user_profile_id,
    'INVOICE_CANCELLATION_STARTED', 'invoices', p_invoice_id, 'sales_invoice', p_invoice_id,
    jsonb_build_object('reason', p_reason, 'status', v_invoice.status)
  );

  for v_movement in
    select *
    from icecream_erp.stock_movements
    where id = any(v_original_movement_ids)
    order by created_at, id
    for update
  loop
    update icecream_erp.stock_balances
    set quantity = coalesce(quantity, quantity_on_hand, 0) + coalesce(v_movement.quantity, 0),
        quantity_on_hand = coalesce(quantity_on_hand, quantity, 0) + coalesce(v_movement.quantity, 0),
        quantity_available = coalesce(quantity_available, quantity_on_hand, quantity, 0) + coalesce(v_movement.quantity, 0),
        total_value = coalesce(total_value, 0) + coalesce(v_movement.total_cost, v_movement.total_value, 0),
        last_updated = now(),
        updated_at = now()
    where organization_id = p_organization_id
      and item_id = v_movement.item_id
      and warehouse_id = v_movement.warehouse_id;

    if not found then
      raise exception 'Stock balance was not found for reversal movement %.', v_movement.id using errcode = 'P0001';
    end if;

    insert into icecream_erp.stock_movements (
      organization_id, item_id, warehouse_id, movement_type, quantity, unit_cost, total_cost, total_value,
      reference_type, reference_id, source_document_type, source_document_id, reference_number, notes,
      created_by, running_balance, reversal_of_movement_id, reversal_reference
    )
    select
      p_organization_id, v_movement.item_id, v_movement.warehouse_id, 'RETURN_IN',
      coalesce(v_movement.quantity, 0), coalesce(v_movement.unit_cost, 0),
      coalesce(v_movement.total_cost, v_movement.total_value, 0),
      coalesce(v_movement.total_cost, v_movement.total_value, 0),
      'sales_invoice_cancellation', v_movement.id, 'sales_invoice_cancellation', p_invoice_id,
      coalesce(v_invoice.invoice_number, p_invoice_id::text),
      'Reversal: ' || p_reason,
      v_actor_user_account_id,
      coalesce(balance.quantity_on_hand, balance.quantity, 0),
      v_movement.id,
      'sales_invoice_cancellation:' || p_invoice_id::text
    from icecream_erp.stock_balances balance
    where balance.organization_id = p_organization_id
      and balance.item_id = v_movement.item_id
      and balance.warehouse_id = v_movement.warehouse_id
    returning id into v_reversal_movement_id;

    v_reversal_movement_ids := array_append(v_reversal_movement_ids, v_reversal_movement_id);
  end loop;

  if v_original_journal_ids <> array[]::uuid[] then
    v_reversal_journal_number := icecream_erp.sales_next_document_number(p_organization_id, 'JOURNAL_ENTRY', 'REV');

    select
      coalesce(sum(line.credit_amount), 0),
      coalesce(sum(line.debit_amount), 0)
      into v_total_debit, v_total_credit
    from icecream_erp.journal_entry_lines line
    where line.journal_entry_id = any(v_original_journal_ids);

    if round(v_total_debit::numeric, 4) <> round(v_total_credit::numeric, 4) then
      raise exception 'Reversal journal is not balanced.' using errcode = 'P0001';
    end if;
    if v_total_debit <= 0 then
      raise exception 'Original journal lines were not found.' using errcode = 'P0001';
    end if;

    insert into icecream_erp.journal_entries (
      organization_id, entry_number, entry_date, description, reference, reference_type, reference_id,
      branch_id, department_id, cost_center_code, currency_code, exchange_rate,
      status, is_posted, posted_by, posted_at, created_by, approved_by, total_debit, total_credit
    )
    values (
      p_organization_id, v_reversal_journal_number, current_date,
      'Reversal of sales invoice ' || coalesce(v_invoice.invoice_number, p_invoice_id::text),
      'sales:sales_invoice_cancellation:' || p_invoice_id::text,
      'sales_invoice_cancellation',
      p_invoice_id::text,
      v_invoice.branch_id, v_invoice.department_id, v_invoice.cost_center_code,
      coalesce(v_invoice.currency_code, 'USD'), coalesce(v_invoice.exchange_rate, 1),
      'POSTED', true, v_actor_user_account_id, now(), v_actor_user_account_id, v_actor_user_account_id,
      v_total_debit, v_total_credit
    )
    returning id into v_reversal_journal_id;

    for v_line in
      select *
      from icecream_erp.journal_entry_lines
      where journal_entry_id = any(v_original_journal_ids)
      order by created_at, id
    loop
      insert into icecream_erp.journal_entry_lines (
        journal_entry_id, account_id, branch_id, department_id, cost_center_code, description, debit_amount, credit_amount
      )
      values (
        v_reversal_journal_id, v_line.account_id, v_line.branch_id, v_line.department_id, v_line.cost_center_code,
        'Reversal: ' || coalesce(v_line.description, p_reason),
        coalesce(v_line.credit_amount, 0),
        coalesce(v_line.debit_amount, 0)
      );
    end loop;
  end if;

  if coalesce(v_invoice.customer_id, null) is not null then
    update icecream_erp.customers
    set current_balance = greatest(0, coalesce(current_balance, outstanding_balance, 0) - coalesce(v_invoice.balance_due, v_invoice.total, v_invoice.total_amount, 0)),
        outstanding_balance = greatest(0, coalesce(outstanding_balance, current_balance, 0) - coalesce(v_invoice.balance_due, v_invoice.total, v_invoice.total_amount, 0)),
        updated_at = now()
    where id = v_invoice.customer_id
      and organization_id = p_organization_id;
  end if;

  update icecream_erp.invoices
  set status = 'CANCELLED',
      balance_due = 0,
      void_reason = p_reason,
      voided_at = now(),
      voided_by = p_actor_user_profile_id,
      updated_at = now()
  where id = p_invoice_id;

  update icecream_erp.sales_dispatch_notes
  set status = 'CANCELLED',
      void_reason = p_reason,
      voided_at = now(),
      voided_by = p_actor_user_profile_id,
      updated_at = now()
  where organization_id = p_organization_id
    and invoice_id = p_invoice_id
    and upper(coalesce(status, '')) not in ('CANCELLED', 'VOIDED', 'REVERSED');

  if v_reversal_journal_id is not null then
    insert into icecream_erp.sales_document_relationships (
      organization_id, source_document_type, source_document_id, related_document_type, related_document_id, relationship_type
    )
    values (p_organization_id, 'sales_invoice', p_invoice_id, 'journal_entry', v_reversal_journal_id, 'REVERSAL')
    on conflict do nothing;
  end if;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values
    (
      p_organization_id, v_actor_user_account_id, p_actor_user_profile_id,
      'STOCK_REVERSAL_CREATED', 'stock_movements', p_invoice_id, 'sales_invoice', p_invoice_id,
      jsonb_build_object('originalMovementIds', v_original_movement_ids, 'reversalMovementIds', v_reversal_movement_ids, 'reason', p_reason)
    ),
    (
      p_organization_id, v_actor_user_account_id, p_actor_user_profile_id,
      'JOURNAL_REVERSED', 'journal_entries', coalesce(v_reversal_journal_id, p_invoice_id), 'sales_invoice', p_invoice_id,
      jsonb_build_object('originalJournalIds', v_original_journal_ids, 'reversalJournalId', v_reversal_journal_id, 'reason', p_reason)
    ),
    (
      p_organization_id, v_actor_user_account_id, p_actor_user_profile_id,
      'DISPATCH_REVERSED', 'sales_dispatch_notes', p_invoice_id, 'sales_invoice', p_invoice_id,
      jsonb_build_object('dispatchCount', v_dispatch_count, 'reason', p_reason)
    ),
    (
      p_organization_id, v_actor_user_account_id, p_actor_user_profile_id,
      'INVOICE_CANCELLED', 'invoices', p_invoice_id, 'sales_invoice', p_invoice_id,
      jsonb_build_object('reason', p_reason, 'reversalJournalId', v_reversal_journal_id, 'reversalMovementIds', v_reversal_movement_ids)
    );

  return jsonb_build_object(
    'success', true,
    'invoiceId', p_invoice_id,
    'invoiceStatus', 'CANCELLED',
    'dispatchStatus', case when v_dispatch_count > 0 then 'CANCELLED' else null end,
    'reversedStockMovements', v_reversal_movement_ids,
    'reversalJournalId', v_reversal_journal_id,
    'customerOutstanding', 0
  );
end;
$$;

revoke all on function icecream_erp.cancel_sales_invoice_transaction(uuid, uuid, uuid, text) from public;
grant execute on function icecream_erp.cancel_sales_invoice_transaction(uuid, uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
