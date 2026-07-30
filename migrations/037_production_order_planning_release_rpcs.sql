-- 037_production_order_planning_release_rpcs.sql
-- Transactional planning and release RPCs for production orders.
-- Rollback approach: drop functions after confirming no API clients depend on them.

create or replace function icecream_erp.production_next_document_number(
  p_organization_id uuid,
  p_series_type text,
  p_prefix text
) returns text
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_series record;
  v_next integer;
begin
  select id, prefix, last_number, padding
  into v_series
  from icecream_erp.number_series
  where organization_id = p_organization_id
    and series_type = p_series_type
    and is_active = true
  for update;

  if found then
    v_next := coalesce(v_series.last_number, 0) + 1;
    update icecream_erp.number_series
    set last_number = v_next, updated_at = now()
    where id = v_series.id;

    return concat(coalesce(v_series.prefix, p_prefix), '-', lpad(v_next::text, coalesce(v_series.padding, 5), '0'));
  end if;

  insert into icecream_erp.number_series (organization_id, series_type, prefix, last_number, padding, is_active)
  values (p_organization_id, p_series_type, p_prefix, 1, 5, true)
  on conflict (organization_id, series_type) do update
    set last_number = icecream_erp.number_series.last_number + 1,
        updated_at = now()
  returning last_number into v_next;

  return concat(p_prefix, '-', lpad(v_next::text, 5, '0'));
end;
$$;

create or replace function icecream_erp.production_rebuild_order_components(
  p_order_id uuid,
  p_quantity numeric,
  p_mode text
) returns void
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_order record;
  v_base_quantity numeric(18,4);
begin
  select *
  into v_order
  from icecream_erp.production_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Production order not found.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from icecream_erp.production_order_components
    where production_order_id = p_order_id
      and (issued_quantity > 0 or returned_quantity > 0)
  ) then
    raise exception 'Cannot rebuild components after issue or return transactions exist.' using errcode = '23514';
  end if;

  select greatest(coalesce(expected_output_quantity, batch_size, 1), 0.0001)
  into v_base_quantity
  from icecream_erp.recipes
  where id = v_order.bom_id;

  delete from icecream_erp.production_order_components
  where production_order_id = p_order_id;

  insert into icecream_erp.production_order_components (
    organization_id,
    production_order_id,
    component_item_id,
    component_number_snapshot,
    component_description_snapshot,
    component_type,
    bom_line_id,
    bom_line_type,
    base_quantity,
    base_ratio,
    planned_quantity,
    released_quantity,
    available_quantity_snapshot,
    shortage_quantity,
    uom_id,
    warehouse_id,
    scrap_percentage,
    unit_cost_snapshot,
    planned_cost,
    actual_cost
  )
  select
    v_order.organization_id,
    v_order.id,
    source_lines.item_id,
    coalesce(i.code, ''),
    coalesce(i.name, ''),
    coalesce(i.item_type, i.type::text),
    source_lines.line_id,
    source_lines.line_type,
    source_lines.quantity_required,
    source_lines.quantity_required / v_base_quantity,
    round(((v_order.planned_quantity * source_lines.quantity_required / v_base_quantity) * (1 + source_lines.scrap_percentage / 100))::numeric, 4),
    case
      when upper(p_mode) = 'RELEASE' then round(((p_quantity * source_lines.quantity_required / v_base_quantity) * (1 + source_lines.scrap_percentage / 100))::numeric, 4)
      else 0
    end,
    coalesce(sb.quantity_available, sb.quantity_on_hand - sb.quantity_reserved, 0),
    case
      when upper(p_mode) = 'RELEASE' then greatest(round(((p_quantity * source_lines.quantity_required / v_base_quantity) * (1 + source_lines.scrap_percentage / 100))::numeric, 4) - coalesce(sb.quantity_available, sb.quantity_on_hand - sb.quantity_reserved, 0), 0)
      else greatest(round(((v_order.planned_quantity * source_lines.quantity_required / v_base_quantity) * (1 + source_lines.scrap_percentage / 100))::numeric, 4) - coalesce(sb.quantity_available, sb.quantity_on_hand - sb.quantity_reserved, 0), 0)
    end,
    source_lines.unit_id,
    v_order.production_warehouse_id,
    source_lines.scrap_percentage,
    coalesce(i.unit_cost, i.standard_cost, sb.avg_cost, 0),
    round(((v_order.planned_quantity * source_lines.quantity_required / v_base_quantity) * (1 + source_lines.scrap_percentage / 100) * coalesce(i.unit_cost, i.standard_cost, sb.avg_cost, 0))::numeric, 2),
    0
  from (
    select id as line_id, item_id, quantity_required, unit_id, wastage_allowance_percent as scrap_percentage, 'INGREDIENT'::text as line_type
    from icecream_erp.recipe_items
    where recipe_id = v_order.bom_id
    union all
    select id as line_id, item_id, quantity_required, unit_id, wastage_allowance_percent as scrap_percentage, 'PACKAGING'::text as line_type
    from icecream_erp.recipe_packaging_items
    where recipe_id = v_order.bom_id
  ) source_lines
  join icecream_erp.items i on i.id = source_lines.item_id
  left join icecream_erp.stock_balances sb
    on sb.organization_id = v_order.organization_id
   and sb.item_id = source_lines.item_id
   and sb.warehouse_id = v_order.production_warehouse_id;

  update icecream_erp.production_orders
  set
    planned_cost = coalesce((
      select sum(planned_cost)
      from icecream_erp.production_order_components
      where production_order_id = p_order_id
    ), 0),
    updated_at = now(),
    version_number = version_number + 1
  where id = p_order_id;
end;
$$;

create or replace function icecream_erp.save_planned_production_order(
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_actor_user_account_id uuid,
  p_product_id uuid,
  p_planned_quantity numeric,
  p_production_warehouse_id uuid,
  p_finished_goods_warehouse_id uuid,
  p_branch_id uuid,
  p_planned_start_date date,
  p_planned_due_date date,
  p_priority text,
  p_remarks text,
  p_order_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_order record;
  v_product record;
  v_recipe record;
  v_order_id uuid;
  v_order_number text;
begin
  if p_planned_quantity is null or p_planned_quantity <= 0 then
    raise exception 'Planned quantity must be greater than zero.' using errcode = '22023';
  end if;

  select id, code, name, description, item_type, type, category_id, unit_of_measure_id, unit_id, default_warehouse_id, is_active, unit_cost, standard_cost, production_category
  into v_product
  from icecream_erp.items
  where id = p_product_id
    and organization_id = p_organization_id
    and is_active = true;

  if not found then
    raise exception 'Active product was not found.' using errcode = 'P0002';
  end if;

  if coalesce(v_product.item_type, v_product.type::text) <> 'FINISHED_GOOD' then
    raise exception 'Only active finished goods can be selected for production orders.' using errcode = '23514';
  end if;

  select id, code, version, expected_output_quantity, output_unit_id, batch_unit_id
  into v_recipe
  from icecream_erp.recipes
  where organization_id = p_organization_id
    and finished_item_id = p_product_id
    and status::text = 'ACTIVE'
    and deleted_at is null
  order by version desc, updated_at desc
  limit 1;

  if not found then
    raise exception 'No active Bill of Materials is available for this product.' using errcode = 'P0002';
  end if;

  if p_order_id is null then
    v_order_number := icecream_erp.production_next_document_number(p_organization_id, 'PRODUCTION_ORDER', 'PDO');
    insert into icecream_erp.production_orders (
      organization_id, branch_id, production_order_number, product_id, product_number,
      product_description_snapshot, product_category_snapshot, bom_id, bom_number, bom_version,
      status, planned_quantity, uom_id, production_warehouse_id, finished_goods_warehouse_id,
      planned_start_date, planned_due_date, priority, remarks, created_by
    )
    values (
      p_organization_id, p_branch_id, v_order_number, p_product_id, v_product.code,
      coalesce(v_product.description, v_product.name), v_product.production_category, v_recipe.id, v_recipe.code, v_recipe.version,
      'PLANNED', p_planned_quantity, coalesce(v_product.unit_of_measure_id, v_product.unit_id, v_recipe.output_unit_id, v_recipe.batch_unit_id),
      p_production_warehouse_id, p_finished_goods_warehouse_id,
      p_planned_start_date, p_planned_due_date, coalesce(nullif(upper(p_priority), ''), 'NORMAL'), p_remarks, p_actor_user_profile_id
    )
    returning id into v_order_id;

    insert into icecream_erp.production_order_status_history (
      organization_id, production_order_id, previous_status, new_status, source_action, notes, changed_by
    )
    values (p_organization_id, v_order_id, null, 'PLANNED', 'CREATE', p_remarks, p_actor_user_profile_id);
  else
    select *
    into v_order
    from icecream_erp.production_orders
    where id = p_order_id
      and organization_id = p_organization_id
    for update;

    if not found then
      raise exception 'Production order not found.' using errcode = 'P0002';
    end if;
    if v_order.status <> 'PLANNED' or v_order.is_locked then
      raise exception 'Only unlocked planned production orders can be edited.' using errcode = '23514';
    end if;

    update icecream_erp.production_orders
    set
      branch_id = p_branch_id,
      product_id = p_product_id,
      product_number = v_product.code,
      product_description_snapshot = coalesce(v_product.description, v_product.name),
      product_category_snapshot = v_product.production_category,
      bom_id = v_recipe.id,
      bom_number = v_recipe.code,
      bom_version = v_recipe.version,
      planned_quantity = p_planned_quantity,
      uom_id = coalesce(v_product.unit_of_measure_id, v_product.unit_id, v_recipe.output_unit_id, v_recipe.batch_unit_id),
      production_warehouse_id = p_production_warehouse_id,
      finished_goods_warehouse_id = p_finished_goods_warehouse_id,
      planned_start_date = p_planned_start_date,
      planned_due_date = p_planned_due_date,
      priority = coalesce(nullif(upper(p_priority), ''), 'NORMAL'),
      remarks = p_remarks,
      updated_at = now(),
      version_number = version_number + 1
    where id = p_order_id
    returning id into v_order_id;
  end if;

  perform icecream_erp.production_rebuild_order_components(v_order_id, p_planned_quantity, 'PLAN');

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id, p_actor_user_account_id, p_actor_user_profile_id,
    case when p_order_id is null then 'PRODUCTION_ORDER_CREATED' else 'PRODUCTION_ORDER_UPDATED' end,
    'production_orders', v_order_id, 'production_order', v_order_id,
    jsonb_build_object('plannedQuantity', p_planned_quantity, 'status', 'PLANNED')
  );

  return jsonb_build_object('success', true, 'productionOrderId', v_order_id);
end;
$$;

create or replace function icecream_erp.release_production_order(
  p_order_id uuid,
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_actor_user_account_id uuid,
  p_released_quantity numeric,
  p_release_notes text,
  p_allow_over_release boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_order record;
begin
  if p_released_quantity is null or p_released_quantity <= 0 then
    raise exception 'Released quantity must be greater than zero.' using errcode = '22023';
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
  if v_order.status <> 'PLANNED' then
    raise exception 'Only PLANNED production orders can be released.' using errcode = '23514';
  end if;
  if p_released_quantity > v_order.planned_quantity and not p_allow_over_release then
    raise exception 'Released quantity cannot exceed planned quantity without over-release permission.' using errcode = '23514';
  end if;

  update icecream_erp.production_orders
  set
    status = 'RELEASED',
    released_quantity = p_released_quantity,
    released_by = p_actor_user_profile_id,
    released_at = now(),
    release_notes = p_release_notes,
    actual_start_date = coalesce(actual_start_date, now()),
    updated_at = now(),
    version_number = version_number + 1
  where id = p_order_id;

  perform icecream_erp.production_rebuild_order_components(p_order_id, p_released_quantity, 'RELEASE');

  insert into icecream_erp.production_order_status_history (
    organization_id, production_order_id, previous_status, new_status, source_action, notes, changed_by
  )
  values (p_organization_id, p_order_id, 'PLANNED', 'RELEASED', 'RELEASE', p_release_notes, p_actor_user_profile_id);

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id, p_actor_user_account_id, p_actor_user_profile_id,
    'PRODUCTION_ORDER_RELEASED', 'production_orders', p_order_id, 'production_order', p_order_id,
    jsonb_build_object('releasedQuantity', p_released_quantity, 'status', 'RELEASED')
  );

  return jsonb_build_object('success', true, 'productionOrderId', p_order_id, 'status', 'RELEASED');
end;
$$;

revoke all on function icecream_erp.production_next_document_number(uuid, text, text) from public;
revoke all on function icecream_erp.production_rebuild_order_components(uuid, numeric, text) from public;
revoke all on function icecream_erp.save_planned_production_order(uuid, uuid, uuid, uuid, numeric, uuid, uuid, uuid, date, date, text, text, uuid) from public;
revoke all on function icecream_erp.release_production_order(uuid, uuid, uuid, uuid, numeric, text, boolean) from public;

grant execute on function icecream_erp.production_next_document_number(uuid, text, text) to service_role;
grant execute on function icecream_erp.production_rebuild_order_components(uuid, numeric, text) to service_role;
grant execute on function icecream_erp.save_planned_production_order(uuid, uuid, uuid, uuid, numeric, uuid, uuid, uuid, date, date, text, text, uuid) to service_role;
grant execute on function icecream_erp.release_production_order(uuid, uuid, uuid, uuid, numeric, text, boolean) to service_role;

notify pgrst, 'reload schema';
