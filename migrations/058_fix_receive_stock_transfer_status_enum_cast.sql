-- Fix stock transfer receipt posting so transfer status writes cast correctly.
-- Keep the live-compatible stock balance semantics from migration 044.

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
  set status = (
        case
          when coalesce(v_total_received, 0) >= coalesce(v_total_sent, 0) then 'COMPLETED'
          else 'PARTIALLY_RECEIVED'
        end
      )::icecream_erp.transfer_status,
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

notify pgrst, 'reload schema';
