-- Modern production order issue UOM support.
-- Safe to run only after 061. Preserves the existing post_production_issue RPC signature.

set search_path = icecream_erp, public;

create or replace function icecream_erp.resolve_item_uom_base_quantity(
  p_organization_id uuid,
  p_item_id uuid,
  p_transaction_quantity numeric,
  p_transaction_uom_id uuid,
  p_base_uom_id uuid
) returns table (
  base_quantity numeric,
  conversion_factor numeric
)
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_factor numeric(24,8);
begin
  if p_transaction_quantity is null or p_transaction_quantity <= 0 then
    raise exception 'Issue quantity must be greater than zero.' using errcode = '22023';
  end if;
  if p_base_uom_id is null then
    raise exception 'Item base unit of measure is not configured.' using errcode = '23514';
  end if;

  if p_transaction_uom_id is null or p_transaction_uom_id = p_base_uom_id then
    return query select p_transaction_quantity::numeric, 1::numeric;
    return;
  end if;

  select conversion.conversion_factor
  into v_factor
  from icecream_erp.item_uom_conversions conversion
  where conversion.organization_id = p_organization_id
    and conversion.item_id = p_item_id
    and conversion.from_uom_id = p_transaction_uom_id
    and conversion.to_uom_id = p_base_uom_id
    and conversion.is_active = true
    and conversion.conversion_factor > 0
  order by updated_at desc, created_at desc
  limit 1;

  if v_factor is null then
    raise exception 'No active UOM conversion exists for this production issue line.' using errcode = '23514';
  end if;

  return query select round((p_transaction_quantity * v_factor)::numeric, 6), v_factor;
end;
$$;

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
  v_base_uom_id uuid;
  v_transaction_uom_id uuid;
  v_transaction_quantity numeric(24,6);
  v_base_quantity numeric(24,6);
  v_conversion_factor numeric(24,8);
  v_unit_cost numeric(24,8);
  v_line_cost numeric(24,4);
  v_total_qty numeric(24,6) := 0;
  v_total_cost numeric(24,4) := 0;
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
    v_transaction_quantity := nullif(v_line->>'currentIssueQuantity', '')::numeric;
    if v_transaction_quantity is null then
      v_transaction_quantity := nullif(v_line->>'quantity', '')::numeric;
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

    select unit_of_measure_id
    into v_base_uom_id
    from icecream_erp.items
    where id = v_component.component_item_id
      and organization_id = p_organization_id;

    v_transaction_uom_id := coalesce(
      nullif(v_line->>'transactionUomId', '')::uuid,
      nullif(v_line->>'transaction_uom_id', '')::uuid,
      nullif(v_line->>'uomId', '')::uuid,
      nullif(v_line->>'uom_id', '')::uuid,
      v_component.uom_id,
      v_base_uom_id
    );

    select base_quantity, conversion_factor
    into v_base_quantity, v_conversion_factor
    from icecream_erp.resolve_item_uom_base_quantity(
      p_organization_id,
      v_component.component_item_id,
      v_transaction_quantity,
      v_transaction_uom_id,
      v_base_uom_id
    );

    if v_component.issued_quantity + v_base_quantity > v_component.released_quantity then
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

    if coalesce(v_balance.quantity_available, v_balance.quantity_on_hand - v_balance.quantity_reserved, 0) < v_base_quantity then
      raise exception 'Insufficient available stock for component %.', v_component.component_number_snapshot using errcode = '23514';
    end if;

    v_unit_cost := coalesce(v_balance.avg_cost, v_component.unit_cost_snapshot, nullif(v_line->>'unitCost', '')::numeric, 0);
    v_line_cost := round((v_base_quantity * v_unit_cost)::numeric, 4);

    update icecream_erp.stock_balances
    set
      quantity_on_hand = quantity_on_hand - v_base_quantity,
      quantity_available = quantity_available - v_base_quantity,
      quantity = quantity_on_hand - v_base_quantity,
      total_value = greatest(coalesce(total_value, quantity_on_hand * coalesce(avg_cost, 0)) - v_line_cost, 0),
      last_updated = now(),
      updated_at = now()
    where id = v_balance.id;

    insert into icecream_erp.stock_movements (
      organization_id, item_id, warehouse_id, movement_type, quantity, unit_cost, total_cost, total_value,
      transaction_quantity, transaction_uom_id, base_quantity, base_uom_id, uom_conversion_factor,
      reference_type, reference_id, source_document_type, source_document_id, reference_number,
      batch_number, expiry_date, notes, created_by, running_balance
    )
    values (
      p_organization_id, v_component.component_item_id, v_balance.warehouse_id, 'PRODUCTION_ISSUE',
      v_base_quantity, v_unit_cost, v_line_cost, v_line_cost,
      v_transaction_quantity, v_transaction_uom_id, v_base_quantity, v_base_uom_id, v_conversion_factor,
      'production_issue', v_issue_id, 'production_issue', v_issue_id, v_issue_number,
      nullif(v_line->>'batchNumber', ''), nullif(v_line->>'expiryDate', '')::date,
      p_remarks, p_actor_user_account_id, v_balance.quantity_on_hand - v_base_quantity
    );

    insert into icecream_erp.production_issue_lines (
      organization_id, production_issue_id, production_order_id, production_order_component_id,
      component_item_id, component_number_snapshot, component_description_snapshot,
      planned_quantity, released_requirement, previously_issued_quantity, current_issue_quantity,
      total_issued_quantity, available_quantity_snapshot, warehouse_id, batch_number, expiry_date,
      uom_id, transaction_quantity, transaction_uom_id, base_quantity, base_uom_id, uom_conversion_factor,
      unit_cost, line_cost, variance, remarks
    )
    values (
      p_organization_id, v_issue_id, p_order_id, v_component.id,
      v_component.component_item_id, v_component.component_number_snapshot, v_component.component_description_snapshot,
      v_component.planned_quantity, v_component.released_quantity, v_component.issued_quantity, v_base_quantity,
      v_component.issued_quantity + v_base_quantity, coalesce(v_balance.quantity_available, 0), v_balance.warehouse_id,
      nullif(v_line->>'batchNumber', ''), nullif(v_line->>'expiryDate', '')::date,
      v_base_uom_id, v_transaction_quantity, v_transaction_uom_id, v_base_quantity, v_base_uom_id, v_conversion_factor,
      v_unit_cost, v_line_cost, (v_component.issued_quantity + v_base_quantity) - v_component.released_quantity,
      nullif(v_line->>'remarks', '')
    );

    update icecream_erp.production_order_components
    set
      issued_quantity = issued_quantity + v_base_quantity,
      actual_cost = actual_cost + v_line_cost,
      shortage_quantity = greatest(released_quantity - (issued_quantity + v_base_quantity), 0),
      line_status = case when issued_quantity + v_base_quantity >= released_quantity then 'ISSUED' else 'PARTIAL' end,
      updated_at = now()
    where id = v_component.id;

    v_total_qty := v_total_qty + v_base_quantity;
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
    jsonb_build_object('productionOrderId', p_order_id, 'totalBaseQuantity', v_total_qty, 'totalCost', v_total_cost)
  );

  return jsonb_build_object('success', true, 'productionIssueId', v_issue_id, 'issueNumber', v_issue_number, 'totalQuantity', v_total_qty, 'totalCost', v_total_cost);
end;
$$;

revoke all on function icecream_erp.resolve_item_uom_base_quantity(uuid, uuid, numeric, uuid, uuid) from public;
grant execute on function icecream_erp.resolve_item_uom_base_quantity(uuid, uuid, numeric, uuid, uuid) to service_role;

revoke all on function icecream_erp.post_production_issue(uuid, uuid, uuid, uuid, date, jsonb, text, text, text, text) from public;
grant execute on function icecream_erp.post_production_issue(uuid, uuid, uuid, uuid, date, jsonb, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
