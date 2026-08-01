-- Phase 1F atomic inventory posting, stock-take workflow foundation,
-- transfer consistency support, and stock-ledger enrichment.
-- Additive only. Do not apply destructive DDL.

do $$
begin
  if exists (
    select 1
    from pg_type
    where typnamespace = 'icecream_erp'::regnamespace
      and typname = 'transfer_status'
  ) then
    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'icecream_erp.transfer_status'::regtype
        and enumlabel = 'PENDING_APPROVAL'
    ) then
      alter type icecream_erp.transfer_status add value 'PENDING_APPROVAL';
    end if;

    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'icecream_erp.transfer_status'::regtype
        and enumlabel = 'APPROVED'
    ) then
      alter type icecream_erp.transfer_status add value 'APPROVED';
    end if;

    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'icecream_erp.transfer_status'::regtype
        and enumlabel = 'PARTIALLY_RECEIVED'
    ) then
      alter type icecream_erp.transfer_status add value 'PARTIALLY_RECEIVED';
    end if;

    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'icecream_erp.transfer_status'::regtype
        and enumlabel = 'REVERSED'
    ) then
      alter type icecream_erp.transfer_status add value 'REVERSED';
    end if;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_type
    where typnamespace = 'icecream_erp'::regnamespace
      and typname = 'stock_movement_type'
  ) then
    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'icecream_erp.stock_movement_type'::regtype
        and enumlabel = 'GOODS_IN_TRANSIT'
    ) then
      alter type icecream_erp.stock_movement_type add value 'GOODS_IN_TRANSIT';
    end if;

    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'icecream_erp.stock_movement_type'::regtype
        and enumlabel = 'REVERSAL'
    ) then
      alter type icecream_erp.stock_movement_type add value 'REVERSAL';
    end if;
  end if;
end $$;

alter table if exists icecream_erp.stock_balances
  add column if not exists average_cost numeric(18,4) not null default 0,
  add column if not exists total_value numeric(18,4) not null default 0;

update icecream_erp.stock_balances
set average_cost = coalesce(average_cost, avg_cost, 0),
    total_value = coalesce(total_value, quantity_on_hand * coalesce(average_cost, avg_cost, 0), 0),
    updated_at = now()
where average_cost is null
   or total_value is null;

alter table if exists icecream_erp.stock_movements
  add column if not exists total_value numeric(18,4) null,
  add column if not exists movement_number text null,
  add column if not exists source_document_number text null,
  add column if not exists posting_date date null,
  add column if not exists posting_status text not null default 'POSTED',
  add column if not exists journal_entry_id uuid null references icecream_erp.journal_entries(id),
  add column if not exists branch_id uuid null references icecream_erp.branches(id),
  add column if not exists source_branch_id uuid null references icecream_erp.branches(id),
  add column if not exists destination_branch_id uuid null references icecream_erp.branches(id),
  add column if not exists running_value numeric(18,4) null,
  add column if not exists reversal_of_movement_id uuid null references icecream_erp.stock_movements(id),
  add column if not exists reversal_reference text null;

with stock_movement_context as (
  select
    movement.id,
    wh.branch_id as warehouse_branch_id,
    src.branch_id as source_branch_id,
    dst.branch_id as destination_branch_id
  from icecream_erp.stock_movements movement
  join icecream_erp.warehouses wh
    on wh.id = movement.warehouse_id
  left join icecream_erp.warehouses src
    on src.id = movement.source_warehouse_id
  left join icecream_erp.warehouses dst
    on dst.id = movement.destination_warehouse_id
)
update icecream_erp.stock_movements sm
set total_value = coalesce(sm.total_value, sm.total_cost, sm.quantity * sm.unit_cost, 0),
    posting_date = coalesce(sm.posting_date, sm.created_at::date),
    posting_status = coalesce(nullif(sm.posting_status, ''), 'POSTED'),
    movement_number = coalesce(
      nullif(sm.movement_number, ''),
      nullif(sm.reference_number, ''),
      'SM-' || replace(left(sm.created_at::text, 19), ':', '') || '-' || left(sm.id::text, 8)
    ),
    branch_id = coalesce(sm.branch_id, context.warehouse_branch_id),
    source_branch_id = coalesce(sm.source_branch_id, context.source_branch_id, context.warehouse_branch_id),
    destination_branch_id = coalesce(sm.destination_branch_id, context.destination_branch_id),
    running_value = coalesce(sm.running_value, sm.total_value),
    updated_at = now()
from stock_movement_context context
where context.id = sm.id
  and (
    sm.total_value is null
    or sm.posting_date is null
    or sm.movement_number is null
    or sm.branch_id is null
    or sm.source_branch_id is null
    or sm.destination_branch_id is null
    or sm.running_value is null
    or sm.posting_status is null
    or sm.posting_status = ''
  );

create index if not exists idx_stock_movements_posting_date
  on icecream_erp.stock_movements (organization_id, posting_date, created_at, id);

create index if not exists idx_stock_movements_ledger_filters
  on icecream_erp.stock_movements (organization_id, branch_id, warehouse_id, item_id, movement_type);

create index if not exists idx_stock_movements_journal_entry
  on icecream_erp.stock_movements (journal_entry_id);

create index if not exists idx_stock_movements_reversal_of
  on icecream_erp.stock_movements (reversal_of_movement_id);

alter table if exists icecream_erp.inventory_stock_takes
  add column if not exists organization_id uuid null references icecream_erp.organizations(id),
  add column if not exists branch_id uuid null references icecream_erp.branches(id),
  add column if not exists document_number text null,
  add column if not exists count_date date null,
  add column if not exists notes text null,
  add column if not exists created_by uuid null references icecream_erp.users(id),
  add column if not exists submitted_by uuid null references icecream_erp.users(id),
  add column if not exists submitted_at timestamptz null,
  add column if not exists approved_by uuid null references icecream_erp.users(id),
  add column if not exists approved_at timestamptz null,
  add column if not exists posted_by uuid null references icecream_erp.users(id),
  add column if not exists posted_at timestamptz null,
  add column if not exists reversed_by uuid null references icecream_erp.users(id),
  add column if not exists reversed_at timestamptz null,
  add column if not exists reversal_reason text null,
  add column if not exists idempotency_key text null;

update icecream_erp.inventory_stock_takes t
set organization_id = coalesce(t.organization_id, w.organization_id),
    branch_id = coalesce(t.branch_id, w.branch_id),
    document_number = coalesce(nullif(t.document_number, ''), 'STK-' || replace(to_char(t.created_at, 'YYYYMMDDHH24MISS'), ' ', '') || '-' || left(t.id::text, 6)),
    count_date = coalesce(t.count_date, t.stock_take_date),
    notes = coalesce(t.notes, t.reason),
    created_by = coalesce(t.created_by, t.counted_by),
    updated_at = now()
from icecream_erp.warehouses w
where w.id = t.warehouse_id
  and (
    t.organization_id is null
    or t.branch_id is null
    or t.document_number is null
    or t.count_date is null
    or t.created_by is null
  );

alter table if exists icecream_erp.inventory_stock_takes
  alter column organization_id set not null,
  alter column branch_id set not null,
  alter column document_number set not null,
  alter column count_date set not null,
  alter column created_by set not null;

create unique index if not exists idx_inventory_stock_takes_document_number
  on icecream_erp.inventory_stock_takes (organization_id, document_number);

create unique index if not exists idx_inventory_stock_takes_idempotency
  on icecream_erp.inventory_stock_takes (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_inventory_stock_takes_branch_status
  on icecream_erp.inventory_stock_takes (organization_id, branch_id, status, count_date);

alter table if exists icecream_erp.inventory_stock_take_items
  add column if not exists unit_cost numeric(18,4) null,
  add column if not exists variance_value numeric(18,4) null,
  add column if not exists reason text null,
  add column if not exists batch_id uuid null,
  add column if not exists expiry_date date null,
  add column if not exists posted_movement_id uuid null references icecream_erp.stock_movements(id);

update icecream_erp.inventory_stock_take_items
set reason = coalesce(reason, variance_reason),
    variance_value = coalesce(variance_value, variance_quantity * coalesce(unit_cost, 0)),
    updated_at = now()
where reason is null
   or variance_value is null;

alter table if exists icecream_erp.stock_adjustments
  add column if not exists idempotency_key text null,
  add column if not exists posted_at timestamptz null,
  add column if not exists posted_by uuid null references icecream_erp.users(id),
  add column if not exists reversed_at timestamptz null,
  add column if not exists reversed_by uuid null references icecream_erp.users(id),
  add column if not exists reversal_reason text null,
  add column if not exists journal_entry_id uuid null references icecream_erp.journal_entries(id);

create unique index if not exists idx_stock_adjustments_idempotency
  on icecream_erp.stock_adjustments (organization_id, idempotency_key)
  where idempotency_key is not null;

alter table if exists icecream_erp.goods_received_notes
  add column if not exists idempotency_key text null,
  add column if not exists journal_entry_id uuid null references icecream_erp.journal_entries(id);

create unique index if not exists idx_goods_received_notes_idempotency
  on icecream_erp.goods_received_notes (organization_id, idempotency_key)
  where idempotency_key is not null;

alter table if exists icecream_erp.stock_transfers
  add column if not exists dispatched_at timestamptz null,
  add column if not exists dispatched_by uuid null references icecream_erp.users(id),
  add column if not exists received_at timestamptz null,
  add column if not exists received_by uuid null references icecream_erp.users(id),
  add column if not exists dispatch_journal_entry_id uuid null references icecream_erp.journal_entries(id),
  add column if not exists receipt_journal_entry_id uuid null references icecream_erp.journal_entries(id),
  add column if not exists reversal_reason text null,
  add column if not exists reversed_at timestamptz null,
  add column if not exists reversed_by uuid null references icecream_erp.users(id);

create table if not exists icecream_erp.inventory_posting_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  operation_type text not null,
  source_document_type text not null,
  source_document_id uuid not null,
  idempotency_key text null,
  payload_hash text null,
  status text not null default 'POSTED',
  result jsonb not null default '{}'::jsonb,
  journal_entry_id uuid null references icecream_erp.journal_entries(id),
  created_by uuid null references icecream_erp.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_inventory_posting_runs_document
  on icecream_erp.inventory_posting_runs (organization_id, operation_type, source_document_type, source_document_id);

create unique index if not exists idx_inventory_posting_runs_idempotency
  on icecream_erp.inventory_posting_runs (organization_id, operation_type, idempotency_key)
  where idempotency_key is not null;

create table if not exists icecream_erp.inventory_document_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  source_document_type text not null,
  source_document_id uuid not null,
  related_document_type text not null,
  related_document_id uuid not null,
  relationship_type text not null,
  created_by uuid null references icecream_erp.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_inventory_document_relationships_unique
  on icecream_erp.inventory_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type
  );

create or replace function icecream_erp.inventory_next_document_number(
  p_prefix text
)
returns text
language sql
as $$
  select p_prefix || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));
$$;

create or replace function icecream_erp.inventory_advisory_lock(
  p_key text
)
returns void
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_key, ''), 0));
end;
$$;

create or replace function icecream_erp.inventory_create_posted_journal(
  p_organization_id uuid,
  p_created_by uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_description text,
  p_source_document_type text,
  p_source_document_id uuid,
  p_currency_code text default 'USD',
  p_lines jsonb default '[]'::jsonb
)
returns table (
  journal_id uuid,
  entry_number text,
  total_debit numeric,
  total_credit numeric
)
language plpgsql
as $$
declare
  v_line jsonb;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_entry_number text;
begin
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'Finance lines are required.' using errcode = '23514';
  end if;

  for v_line in
    select value
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    if nullif(v_line ->> 'accountId', '') is null then
      raise exception 'Finance line accountId is required.' using errcode = '23514';
    end if;

    v_total_debit := v_total_debit + coalesce((v_line ->> 'debitAmount')::numeric, 0);
    v_total_credit := v_total_credit + coalesce((v_line ->> 'creditAmount')::numeric, 0);
  end loop;

  if round(v_total_debit::numeric, 4) <> round(v_total_credit::numeric, 4) then
    raise exception 'Finance lines must balance.' using errcode = '23514';
  end if;

  v_entry_number := icecream_erp.inventory_next_document_number('JE');

  insert into icecream_erp.journal_entries (
    organization_id,
    branch_id,
    cost_center_code,
    entry_number,
    entry_date,
    description,
    currency_code,
    reference_type,
    reference_id,
    status,
    is_posted,
    posted_by,
    posted_at,
    created_by,
    total_debit,
    total_credit
  )
  values (
    p_organization_id,
    p_branch_id,
    p_cost_center_code,
    v_entry_number,
    coalesce(p_journal_date, current_date),
    coalesce(p_description, p_source_document_type || ' posting'),
    coalesce(nullif(p_currency_code, ''), 'USD'),
    p_source_document_type,
    p_source_document_id,
    'APPROVED',
    true,
    p_created_by,
    now(),
    p_created_by,
    v_total_debit,
    v_total_credit
  )
  returning id into journal_id;

  insert into icecream_erp.journal_entry_lines (
    journal_entry_id,
    account_id,
    branch_id,
    cost_center_code,
    description,
    debit_amount,
    credit_amount
  )
  select
    journal_id,
    nullif(value ->> 'accountId', '')::uuid,
    nullif(value ->> 'branchId', '')::uuid,
    nullif(value ->> 'costCenterCode', ''),
    nullif(value ->> 'description', ''),
    coalesce((value ->> 'debitAmount')::numeric, 0),
    coalesce((value ->> 'creditAmount')::numeric, 0)
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb));

  entry_number := v_entry_number;
  total_debit := v_total_debit;
  total_credit := v_total_credit;
  return next;
end;
$$;

create or replace function icecream_erp.post_goods_received_note_atomic(
  p_organization_id uuid,
  p_grn_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_journal_description text,
  p_finance_lines jsonb,
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
  v_journal record;
  v_existing_run icecream_erp.inventory_posting_runs%rowtype;
  v_movement_id uuid;
  v_movement_ids uuid[] := '{}';
  v_inventory_value numeric := 0;
  v_posted_at timestamptz := now();
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_header_warehouse_id uuid;
  v_item_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_amount numeric;
  v_po_status text := 'APPROVED';
  v_all_received boolean := true;
  v_any_received boolean := false;
  v_result jsonb;
begin
  if p_grn_id is null or p_organization_id is null or p_actor_user_id is null then
    raise exception 'GRN posting requires organization, document, and actor.' using errcode = '23514';
  end if;

  select *
  into v_existing_run
  from icecream_erp.inventory_posting_runs
  where organization_id = p_organization_id
    and operation_type = 'goods_received_note_post'
    and source_document_type = 'goods_received_note'
    and source_document_id = p_grn_id
  for update;

  if found then
    if p_idempotency_key is not null and v_existing_run.idempotency_key = p_idempotency_key then
      return v_existing_run.result;
    end if;
    raise exception 'Goods received note already posted.' using errcode = '23505';
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

  if coalesce(v_grn.stock_posted, false) or upper(coalesce(v_grn.status::text, '')) = 'POSTED' then
    raise exception 'Goods received note already posted.' using errcode = '23505';
  end if;

  if upper(coalesce(v_grn.quality_status, '')) <> 'APPROVED' then
    raise exception 'Goods received note must be approved before posting.' using errcode = '23514';
  end if;

  v_header_warehouse_id := coalesce(v_grn.receiving_warehouse_id, v_grn.warehouse_id);
  if v_header_warehouse_id is null then
    raise exception 'Please select a receiving warehouse before posting GRN.' using errcode = '23514';
  end if;

  select *
  into v_journal
  from icecream_erp.inventory_create_posted_journal(
    p_organization_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    p_journal_description,
    'goods_received_note',
    p_grn_id,
    'USD',
    p_finance_lines
  );

  for v_line in
    select
      g.id,
      coalesce(g.item_id, g.purchase_order_item_id, g.po_item_id) as fallback_item_source,
      g.item_id,
      coalesce(g.purchase_order_item_id, g.po_item_id) as purchase_order_item_id,
      coalesce(g.warehouse_id, v_header_warehouse_id) as warehouse_id,
      coalesce(g.batch_number, null) as batch_number,
      coalesce(g.expiry_date, null) as expiry_date,
      coalesce(g.quantity_received, g.received_quantity, g.quantity_expected, 0)::numeric as quantity_received,
      coalesce(g.unit_cost, 0)::numeric as unit_cost
    from icecream_erp.goods_received_note_items g
    where coalesce(g.goods_received_note_id, g.grn_id) = p_grn_id
    order by g.created_at, g.id
  loop
    v_item_id := v_line.item_id;

    if v_line.purchase_order_item_id is not null then
      select *
      into v_po_line
      from icecream_erp.purchase_order_items
      where id = v_line.purchase_order_item_id
      for update;

      if v_item_id is null then
        v_item_id := v_po_line.item_id;
      end if;
    end if;

    if v_item_id is null then
      raise exception 'GRN line % does not resolve an inventory item.', v_line.id using errcode = '23514';
    end if;

    v_quantity := greatest(coalesce(v_line.quantity_received, 0), 0);
    v_unit_cost := greatest(coalesce(v_line.unit_cost, 0), 0);
    v_amount := round(v_quantity * v_unit_cost, 4);

    if v_quantity <= 0 then
      continue;
    end if;

    if v_po_line.id is not null then
      if coalesce(v_po_line.quantity_received, coalesce(v_po_line.received_qty, 0), 0) + v_quantity > coalesce(v_po_line.quantity_ordered, v_po_line.quantity, 0) then
        raise exception 'GRN quantity exceeds the remaining purchase-order quantity.' using errcode = '23514';
      end if;
    end if;

    perform icecream_erp.inventory_advisory_lock(
      p_organization_id::text || ':grn:' || v_item_id::text || ':' || v_line.warehouse_id::text
    );

    select *
    into v_balance
    from icecream_erp.stock_balances
    where organization_id = p_organization_id
      and item_id = v_item_id
      and warehouse_id = v_line.warehouse_id
    order by updated_at desc, id desc
    limit 1
    for update;

    if found then
      v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) + v_quantity;
      v_new_total_value := coalesce(v_balance.total_value, coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) * coalesce(v_balance.average_cost, v_balance.avg_cost, 0), 0) + v_amount;
      v_new_average_cost := case when v_new_qty > 0 then v_new_total_value / v_new_qty else 0 end;

      update icecream_erp.stock_balances
      set quantity = v_new_qty,
          quantity_on_hand = v_new_qty,
          quantity_available = v_new_qty - coalesce(v_balance.quantity_reserved, v_balance.reserved_qty, 0),
          avg_cost = v_new_average_cost,
          average_cost = v_new_average_cost,
          total_value = v_new_total_value,
          updated_at = now(),
          last_updated = now()
      where id = v_balance.id;
    else
      v_new_qty := v_quantity;
      v_new_total_value := v_amount;
      v_new_average_cost := case when v_quantity > 0 then v_amount / v_quantity else 0 end;

      insert into icecream_erp.stock_balances (
        organization_id,
        item_id,
        warehouse_id,
        quantity,
        quantity_on_hand,
        quantity_available,
        quantity_reserved,
        reserved_qty,
        avg_cost,
        average_cost,
        total_value,
        updated_at,
        last_updated
      )
      values (
        p_organization_id,
        v_item_id,
        v_line.warehouse_id,
        v_new_qty,
        v_new_qty,
        v_new_qty,
        0,
        0,
        v_new_average_cost,
        v_new_average_cost,
        v_new_total_value,
        now(),
        now()
      );
    end if;

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
      created_by,
      created_at
    )
    values (
      p_organization_id,
      p_branch_id,
      v_item_id,
      v_line.warehouse_id,
      'PURCHASE_RECEIVE',
      icecream_erp.inventory_next_document_number('SM'),
      v_quantity,
      v_unit_cost,
      v_amount,
      v_amount,
      v_new_qty,
      v_new_total_value,
      'goods_received_note',
      p_grn_id,
      coalesce(v_grn.grn_number, p_grn_id::text),
      'goods_received_note',
      p_grn_id,
      coalesce(v_grn.grn_number, p_grn_id::text),
      v_line.batch_number,
      v_line.expiry_date,
      v_grn.notes,
      coalesce(p_journal_date, current_date),
      'POSTED',
      v_journal.journal_id,
      p_actor_user_id,
      v_posted_at
    )
    returning id into v_movement_id;

    v_movement_ids := array_append(v_movement_ids, v_movement_id);
    v_inventory_value := v_inventory_value + v_amount;

    if v_po_line.id is not null then
      update icecream_erp.purchase_order_items
      set quantity_received = coalesce(quantity_received, 0) + v_quantity,
          received_qty = coalesce(received_qty, coalesce(quantity_received, 0)) + v_quantity
      where id = v_po_line.id;
    end if;

    update icecream_erp.items
    set unit_cost = v_unit_cost
    where id = v_item_id
      and v_unit_cost > 0;
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
  set status = 'POSTED',
      stock_posted = true,
      approved_by = coalesce(approved_by, p_actor_user_id),
      approved_at = coalesce(approved_at, v_posted_at),
      posted_by = p_actor_user_id,
      posted_at = v_posted_at,
      journal_entry_id = v_journal.journal_id,
      inventory_value_posted = coalesce(v_inventory_value, 0),
      idempotency_key = coalesce(idempotency_key, p_idempotency_key),
      updated_at = now()
  where id = p_grn_id;

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
    (p_organization_id, 'goods_received_note', p_grn_id, 'journal_entry', v_journal.journal_id, 'POSTED_WITH', p_actor_user_id)
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
  select
    p_organization_id,
    'goods_received_note',
    p_grn_id,
    'stock_movement',
    movement_id,
    'POSTED_AS',
    p_actor_user_id
  from unnest(v_movement_ids) as movement_id
  on conflict do nothing;

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
    'GRN_POSTED_ATOMIC',
    'goods_received_note',
    p_grn_id,
    jsonb_build_object(
      'journalEntryId', v_journal.journal_id,
      'journalNumber', v_journal.entry_number,
      'inventoryValuePosted', v_inventory_value,
      'movementIds', to_jsonb(v_movement_ids),
      'status', 'POSTED'
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'grnId', p_grn_id,
    'journal', jsonb_build_object(
      'id', v_journal.journal_id,
      'entryNumber', v_journal.entry_number,
      'totalDebit', v_journal.total_debit,
      'totalCredit', v_journal.total_credit
    ),
    'inventoryValuePosted', v_inventory_value,
    'movementIds', to_jsonb(v_movement_ids),
    'status', 'POSTED'
  );

  insert into icecream_erp.inventory_posting_runs (
    organization_id,
    operation_type,
    source_document_type,
    source_document_id,
    idempotency_key,
    status,
    result,
    journal_entry_id,
    created_by,
    updated_at
  )
  values (
    p_organization_id,
    'goods_received_note_post',
    'goods_received_note',
    p_grn_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    v_journal.journal_id,
    p_actor_user_id,
    now()
  );

  return v_result;
end;
$$;

create or replace function icecream_erp.post_inventory_adjustment_atomic(
  p_organization_id uuid,
  p_warehouse_id uuid,
  p_item_id uuid,
  p_actor_user_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_unit_cost numeric,
  p_reason text,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_finance_lines jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_adjustment_id uuid;
  v_adjustment_number text;
  v_balance icecream_erp.stock_balances%rowtype;
  v_journal record;
  v_movement_id uuid;
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_quantity_delta numeric;
  v_total_value numeric;
  v_result jsonb;
  v_existing_run icecream_erp.inventory_posting_runs%rowtype;
begin
  if p_organization_id is null or p_warehouse_id is null or p_item_id is null or p_actor_user_id is null then
    raise exception 'Stock adjustment posting requires organization, warehouse, item, and actor.' using errcode = '23514';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Adjustment quantity must be greater than zero.' using errcode = '23514';
  end if;

  if upper(coalesce(p_movement_type, '')) not in ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT') then
    raise exception 'Unsupported stock adjustment movement type.' using errcode = '23514';
  end if;

  select *
  into v_existing_run
  from icecream_erp.inventory_posting_runs
  where organization_id = p_organization_id
    and operation_type = 'stock_adjustment_post'
    and source_document_type = 'stock_adjustment'
    and idempotency_key is not distinct from p_idempotency_key
    and p_idempotency_key is not null
  for update;

  if found then
    return v_existing_run.result;
  end if;

  perform icecream_erp.inventory_advisory_lock(
    p_organization_id::text || ':adjustment:' || p_item_id::text || ':' || p_warehouse_id::text
  );

  select *
  into v_balance
  from icecream_erp.stock_balances
  where organization_id = p_organization_id
    and item_id = p_item_id
    and warehouse_id = p_warehouse_id
  order by updated_at desc, id desc
  limit 1
  for update;

  v_quantity_delta := case when upper(p_movement_type) = 'ADJUSTMENT_IN' then p_quantity else -p_quantity end;
  v_total_value := round(abs(p_quantity) * greatest(coalesce(p_unit_cost, 0), 0), 4);

  if upper(p_movement_type) = 'ADJUSTMENT_OUT' and coalesce(v_balance.quantity_available, v_balance.quantity_on_hand, v_balance.quantity, 0) < p_quantity then
    raise exception 'Insufficient stock for the requested adjustment.' using errcode = '23514';
  end if;

  select *
  into v_journal
  from icecream_erp.inventory_create_posted_journal(
    p_organization_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    coalesce(nullif(p_reason, ''), 'Inventory adjustment'),
    'stock_adjustment',
    gen_random_uuid(),
    'USD',
    p_finance_lines
  );

  v_adjustment_id := v_journal.journal_id;
  v_adjustment_number := icecream_erp.inventory_next_document_number('ADJ');

  insert into icecream_erp.stock_adjustments (
    id,
    organization_id,
    adjustment_number,
    warehouse_id,
    adjustment_date,
    reason,
    status,
    created_by,
    approved_by,
    posted_by,
    posted_at,
    idempotency_key,
    journal_entry_id
  )
  values (
    v_adjustment_id,
    p_organization_id,
    v_adjustment_number,
    p_warehouse_id,
    coalesce(p_journal_date, current_date),
    p_reason,
    'POSTED',
    p_actor_user_id,
    p_actor_user_id,
    p_actor_user_id,
    now(),
    p_idempotency_key,
    v_journal.journal_id
  );

  if found then
    null;
  end if;

  if v_balance.id is not null then
    v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) + v_quantity_delta;
    if v_new_qty < 0 then
      raise exception 'Stock adjustment would reduce stock below zero.' using errcode = '23514';
    end if;
    v_new_total_value := case
      when upper(p_movement_type) = 'ADJUSTMENT_IN'
        then coalesce(v_balance.total_value, coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) * coalesce(v_balance.average_cost, v_balance.avg_cost, 0), 0) + v_total_value
      else greatest(
        coalesce(v_balance.total_value, coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) * coalesce(v_balance.average_cost, v_balance.avg_cost, 0), 0) - v_total_value,
        0
      )
    end;
    v_new_average_cost := case when v_new_qty > 0 then v_new_total_value / v_new_qty else 0 end;

    update icecream_erp.stock_balances
    set quantity = v_new_qty,
        quantity_on_hand = v_new_qty,
        quantity_available = v_new_qty - coalesce(v_balance.quantity_reserved, v_balance.reserved_qty, 0),
        avg_cost = v_new_average_cost,
        average_cost = v_new_average_cost,
        total_value = v_new_total_value,
        updated_at = now(),
        last_updated = now()
    where id = v_balance.id;
  else
    if upper(p_movement_type) = 'ADJUSTMENT_OUT' then
      raise exception 'Insufficient stock for the requested adjustment.' using errcode = '23514';
    end if;
    v_new_qty := p_quantity;
    v_new_total_value := v_total_value;
    v_new_average_cost := case when p_quantity > 0 then v_total_value / p_quantity else 0 end;

    insert into icecream_erp.stock_balances (
      organization_id,
      item_id,
      warehouse_id,
      quantity,
      quantity_on_hand,
      quantity_available,
      quantity_reserved,
      reserved_qty,
      avg_cost,
      average_cost,
      total_value,
      updated_at,
      last_updated
    )
    values (
      p_organization_id,
      p_item_id,
      p_warehouse_id,
      v_new_qty,
      v_new_qty,
      v_new_qty,
      0,
      0,
      v_new_average_cost,
      v_new_average_cost,
      v_new_total_value,
      now(),
      now()
    );
  end if;

  insert into icecream_erp.stock_adjustment_items (
    adjustment_id,
    item_id,
    quantity_before,
    quantity_adjusted,
    quantity_after,
    unit_cost,
    movement_type,
    reason
  )
  values (
    v_adjustment_id,
    p_item_id,
    greatest(v_new_qty - v_quantity_delta, 0),
    p_quantity,
    v_new_qty,
    greatest(coalesce(p_unit_cost, 0), 0),
    upper(p_movement_type),
    p_reason
  );

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
    created_by,
    created_at
  )
  values (
    p_organization_id,
    p_branch_id,
    p_item_id,
    p_warehouse_id,
    upper(p_movement_type)::icecream_erp.stock_movement_type,
    icecream_erp.inventory_next_document_number('SM'),
    p_quantity,
    greatest(coalesce(p_unit_cost, 0), 0),
    v_total_value,
    v_total_value,
    v_new_qty,
    v_new_total_value,
    'stock_adjustment',
    v_adjustment_id,
    v_adjustment_number,
    'stock_adjustment',
    v_adjustment_id,
    v_adjustment_number,
    p_reason,
    coalesce(p_journal_date, current_date),
    'POSTED',
    v_journal.journal_id,
    p_actor_user_id,
    now()
  )
  returning id into v_movement_id;

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
    (p_organization_id, 'stock_adjustment', v_adjustment_id, 'journal_entry', v_journal.journal_id, 'POSTED_WITH', p_actor_user_id),
    (p_organization_id, 'stock_adjustment', v_adjustment_id, 'stock_movement', v_movement_id, 'POSTED_AS', p_actor_user_id)
  on conflict do nothing;

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
    'STOCK_ADJUSTMENT_POSTED_ATOMIC',
    'stock_adjustment',
    v_adjustment_id,
    jsonb_build_object(
      'adjustmentNumber', v_adjustment_number,
      'journalEntryId', v_journal.journal_id,
      'movementId', v_movement_id,
      'movementType', upper(p_movement_type),
      'quantity', p_quantity
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'adjustmentId', v_adjustment_id,
    'adjustmentNumber', v_adjustment_number,
    'journal', jsonb_build_object(
      'id', v_journal.journal_id,
      'entryNumber', v_journal.entry_number
    ),
    'movementId', v_movement_id,
    'quantityOnHand', v_new_qty,
    'stockValue', v_new_total_value,
    'movementType', upper(p_movement_type)
  );

  insert into icecream_erp.inventory_posting_runs (
    organization_id,
    operation_type,
    source_document_type,
    source_document_id,
    idempotency_key,
    status,
    result,
    journal_entry_id,
    created_by,
    updated_at
  )
  values (
    p_organization_id,
    'stock_adjustment_post',
    'stock_adjustment',
    v_adjustment_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    v_journal.journal_id,
    p_actor_user_id,
    now()
  );

  return v_result;
end;
$$;

create or replace function icecream_erp.post_inventory_stock_take_atomic(
  p_organization_id uuid,
  p_stock_take_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_finance_lines jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_take icecream_erp.inventory_stock_takes%rowtype;
  v_line record;
  v_balance icecream_erp.stock_balances%rowtype;
  v_journal record;
  v_movement_id uuid;
  v_movement_ids uuid[] := '{}';
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_movement_type icecream_erp.stock_movement_type;
  v_result jsonb;
  v_existing_run icecream_erp.inventory_posting_runs%rowtype;
begin
  select *
  into v_existing_run
  from icecream_erp.inventory_posting_runs
  where organization_id = p_organization_id
    and operation_type = 'stock_take_post'
    and source_document_type = 'inventory_stock_take'
    and source_document_id = p_stock_take_id
  for update;

  if found then
    if p_idempotency_key is not null and v_existing_run.idempotency_key = p_idempotency_key then
      return v_existing_run.result;
    end if;
    raise exception 'Stock take already posted.' using errcode = '23505';
  end if;

  select *
  into v_take
  from icecream_erp.inventory_stock_takes
  where id = p_stock_take_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Stock take not found.' using errcode = 'P0002';
  end if;

  if upper(coalesce(v_take.status, '')) <> 'APPROVED' then
    raise exception 'Only APPROVED stock takes can be posted.' using errcode = '23514';
  end if;

  select *
  into v_journal
  from icecream_erp.inventory_create_posted_journal(
    p_organization_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    coalesce(v_take.notes, v_take.reason, 'Stock take'),
    'inventory_stock_take',
    p_stock_take_id,
    'USD',
    p_finance_lines
  );

  for v_line in
    select *
    from icecream_erp.inventory_stock_take_items
    where stock_take_id = p_stock_take_id
    order by created_at, id
  loop
    if coalesce(v_line.variance_quantity, 0) = 0 then
      continue;
    end if;

    perform icecream_erp.inventory_advisory_lock(
      p_organization_id::text || ':stock_take:' || v_line.item_id::text || ':' || v_take.warehouse_id::text
    );

    select *
    into v_balance
    from icecream_erp.stock_balances
    where organization_id = p_organization_id
      and item_id = v_line.item_id
      and warehouse_id = v_take.warehouse_id
    order by updated_at desc, id desc
    limit 1
    for update;

    if v_balance.id is null and coalesce(v_line.variance_quantity, 0) < 0 then
      raise exception 'Stock take cannot post a loss without an existing balance.' using errcode = '23514';
    end if;

    v_new_qty := greatest(coalesce(v_line.system_quantity, coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0), 0) + coalesce(v_line.variance_quantity, 0), 0);
    v_new_total_value := greatest(
      coalesce(v_balance.total_value, coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) * coalesce(v_balance.average_cost, v_balance.avg_cost, 0), 0) + coalesce(v_line.variance_value, coalesce(v_line.variance_quantity, 0) * coalesce(v_line.unit_cost, 0), 0),
      0
    );
    v_new_average_cost := case when v_new_qty > 0 then v_new_total_value / v_new_qty else 0 end;
    v_movement_type := case when coalesce(v_line.variance_quantity, 0) >= 0 then 'ADJUSTMENT_IN' else 'ADJUSTMENT_OUT' end;

    if v_balance.id is not null then
      update icecream_erp.stock_balances
      set quantity = v_new_qty,
          quantity_on_hand = v_new_qty,
          quantity_available = v_new_qty - coalesce(v_balance.quantity_reserved, v_balance.reserved_qty, 0),
          avg_cost = v_new_average_cost,
          average_cost = v_new_average_cost,
          total_value = v_new_total_value,
          updated_at = now(),
          last_updated = now()
      where id = v_balance.id;
    else
      insert into icecream_erp.stock_balances (
        organization_id,
        item_id,
        warehouse_id,
        quantity,
        quantity_on_hand,
        quantity_available,
        quantity_reserved,
        reserved_qty,
        avg_cost,
        average_cost,
        total_value,
        updated_at,
        last_updated
      )
      values (
        p_organization_id,
        v_line.item_id,
        v_take.warehouse_id,
        v_new_qty,
        v_new_qty,
        v_new_qty,
        0,
        0,
        v_new_average_cost,
        v_new_average_cost,
        v_new_total_value,
        now(),
        now()
      );
    end if;

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
      expiry_date,
      notes,
      posting_date,
      posting_status,
      journal_entry_id,
      created_by,
      created_at
    )
    values (
      p_organization_id,
      p_branch_id,
      v_line.item_id,
      v_take.warehouse_id,
      v_movement_type,
      icecream_erp.inventory_next_document_number('SM'),
      abs(v_line.variance_quantity),
      coalesce(v_line.unit_cost, 0),
      abs(coalesce(v_line.variance_value, v_line.variance_quantity * coalesce(v_line.unit_cost, 0))),
      abs(coalesce(v_line.variance_value, v_line.variance_quantity * coalesce(v_line.unit_cost, 0))),
      v_new_qty,
      v_new_total_value,
      'inventory_stock_take',
      p_stock_take_id,
      v_take.document_number,
      'inventory_stock_take',
      p_stock_take_id,
      v_take.document_number,
      v_line.expiry_date,
      coalesce(v_line.reason, v_take.reason, v_take.notes),
      coalesce(p_journal_date, current_date),
      'POSTED',
      v_journal.journal_id,
      p_actor_user_id,
      now()
    )
    returning id into v_movement_id;

    update icecream_erp.inventory_stock_take_items
    set posted_movement_id = v_movement_id,
        variance_value = coalesce(variance_value, variance_quantity * coalesce(unit_cost, 0)),
        updated_at = now()
    where id = v_line.id;

    v_movement_ids := array_append(v_movement_ids, v_movement_id);
  end loop;

  update icecream_erp.inventory_stock_takes
  set status = 'POSTED',
      posted_by = p_actor_user_id,
      posted_at = now(),
      idempotency_key = coalesce(idempotency_key, p_idempotency_key),
      updated_at = now()
  where id = p_stock_take_id;

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
    (p_organization_id, 'inventory_stock_take', p_stock_take_id, 'journal_entry', v_journal.journal_id, 'POSTED_WITH', p_actor_user_id)
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
  select
    p_organization_id,
    'inventory_stock_take',
    p_stock_take_id,
    'stock_movement',
    movement_id,
    'POSTED_AS',
    p_actor_user_id
  from unnest(v_movement_ids) as movement_id
  on conflict do nothing;

  v_result := jsonb_build_object(
    'success', true,
    'stockTakeId', p_stock_take_id,
    'status', 'POSTED',
    'journal', jsonb_build_object(
      'id', v_journal.journal_id,
      'entryNumber', v_journal.entry_number
    ),
    'movementIds', to_jsonb(v_movement_ids)
  );

  insert into icecream_erp.inventory_posting_runs (
    organization_id,
    operation_type,
    source_document_type,
    source_document_id,
    idempotency_key,
    status,
    result,
    journal_entry_id,
    created_by,
    updated_at
  )
  values (
    p_organization_id,
    'stock_take_post',
    'inventory_stock_take',
    p_stock_take_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    v_journal.journal_id,
    p_actor_user_id,
    now()
  );

  return v_result;
end;
$$;

create or replace function icecream_erp.post_inventory_write_off_atomic(
  p_organization_id uuid,
  p_batch_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_reason text,
  p_finance_lines jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_batch icecream_erp.inventory_batches%rowtype;
  v_balance icecream_erp.stock_balances%rowtype;
  v_journal record;
  v_movement_id uuid;
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_write_off_value numeric;
  v_result jsonb;
  v_existing_run icecream_erp.inventory_posting_runs%rowtype;
begin
  select *
  into v_existing_run
  from icecream_erp.inventory_posting_runs
  where organization_id = p_organization_id
    and operation_type = 'inventory_write_off_post'
    and source_document_type = 'inventory_write_off'
    and source_document_id = p_batch_id
  for update;

  if found then
    if p_idempotency_key is not null and v_existing_run.idempotency_key = p_idempotency_key then
      return v_existing_run.result;
    end if;
    raise exception 'Inventory batch already written off.' using errcode = '23505';
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

  if v_batch.expiry_date is null or v_batch.expiry_date > current_date then
    raise exception 'Only expired batches can be written off.' using errcode = '23514';
  end if;

  if coalesce(v_batch.quantity_remaining, 0) <= 0 then
    raise exception 'Batch has no remaining quantity to write off.' using errcode = '23514';
  end if;

  perform icecream_erp.inventory_advisory_lock(
    p_organization_id::text || ':writeoff:' || v_batch.item_id::text || ':' || v_batch.warehouse_id::text
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

  if v_balance.id is null or coalesce(v_balance.quantity_available, v_balance.quantity_on_hand, v_balance.quantity, 0) < v_batch.quantity_remaining then
    raise exception 'Insufficient stock for write-off.' using errcode = '23514';
  end if;

  select *
  into v_journal
  from icecream_erp.inventory_create_posted_journal(
    p_organization_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    coalesce(nullif(p_reason, ''), 'Inventory write-off'),
    'inventory_write_off',
    p_batch_id,
    'USD',
    p_finance_lines
  );

  v_write_off_value := round(coalesce(v_batch.quantity_remaining, 0) * coalesce(v_batch.unit_cost, 0), 4);
  v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) - v_batch.quantity_remaining;
  v_new_total_value := greatest(coalesce(v_balance.total_value, coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) * coalesce(v_balance.average_cost, v_balance.avg_cost, 0), 0) - v_write_off_value, 0);
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
  set quantity_remaining = 0,
      status = 'EXPIRED'
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
    created_by,
    created_at
  )
  values (
    p_organization_id,
    p_branch_id,
    v_batch.item_id,
    v_batch.warehouse_id,
    'EXPIRY_WRITE_OFF',
    icecream_erp.inventory_next_document_number('SM'),
    v_batch.quantity_remaining,
    coalesce(v_batch.unit_cost, 0),
    v_write_off_value,
    v_write_off_value,
    v_new_qty,
    v_new_total_value,
    'inventory_write_off',
    p_batch_id,
    coalesce(v_batch.batch_number, p_batch_id::text),
    'inventory_write_off',
    p_batch_id,
    coalesce(v_batch.batch_number, p_batch_id::text),
    v_batch.batch_number,
    v_batch.expiry_date,
    p_reason,
    coalesce(p_journal_date, current_date),
    'POSTED',
    v_journal.journal_id,
    p_actor_user_id,
    now()
  )
  returning id into v_movement_id;

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
    (p_organization_id, 'inventory_write_off', p_batch_id, 'journal_entry', v_journal.journal_id, 'POSTED_WITH', p_actor_user_id),
    (p_organization_id, 'inventory_write_off', p_batch_id, 'stock_movement', v_movement_id, 'POSTED_AS', p_actor_user_id)
  on conflict do nothing;

  v_result := jsonb_build_object(
    'success', true,
    'batchId', p_batch_id,
    'journal', jsonb_build_object(
      'id', v_journal.journal_id,
      'entryNumber', v_journal.entry_number
    ),
    'movementId', v_movement_id,
    'quantityOnHand', v_new_qty,
    'stockValue', v_new_total_value,
    'status', 'POSTED'
  );

  insert into icecream_erp.inventory_posting_runs (
    organization_id,
    operation_type,
    source_document_type,
    source_document_id,
    idempotency_key,
    status,
    result,
    journal_entry_id,
    created_by,
    updated_at
  )
  values (
    p_organization_id,
    'inventory_write_off_post',
    'inventory_write_off',
    p_batch_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    v_journal.journal_id,
    p_actor_user_id,
    now()
  );

  return v_result;
end;
$$;

create or replace function icecream_erp.dispatch_stock_transfer_atomic(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_finance_lines jsonb,
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
  v_journal record;
  v_movement_id uuid;
  v_movement_ids uuid[] := '{}';
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_result jsonb;
  v_existing_run icecream_erp.inventory_posting_runs%rowtype;
  v_source_branch_id uuid;
  v_destination_branch_id uuid;
begin
  select *
  into v_existing_run
  from icecream_erp.inventory_posting_runs
  where organization_id = p_organization_id
    and operation_type = 'stock_transfer_dispatch'
    and source_document_type = 'stock_transfer'
    and source_document_id = p_transfer_id
  for update;

  if found then
    if p_idempotency_key is not null and v_existing_run.idempotency_key = p_idempotency_key then
      return v_existing_run.result;
    end if;
    raise exception 'Stock transfer already dispatched.' using errcode = '23505';
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

  if upper(coalesce(v_transfer.status::text, '')) not in ('APPROVED', 'DRAFT') then
    raise exception 'Only approved transfers can be dispatched.' using errcode = '23514';
  end if;

  if coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse) = coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse) then
    raise exception 'Source and destination cannot be the same.' using errcode = '23514';
  end if;

  select branch_id into v_source_branch_id from icecream_erp.warehouses where id = coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse);
  select branch_id into v_destination_branch_id from icecream_erp.warehouses where id = coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse);

  select *
  into v_journal
  from icecream_erp.inventory_create_posted_journal(
    p_organization_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    'Transfer dispatch ' || coalesce(v_transfer.transfer_number, p_transfer_id::text),
    'stock_transfer_dispatch',
    p_transfer_id,
    'USD',
    p_finance_lines
  );

  for v_item in
    select *
    from icecream_erp.stock_transfer_items
    where transfer_id = p_transfer_id
    order by id
    for update
  loop
    if coalesce(v_item.quantity_requested, v_item.quantity, 0) <= 0 then
      raise exception 'Transfer line quantity must be greater than zero.' using errcode = '23514';
    end if;

    perform icecream_erp.inventory_advisory_lock(
      p_organization_id::text || ':transfer_dispatch:' || v_item.item_id::text || ':' || coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse)::text
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

    if v_balance.id is null or coalesce(v_balance.quantity_available, v_balance.quantity_on_hand, v_balance.quantity, 0) < coalesce(v_item.quantity_requested, v_item.quantity, 0) then
      raise exception 'Insufficient stock for dispatch.' using errcode = '23514';
    end if;

    v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) - coalesce(v_item.quantity_requested, v_item.quantity, 0);
    v_new_total_value := greatest(coalesce(v_balance.total_value, coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) * coalesce(v_balance.average_cost, v_balance.avg_cost, 0), 0) - (coalesce(v_item.quantity_requested, v_item.quantity, 0) * coalesce(v_item.unit_cost, 0)), 0);
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
      created_by,
      created_at
    )
    values (
      p_organization_id,
      v_source_branch_id,
      v_source_branch_id,
      v_destination_branch_id,
      v_item.item_id,
      coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse),
      coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse),
      coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse),
      'TRANSFER_OUT',
      icecream_erp.inventory_next_document_number('SM'),
      coalesce(v_item.quantity_requested, v_item.quantity, 0),
      coalesce(v_item.unit_cost, 0),
      coalesce(v_item.quantity_requested, v_item.quantity, 0) * coalesce(v_item.unit_cost, 0),
      coalesce(v_item.quantity_requested, v_item.quantity, 0) * coalesce(v_item.unit_cost, 0),
      v_new_qty,
      v_new_total_value,
      'stock_transfer',
      p_transfer_id,
      coalesce(v_transfer.transfer_number, p_transfer_id::text),
      'stock_transfer_dispatch',
      p_transfer_id,
      coalesce(v_transfer.transfer_number, p_transfer_id::text),
      v_item.batch_number,
      v_item.expiry_date,
      v_transfer.notes,
      coalesce(p_journal_date, current_date),
      'POSTED',
      v_journal.journal_id,
      p_actor_user_id,
      now()
    )
    returning id into v_movement_id;

    v_movement_ids := array_append(v_movement_ids, v_movement_id);

    update icecream_erp.stock_transfer_items
    set quantity_sent = coalesce(quantity_requested, quantity, 0)
    where id = v_item.id;
  end loop;

  update icecream_erp.stock_transfers
  set status = 'IN_TRANSIT',
      dispatched_at = now(),
      dispatched_by = p_actor_user_id,
      dispatch_journal_entry_id = v_journal.journal_id,
      approved_at = coalesce(approved_at, now())
  where id = p_transfer_id;

  v_result := jsonb_build_object(
    'success', true,
    'transferId', p_transfer_id,
    'status', 'IN_TRANSIT',
    'journal', jsonb_build_object(
      'id', v_journal.journal_id,
      'entryNumber', v_journal.entry_number
    ),
    'movementIds', to_jsonb(v_movement_ids)
  );

  insert into icecream_erp.inventory_posting_runs (
    organization_id,
    operation_type,
    source_document_type,
    source_document_id,
    idempotency_key,
    status,
    result,
    journal_entry_id,
    created_by,
    updated_at
  )
  values (
    p_organization_id,
    'stock_transfer_dispatch',
    'stock_transfer',
    p_transfer_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    v_journal.journal_id,
    p_actor_user_id,
    now()
  );

  return v_result;
end;
$$;

create or replace function icecream_erp.receive_stock_transfer_atomic(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_actor_user_id uuid,
  p_branch_id uuid,
  p_cost_center_code text,
  p_journal_date date,
  p_receipt_lines jsonb,
  p_finance_lines jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_transfer icecream_erp.stock_transfers%rowtype;
  v_receipt jsonb;
  v_transfer_item icecream_erp.stock_transfer_items%rowtype;
  v_balance icecream_erp.stock_balances%rowtype;
  v_journal record;
  v_movement_id uuid;
  v_movement_ids uuid[] := '{}';
  v_new_qty numeric;
  v_new_total_value numeric;
  v_new_average_cost numeric;
  v_receipt_quantity numeric;
  v_total_sent numeric;
  v_total_received numeric;
  v_result jsonb;
  v_existing_run icecream_erp.inventory_posting_runs%rowtype;
  v_source_branch_id uuid;
  v_destination_branch_id uuid;
begin
  select *
  into v_transfer
  from icecream_erp.stock_transfers
  where id = p_transfer_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Stock transfer not found.' using errcode = 'P0002';
  end if;

  if upper(coalesce(v_transfer.status::text, '')) not in ('IN_TRANSIT', 'PARTIALLY_RECEIVED') then
    raise exception 'Only in-transit transfers can be received.' using errcode = '23514';
  end if;

  select branch_id into v_source_branch_id from icecream_erp.warehouses where id = coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse);
  select branch_id into v_destination_branch_id from icecream_erp.warehouses where id = coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse);

  select *
  into v_journal
  from icecream_erp.inventory_create_posted_journal(
    p_organization_id,
    p_actor_user_id,
    p_branch_id,
    p_cost_center_code,
    p_journal_date,
    'Transfer receipt ' || coalesce(v_transfer.transfer_number, p_transfer_id::text),
    'stock_transfer_receipt',
    p_transfer_id,
    'USD',
    p_finance_lines
  );

  for v_receipt in
    select value
    from jsonb_array_elements(coalesce(p_receipt_lines, '[]'::jsonb))
  loop
    select *
    into v_transfer_item
    from icecream_erp.stock_transfer_items
    where id = nullif(v_receipt ->> 'transferItemId', '')::uuid
      and transfer_id = p_transfer_id
    for update;

    if not found then
      raise exception 'Transfer receipt line references an invalid transfer item.' using errcode = '23514';
    end if;

    v_receipt_quantity := coalesce((v_receipt ->> 'quantityReceived')::numeric, 0);
    if v_receipt_quantity <= 0 then
      raise exception 'Receipt quantity must be greater than zero.' using errcode = '23514';
    end if;

    if coalesce(v_transfer_item.quantity_received, 0) + v_receipt_quantity > coalesce(v_transfer_item.quantity_sent, 0) then
      raise exception 'Receipt quantity exceeds the dispatched quantity.' using errcode = '23514';
    end if;

    perform icecream_erp.inventory_advisory_lock(
      p_organization_id::text || ':transfer_receipt:' || v_transfer_item.item_id::text || ':' || coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse)::text
    );

    select *
    into v_balance
    from icecream_erp.stock_balances
    where organization_id = p_organization_id
      and item_id = v_transfer_item.item_id
      and warehouse_id = coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse)
    order by updated_at desc, id desc
    limit 1
    for update;

    if v_balance.id is not null then
      v_new_qty := coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) + v_receipt_quantity;
      v_new_total_value := coalesce(v_balance.total_value, coalesce(v_balance.quantity_on_hand, v_balance.quantity, 0) * coalesce(v_balance.average_cost, v_balance.avg_cost, 0), 0) + (v_receipt_quantity * coalesce(v_transfer_item.unit_cost, 0));
      v_new_average_cost := case when v_new_qty > 0 then v_new_total_value / v_new_qty else 0 end;

      update icecream_erp.stock_balances
      set quantity = v_new_qty,
          quantity_on_hand = v_new_qty,
          quantity_available = v_new_qty - coalesce(v_balance.quantity_reserved, v_balance.reserved_qty, 0),
          avg_cost = v_new_average_cost,
          average_cost = v_new_average_cost,
          total_value = v_new_total_value,
          updated_at = now(),
          last_updated = now()
      where id = v_balance.id;
    else
      v_new_qty := v_receipt_quantity;
      v_new_total_value := v_receipt_quantity * coalesce(v_transfer_item.unit_cost, 0);
      v_new_average_cost := case when v_new_qty > 0 then v_new_total_value / v_new_qty else 0 end;

      insert into icecream_erp.stock_balances (
        organization_id,
        item_id,
        warehouse_id,
        quantity,
        quantity_on_hand,
        quantity_available,
        quantity_reserved,
        reserved_qty,
        avg_cost,
        average_cost,
        total_value,
        updated_at,
        last_updated
      )
      values (
        p_organization_id,
        v_transfer_item.item_id,
        coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse),
        v_new_qty,
        v_new_qty,
        v_new_qty,
        0,
        0,
        v_new_average_cost,
        v_new_average_cost,
        v_new_total_value,
        now(),
        now()
      );
    end if;

    update icecream_erp.stock_transfer_items
    set quantity_received = coalesce(quantity_received, 0) + v_receipt_quantity
    where id = v_transfer_item.id;

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
      created_by,
      created_at
    )
    values (
      p_organization_id,
      v_destination_branch_id,
      v_source_branch_id,
      v_destination_branch_id,
      v_transfer_item.item_id,
      coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse),
      coalesce(v_transfer.from_warehouse_id, v_transfer.from_warehouse),
      coalesce(v_transfer.to_warehouse_id, v_transfer.to_warehouse),
      'TRANSFER_IN',
      icecream_erp.inventory_next_document_number('SM'),
      v_receipt_quantity,
      coalesce(v_transfer_item.unit_cost, 0),
      v_receipt_quantity * coalesce(v_transfer_item.unit_cost, 0),
      v_receipt_quantity * coalesce(v_transfer_item.unit_cost, 0),
      v_new_qty,
      v_new_total_value,
      'stock_transfer',
      p_transfer_id,
      coalesce(v_transfer.transfer_number, p_transfer_id::text),
      'stock_transfer_receipt',
      p_transfer_id,
      coalesce(v_transfer.transfer_number, p_transfer_id::text),
      v_transfer_item.batch_number,
      v_transfer_item.expiry_date,
      v_transfer.notes,
      coalesce(p_journal_date, current_date),
      'POSTED',
      v_journal.journal_id,
      p_actor_user_id,
      now()
    )
    returning id into v_movement_id;

    v_movement_ids := array_append(v_movement_ids, v_movement_id);
  end loop;

  select
    sum(coalesce(quantity_sent, 0)),
    sum(coalesce(quantity_received, 0))
  into v_total_sent, v_total_received
  from icecream_erp.stock_transfer_items
  where transfer_id = p_transfer_id;

  update icecream_erp.stock_transfers
  set status = case
        when coalesce(v_total_received, 0) >= coalesce(v_total_sent, 0) then 'COMPLETED'
        else 'PARTIALLY_RECEIVED'
      end,
      received_at = now(),
      received_by = p_actor_user_id,
      receipt_journal_entry_id = v_journal.journal_id
  where id = p_transfer_id;

  v_result := jsonb_build_object(
    'success', true,
    'transferId', p_transfer_id,
    'status', case when coalesce(v_total_received, 0) >= coalesce(v_total_sent, 0) then 'COMPLETED' else 'PARTIALLY_RECEIVED' end,
    'journal', jsonb_build_object(
      'id', v_journal.journal_id,
      'entryNumber', v_journal.entry_number
    ),
    'movementIds', to_jsonb(v_movement_ids),
    'remainingInTransitQuantity', greatest(coalesce(v_total_sent, 0) - coalesce(v_total_received, 0), 0)
  );

  insert into icecream_erp.inventory_posting_runs (
    organization_id,
    operation_type,
    source_document_type,
    source_document_id,
    idempotency_key,
    status,
    result,
    journal_entry_id,
    created_by,
    updated_at
  )
  values (
    p_organization_id,
    'stock_transfer_receipt',
    'stock_transfer',
    p_transfer_id,
    p_idempotency_key,
    'POSTED',
    v_result,
    v_journal.journal_id,
    p_actor_user_id,
    now()
  );

  return v_result;
end;
$$;

revoke all on function icecream_erp.inventory_next_document_number(text) from public;
revoke all on function icecream_erp.inventory_advisory_lock(text) from public;
revoke all on function icecream_erp.inventory_create_posted_journal(uuid, uuid, uuid, text, date, text, text, uuid, text, jsonb) from public;
revoke all on function icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from public;
revoke all on function icecream_erp.post_inventory_adjustment_atomic(uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, date, jsonb, text) from public;
revoke all on function icecream_erp.post_inventory_stock_take_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text) from public;
revoke all on function icecream_erp.post_inventory_write_off_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from public;
revoke all on function icecream_erp.dispatch_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text) from public;
revoke all on function icecream_erp.receive_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, jsonb, text) from public;
revoke all on function icecream_erp.inventory_next_document_number(text) from anon;
revoke all on function icecream_erp.inventory_advisory_lock(text) from anon;
revoke all on function icecream_erp.inventory_create_posted_journal(uuid, uuid, uuid, text, date, text, text, uuid, text, jsonb) from anon;
revoke all on function icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from anon;
revoke all on function icecream_erp.post_inventory_adjustment_atomic(uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, date, jsonb, text) from anon;
revoke all on function icecream_erp.post_inventory_stock_take_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text) from anon;
revoke all on function icecream_erp.post_inventory_write_off_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from anon;
revoke all on function icecream_erp.dispatch_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text) from anon;
revoke all on function icecream_erp.receive_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, jsonb, text) from anon;
revoke all on function icecream_erp.inventory_next_document_number(text) from authenticated;
revoke all on function icecream_erp.inventory_advisory_lock(text) from authenticated;
revoke all on function icecream_erp.inventory_create_posted_journal(uuid, uuid, uuid, text, date, text, text, uuid, text, jsonb) from authenticated;
revoke all on function icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from authenticated;
revoke all on function icecream_erp.post_inventory_adjustment_atomic(uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, date, jsonb, text) from authenticated;
revoke all on function icecream_erp.post_inventory_stock_take_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text) from authenticated;
revoke all on function icecream_erp.post_inventory_write_off_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from authenticated;
revoke all on function icecream_erp.dispatch_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text) from authenticated;
revoke all on function icecream_erp.receive_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, jsonb, text) from authenticated;

grant execute on function icecream_erp.inventory_next_document_number(text) to service_role;
grant execute on function icecream_erp.inventory_advisory_lock(text) to service_role;
grant execute on function icecream_erp.inventory_create_posted_journal(uuid, uuid, uuid, text, date, text, text, uuid, text, jsonb) to service_role;
grant execute on function icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) to service_role;
grant execute on function icecream_erp.post_inventory_adjustment_atomic(uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, date, jsonb, text) to service_role;
grant execute on function icecream_erp.post_inventory_stock_take_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text) to service_role;
grant execute on function icecream_erp.post_inventory_write_off_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) to service_role;
grant execute on function icecream_erp.dispatch_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text) to service_role;
grant execute on function icecream_erp.receive_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, jsonb, text) to service_role;

notify pgrst, 'reload schema';
