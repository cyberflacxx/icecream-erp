-- 038_production_order_transaction_rpcs.sql
-- Transactional issue, receipt, reversal, and close RPCs.
-- Rollback approach: drop RPCs first, then document tables only after export.

create or replace function icecream_erp.post_production_issue(
  p_order_id uuid,
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_actor_user_account_id uuid,
  p_issue_date date,
  p_lines jsonb,
  p_department text,
  p_shift text,
  p_remarks text,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_order record;
  v_issue_id uuid;
  v_issue_number text;
  v_line jsonb;
  v_component record;
  v_balance record;
  v_quantity numeric(18,4);
  v_unit_cost numeric(18,4);
  v_line_cost numeric(18,2);
  v_total_qty numeric(18,4) := 0;
  v_total_cost numeric(18,2) := 0;
  v_existing uuid;
begin
  select id into v_existing
  from icecream_erp.production_issues
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key
    and p_idempotency_key is not null;
  if found then
    return jsonb_build_object('success', false, 'code', 'CONFLICT', 'message', 'Issue has already been posted.', 'productionIssueId', v_existing);
  end if;

  select *
  into v_order
  from icecream_erp.production_orders
  where id = p_order_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Production order not found.' using errcode = 'P0002';
  end if;
  if v_order.status <> 'RELEASED' then
    raise exception 'Issue for Production requires a RELEASED production order.' using errcode = '23514';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one issue line is required.' using errcode = '22023';
  end if;

  v_issue_number := icecream_erp.production_next_document_number(p_organization_id, 'PRODUCTION_ISSUE', 'PIS');

  insert into icecream_erp.production_issues (
    organization_id, branch_id, production_order_id, issue_number, issue_date,
    production_warehouse_id, department, shift, posting_status, remarks,
    idempotency_key, issued_by, posted_by, posted_at
  )
  values (
    p_organization_id, v_order.branch_id, p_order_id, v_issue_number, coalesce(p_issue_date, current_date),
    v_order.production_warehouse_id, p_department, p_shift, 'POSTED', p_remarks,
    p_idempotency_key, p_actor_user_profile_id, p_actor_user_profile_id, now()
  )
  returning id into v_issue_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_quantity := nullif(v_line->>'currentIssueQuantity', '')::numeric;
    if v_quantity is null then
      v_quantity := nullif(v_line->>'quantity', '')::numeric;
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Issue quantity must be greater than zero.' using errcode = '22023';
    end if;

    select *
    into v_component
    from icecream_erp.production_order_components
    where id = (v_line->>'componentId')::uuid
      and production_order_id = p_order_id
      and organization_id = p_organization_id
    for update;

    if not found then
      raise exception 'Production order component not found.' using errcode = 'P0002';
    end if;

    if v_component.issued_quantity + v_quantity > v_component.released_quantity then
      raise exception 'Issue quantity exceeds released component requirement for %.', v_component.component_number_snapshot using errcode = '23514';
    end if;

    select *
    into v_balance
    from icecream_erp.stock_balances
    where organization_id = p_organization_id
      and item_id = v_component.component_item_id
      and warehouse_id = coalesce(nullif(v_line->>'warehouseId', '')::uuid, v_component.warehouse_id)
    for update;

    if not found then
      raise exception 'No stock balance found for component %.', v_component.component_number_snapshot using errcode = 'P0002';
    end if;

    if coalesce(v_balance.quantity_available, v_balance.quantity_on_hand - v_balance.quantity_reserved, 0) < v_quantity then
      raise exception 'Insufficient available stock for component %.', v_component.component_number_snapshot using errcode = '23514';
    end if;

    v_unit_cost := coalesce(nullif(v_line->>'unitCost', '')::numeric, v_component.unit_cost_snapshot, v_balance.avg_cost, 0);
    v_line_cost := round((v_quantity * v_unit_cost)::numeric, 2);

    update icecream_erp.stock_balances
    set
      quantity_on_hand = quantity_on_hand - v_quantity,
      quantity_available = quantity_available - v_quantity,
      quantity = quantity_on_hand - v_quantity,
      total_value = greatest(coalesce(total_value, quantity_on_hand * coalesce(avg_cost, 0)) - v_line_cost, 0),
      last_updated = now(),
      updated_at = now()
    where id = v_balance.id;

    insert into icecream_erp.stock_movements (
      organization_id, item_id, warehouse_id, movement_type, quantity, unit_cost, total_cost, total_value,
      reference_type, reference_id, source_document_type, source_document_id, reference_number,
      batch_number, expiry_date, notes, created_by, running_balance
    )
    values (
      p_organization_id, v_component.component_item_id, v_balance.warehouse_id, 'PRODUCTION_ISSUE',
      v_quantity, v_unit_cost, v_line_cost, v_line_cost,
      'production_issue', v_issue_id, 'production_issue', v_issue_id, v_issue_number,
      nullif(v_line->>'batchNumber', ''), nullif(v_line->>'expiryDate', '')::date,
      p_remarks, p_actor_user_account_id, v_balance.quantity_on_hand - v_quantity
    );

    insert into icecream_erp.production_issue_lines (
      organization_id, production_issue_id, production_order_id, production_order_component_id,
      component_item_id, component_number_snapshot, component_description_snapshot,
      planned_quantity, released_requirement, previously_issued_quantity, current_issue_quantity,
      total_issued_quantity, available_quantity_snapshot, warehouse_id, batch_number, expiry_date,
      uom_id, unit_cost, line_cost, variance, remarks
    )
    values (
      p_organization_id, v_issue_id, p_order_id, v_component.id,
      v_component.component_item_id, v_component.component_number_snapshot, v_component.component_description_snapshot,
      v_component.planned_quantity, v_component.released_quantity, v_component.issued_quantity, v_quantity,
      v_component.issued_quantity + v_quantity, coalesce(v_balance.quantity_available, 0), v_balance.warehouse_id,
      nullif(v_line->>'batchNumber', ''), nullif(v_line->>'expiryDate', '')::date,
      v_component.uom_id, v_unit_cost, v_line_cost, (v_component.issued_quantity + v_quantity) - v_component.released_quantity,
      nullif(v_line->>'remarks', '')
    );

    update icecream_erp.production_order_components
    set
      issued_quantity = issued_quantity + v_quantity,
      actual_cost = actual_cost + v_line_cost,
      shortage_quantity = greatest(released_quantity - (issued_quantity + v_quantity), 0),
      line_status = case when issued_quantity + v_quantity >= released_quantity then 'ISSUED' else 'PARTIAL' end,
      updated_at = now()
    where id = v_component.id;

    v_total_qty := v_total_qty + v_quantity;
    v_total_cost := v_total_cost + v_line_cost;
  end loop;

  update icecream_erp.production_issues
  set total_quantity = v_total_qty, total_cost = v_total_cost, updated_at = now()
  where id = v_issue_id;

  update icecream_erp.production_orders
  set actual_cost = actual_cost + v_total_cost, updated_at = now(), version_number = version_number + 1
  where id = p_order_id;

  insert into icecream_erp.production_document_links (
    organization_id, production_order_id, from_document_type, from_document_id, to_document_type, to_document_id, relationship_type, created_by
  )
  values (p_organization_id, p_order_id, 'production_order', p_order_id, 'production_issue', v_issue_id, 'ISSUES_MATERIAL_TO', p_actor_user_profile_id)
  on conflict do nothing;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id, p_actor_user_account_id, p_actor_user_profile_id,
    'PRODUCTION_ISSUE_POSTED', 'production_issues', v_issue_id, 'production_issue', v_issue_id,
    jsonb_build_object('productionOrderId', p_order_id, 'totalQuantity', v_total_qty, 'totalCost', v_total_cost)
  );

  return jsonb_build_object('success', true, 'productionIssueId', v_issue_id, 'issueNumber', v_issue_number, 'totalQuantity', v_total_qty, 'totalCost', v_total_cost);
end;
$$;

create or replace function icecream_erp.post_production_receipt(
  p_order_id uuid,
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_actor_user_account_id uuid,
  p_receipt_date date,
  p_completed_quantity numeric,
  p_rejected_quantity numeric,
  p_wastage_quantity numeric,
  p_batch_number text,
  p_production_date date,
  p_expiry_date date,
  p_remarks text,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_order record;
  v_balance record;
  v_receipt_id uuid;
  v_receipt_number text;
  v_completed numeric(18,4) := coalesce(p_completed_quantity, 0);
  v_rejected numeric(18,4) := coalesce(p_rejected_quantity, 0);
  v_wastage numeric(18,4) := coalesce(p_wastage_quantity, 0);
  v_unit_cost numeric(18,4);
  v_total_cost numeric(18,2);
  v_existing uuid;
begin
  select id into v_existing
  from icecream_erp.production_receipts
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key
    and p_idempotency_key is not null;
  if found then
    return jsonb_build_object('success', false, 'code', 'CONFLICT', 'message', 'Receipt has already been posted.', 'productionReceiptId', v_existing);
  end if;

  if v_completed <= 0 and v_rejected <= 0 and v_wastage <= 0 then
    raise exception 'Receipt must include completed, rejected, or wastage quantity.' using errcode = '22023';
  end if;

  select *
  into v_order
  from icecream_erp.production_orders
  where id = p_order_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Production order not found.' using errcode = 'P0002';
  end if;
  if v_order.status <> 'RELEASED' then
    raise exception 'Receipt from Production requires a RELEASED production order.' using errcode = '23514';
  end if;
  if v_order.completed_quantity + v_completed + v_rejected > v_order.released_quantity then
    raise exception 'Receipt quantities exceed released production quantity.' using errcode = '23514';
  end if;

  v_unit_cost := case
    when v_order.completed_quantity + v_completed > 0 then round((v_order.actual_cost / (v_order.completed_quantity + v_completed))::numeric, 4)
    else 0
  end;
  v_total_cost := round((v_completed * v_unit_cost)::numeric, 2);
  v_receipt_number := icecream_erp.production_next_document_number(p_organization_id, 'PRODUCTION_RECEIPT', 'PRC');

  insert into icecream_erp.production_receipts (
    organization_id, branch_id, production_order_id, receipt_number, receipt_date,
    finished_goods_warehouse_id, posting_status, total_completed_quantity, total_rejected_quantity,
    total_wastage_quantity, total_cost, remarks, idempotency_key, received_by, posted_by, posted_at
  )
  values (
    p_organization_id, v_order.branch_id, p_order_id, v_receipt_number, coalesce(p_receipt_date, current_date),
    v_order.finished_goods_warehouse_id, 'POSTED', v_completed, v_rejected, v_wastage, v_total_cost,
    p_remarks, p_idempotency_key, p_actor_user_profile_id, p_actor_user_profile_id, now()
  )
  returning id into v_receipt_id;

  if v_completed > 0 then
    select *
    into v_balance
    from icecream_erp.stock_balances
    where organization_id = p_organization_id
      and item_id = v_order.product_id
      and warehouse_id = v_order.finished_goods_warehouse_id
    for update;

    if found then
      update icecream_erp.stock_balances
      set
        avg_cost = case
          when quantity_on_hand + v_completed > 0 then round(((quantity_on_hand * coalesce(avg_cost, 0)) + v_total_cost) / (quantity_on_hand + v_completed), 4)
          else avg_cost
        end,
        quantity_on_hand = quantity_on_hand + v_completed,
        quantity_available = quantity_available + v_completed,
        quantity = quantity_on_hand + v_completed,
        total_value = coalesce(total_value, quantity_on_hand * coalesce(avg_cost, 0)) + v_total_cost,
        last_updated = now(),
        updated_at = now()
      where id = v_balance.id;
    else
      insert into icecream_erp.stock_balances (
        organization_id, item_id, warehouse_id, quantity, reserved_qty, avg_cost,
        quantity_on_hand, quantity_available, quantity_reserved, total_value, last_updated, updated_at
      )
      values (
        p_organization_id, v_order.product_id, v_order.finished_goods_warehouse_id, v_completed, 0, v_unit_cost,
        v_completed, v_completed, 0, v_total_cost, now(), now()
      )
      returning * into v_balance;
    end if;

    insert into icecream_erp.stock_movements (
      organization_id, item_id, warehouse_id, movement_type, quantity, unit_cost, total_cost, total_value,
      reference_type, reference_id, source_document_type, source_document_id, reference_number,
      batch_number, expiry_date, notes, created_by, running_balance
    )
    values (
      p_organization_id, v_order.product_id, v_order.finished_goods_warehouse_id, 'PRODUCTION_OUTPUT',
      v_completed, v_unit_cost, v_total_cost, v_total_cost,
      'production_receipt', v_receipt_id, 'production_receipt', v_receipt_id, v_receipt_number,
      nullif(p_batch_number, ''), p_expiry_date, p_remarks, p_actor_user_account_id, coalesce(v_balance.quantity_on_hand, 0) + v_completed
    );
  end if;

  insert into icecream_erp.production_receipt_lines (
    organization_id, production_receipt_id, production_order_id, finished_product_id,
    finished_product_number_snapshot, finished_product_description_snapshot, planned_quantity, released_quantity,
    previously_received_quantity, current_completed_quantity, current_rejected_quantity, current_wastage_quantity,
    total_received_quantity, remaining_quantity, uom_id, batch_number, production_date, expiry_date,
    unit_production_cost, total_production_cost, warehouse_id, remarks
  )
  values (
    p_organization_id, v_receipt_id, p_order_id, v_order.product_id,
    v_order.product_number, v_order.product_description_snapshot, v_order.planned_quantity, v_order.released_quantity,
    v_order.received_quantity, v_completed, v_rejected, v_wastage,
    v_order.received_quantity + v_completed,
    greatest(v_order.released_quantity - v_order.completed_quantity - v_completed - v_order.rejected_quantity - v_rejected, 0),
    v_order.uom_id, nullif(p_batch_number, ''), p_production_date, p_expiry_date,
    v_unit_cost, v_total_cost, v_order.finished_goods_warehouse_id, p_remarks
  );

  update icecream_erp.production_orders
  set
    completed_quantity = completed_quantity + v_completed,
    received_quantity = received_quantity + v_completed,
    rejected_quantity = rejected_quantity + v_rejected,
    wastage_quantity = wastage_quantity + v_wastage,
    cost_per_unit = case when completed_quantity + v_completed > 0 then round((actual_cost / (completed_quantity + v_completed))::numeric, 4) else cost_per_unit end,
    updated_at = now(),
    version_number = version_number + 1
  where id = p_order_id;

  insert into icecream_erp.production_document_links (
    organization_id, production_order_id, from_document_type, from_document_id, to_document_type, to_document_id, relationship_type, created_by
  )
  values (p_organization_id, p_order_id, 'production_order', p_order_id, 'production_receipt', v_receipt_id, 'RECEIVES_OUTPUT_FROM', p_actor_user_profile_id)
  on conflict do nothing;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id, p_actor_user_account_id, p_actor_user_profile_id,
    'PRODUCTION_RECEIPT_POSTED', 'production_receipts', v_receipt_id, 'production_receipt', v_receipt_id,
    jsonb_build_object('productionOrderId', p_order_id, 'completedQuantity', v_completed, 'rejectedQuantity', v_rejected, 'wastageQuantity', v_wastage, 'totalCost', v_total_cost)
  );

  return jsonb_build_object('success', true, 'productionReceiptId', v_receipt_id, 'receiptNumber', v_receipt_number, 'completedQuantity', v_completed, 'totalCost', v_total_cost);
end;
$$;

create or replace function icecream_erp.close_production_order(
  p_order_id uuid,
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_actor_user_account_id uuid,
  p_closing_notes text
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_order record;
begin
  select *
  into v_order
  from icecream_erp.production_orders
  where id = p_order_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Production order not found.' using errcode = 'P0002';
  end if;
  if v_order.status <> 'RELEASED' then
    raise exception 'Only RELEASED production orders can be closed.' using errcode = '23514';
  end if;
  if v_order.completed_quantity <= 0 then
    raise exception 'A production receipt is required before closing.' using errcode = '23514';
  end if;
  if exists (
    select 1 from icecream_erp.production_issues
    where production_order_id = p_order_id and posting_status = 'DRAFT'
  ) or exists (
    select 1 from icecream_erp.production_receipts
    where production_order_id = p_order_id and posting_status = 'DRAFT'
  ) then
    raise exception 'Draft production issue or receipt documents must be resolved before closing.' using errcode = '23514';
  end if;

  update icecream_erp.production_orders
  set
    status = 'CLOSED',
    is_locked = true,
    closed_by = p_actor_user_profile_id,
    closed_at = now(),
    actual_completion_date = coalesce(actual_completion_date, now()),
    closing_notes = p_closing_notes,
    cost_per_unit = case when completed_quantity > 0 then round((actual_cost / completed_quantity)::numeric, 4) else 0 end,
    updated_at = now(),
    version_number = version_number + 1
  where id = p_order_id;

  insert into icecream_erp.production_order_status_history (
    organization_id, production_order_id, previous_status, new_status, source_action, notes, changed_by
  )
  values (p_organization_id, p_order_id, 'RELEASED', 'CLOSED', 'CLOSE', p_closing_notes, p_actor_user_profile_id);

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id, p_actor_user_account_id, p_actor_user_profile_id,
    'PRODUCTION_ORDER_CLOSED', 'production_orders', p_order_id, 'production_order', p_order_id,
    jsonb_build_object('completedQuantity', v_order.completed_quantity, 'actualCost', v_order.actual_cost, 'status', 'CLOSED')
  );

  return jsonb_build_object('success', true, 'productionOrderId', p_order_id, 'status', 'CLOSED');
end;
$$;

create or replace function icecream_erp.reverse_production_issue(
  p_issue_id uuid,
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_actor_user_account_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_issue record;
  v_line record;
  v_balance record;
begin
  select * into v_issue
  from icecream_erp.production_issues
  where id = p_issue_id and organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Production issue not found.' using errcode = 'P0002';
  end if;
  if v_issue.posting_status <> 'POSTED' then
    raise exception 'Only POSTED production issues can be reversed.' using errcode = '23514';
  end if;

  perform 1 from icecream_erp.production_orders
  where id = v_issue.production_order_id and status <> 'CLOSED'
  for update;
  if not found then
    raise exception 'Closed production orders cannot be corrected by direct issue reversal.' using errcode = '23514';
  end if;

  for v_line in
    select * from icecream_erp.production_issue_lines where production_issue_id = p_issue_id
  loop
    select * into v_balance
    from icecream_erp.stock_balances
    where organization_id = p_organization_id
      and item_id = v_line.component_item_id
      and warehouse_id = v_line.warehouse_id
    for update;

    update icecream_erp.stock_balances
    set
      quantity_on_hand = quantity_on_hand + v_line.current_issue_quantity,
      quantity_available = quantity_available + v_line.current_issue_quantity,
      quantity = quantity_on_hand + v_line.current_issue_quantity,
      total_value = coalesce(total_value, quantity_on_hand * coalesce(avg_cost, 0)) + v_line.line_cost,
      last_updated = now(),
      updated_at = now()
    where id = v_balance.id;

    update icecream_erp.production_order_components
    set
      issued_quantity = greatest(issued_quantity - v_line.current_issue_quantity, 0),
      actual_cost = greatest(actual_cost - v_line.line_cost, 0),
      line_status = 'OPEN',
      updated_at = now()
    where id = v_line.production_order_component_id;

    insert into icecream_erp.stock_movements (
      organization_id, item_id, warehouse_id, movement_type, quantity, unit_cost, total_cost, total_value,
      reference_type, reference_id, source_document_type, source_document_id, reference_number,
      batch_number, expiry_date, notes, created_by, running_balance
    )
    values (
      p_organization_id, v_line.component_item_id, v_line.warehouse_id, 'ADJUSTMENT_IN',
      v_line.current_issue_quantity, v_line.unit_cost, v_line.line_cost, v_line.line_cost,
      'production_issue_reversal', p_issue_id, 'production_issue', p_issue_id, v_issue.issue_number,
      v_line.batch_number, v_line.expiry_date, p_reason, p_actor_user_account_id,
      coalesce(v_balance.quantity_on_hand, 0) + v_line.current_issue_quantity
    );
  end loop;

  update icecream_erp.production_issues
  set posting_status = 'REVERSED', reversed_by = p_actor_user_profile_id, reversed_at = now(), reversal_reason = p_reason, updated_at = now()
  where id = p_issue_id;

  update icecream_erp.production_orders
  set actual_cost = greatest(actual_cost - v_issue.total_cost, 0), updated_at = now(), version_number = version_number + 1
  where id = v_issue.production_order_id;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id, p_actor_user_account_id, p_actor_user_profile_id,
    'PRODUCTION_ISSUE_REVERSED', 'production_issues', p_issue_id, 'production_issue', p_issue_id,
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object('success', true, 'productionIssueId', p_issue_id, 'status', 'REVERSED');
end;
$$;

create or replace function icecream_erp.reverse_production_receipt(
  p_receipt_id uuid,
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_actor_user_account_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_receipt record;
  v_line record;
  v_balance record;
begin
  select * into v_receipt
  from icecream_erp.production_receipts
  where id = p_receipt_id and organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Production receipt not found.' using errcode = 'P0002';
  end if;
  if v_receipt.posting_status <> 'POSTED' then
    raise exception 'Only POSTED production receipts can be reversed.' using errcode = '23514';
  end if;

  perform 1 from icecream_erp.production_orders
  where id = v_receipt.production_order_id and status <> 'CLOSED'
  for update;
  if not found then
    raise exception 'Closed production orders cannot be corrected by direct receipt reversal.' using errcode = '23514';
  end if;

  for v_line in
    select * from icecream_erp.production_receipt_lines where production_receipt_id = p_receipt_id
  loop
    if v_line.current_completed_quantity > 0 then
      select * into v_balance
      from icecream_erp.stock_balances
      where organization_id = p_organization_id
        and item_id = v_line.finished_product_id
        and warehouse_id = v_line.warehouse_id
      for update;

      if not found or v_balance.quantity_available < v_line.current_completed_quantity then
        raise exception 'Insufficient finished-goods stock to reverse production receipt.' using errcode = '23514';
      end if;

      update icecream_erp.stock_balances
      set
        quantity_on_hand = quantity_on_hand - v_line.current_completed_quantity,
        quantity_available = quantity_available - v_line.current_completed_quantity,
        quantity = quantity_on_hand - v_line.current_completed_quantity,
        total_value = greatest(coalesce(total_value, quantity_on_hand * coalesce(avg_cost, 0)) - v_line.total_production_cost, 0),
        last_updated = now(),
        updated_at = now()
      where id = v_balance.id;

      insert into icecream_erp.stock_movements (
        organization_id, item_id, warehouse_id, movement_type, quantity, unit_cost, total_cost, total_value,
        reference_type, reference_id, source_document_type, source_document_id, reference_number,
        batch_number, expiry_date, notes, created_by, running_balance
      )
      values (
        p_organization_id, v_line.finished_product_id, v_line.warehouse_id, 'ADJUSTMENT_OUT',
        v_line.current_completed_quantity, v_line.unit_production_cost, v_line.total_production_cost, v_line.total_production_cost,
        'production_receipt_reversal', p_receipt_id, 'production_receipt', p_receipt_id, v_receipt.receipt_number,
        v_line.batch_number, v_line.expiry_date, p_reason, p_actor_user_account_id,
        v_balance.quantity_on_hand - v_line.current_completed_quantity
      );
    end if;

    update icecream_erp.production_orders
    set
      completed_quantity = greatest(completed_quantity - v_line.current_completed_quantity, 0),
      received_quantity = greatest(received_quantity - v_line.current_completed_quantity, 0),
      rejected_quantity = greatest(rejected_quantity - v_line.current_rejected_quantity, 0),
      wastage_quantity = greatest(wastage_quantity - v_line.current_wastage_quantity, 0),
      updated_at = now(),
      version_number = version_number + 1
    where id = v_line.production_order_id;
  end loop;

  update icecream_erp.production_receipts
  set posting_status = 'REVERSED', reversed_by = p_actor_user_profile_id, reversed_at = now(), reversal_reason = p_reason, updated_at = now()
  where id = p_receipt_id;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id, p_actor_user_account_id, p_actor_user_profile_id,
    'PRODUCTION_RECEIPT_REVERSED', 'production_receipts', p_receipt_id, 'production_receipt', p_receipt_id,
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object('success', true, 'productionReceiptId', p_receipt_id, 'status', 'REVERSED');
end;
$$;

revoke all on function icecream_erp.post_production_issue(uuid, uuid, uuid, uuid, date, jsonb, text, text, text, text) from public;
revoke all on function icecream_erp.post_production_receipt(uuid, uuid, uuid, uuid, date, numeric, numeric, numeric, text, date, date, text, text) from public;
revoke all on function icecream_erp.close_production_order(uuid, uuid, uuid, uuid, text) from public;
revoke all on function icecream_erp.reverse_production_issue(uuid, uuid, uuid, uuid, text) from public;
revoke all on function icecream_erp.reverse_production_receipt(uuid, uuid, uuid, uuid, text) from public;

grant execute on function icecream_erp.post_production_issue(uuid, uuid, uuid, uuid, date, jsonb, text, text, text, text) to service_role;
grant execute on function icecream_erp.post_production_receipt(uuid, uuid, uuid, uuid, date, numeric, numeric, numeric, text, date, date, text, text) to service_role;
grant execute on function icecream_erp.close_production_order(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function icecream_erp.reverse_production_issue(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function icecream_erp.reverse_production_receipt(uuid, uuid, uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
