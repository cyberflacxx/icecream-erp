-- Phase 1G: operational inventory and procurement reversals
-- Additive only. Do not modify shared PostgREST role configuration.

do $$
begin
  alter type icecream_erp.grn_status add value if not exists 'REVERSED';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type icecream_erp.transfer_status add value if not exists 'PENDING_APPROVAL';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type icecream_erp.transfer_status add value if not exists 'APPROVED';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type icecream_erp.transfer_status add value if not exists 'PARTIALLY_RECEIVED';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type icecream_erp.transfer_status add value if not exists 'REVERSED';
exception
  when duplicate_object then null;
end $$;

alter table if exists icecream_erp.goods_received_notes
  add column if not exists reversed_at timestamptz null,
  add column if not exists reversed_by uuid null references icecream_erp.users(id),
  add column if not exists reversal_reason text null;

create table if not exists icecream_erp.inventory_reversal_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  operation_type text not null,
  original_document_type text not null,
  original_document_id uuid not null,
  reversal_number text not null,
  reversal_reference text null,
  original_journal_entry_id uuid null references icecream_erp.journal_entries(id),
  reversal_journal_entry_id uuid null references icecream_erp.journal_entries(id),
  original_movement_ids uuid[] not null default '{}'::uuid[],
  reversal_movement_ids uuid[] not null default '{}'::uuid[],
  branch_id uuid null references icecream_erp.branches(id),
  fiscal_period_id uuid null references icecream_erp.fiscal_periods(id),
  reason text not null,
  requested_by uuid null references icecream_erp.users(id),
  approved_by uuid null references icecream_erp.users(id),
  posted_by uuid null references icecream_erp.users(id),
  idempotency_key text null,
  status text not null default 'POSTED',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  posted_at timestamptz not null default now()
);

create unique index if not exists idx_inventory_reversal_runs_operation_document
  on icecream_erp.inventory_reversal_runs (organization_id, operation_type, original_document_type, original_document_id);

create unique index if not exists idx_inventory_reversal_runs_idempotency
  on icecream_erp.inventory_reversal_runs (organization_id, operation_type, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_inventory_reversal_runs_document_lookup
  on icecream_erp.inventory_reversal_runs (organization_id, original_document_type, original_document_id, created_at desc);

create or replace function icecream_erp.inventory_assert_open_fiscal_period(
  p_organization_id uuid,
  p_effective_date date
)
returns uuid
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_period_id uuid;
begin
  select id
  into v_period_id
  from icecream_erp.fiscal_periods
  where organization_id = p_organization_id
    and start_date <= coalesce(p_effective_date, current_date)
    and end_date >= coalesce(p_effective_date, current_date)
    and upper(coalesce(status, '')) = 'OPEN'
    and coalesce(is_locked, false) = false
  order by start_date desc
  limit 1;

  if v_period_id is null then
    raise exception 'No open fiscal period exists for %.', coalesce(p_effective_date, current_date) using errcode = '23514';
  end if;

  return v_period_id;
end;
$$;

create or replace function icecream_erp.inventory_reverse_posted_journal(
  p_organization_id uuid,
  p_original_journal_id uuid,
  p_reversal_document_type text,
  p_reversal_document_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_description text
)
returns table (
  original_journal_id uuid,
  reversal_journal_id uuid,
  reversal_entry_number text,
  total_debit numeric,
  total_credit numeric
)
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_original icecream_erp.journal_entries%rowtype;
  v_lines jsonb;
  v_created record;
begin
  select *
  into v_original
  from icecream_erp.journal_entries
  where id = p_original_journal_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Original journal entry not found.' using errcode = 'P0002';
  end if;

  if upper(coalesce(v_original.status, '')) = 'REVERSED' then
    raise exception 'Original journal entry has already been reversed.' using errcode = '23505';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'accountId', account_id,
      'branchId', coalesce(branch_id, v_original.branch_id, p_branch_id),
      'costCenterCode', coalesce(cost_center_code, v_original.cost_center_code, p_cost_center_code),
      'debitAmount', coalesce(credit_amount, 0),
      'creditAmount', coalesce(debit_amount, 0),
      'description', coalesce(description, p_description)
    )
  )
  into v_lines
  from icecream_erp.journal_entry_lines
  where journal_entry_id = p_original_journal_id;

  if jsonb_typeof(coalesce(v_lines, 'null'::jsonb)) <> 'array' or jsonb_array_length(coalesce(v_lines, '[]'::jsonb)) = 0 then
    raise exception 'Original journal has no posted lines to reverse.' using errcode = '23514';
  end if;

  select *
  into v_created
  from icecream_erp.inventory_create_posted_journal(
    p_organization_id,
    p_actor_user_id,
    coalesce(p_branch_id, v_original.branch_id),
    coalesce(p_cost_center_code, v_original.cost_center_code),
    coalesce(p_journal_date, current_date),
    p_description,
    p_reversal_document_type,
    p_reversal_document_id,
    coalesce(v_original.currency_code, 'USD'),
    v_lines
  );

  update icecream_erp.journal_entries
  set status = 'REVERSED'
  where id = p_original_journal_id;

  original_journal_id := p_original_journal_id;
  reversal_journal_id := v_created.journal_id;
  reversal_entry_number := v_created.entry_number;
  total_debit := v_created.total_debit;
  total_credit := v_created.total_credit;
  return next;
end;
$$;

create or replace function icecream_erp.reverse_goods_received_note_atomic(
  p_organization_id uuid,
  p_grn_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_reason text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_grn icecream_erp.goods_received_notes%rowtype;
  v_line record;
  v_po_line record;
  v_balance icecream_erp.stock_balances%rowtype;
  v_original_movement record;
  v_reversal_id uuid := gen_random_uuid();
  v_reversal_number text := icecream_erp.inventory_next_document_number('REV');
  v_original_movement_ids uuid[] := '{}'::uuid[];
  v_reversal_movement_ids uuid[] := '{}'::uuid[];
  v_reversal_movement_id uuid;
  v_reversal_journal record;
  v_fiscal_period_id uuid;
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_any_received boolean := false;
  v_all_received boolean := true;
  v_po_status text := 'APPROVED';
  v_result jsonb;
begin
  if p_grn_id is null or p_actor_user_id is null or p_organization_id is null then
    raise exception 'GRN reversal requires organization, document, and actor.' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Reversal reason is required.' using errcode = '23514';
  end if;

  select *
  into v_grn
  from icecream_erp.goods_received_notes
  where id = p_grn_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Goods received note not found.' using errcode = 'P0002';
  end if;

  if upper(coalesce(v_grn.status::text, '')) <> 'POSTED' or coalesce(v_grn.stock_posted, false) = false then
    raise exception 'Only posted GRNs may be reversed.' using errcode = '23514';
  end if;

  if v_grn.reversed_at is not null then
    raise exception 'Goods received note has already been reversed.' using errcode = '23505';
  end if;

  select id
  into v_reversal_id
  from icecream_erp.inventory_reversal_runs
  where organization_id = p_organization_id
    and operation_type = 'goods_received_note_reverse'
    and original_document_type = 'goods_received_note'
    and original_document_id = p_grn_id
  for update;

  if found then
    raise exception 'Goods received note has already been reversed.' using errcode = '23505';
  end if;

  v_reversal_id := gen_random_uuid();

  if v_grn.journal_entry_id is null then
    raise exception 'Posted GRN is missing its journal entry link.' using errcode = '23514';
  end if;

  v_fiscal_period_id := icecream_erp.inventory_assert_open_fiscal_period(p_organization_id, coalesce(p_journal_date, current_date));

  select *
  into v_reversal_journal
  from icecream_erp.inventory_reverse_posted_journal(
    p_organization_id,
    v_grn.journal_entry_id,
    'goods_received_note_reversal',
    v_reversal_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    'GRN reversal ' || coalesce(v_grn.grn_number, p_grn_id::text) || ': ' || trim(p_reason)
  );

  for v_original_movement in
    select *
    from icecream_erp.stock_movements
    where organization_id = p_organization_id
      and source_document_type = 'goods_received_note'
      and source_document_id = p_grn_id
      and coalesce(posting_status, 'POSTED') = 'POSTED'
      and reversal_of_movement_id is null
    order by created_at, id
    for update
  loop
    v_original_movement_ids := array_append(v_original_movement_ids, v_original_movement.id);

    perform icecream_erp.inventory_advisory_lock(
      p_organization_id::text || ':grn_reverse:' || v_original_movement.item_id::text || ':' || v_original_movement.warehouse_id::text
    );

    select *
    into v_balance
    from icecream_erp.stock_balances
    where organization_id = p_organization_id
      and item_id = v_original_movement.item_id
      and warehouse_id = v_original_movement.warehouse_id
    order by updated_at desc, id desc
    limit 1
    for update;

    if v_balance.id is null or coalesce(v_balance.quantity_available, v_balance.quantity_on_hand, v_balance.quantity, 0) < coalesce(v_original_movement.quantity, 0) then
      raise exception 'Insufficient stock is available to reverse the posted GRN.' using errcode = '23514';
    end if;

    v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) - coalesce(v_original_movement.quantity, 0);
    v_new_total_value := greatest(
      coalesce(v_balance.total_value, coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) * coalesce(v_balance.average_cost, v_balance.avg_cost, 0), 0) - coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
      0
    );
    v_new_average_cost := case when v_new_qty > 0 then v_new_total_value / v_new_qty else 0 end;

    update icecream_erp.stock_balances
    set quantity = v_new_qty,
        quantity_on_hand = v_new_qty,
        quantity_available = greatest(v_new_qty - coalesce(v_balance.quantity_reserved, v_balance.reserved_qty, 0), 0),
        avg_cost = v_new_average_cost,
        average_cost = v_new_average_cost,
        total_value = v_new_total_value,
        updated_at = now(),
        last_updated = now()
    where id = v_balance.id;

    insert into icecream_erp.stock_movements (
      organization_id,
      branch_id,
      item_id,
      warehouse_id,
      movement_type,
      movement_number,
      quantity,
      unit_cost,
      total_cost,
      total_value,
      running_balance,
      running_value,
      reference_type,
      reference_id,
      reference_number,
      source_document_type,
      source_document_id,
      source_document_number,
      batch_number,
      expiry_date,
      notes,
      posting_date,
      posting_status,
      journal_entry_id,
      reversal_of_movement_id,
      reversal_reference,
      created_by,
      created_at
    )
    values (
      p_organization_id,
      p_branch_id,
      v_original_movement.item_id,
      v_original_movement.warehouse_id,
      'ADJUSTMENT_OUT',
      icecream_erp.inventory_next_document_number('SM'),
      coalesce(v_original_movement.quantity, 0),
      coalesce(v_original_movement.unit_cost, 0),
      coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
      coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
      v_new_qty,
      v_new_total_value,
      'goods_received_note_reversal',
      v_reversal_id,
      v_reversal_number,
      'goods_received_note_reversal',
      v_reversal_id,
      v_reversal_number,
      v_original_movement.batch_number,
      v_original_movement.expiry_date,
      p_reason,
      coalesce(p_journal_date, current_date),
      'POSTED',
      v_reversal_journal.reversal_journal_id,
      v_original_movement.id,
      v_reversal_number,
      p_actor_user_id,
      now()
    )
    returning id into v_reversal_movement_id;

    v_reversal_movement_ids := array_append(v_reversal_movement_ids, v_reversal_movement_id);
  end loop;

  for v_line in
    select
      id,
      coalesce(purchase_order_item_id, po_item_id) as purchase_order_item_id,
      coalesce(quantity_received, received_quantity, quantity_expected, 0)::numeric as quantity_received
    from icecream_erp.goods_received_note_items
    where coalesce(goods_received_note_id, grn_id) = p_grn_id
    order by created_at, id
    for update
  loop
    if v_line.purchase_order_item_id is null or coalesce(v_line.quantity_received, 0) <= 0 then
      continue;
    end if;

    select *
    into v_po_line
    from icecream_erp.purchase_order_items
    where id = v_line.purchase_order_item_id
    for update;

    update icecream_erp.purchase_order_items
    set quantity_received = greatest(coalesce(quantity_received, 0) - v_line.quantity_received, 0),
        received_qty = greatest(coalesce(received_qty, coalesce(quantity_received, 0)) - v_line.quantity_received, 0)
    where id = v_line.purchase_order_item_id;
  end loop;

  if v_grn.purchase_order_id is not null then
    for v_po_line in
      select *
      from icecream_erp.purchase_order_items
      where purchase_order_id = v_grn.purchase_order_id
      for update
    loop
      if coalesce(v_po_line.quantity_received, coalesce(v_po_line.received_qty, 0), 0) > 0 then
        v_any_received := true;
      end if;
      if coalesce(v_po_line.quantity_received, coalesce(v_po_line.received_qty, 0), 0) < coalesce(v_po_line.quantity_ordered, v_po_line.quantity, 0) then
        v_all_received := false;
      end if;
    end loop;

    if v_all_received and v_any_received then
      v_po_status := 'FULLY_RECEIVED';
    elsif v_any_received then
      v_po_status := 'PARTIAL_RECEIVED';
    else
      v_po_status := 'APPROVED';
    end if;

    update icecream_erp.purchase_orders
    set status = v_po_status,
        updated_at = now()
    where id = v_grn.purchase_order_id;
  end if;

  update icecream_erp.goods_received_notes
  set status = 'REVERSED',
      reversed_at = now(),
      reversed_by = p_actor_user_id,
      reversal_reason = trim(p_reason),
      updated_at = now()
  where id = p_grn_id;

  update icecream_erp.inventory_posting_runs
  set status = 'REVERSED',
      updated_at = now()
  where organization_id = p_organization_id
    and operation_type = 'goods_received_note_post'
    and source_document_type = 'goods_received_note'
    and source_document_id = p_grn_id;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  values
    (p_organization_id, 'goods_received_note', p_grn_id, 'inventory_reversal', v_reversal_id, 'REVERSED_BY', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'journal_entry', v_grn.journal_entry_id, 'REVERSES', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'journal_entry', v_reversal_journal.reversal_journal_id, 'POSTED_WITH', p_actor_user_id)
  on conflict do nothing;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  select p_organization_id, 'inventory_reversal', v_reversal_id, 'stock_movement', movement_id, 'REVERSES', p_actor_user_id
  from unnest(v_original_movement_ids) as movement_id
  on conflict do nothing;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  select p_organization_id, 'inventory_reversal', v_reversal_id, 'stock_movement', movement_id, 'POSTED_AS', p_actor_user_id
  from unnest(v_reversal_movement_ids) as movement_id
  on conflict do nothing;

  v_result := jsonb_build_object(
    'success', true,
    'reversalId', v_reversal_id,
    'reversalNumber', v_reversal_number,
    'originalDocumentType', 'goods_received_note',
    'originalDocumentId', p_grn_id,
    'originalJournalId', v_grn.journal_entry_id,
    'reversalJournal', jsonb_build_object(
      'id', v_reversal_journal.reversal_journal_id,
      'entryNumber', v_reversal_journal.reversal_entry_number,
      'totalDebit', v_reversal_journal.total_debit,
      'totalCredit', v_reversal_journal.total_credit
    ),
    'originalMovementIds', to_jsonb(v_original_movement_ids),
    'reversalMovementIds', to_jsonb(v_reversal_movement_ids),
    'reason', trim(p_reason),
    'status', 'REVERSED'
  );

  insert into icecream_erp.inventory_reversal_runs (
    id,
    organization_id,
    operation_type,
    original_document_type,
    original_document_id,
    reversal_number,
    reversal_reference,
    original_journal_entry_id,
    reversal_journal_entry_id,
    original_movement_ids,
    reversal_movement_ids,
    branch_id,
    fiscal_period_id,
    reason,
    requested_by,
    approved_by,
    posted_by,
    idempotency_key,
    status,
    result,
    posted_at
  )
  values (
    v_reversal_id,
    p_organization_id,
    'goods_received_note_reverse',
    'goods_received_note',
    p_grn_id,
    v_reversal_number,
    v_reversal_number,
    v_grn.journal_entry_id,
    v_reversal_journal.reversal_journal_id,
    v_original_movement_ids,
    v_reversal_movement_ids,
    p_branch_id,
    v_fiscal_period_id,
    trim(p_reason),
    p_actor_user_id,
    p_actor_user_id,
    p_actor_user_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    now()
  );

  insert into icecream_erp.audit_logs (
    organization_id,
    user_profile_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    p_organization_id,
    p_actor_user_id,
    'GRN_REVERSED_ATOMIC',
    'goods_received_note',
    p_grn_id,
    v_result
  );

  return v_result;
end;
$$;

create or replace function icecream_erp.reverse_inventory_adjustment_atomic(
  p_organization_id uuid,
  p_adjustment_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_reason text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_adjustment icecream_erp.stock_adjustments%rowtype;
  v_line record;
  v_original_movement icecream_erp.stock_movements%rowtype;
  v_balance icecream_erp.stock_balances%rowtype;
  v_reversal_id uuid := gen_random_uuid();
  v_reversal_number text := icecream_erp.inventory_next_document_number('REV');
  v_reversal_journal record;
  v_fiscal_period_id uuid;
  v_original_movement_ids uuid[] := '{}'::uuid[];
  v_reversal_movement_ids uuid[] := '{}'::uuid[];
  v_reversal_movement_id uuid;
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_reversal_type icecream_erp.stock_movement_type;
  v_result jsonb;
begin
  if p_adjustment_id is null or p_actor_user_id is null or p_organization_id is null then
    raise exception 'Stock adjustment reversal requires organization, document, and actor.' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Reversal reason is required.' using errcode = '23514';
  end if;

  select *
  into v_adjustment
  from icecream_erp.stock_adjustments
  where id = p_adjustment_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Stock adjustment not found.' using errcode = 'P0002';
  end if;

  if upper(coalesce(v_adjustment.status, '')) <> 'POSTED' then
    raise exception 'Only posted stock adjustments may be reversed.' using errcode = '23514';
  end if;

  if v_adjustment.reversed_at is not null then
    raise exception 'Stock adjustment has already been reversed.' using errcode = '23505';
  end if;

  if v_adjustment.journal_entry_id is null then
    raise exception 'Posted stock adjustment is missing its journal entry link.' using errcode = '23514';
  end if;

  perform 1
  from icecream_erp.inventory_reversal_runs
  where organization_id = p_organization_id
    and operation_type = 'stock_adjustment_reverse'
    and original_document_type = 'stock_adjustment'
    and original_document_id = p_adjustment_id
  for update;

  if found then
    raise exception 'Stock adjustment has already been reversed.' using errcode = '23505';
  end if;

  v_fiscal_period_id := icecream_erp.inventory_assert_open_fiscal_period(p_organization_id, coalesce(p_journal_date, current_date));

  select *
  into v_reversal_journal
  from icecream_erp.inventory_reverse_posted_journal(
    p_organization_id,
    v_adjustment.journal_entry_id,
    'stock_adjustment_reversal',
    v_reversal_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    'Stock adjustment reversal ' || coalesce(v_adjustment.adjustment_number, p_adjustment_id::text) || ': ' || trim(p_reason)
  );

  select *
  into v_original_movement
  from icecream_erp.stock_movements
  where organization_id = p_organization_id
    and source_document_type = 'stock_adjustment'
    and source_document_id = p_adjustment_id
    and reversal_of_movement_id is null
  order by created_at desc, id desc
  limit 1
  for update;

  if v_original_movement.id is null then
    raise exception 'Posted stock adjustment is missing its stock movement link.' using errcode = '23514';
  end if;

  v_original_movement_ids := array_append(v_original_movement_ids, v_original_movement.id);

  select *
  into v_line
  from icecream_erp.stock_adjustment_items
  where adjustment_id = p_adjustment_id
  order by id
  limit 1
  for update;

  if not found then
    raise exception 'Stock adjustment is missing its adjustment line.' using errcode = '23514';
  end if;

  perform icecream_erp.inventory_advisory_lock(
    p_organization_id::text || ':adjustment_reverse:' || v_original_movement.item_id::text || ':' || v_adjustment.warehouse_id::text
  );

  select *
  into v_balance
  from icecream_erp.stock_balances
  where organization_id = p_organization_id
    and item_id = v_original_movement.item_id
    and warehouse_id = v_adjustment.warehouse_id
  order by updated_at desc, id desc
  limit 1
  for update;

  if v_balance.id is null then
    raise exception 'Stock balance not found for the adjustment reversal.' using errcode = '23514';
  end if;

  if upper(coalesce(v_line.movement_type, '')) = 'ADJUSTMENT_IN' then
    if coalesce(v_balance.quantity_available, v_balance.quantity_on_hand, v_balance.quantity, 0) < coalesce(v_line.quantity_adjusted, 0) then
      raise exception 'Insufficient stock is available to reverse the gain adjustment.' using errcode = '23514';
    end if;
    v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) - coalesce(v_line.quantity_adjusted, 0);
    v_new_total_value := greatest(coalesce(v_balance.total_value, 0) - coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0), 0);
    v_reversal_type := 'ADJUSTMENT_OUT';
  else
    v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) + coalesce(v_line.quantity_adjusted, 0);
    v_new_total_value := coalesce(v_balance.total_value, 0) + coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0);
    v_reversal_type := 'ADJUSTMENT_IN';
  end if;

  v_new_average_cost := case when v_new_qty > 0 then v_new_total_value / v_new_qty else 0 end;

  update icecream_erp.stock_balances
  set quantity = v_new_qty,
      quantity_on_hand = v_new_qty,
      quantity_available = greatest(v_new_qty - coalesce(v_balance.quantity_reserved, v_balance.reserved_qty, 0), 0),
      avg_cost = v_new_average_cost,
      average_cost = v_new_average_cost,
      total_value = v_new_total_value,
      updated_at = now(),
      last_updated = now()
  where id = v_balance.id;

  insert into icecream_erp.stock_movements (
    organization_id,
    branch_id,
    item_id,
    warehouse_id,
    movement_type,
    movement_number,
    quantity,
    unit_cost,
    total_cost,
    total_value,
    running_balance,
    running_value,
    reference_type,
    reference_id,
    reference_number,
    source_document_type,
    source_document_id,
    source_document_number,
    notes,
    posting_date,
    posting_status,
    journal_entry_id,
    reversal_of_movement_id,
    reversal_reference,
    created_by,
    created_at
  )
  values (
    p_organization_id,
    p_branch_id,
    v_original_movement.item_id,
    v_adjustment.warehouse_id,
    v_reversal_type,
    icecream_erp.inventory_next_document_number('SM'),
    coalesce(v_line.quantity_adjusted, 0),
    coalesce(v_line.unit_cost, v_original_movement.unit_cost, 0),
    coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
    coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
    v_new_qty,
    v_new_total_value,
    'stock_adjustment_reversal',
    v_reversal_id,
    v_reversal_number,
    'stock_adjustment_reversal',
    v_reversal_id,
    v_reversal_number,
    trim(p_reason),
    coalesce(p_journal_date, current_date),
    'POSTED',
    v_reversal_journal.reversal_journal_id,
    v_original_movement.id,
    v_reversal_number,
    p_actor_user_id,
    now()
  )
  returning id into v_reversal_movement_id;

  v_reversal_movement_ids := array_append(v_reversal_movement_ids, v_reversal_movement_id);

  update icecream_erp.stock_adjustments
  set status = 'REVERSED',
      reversed_at = now(),
      reversed_by = p_actor_user_id,
      reversal_reason = trim(p_reason)
  where id = p_adjustment_id;

  update icecream_erp.inventory_posting_runs
  set status = 'REVERSED',
      updated_at = now()
  where organization_id = p_organization_id
    and operation_type = 'stock_adjustment_post'
    and source_document_type = 'stock_adjustment'
    and source_document_id = p_adjustment_id;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  values
    (p_organization_id, 'stock_adjustment', p_adjustment_id, 'inventory_reversal', v_reversal_id, 'REVERSED_BY', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'journal_entry', v_adjustment.journal_entry_id, 'REVERSES', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'journal_entry', v_reversal_journal.reversal_journal_id, 'POSTED_WITH', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'stock_movement', v_original_movement.id, 'REVERSES', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'stock_movement', v_reversal_movement_id, 'POSTED_AS', p_actor_user_id)
  on conflict do nothing;

  v_result := jsonb_build_object(
    'success', true,
    'reversalId', v_reversal_id,
    'reversalNumber', v_reversal_number,
    'originalDocumentType', 'stock_adjustment',
    'originalDocumentId', p_adjustment_id,
    'originalJournalId', v_adjustment.journal_entry_id,
    'reversalJournal', jsonb_build_object(
      'id', v_reversal_journal.reversal_journal_id,
      'entryNumber', v_reversal_journal.reversal_entry_number,
      'totalDebit', v_reversal_journal.total_debit,
      'totalCredit', v_reversal_journal.total_credit
    ),
    'originalMovementIds', to_jsonb(v_original_movement_ids),
    'reversalMovementIds', to_jsonb(v_reversal_movement_ids),
    'reason', trim(p_reason),
    'status', 'REVERSED'
  );

  insert into icecream_erp.inventory_reversal_runs (
    id,
    organization_id,
    operation_type,
    original_document_type,
    original_document_id,
    reversal_number,
    reversal_reference,
    original_journal_entry_id,
    reversal_journal_entry_id,
    original_movement_ids,
    reversal_movement_ids,
    branch_id,
    fiscal_period_id,
    reason,
    requested_by,
    approved_by,
    posted_by,
    idempotency_key,
    status,
    result,
    posted_at
  )
  values (
    v_reversal_id,
    p_organization_id,
    'stock_adjustment_reverse',
    'stock_adjustment',
    p_adjustment_id,
    v_reversal_number,
    v_reversal_number,
    v_adjustment.journal_entry_id,
    v_reversal_journal.reversal_journal_id,
    v_original_movement_ids,
    v_reversal_movement_ids,
    p_branch_id,
    v_fiscal_period_id,
    trim(p_reason),
    p_actor_user_id,
    p_actor_user_id,
    p_actor_user_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    now()
  );

  insert into icecream_erp.audit_logs (
    organization_id,
    user_profile_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    p_organization_id,
    p_actor_user_id,
    'STOCK_ADJUSTMENT_REVERSED_ATOMIC',
    'stock_adjustment',
    p_adjustment_id,
    v_result
  );

  return v_result;
end;
$$;

create or replace function icecream_erp.reverse_inventory_write_off_atomic(
  p_organization_id uuid,
  p_batch_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_reason text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_batch icecream_erp.inventory_batches%rowtype;
  v_original_movement icecream_erp.stock_movements%rowtype;
  v_posting_run icecream_erp.inventory_posting_runs%rowtype;
  v_balance icecream_erp.stock_balances%rowtype;
  v_reversal_id uuid := gen_random_uuid();
  v_reversal_number text := icecream_erp.inventory_next_document_number('REV');
  v_reversal_journal record;
  v_fiscal_period_id uuid;
  v_original_movement_ids uuid[] := '{}'::uuid[];
  v_reversal_movement_ids uuid[] := '{}'::uuid[];
  v_reversal_movement_id uuid;
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_result jsonb;
begin
  if p_batch_id is null or p_actor_user_id is null or p_organization_id is null then
    raise exception 'Write-off reversal requires organization, batch, and actor.' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Reversal reason is required.' using errcode = '23514';
  end if;

  perform 1
  from icecream_erp.inventory_reversal_runs
  where organization_id = p_organization_id
    and operation_type = 'inventory_write_off_reverse'
    and original_document_type = 'inventory_write_off'
    and original_document_id = p_batch_id
  for update;

  if found then
    raise exception 'Inventory write-off has already been reversed.' using errcode = '23505';
  end if;

  select *
  into v_batch
  from icecream_erp.inventory_batches
  where id = p_batch_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Inventory batch not found.' using errcode = 'P0002';
  end if;

  select *
  into v_posting_run
  from icecream_erp.inventory_posting_runs
  where organization_id = p_organization_id
    and operation_type = 'inventory_write_off_post'
    and source_document_type = 'inventory_write_off'
    and source_document_id = p_batch_id
  for update;

  if not found then
    raise exception 'Inventory batch is not eligible for write-off reversal.' using errcode = '23514';
  end if;

  if v_posting_run.journal_entry_id is null then
    raise exception 'Posted write-off is missing its journal entry link.' using errcode = '23514';
  end if;

  select *
  into v_original_movement
  from icecream_erp.stock_movements
  where organization_id = p_organization_id
    and source_document_type = 'inventory_write_off'
    and source_document_id = p_batch_id
    and reversal_of_movement_id is null
  order by created_at desc, id desc
  limit 1
  for update;

  if v_original_movement.id is null then
    raise exception 'Posted write-off is missing its stock movement link.' using errcode = '23514';
  end if;

  v_original_movement_ids := array_append(v_original_movement_ids, v_original_movement.id);
  v_fiscal_period_id := icecream_erp.inventory_assert_open_fiscal_period(p_organization_id, coalesce(p_journal_date, current_date));

  select *
  into v_reversal_journal
  from icecream_erp.inventory_reverse_posted_journal(
    p_organization_id,
    v_posting_run.journal_entry_id,
    'inventory_write_off_reversal',
    v_reversal_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    'Inventory write-off reversal ' || coalesce(v_batch.batch_number, p_batch_id::text) || ': ' || trim(p_reason)
  );

  perform icecream_erp.inventory_advisory_lock(
    p_organization_id::text || ':writeoff_reverse:' || v_batch.item_id::text || ':' || v_batch.warehouse_id::text
  );

  select *
  into v_balance
  from icecream_erp.stock_balances
  where organization_id = p_organization_id
    and item_id = v_batch.item_id
    and warehouse_id = v_batch.warehouse_id
  order by updated_at desc, id desc
  limit 1
  for update;

  if v_balance.id is null then
    raise exception 'Stock balance not found for the write-off reversal.' using errcode = '23514';
  end if;

  v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) + coalesce(v_original_movement.quantity, 0);
  v_new_total_value := coalesce(v_balance.total_value, 0) + coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0);
  v_new_average_cost := case when v_new_qty > 0 then v_new_total_value / v_new_qty else 0 end;

  update icecream_erp.stock_balances
  set quantity = v_new_qty,
      quantity_on_hand = v_new_qty,
      quantity_available = greatest(v_new_qty - coalesce(v_balance.quantity_reserved, v_balance.reserved_qty, 0), 0),
      avg_cost = v_new_average_cost,
      average_cost = v_new_average_cost,
      total_value = v_new_total_value,
      updated_at = now(),
      last_updated = now()
  where id = v_balance.id;

  update icecream_erp.inventory_batches
  set quantity_remaining = coalesce(quantity_remaining, 0) + coalesce(v_original_movement.quantity, 0),
      status = case when expiry_date is not null and expiry_date <= current_date then 'EXPIRED' else coalesce(status, 'AVAILABLE') end
  where id = p_batch_id;

  insert into icecream_erp.stock_movements (
    organization_id,
    branch_id,
    item_id,
    warehouse_id,
    movement_type,
    movement_number,
    quantity,
    unit_cost,
    total_cost,
    total_value,
    running_balance,
    running_value,
    reference_type,
    reference_id,
    reference_number,
    source_document_type,
    source_document_id,
    source_document_number,
    batch_number,
    expiry_date,
    notes,
    posting_date,
    posting_status,
    journal_entry_id,
    reversal_of_movement_id,
    reversal_reference,
    created_by,
    created_at
  )
  values (
    p_organization_id,
    p_branch_id,
    v_batch.item_id,
    v_batch.warehouse_id,
    'ADJUSTMENT_IN',
    icecream_erp.inventory_next_document_number('SM'),
    coalesce(v_original_movement.quantity, 0),
    coalesce(v_original_movement.unit_cost, v_batch.unit_cost, 0),
    coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
    coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
    v_new_qty,
    v_new_total_value,
    'inventory_write_off_reversal',
    v_reversal_id,
    v_reversal_number,
    'inventory_write_off_reversal',
    v_reversal_id,
    v_reversal_number,
    v_batch.batch_number,
    v_batch.expiry_date,
    trim(p_reason),
    coalesce(p_journal_date, current_date),
    'POSTED',
    v_reversal_journal.reversal_journal_id,
    v_original_movement.id,
    v_reversal_number,
    p_actor_user_id,
    now()
  )
  returning id into v_reversal_movement_id;

  v_reversal_movement_ids := array_append(v_reversal_movement_ids, v_reversal_movement_id);

  update icecream_erp.inventory_posting_runs
  set status = 'REVERSED',
      updated_at = now()
  where id = v_posting_run.id;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  values
    (p_organization_id, 'inventory_write_off', p_batch_id, 'inventory_reversal', v_reversal_id, 'REVERSED_BY', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'journal_entry', v_posting_run.journal_entry_id, 'REVERSES', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'journal_entry', v_reversal_journal.reversal_journal_id, 'POSTED_WITH', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'stock_movement', v_original_movement.id, 'REVERSES', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'stock_movement', v_reversal_movement_id, 'POSTED_AS', p_actor_user_id)
  on conflict do nothing;

  v_result := jsonb_build_object(
    'success', true,
    'reversalId', v_reversal_id,
    'reversalNumber', v_reversal_number,
    'originalDocumentType', 'inventory_write_off',
    'originalDocumentId', p_batch_id,
    'originalJournalId', v_posting_run.journal_entry_id,
    'reversalJournal', jsonb_build_object(
      'id', v_reversal_journal.reversal_journal_id,
      'entryNumber', v_reversal_journal.reversal_entry_number,
      'totalDebit', v_reversal_journal.total_debit,
      'totalCredit', v_reversal_journal.total_credit
    ),
    'originalMovementIds', to_jsonb(v_original_movement_ids),
    'reversalMovementIds', to_jsonb(v_reversal_movement_ids),
    'reason', trim(p_reason),
    'status', 'REVERSED'
  );

  insert into icecream_erp.inventory_reversal_runs (
    id,
    organization_id,
    operation_type,
    original_document_type,
    original_document_id,
    reversal_number,
    reversal_reference,
    original_journal_entry_id,
    reversal_journal_entry_id,
    original_movement_ids,
    reversal_movement_ids,
    branch_id,
    fiscal_period_id,
    reason,
    requested_by,
    approved_by,
    posted_by,
    idempotency_key,
    status,
    result,
    posted_at
  )
  values (
    v_reversal_id,
    p_organization_id,
    'inventory_write_off_reverse',
    'inventory_write_off',
    p_batch_id,
    v_reversal_number,
    v_reversal_number,
    v_posting_run.journal_entry_id,
    v_reversal_journal.reversal_journal_id,
    v_original_movement_ids,
    v_reversal_movement_ids,
    p_branch_id,
    v_fiscal_period_id,
    trim(p_reason),
    p_actor_user_id,
    p_actor_user_id,
    p_actor_user_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    now()
  );

  insert into icecream_erp.audit_logs (
    organization_id,
    user_profile_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    p_organization_id,
    p_actor_user_id,
    'INVENTORY_WRITE_OFF_REVERSED_ATOMIC',
    'inventory_write_off',
    p_batch_id,
    v_result
  );

  return v_result;
end;
$$;

create or replace function icecream_erp.reverse_stock_transfer_dispatch_atomic(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_reason text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_transfer icecream_erp.stock_transfers%rowtype;
  v_item record;
  v_balance icecream_erp.stock_balances%rowtype;
  v_original_movement icecream_erp.stock_movements%rowtype;
  v_reversal_id uuid := gen_random_uuid();
  v_reversal_number text := icecream_erp.inventory_next_document_number('REV');
  v_reversal_journal record;
  v_fiscal_period_id uuid;
  v_original_movement_ids uuid[] := '{}'::uuid[];
  v_reversal_movement_ids uuid[] := '{}'::uuid[];
  v_reversal_movement_id uuid;
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_result jsonb;
begin
  if p_transfer_id is null or p_actor_user_id is null or p_organization_id is null then
    raise exception 'Transfer dispatch reversal requires organization, document, and actor.' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Reversal reason is required.' using errcode = '23514';
  end if;

  perform 1
  from icecream_erp.inventory_reversal_runs
  where organization_id = p_organization_id
    and operation_type = 'stock_transfer_dispatch_reverse'
    and original_document_type = 'stock_transfer'
    and original_document_id = p_transfer_id
  for update;

  if found then
    raise exception 'Stock transfer dispatch has already been reversed.' using errcode = '23505';
  end if;

  select *
  into v_transfer
  from icecream_erp.stock_transfers
  where id = p_transfer_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Stock transfer not found.' using errcode = 'P0002';
  end if;

  if v_transfer.dispatch_journal_entry_id is null then
    raise exception 'Only dispatched stock transfers may be reversed.' using errcode = '23514';
  end if;

  if upper(coalesce(v_transfer.status::text, '')) not in ('IN_TRANSIT', 'PARTIALLY_RECEIVED') then
    raise exception 'Only dispatched stock transfers may be reversed.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from icecream_erp.stock_transfer_items
    where transfer_id = p_transfer_id
      and coalesce(quantity_received, 0) > 0
  ) then
    raise exception 'Transfer receipt must be reversed before dispatch can be reversed.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from icecream_erp.stock_transfer_items
    where transfer_id = p_transfer_id
      and coalesce(quantity_received, 0) > 0
  ) then
    raise exception 'Dispatch cannot be reversed after receipt activity unless the receipt is reversed first.' using errcode = '23514';
  end if;

  v_fiscal_period_id := icecream_erp.inventory_assert_open_fiscal_period(p_organization_id, coalesce(p_journal_date, current_date));

  select *
  into v_reversal_journal
  from icecream_erp.inventory_reverse_posted_journal(
    p_organization_id,
    v_transfer.dispatch_journal_entry_id,
    'stock_transfer_dispatch_reversal',
    v_reversal_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    'Transfer dispatch reversal ' || coalesce(v_transfer.transfer_number, p_transfer_id::text) || ': ' || trim(p_reason)
  );

  for v_item in
    select *
    from icecream_erp.stock_transfer_items
    where transfer_id = p_transfer_id
    order by id
    for update
  loop
    select *
    into v_original_movement
    from icecream_erp.stock_movements
    where organization_id = p_organization_id
      and source_document_type = 'stock_transfer_dispatch'
      and source_document_id = p_transfer_id
      and item_id = v_item.item_id
      and reversal_of_movement_id is null
    order by created_at desc, id desc
    limit 1
    for update;

    if v_original_movement.id is null then
      raise exception 'Transfer dispatch movement is missing for item %.', v_item.item_id using errcode = '23514';
    end if;

    v_original_movement_ids := array_append(v_original_movement_ids, v_original_movement.id);

    perform icecream_erp.inventory_advisory_lock(
      p_organization_id::text || ':transfer_dispatch_reverse:' || v_item.item_id::text || ':' || coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse)::text
    );

    select *
    into v_balance
    from icecream_erp.stock_balances
    where organization_id = p_organization_id
      and item_id = v_item.item_id
      and warehouse_id = coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse)
    order by updated_at desc, id desc
    limit 1
    for update;

    if v_balance.id is null then
      raise exception 'Source stock balance was not found for transfer dispatch reversal.' using errcode = '23514';
    end if;

    v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) + coalesce(v_original_movement.quantity, 0);
    v_new_total_value := coalesce(v_balance.total_value, 0) + coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0);
    v_new_average_cost := case when v_new_qty > 0 then v_new_total_value / v_new_qty else 0 end;

    update icecream_erp.stock_balances
    set quantity = v_new_qty,
        quantity_on_hand = v_new_qty,
        quantity_available = greatest(v_new_qty - coalesce(v_balance.quantity_reserved, v_balance.reserved_qty, 0), 0),
        avg_cost = v_new_average_cost,
        average_cost = v_new_average_cost,
        total_value = v_new_total_value,
        updated_at = now(),
        last_updated = now()
    where id = v_balance.id;

    insert into icecream_erp.stock_movements (
      organization_id,
      branch_id,
      source_branch_id,
      destination_branch_id,
      item_id,
      warehouse_id,
      source_warehouse_id,
      destination_warehouse_id,
      movement_type,
      movement_number,
      quantity,
      unit_cost,
      total_cost,
      total_value,
      running_balance,
      running_value,
      reference_type,
      reference_id,
      reference_number,
      source_document_type,
      source_document_id,
      source_document_number,
      batch_number,
      expiry_date,
      notes,
      posting_date,
      posting_status,
      journal_entry_id,
      reversal_of_movement_id,
      reversal_reference,
      created_by,
      created_at
    )
    values (
      p_organization_id,
      v_original_movement.branch_id,
      v_original_movement.source_branch_id,
      v_original_movement.destination_branch_id,
      v_item.item_id,
      coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse),
      coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse),
      coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse),
      'TRANSFER_IN',
      icecream_erp.inventory_next_document_number('SM'),
      coalesce(v_original_movement.quantity, 0),
      coalesce(v_original_movement.unit_cost, 0),
      coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
      coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
      v_new_qty,
      v_new_total_value,
      'stock_transfer_dispatch_reversal',
      v_reversal_id,
      v_reversal_number,
      'stock_transfer_dispatch_reversal',
      v_reversal_id,
      v_reversal_number,
      v_original_movement.batch_number,
      v_original_movement.expiry_date,
      trim(p_reason),
      coalesce(p_journal_date, current_date),
      'POSTED',
      v_reversal_journal.reversal_journal_id,
      v_original_movement.id,
      v_reversal_number,
      p_actor_user_id,
      now()
    )
    returning id into v_reversal_movement_id;

    v_reversal_movement_ids := array_append(v_reversal_movement_ids, v_reversal_movement_id);

    update icecream_erp.stock_transfer_items
    set quantity_sent = 0
    where id = v_item.id;
  end loop;

  update icecream_erp.stock_transfers
  set status = 'REVERSED',
      reversed_at = now(),
      reversed_by = p_actor_user_id,
      reversal_reason = trim(p_reason),
      updated_at = now()
  where id = p_transfer_id;

  update icecream_erp.inventory_posting_runs
  set status = 'REVERSED',
      updated_at = now()
  where organization_id = p_organization_id
    and operation_type = 'stock_transfer_dispatch'
    and source_document_type = 'stock_transfer'
    and source_document_id = p_transfer_id;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  values
    (p_organization_id, 'stock_transfer', p_transfer_id, 'inventory_reversal', v_reversal_id, 'REVERSED_BY', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'journal_entry', v_transfer.dispatch_journal_entry_id, 'REVERSES', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'journal_entry', v_reversal_journal.reversal_journal_id, 'POSTED_WITH', p_actor_user_id)
  on conflict do nothing;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  select p_organization_id, 'inventory_reversal', v_reversal_id, 'stock_movement', movement_id, 'REVERSES', p_actor_user_id
  from unnest(v_original_movement_ids) as movement_id
  on conflict do nothing;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  select p_organization_id, 'inventory_reversal', v_reversal_id, 'stock_movement', movement_id, 'POSTED_AS', p_actor_user_id
  from unnest(v_reversal_movement_ids) as movement_id
  on conflict do nothing;

  v_result := jsonb_build_object(
    'success', true,
    'reversalId', v_reversal_id,
    'reversalNumber', v_reversal_number,
    'originalDocumentType', 'stock_transfer_dispatch',
    'originalDocumentId', p_transfer_id,
    'originalJournalId', v_transfer.dispatch_journal_entry_id,
    'reversalJournal', jsonb_build_object(
      'id', v_reversal_journal.reversal_journal_id,
      'entryNumber', v_reversal_journal.reversal_entry_number,
      'totalDebit', v_reversal_journal.total_debit,
      'totalCredit', v_reversal_journal.total_credit
    ),
    'originalMovementIds', to_jsonb(v_original_movement_ids),
    'reversalMovementIds', to_jsonb(v_reversal_movement_ids),
    'reason', trim(p_reason),
    'status', 'REVERSED'
  );

  insert into icecream_erp.inventory_reversal_runs (
    id,
    organization_id,
    operation_type,
    original_document_type,
    original_document_id,
    reversal_number,
    reversal_reference,
    original_journal_entry_id,
    reversal_journal_entry_id,
    original_movement_ids,
    reversal_movement_ids,
    branch_id,
    fiscal_period_id,
    reason,
    requested_by,
    approved_by,
    posted_by,
    idempotency_key,
    status,
    result,
    posted_at
  )
  values (
    v_reversal_id,
    p_organization_id,
    'stock_transfer_dispatch_reverse',
    'stock_transfer',
    p_transfer_id,
    v_reversal_number,
    v_reversal_number,
    v_transfer.dispatch_journal_entry_id,
    v_reversal_journal.reversal_journal_id,
    v_original_movement_ids,
    v_reversal_movement_ids,
    p_branch_id,
    v_fiscal_period_id,
    trim(p_reason),
    p_actor_user_id,
    p_actor_user_id,
    p_actor_user_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    now()
  );

  insert into icecream_erp.audit_logs (
    organization_id,
    user_profile_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    p_organization_id,
    p_actor_user_id,
    'STOCK_TRANSFER_DISPATCH_REVERSED_ATOMIC',
    'stock_transfer',
    p_transfer_id,
    v_result
  );

  return v_result;
end;
$$;

create or replace function icecream_erp.reverse_stock_transfer_receipt_atomic(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_reason text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_transfer icecream_erp.stock_transfers%rowtype;
  v_item record;
  v_balance icecream_erp.stock_balances%rowtype;
  v_original_movement icecream_erp.stock_movements%rowtype;
  v_reversal_id uuid := gen_random_uuid();
  v_reversal_number text := icecream_erp.inventory_next_document_number('REV');
  v_reversal_journal record;
  v_fiscal_period_id uuid;
  v_original_movement_ids uuid[] := '{}'::uuid[];
  v_reversal_movement_ids uuid[] := '{}'::uuid[];
  v_reversal_movement_id uuid;
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_received_total numeric := 0;
  v_result jsonb;
begin
  if p_transfer_id is null or p_actor_user_id is null or p_organization_id is null then
    raise exception 'Transfer receipt reversal requires organization, document, and actor.' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Reversal reason is required.' using errcode = '23514';
  end if;

  perform 1
  from icecream_erp.inventory_reversal_runs
  where organization_id = p_organization_id
    and operation_type = 'stock_transfer_receipt_reverse'
    and original_document_type = 'stock_transfer'
    and original_document_id = p_transfer_id
  for update;

  if found then
    raise exception 'Stock transfer receipt has already been reversed.' using errcode = '23505';
  end if;

  select *
  into v_transfer
  from icecream_erp.stock_transfers
  where id = p_transfer_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Stock transfer not found.' using errcode = 'P0002';
  end if;

  if v_transfer.receipt_journal_entry_id is null then
    raise exception 'Only received stock transfers may be reversed.' using errcode = '23514';
  end if;

  if upper(coalesce(v_transfer.status::text, '')) not in ('COMPLETED', 'PARTIALLY_RECEIVED') then
    raise exception 'Only received stock transfers may be reversed.' using errcode = '23514';
  end if;

  v_fiscal_period_id := icecream_erp.inventory_assert_open_fiscal_period(p_organization_id, coalesce(p_journal_date, current_date));

  select *
  into v_reversal_journal
  from icecream_erp.inventory_reverse_posted_journal(
    p_organization_id,
    v_transfer.receipt_journal_entry_id,
    'stock_transfer_receipt_reversal',
    v_reversal_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    'Transfer receipt reversal ' || coalesce(v_transfer.transfer_number, p_transfer_id::text) || ': ' || trim(p_reason)
  );

  for v_item in
    select *
    from icecream_erp.stock_transfer_items
    where transfer_id = p_transfer_id
      and coalesce(quantity_received, 0) > 0
    order by id
    for update
  loop
    select *
    into v_original_movement
    from icecream_erp.stock_movements
    where organization_id = p_organization_id
      and source_document_type = 'stock_transfer_receipt'
      and source_document_id = p_transfer_id
      and item_id = v_item.item_id
      and reversal_of_movement_id is null
    order by created_at desc, id desc
    limit 1
    for update;

    if v_original_movement.id is null then
      raise exception 'Transfer receipt movement is missing for item %.', v_item.item_id using errcode = '23514';
    end if;

    v_original_movement_ids := array_append(v_original_movement_ids, v_original_movement.id);

    perform icecream_erp.inventory_advisory_lock(
      p_organization_id::text || ':transfer_receipt_reverse:' || v_item.item_id::text || ':' || coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse)::text
    );

    select *
    into v_balance
    from icecream_erp.stock_balances
    where organization_id = p_organization_id
      and item_id = v_item.item_id
      and warehouse_id = coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse)
    order by updated_at desc, id desc
    limit 1
    for update;

    if v_balance.id is null or coalesce(v_balance.quantity_available, v_balance.quantity_on_hand, v_balance.quantity, 0) < coalesce(v_item.quantity_received, 0) then
      raise exception 'Insufficient destination stock is available to reverse the transfer receipt.' using errcode = '23514';
    end if;

    v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) - coalesce(v_item.quantity_received, 0);
    v_new_total_value := greatest(coalesce(v_balance.total_value, 0) - coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0), 0);
    v_new_average_cost := case when v_new_qty > 0 then v_new_total_value / v_new_qty else 0 end;

    update icecream_erp.stock_balances
    set quantity = v_new_qty,
        quantity_on_hand = v_new_qty,
        quantity_available = greatest(v_new_qty - coalesce(v_balance.quantity_reserved, v_balance.reserved_qty, 0), 0),
        avg_cost = v_new_average_cost,
        average_cost = v_new_average_cost,
        total_value = v_new_total_value,
        updated_at = now(),
        last_updated = now()
    where id = v_balance.id;

    insert into icecream_erp.stock_movements (
      organization_id,
      branch_id,
      source_branch_id,
      destination_branch_id,
      item_id,
      warehouse_id,
      source_warehouse_id,
      destination_warehouse_id,
      movement_type,
      movement_number,
      quantity,
      unit_cost,
      total_cost,
      total_value,
      running_balance,
      running_value,
      reference_type,
      reference_id,
      reference_number,
      source_document_type,
      source_document_id,
      source_document_number,
      batch_number,
      expiry_date,
      notes,
      posting_date,
      posting_status,
      journal_entry_id,
      reversal_of_movement_id,
      reversal_reference,
      created_by,
      created_at
    )
    values (
      p_organization_id,
      v_original_movement.branch_id,
      v_original_movement.source_branch_id,
      v_original_movement.destination_branch_id,
      v_item.item_id,
      coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse),
      coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse),
      coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse),
      'TRANSFER_OUT',
      icecream_erp.inventory_next_document_number('SM'),
      coalesce(v_item.quantity_received, 0),
      coalesce(v_original_movement.unit_cost, v_item.unit_cost, 0),
      coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
      coalesce(v_original_movement.total_value, v_original_movement.total_cost, 0),
      v_new_qty,
      v_new_total_value,
      'stock_transfer_receipt_reversal',
      v_reversal_id,
      v_reversal_number,
      'stock_transfer_receipt_reversal',
      v_reversal_id,
      v_reversal_number,
      v_original_movement.batch_number,
      v_original_movement.expiry_date,
      trim(p_reason),
      coalesce(p_journal_date, current_date),
      'POSTED',
      v_reversal_journal.reversal_journal_id,
      v_original_movement.id,
      v_reversal_number,
      p_actor_user_id,
      now()
    )
    returning id into v_reversal_movement_id;

    v_reversal_movement_ids := array_append(v_reversal_movement_ids, v_reversal_movement_id);
    v_received_total := v_received_total + coalesce(v_item.quantity_received, 0);

    update icecream_erp.stock_transfer_items
    set quantity_received = 0
    where id = v_item.id;
  end loop;

  if v_received_total <= 0 then
    raise exception 'No received quantity is available to reverse.' using errcode = '23514';
  end if;

  update icecream_erp.stock_transfers
  set status = 'IN_TRANSIT',
      reversed_at = now(),
      reversed_by = p_actor_user_id,
      reversal_reason = trim(p_reason),
      updated_at = now()
  where id = p_transfer_id;

  update icecream_erp.inventory_posting_runs
  set status = 'REVERSED',
      updated_at = now()
  where organization_id = p_organization_id
    and operation_type = 'stock_transfer_receipt'
    and source_document_type = 'stock_transfer'
    and source_document_id = p_transfer_id;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  values
    (p_organization_id, 'stock_transfer', p_transfer_id, 'inventory_reversal', v_reversal_id, 'REVERSED_BY', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'journal_entry', v_transfer.receipt_journal_entry_id, 'REVERSES', p_actor_user_id),
    (p_organization_id, 'inventory_reversal', v_reversal_id, 'journal_entry', v_reversal_journal.reversal_journal_id, 'POSTED_WITH', p_actor_user_id)
  on conflict do nothing;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  select p_organization_id, 'inventory_reversal', v_reversal_id, 'stock_movement', movement_id, 'REVERSES', p_actor_user_id
  from unnest(v_original_movement_ids) as movement_id
  on conflict do nothing;

  insert into icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type,
    created_by
  )
  select p_organization_id, 'inventory_reversal', v_reversal_id, 'stock_movement', movement_id, 'POSTED_AS', p_actor_user_id
  from unnest(v_reversal_movement_ids) as movement_id
  on conflict do nothing;

  v_result := jsonb_build_object(
    'success', true,
    'reversalId', v_reversal_id,
    'reversalNumber', v_reversal_number,
    'originalDocumentType', 'stock_transfer_receipt',
    'originalDocumentId', p_transfer_id,
    'originalJournalId', v_transfer.receipt_journal_entry_id,
    'reversalJournal', jsonb_build_object(
      'id', v_reversal_journal.reversal_journal_id,
      'entryNumber', v_reversal_journal.reversal_entry_number,
      'totalDebit', v_reversal_journal.total_debit,
      'totalCredit', v_reversal_journal.total_credit
    ),
    'originalMovementIds', to_jsonb(v_original_movement_ids),
    'reversalMovementIds', to_jsonb(v_reversal_movement_ids),
    'reason', trim(p_reason),
    'status', 'REVERSED'
  );

  insert into icecream_erp.inventory_reversal_runs (
    id,
    organization_id,
    operation_type,
    original_document_type,
    original_document_id,
    reversal_number,
    reversal_reference,
    original_journal_entry_id,
    reversal_journal_entry_id,
    original_movement_ids,
    reversal_movement_ids,
    branch_id,
    fiscal_period_id,
    reason,
    requested_by,
    approved_by,
    posted_by,
    idempotency_key,
    status,
    result,
    posted_at
  )
  values (
    v_reversal_id,
    p_organization_id,
    'stock_transfer_receipt_reverse',
    'stock_transfer',
    p_transfer_id,
    v_reversal_number,
    v_reversal_number,
    v_transfer.receipt_journal_entry_id,
    v_reversal_journal.reversal_journal_id,
    v_original_movement_ids,
    v_reversal_movement_ids,
    p_branch_id,
    v_fiscal_period_id,
    trim(p_reason),
    p_actor_user_id,
    p_actor_user_id,
    p_actor_user_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    now()
  );

  insert into icecream_erp.audit_logs (
    organization_id,
    user_profile_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    p_organization_id,
    p_actor_user_id,
    'STOCK_TRANSFER_RECEIPT_REVERSED_ATOMIC',
    'stock_transfer',
    p_transfer_id,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function icecream_erp.inventory_assert_open_fiscal_period(uuid, date) from public;
revoke all on function icecream_erp.inventory_reverse_posted_journal(uuid, uuid, text, uuid, uuid, uuid, text, date, text) from public;
revoke all on function icecream_erp.reverse_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, text) from public;
revoke all on function icecream_erp.reverse_inventory_adjustment_atomic(uuid, uuid, uuid, uuid, text, date, text, text) from public;
revoke all on function icecream_erp.reverse_inventory_write_off_atomic(uuid, uuid, uuid, uuid, text, date, text, text) from public;
revoke all on function icecream_erp.reverse_stock_transfer_dispatch_atomic(uuid, uuid, uuid, uuid, text, date, text, text) from public;
revoke all on function icecream_erp.reverse_stock_transfer_receipt_atomic(uuid, uuid, uuid, uuid, text, date, text, text) from public;

grant execute on function icecream_erp.inventory_assert_open_fiscal_period(uuid, date) to service_role;
grant execute on function icecream_erp.inventory_reverse_posted_journal(uuid, uuid, text, uuid, uuid, uuid, text, date, text) to service_role;
grant execute on function icecream_erp.reverse_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, text) to service_role;
grant execute on function icecream_erp.reverse_inventory_adjustment_atomic(uuid, uuid, uuid, uuid, text, date, text, text) to service_role;
grant execute on function icecream_erp.reverse_inventory_write_off_atomic(uuid, uuid, uuid, uuid, text, date, text, text) to service_role;
grant execute on function icecream_erp.reverse_stock_transfer_dispatch_atomic(uuid, uuid, uuid, uuid, text, date, text, text) to service_role;
grant execute on function icecream_erp.reverse_stock_transfer_receipt_atomic(uuid, uuid, uuid, uuid, text, date, text, text) to service_role;

notify pgrst, 'reload schema';
