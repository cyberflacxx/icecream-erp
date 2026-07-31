\set ON_ERROR_STOP on

-- Batch 4 rollback-only Production workflow verification.
-- Execute with psql against the shared PostgreSQL 15/Supabase database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/vps-test-production-order-workflow.sql
--
-- Configuration:
-- - Leave a variable blank to auto-discover a safe candidate.
-- - `raw_material_item_ids` may be a comma-separated UUID list to constrain the recipe ingredients used.
-- - The script writes only inside a single transaction and finishes with ROLLBACK.

\if :{?organization_id}
\else
\set organization_id ''
\endif
\if :{?actor_user_account_id}
\else
\set actor_user_account_id ''
\endif
\if :{?actor_user_profile_id}
\else
\set actor_user_profile_id ''
\endif
\if :{?branch_id}
\else
\set branch_id ''
\endif
\if :{?raw_material_warehouse_id}
\else
\set raw_material_warehouse_id ''
\endif
\if :{?production_warehouse_id}
\else
\set production_warehouse_id ''
\endif
\if :{?finished_goods_warehouse_id}
\else
\set finished_goods_warehouse_id ''
\endif
\if :{?finished_good_item_id}
\else
\set finished_good_item_id ''
\endif
\if :{?active_recipe_id}
\else
\set active_recipe_id ''
\endif
\if :{?raw_material_item_ids}
\else
\set raw_material_item_ids ''
\endif

select
  format('production-batch4-%s', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')) as test_token,
  format('production-issue-%s', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')) as issue_idempotency_key,
  format('production-receipt-%s', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')) as receipt_idempotency_key
\gset

begin;

set local search_path = icecream_erp, pg_temp;

create temporary table production_test_ctx (
  test_token text not null,
  organization_id uuid not null,
  actor_user_profile_id uuid not null,
  actor_user_account_id uuid not null,
  branch_id uuid null,
  raw_material_warehouse_id uuid not null,
  production_warehouse_id uuid not null,
  finished_goods_warehouse_id uuid not null,
  finished_good_item_id uuid not null,
  recipe_id uuid not null,
  planned_quantity numeric(18,4) not null,
  issue_idempotency_key text not null,
  receipt_idempotency_key text not null,
  order_id uuid null,
  order_number text null,
  issue_id uuid null,
  issue_number text null,
  receipt_id uuid null,
  receipt_number text null,
  raw_qty_before_issue jsonb null,
  raw_qty_after_issue jsonb null,
  fg_qty_before_receipt numeric(18,4) null,
  fg_qty_after_receipt numeric(18,4) null
) on commit drop;

do $$
declare
  v_org_id uuid := nullif(:'organization_id', '')::uuid;
  v_actor_account_id uuid := nullif(:'actor_user_account_id', '')::uuid;
  v_actor_profile_id uuid := nullif(:'actor_user_profile_id', '')::uuid;
  v_branch_id uuid := nullif(:'branch_id', '')::uuid;
  v_raw_warehouse_id uuid := nullif(:'raw_material_warehouse_id', '')::uuid;
  v_production_warehouse_id uuid := nullif(:'production_warehouse_id', '')::uuid;
  v_finished_goods_warehouse_id uuid := nullif(:'finished_goods_warehouse_id', '')::uuid;
  v_finished_good_item_id uuid := nullif(:'finished_good_item_id', '')::uuid;
  v_recipe_id uuid := nullif(:'active_recipe_id', '')::uuid;
  v_raw_item_ids uuid[];
  v_recipe record;
begin
  if nullif(:'raw_material_item_ids', '') is not null then
    v_raw_item_ids := string_to_array(replace(:'raw_material_item_ids', ' ', ''), ',')::uuid[];
  end if;

  if v_recipe_id is not null then
    select r.*
    into v_recipe
    from icecream_erp.recipes r
    where r.id = v_recipe_id
      and r.deleted_at is null
      and upper(coalesce(r.status::text, '')) = 'ACTIVE';
  else
    select r.*
    into v_recipe
    from icecream_erp.recipes r
    where r.deleted_at is null
      and upper(coalesce(r.status::text, '')) = 'ACTIVE'
      and (v_org_id is null or r.organization_id = v_org_id)
      and (v_finished_good_item_id is null or r.finished_item_id = v_finished_good_item_id)
      and exists (
        select 1
        from icecream_erp.recipe_items ri
        where ri.recipe_id = r.id
      )
      and (
        v_raw_item_ids is null
        or exists (
          select 1
          from icecream_erp.recipe_items ri
          where ri.recipe_id = r.id
            and ri.item_id = any(v_raw_item_ids)
        )
      )
    order by r.version desc, r.updated_at desc nulls last, r.id desc
    limit 1;
  end if;

  if not found then
    raise exception 'No active recipe was found for the requested Production rollback test inputs.';
  end if;

  v_org_id := coalesce(v_org_id, v_recipe.organization_id);
  v_recipe_id := v_recipe.id;
  v_finished_good_item_id := coalesce(v_finished_good_item_id, v_recipe.finished_item_id);

  if v_actor_profile_id is null or v_actor_account_id is null then
    select
      u.id,
      coalesce(u.user_account_id, u.id)
    into v_actor_profile_id, v_actor_account_id
    from icecream_erp.users u
    where u.organization_id = v_org_id
      and upper(coalesce(u.status, 'ACTIVE')) = 'ACTIVE'
      and coalesce(u.user_account_id, u.id) is not null
    order by u.updated_at desc nulls last, u.created_at desc nulls last, u.id
    limit 1;
  end if;

  if v_actor_profile_id is null or v_actor_account_id is null then
    raise exception 'No active user with both profile and account identifiers is available for organization %.', v_org_id;
  end if;

  if v_branch_id is null then
    select b.id
    into v_branch_id
    from icecream_erp.branches b
    where b.organization_id = v_org_id
      and upper(coalesce(b.status, 'ACTIVE')) = 'ACTIVE'
    order by b.updated_at desc nulls last, b.created_at desc nulls last, b.id
    limit 1;
  end if;

  if v_production_warehouse_id is null then
    select w.id
    into v_production_warehouse_id
    from icecream_erp.warehouses w
    where w.organization_id = v_org_id
      and (v_branch_id is null or w.branch_id = v_branch_id)
    order by
      case upper(coalesce(to_jsonb(w)->>'warehouse_type', to_jsonb(w)->>'type', ''))
        when 'PRODUCTION' then 0
        when 'PRODUCTION_MATERIALS' then 1
        when 'WIP' then 2
        when 'GENERAL' then 3
        else 99
      end,
      w.id
    limit 1;
  end if;

  if v_raw_warehouse_id is null then
    select w.id
    into v_raw_warehouse_id
    from icecream_erp.warehouses w
    where w.organization_id = v_org_id
      and (v_branch_id is null or w.branch_id = v_branch_id)
    order by
      case upper(coalesce(to_jsonb(w)->>'warehouse_type', to_jsonb(w)->>'type', ''))
        when 'RAW_MATERIALS' then 0
        when 'RAW_MATERIAL' then 1
        when 'PRODUCTION' then 2
        when 'PRODUCTION_MATERIALS' then 3
        when 'WIP' then 4
        when 'GENERAL' then 5
        else 99
      end,
      w.id
    limit 1;
  end if;

  if v_finished_goods_warehouse_id is null then
    select w.id
    into v_finished_goods_warehouse_id
    from icecream_erp.warehouses w
    where w.organization_id = v_org_id
      and (v_branch_id is null or w.branch_id = v_branch_id)
    order by
      case upper(coalesce(to_jsonb(w)->>'warehouse_type', to_jsonb(w)->>'type', ''))
        when 'FINISHED_GOODS' then 0
        when 'FINISHED_GOOD' then 1
        when 'PRODUCTION_FINISHED' then 2
        when 'GENERAL' then 3
        when 'PRODUCTION' then 4
        else 99
      end,
      coalesce((to_jsonb(w)->>'is_main_warehouse')::boolean, false) desc,
      w.id
    limit 1;
  end if;

  if v_production_warehouse_id is null then
    raise exception 'No production warehouse candidate was found for organization %.', v_org_id;
  end if;
  if v_raw_warehouse_id is null then
    raise exception 'No raw-material warehouse candidate was found for organization %.', v_org_id;
  end if;
  if v_finished_goods_warehouse_id is null then
    raise exception 'No finished-goods warehouse candidate was found for organization %.', v_org_id;
  end if;

  insert into production_test_ctx (
    test_token,
    organization_id,
    actor_user_profile_id,
    actor_user_account_id,
    branch_id,
    raw_material_warehouse_id,
    production_warehouse_id,
    finished_goods_warehouse_id,
    finished_good_item_id,
    recipe_id,
    planned_quantity,
    issue_idempotency_key,
    receipt_idempotency_key
  )
  values (
    :'test_token',
    v_org_id,
    v_actor_profile_id,
    v_actor_account_id,
    v_branch_id,
    v_raw_warehouse_id,
    v_production_warehouse_id,
    v_finished_goods_warehouse_id,
    v_finished_good_item_id,
    v_recipe_id,
    1.0,
    :'issue_idempotency_key',
    :'receipt_idempotency_key'
  );

  raise notice 'Resolved Production test context: org=%, branch=%, recipe=%, raw_wh=%, prod_wh=%, fg_wh=%',
    v_org_id, v_branch_id, v_recipe_id, v_raw_warehouse_id, v_production_warehouse_id, v_finished_goods_warehouse_id;
end;
$$;

do $$
declare
  v_ctx production_test_ctx%rowtype;
  v_result jsonb;
begin
  select * into v_ctx from production_test_ctx;

  v_result := icecream_erp.save_planned_production_order(
    v_ctx.organization_id,
    v_ctx.actor_user_profile_id,
    v_ctx.actor_user_account_id,
    v_ctx.finished_good_item_id,
    v_ctx.planned_quantity,
    v_ctx.production_warehouse_id,
    v_ctx.finished_goods_warehouse_id,
    v_ctx.branch_id,
    current_date,
    current_date + 1,
    'NORMAL',
    format('Batch 4 rollback test %s', v_ctx.test_token),
    null
  );

  update production_test_ctx
  set order_id = (v_result->>'productionOrderId')::uuid
  where test_token = v_ctx.test_token;

  update production_test_ctx ctx
  set order_number = po.production_order_number
  from icecream_erp.production_orders po
  where ctx.order_id = po.id;

  if not exists (
    select 1
    from icecream_erp.production_orders po
    join production_test_ctx ctx on ctx.order_id = po.id
    where po.status = 'PLANNED'
      and po.planned_quantity = ctx.planned_quantity
  ) then
    raise exception 'save_planned_production_order did not create a PLANNED order with the expected quantity.';
  end if;

  if not exists (
    select 1
    from icecream_erp.production_order_components poc
    join production_test_ctx ctx on ctx.order_id = poc.production_order_id
  ) then
    raise exception 'Planned order components were not created from the active BOM.';
  end if;

  raise notice 'Planned order created successfully.';
end;
$$;

do $$
declare
  v_ctx production_test_ctx%rowtype;
begin
  select * into v_ctx from production_test_ctx;

  perform icecream_erp.release_production_order(
    v_ctx.order_id,
    v_ctx.organization_id,
    v_ctx.actor_user_profile_id,
    v_ctx.actor_user_account_id,
    v_ctx.planned_quantity,
    format('Release for rollback test %s', v_ctx.test_token),
    false
  );

  if not exists (
    select 1
    from icecream_erp.production_orders
    where id = v_ctx.order_id
      and status = 'RELEASED'
      and released_quantity = v_ctx.planned_quantity
  ) then
    raise exception 'release_production_order did not move the order to RELEASED with the expected quantity.';
  end if;

  begin
    perform icecream_erp.close_production_order(
      v_ctx.order_id,
      v_ctx.organization_id,
      v_ctx.actor_user_profile_id,
      v_ctx.actor_user_account_id,
      'Expected invalid close before receipt.'
    );
    raise exception 'close_production_order unexpectedly succeeded before any receipt was posted.';
  exception
    when others then
      if position('production receipt is required' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;

  raise notice 'Release succeeded and invalid early close was correctly rejected.';
end;
$$;

do $$
declare
  v_ctx production_test_ctx%rowtype;
  v_seed record;
  v_required_items uuid[];
begin
  select * into v_ctx from production_test_ctx;

  select array_agg(distinct component_item_id order by component_item_id)
  into v_required_items
  from icecream_erp.production_order_components
  where production_order_id = v_ctx.order_id;

  if v_required_items is null or cardinality(v_required_items) = 0 then
    raise exception 'Released order has no components to seed for issue posting.';
  end if;

  for v_seed in
    select
      poc.component_item_id,
      sum(poc.released_quantity) as required_quantity,
      max(coalesce(poc.unit_cost_snapshot, i.unit_cost, i.standard_cost, 1)) as unit_cost
    from icecream_erp.production_order_components poc
    join icecream_erp.items i on i.id = poc.component_item_id
    where poc.production_order_id = v_ctx.order_id
    group by poc.component_item_id
  loop
    if exists (
      select 1
      from icecream_erp.stock_balances sb
      where sb.organization_id = v_ctx.organization_id
        and sb.item_id = v_seed.component_item_id
        and sb.warehouse_id = v_ctx.raw_material_warehouse_id
    ) then
      update icecream_erp.stock_balances sb
      set
        quantity_on_hand = greatest(sb.quantity_on_hand, v_seed.required_quantity),
        quantity_available = greatest(sb.quantity_available, v_seed.required_quantity),
        quantity = greatest(sb.quantity, v_seed.required_quantity),
        avg_cost = case when coalesce(sb.avg_cost, 0) > 0 then sb.avg_cost else v_seed.unit_cost end,
        total_value = greatest(coalesce(sb.total_value, 0), v_seed.required_quantity * greatest(v_seed.unit_cost, 0)),
        last_updated = now(),
        updated_at = now()
      where sb.organization_id = v_ctx.organization_id
        and sb.item_id = v_seed.component_item_id
        and sb.warehouse_id = v_ctx.raw_material_warehouse_id;
    else
      insert into icecream_erp.stock_balances (
        organization_id,
        item_id,
        warehouse_id,
        quantity,
        reserved_qty,
        avg_cost,
        quantity_on_hand,
        quantity_available,
        quantity_reserved,
        total_value,
        last_updated,
        updated_at
      )
      values (
        v_ctx.organization_id,
        v_seed.component_item_id,
        v_ctx.raw_material_warehouse_id,
        v_seed.required_quantity,
        0,
        greatest(v_seed.unit_cost, 0),
        v_seed.required_quantity,
        v_seed.required_quantity,
        0,
        v_seed.required_quantity * greatest(v_seed.unit_cost, 0),
        now(),
        now()
      );
    end if;
  end loop;

  update production_test_ctx ctx
  set raw_qty_before_issue = seeded.quantities
  from (
    select jsonb_object_agg(sb.item_id::text, sb.quantity_available) as quantities
    from icecream_erp.stock_balances sb
    where sb.organization_id = v_ctx.organization_id
      and sb.warehouse_id = v_ctx.raw_material_warehouse_id
      and sb.item_id = any(v_required_items)
  ) seeded
  where ctx.test_token = v_ctx.test_token;

  update production_test_ctx ctx
  set fg_qty_before_receipt = coalesce((
    select sb.quantity_available
    from icecream_erp.stock_balances sb
    where sb.organization_id = v_ctx.organization_id
      and sb.item_id = v_ctx.finished_good_item_id
      and sb.warehouse_id = v_ctx.finished_goods_warehouse_id
  ), 0)
  where ctx.test_token = v_ctx.test_token;

  raise notice 'Seeded minimum raw-material stock for issue posting.';
end;
$$;

do $$
declare
  v_ctx production_test_ctx%rowtype;
  v_lines jsonb;
  v_result jsonb;
  v_duplicate jsonb;
  v_before jsonb;
  v_after jsonb;
  v_issue_count integer;
  v_movement_count integer;
begin
  select * into v_ctx from production_test_ctx;
  v_before := v_ctx.raw_qty_before_issue;

  select jsonb_agg(
           jsonb_build_object(
             'componentId', poc.id,
             'quantity', poc.released_quantity,
             'warehouseId', v_ctx.raw_material_warehouse_id,
             'unitCost', poc.unit_cost_snapshot,
             'remarks', format('Issue via %s', v_ctx.test_token)
           )
           order by poc.id
         )
  into v_lines
  from icecream_erp.production_order_components poc
  where poc.production_order_id = v_ctx.order_id;

  if v_lines is null then
    raise exception 'Issue payload could not be built from released order components.';
  end if;

  v_result := icecream_erp.post_production_issue(
    v_ctx.order_id,
    v_ctx.organization_id,
    v_ctx.actor_user_profile_id,
    v_ctx.actor_user_account_id,
    current_date,
    v_lines,
    'ROLLBACK_TEST',
    'DAY',
    format('Issue via %s', v_ctx.test_token),
    v_ctx.issue_idempotency_key
  );

  update production_test_ctx
  set
    issue_id = (v_result->>'productionIssueId')::uuid,
    issue_number = v_result->>'issueNumber'
  where test_token = v_ctx.test_token;

  select count(*) into v_issue_count
  from icecream_erp.production_issue_lines
  where production_issue_id = (select issue_id from production_test_ctx where test_token = v_ctx.test_token);

  if v_issue_count = 0 then
    raise exception 'Issue lines were not posted.';
  end if;

  update production_test_ctx ctx
  set raw_qty_after_issue = seeded.quantities
  from (
    select jsonb_object_agg(sb.item_id::text, sb.quantity_available) as quantities
    from icecream_erp.stock_balances sb
    where sb.organization_id = v_ctx.organization_id
      and sb.warehouse_id = v_ctx.raw_material_warehouse_id
      and sb.item_id in (
        select distinct component_item_id
        from icecream_erp.production_issue_lines
        where production_issue_id = (select issue_id from production_test_ctx where test_token = v_ctx.test_token)
      )
  ) seeded
  where ctx.test_token = v_ctx.test_token;

  select raw_qty_after_issue into v_after
  from production_test_ctx
  where test_token = v_ctx.test_token;

  if exists (
    select 1
    from (
      select
        pil.component_item_id::text as item_id,
        sum(pil.current_issue_quantity) as issued_quantity
      from icecream_erp.production_issue_lines pil
      where pil.production_issue_id = (select issue_id from production_test_ctx where test_token = v_ctx.test_token)
      group by pil.component_item_id
    ) issued
    where coalesce((v_before ->> issued.item_id)::numeric, 0) - issued.issued_quantity
      <> coalesce((v_after ->> issued.item_id)::numeric, 0)
  ) then
    raise exception 'Raw-material stock was not reduced by the posted issue quantities.';
  end if;

  select count(*) into v_movement_count
  from icecream_erp.stock_movements sm
  where sm.source_document_type = 'production_issue'
    and sm.source_document_id = (select issue_id from production_test_ctx where test_token = v_ctx.test_token);

  if v_movement_count = 0 then
    raise exception 'Issue stock movements were not recorded.';
  end if;

  v_duplicate := icecream_erp.post_production_issue(
    v_ctx.order_id,
    v_ctx.organization_id,
    v_ctx.actor_user_profile_id,
    v_ctx.actor_user_account_id,
    current_date,
    v_lines,
    'ROLLBACK_TEST',
    'DAY',
    format('Duplicate issue via %s', v_ctx.test_token),
    v_ctx.issue_idempotency_key
  );

  if coalesce(v_duplicate->>'code', '') <> 'CONFLICT' then
    raise exception 'Duplicate issue idempotency check did not return the expected CONFLICT response.';
  end if;

  if (select count(*) from icecream_erp.production_issues where idempotency_key = v_ctx.issue_idempotency_key) <> 1 then
    raise exception 'Duplicate issue attempt created more than one issue document.';
  end if;

  raise notice 'Issue posting and idempotency verification succeeded.';
end;
$$;

do $$
declare
  v_ctx production_test_ctx%rowtype;
  v_result jsonb;
  v_summary record;
  v_receipt_count integer;
begin
  select * into v_ctx from production_test_ctx;

  v_result := icecream_erp.post_production_receipt(
    v_ctx.order_id,
    v_ctx.organization_id,
    v_ctx.actor_user_profile_id,
    v_ctx.actor_user_account_id,
    current_date,
    v_ctx.planned_quantity,
    0,
    0,
    format('LOT-%s', v_ctx.test_token),
    current_date,
    current_date + 30,
    format('Receipt via %s', v_ctx.test_token),
    v_ctx.receipt_idempotency_key
  );

  update production_test_ctx
  set
    receipt_id = (v_result->>'productionReceiptId')::uuid,
    receipt_number = v_result->>'receiptNumber'
  where test_token = v_ctx.test_token;

  update production_test_ctx ctx
  set fg_qty_after_receipt = coalesce((
    select sb.quantity_available
    from icecream_erp.stock_balances sb
    where sb.organization_id = v_ctx.organization_id
      and sb.item_id = v_ctx.finished_good_item_id
      and sb.warehouse_id = v_ctx.finished_goods_warehouse_id
  ), 0)
  where ctx.test_token = v_ctx.test_token;

  select count(*) into v_receipt_count
  from icecream_erp.production_receipt_lines
  where production_receipt_id = (select receipt_id from production_test_ctx where test_token = v_ctx.test_token);

  if v_receipt_count = 0 then
    raise exception 'Receipt lines were not posted.';
  end if;

  if not exists (
    select 1
    from production_test_ctx ctx
    where ctx.fg_qty_after_receipt = ctx.fg_qty_before_receipt + ctx.planned_quantity
  ) then
    raise exception 'Finished-goods stock did not increase by the receipt quantity.';
  end if;

  select *
  into v_summary
  from icecream_erp.production_order_cost_summary
  where production_order_id = v_ctx.order_id;

  if v_summary.production_order_id is null then
    raise exception 'production_order_cost_summary did not return a row for the test order.';
  end if;
  if coalesce(v_summary.actual_cost, 0) <= 0 then
    raise exception 'Actual cost did not accumulate after issue and receipt posting.';
  end if;

  if not exists (
    select 1
    from icecream_erp.stock_movements sm
    where sm.source_document_type = 'production_receipt'
      and sm.source_document_id = (select receipt_id from production_test_ctx where test_token = v_ctx.test_token)
  ) then
    raise exception 'Receipt stock movements were not recorded.';
  end if;

  raise notice 'Receipt posting and costing verification succeeded.';
end;
$$;

do $$
declare
  v_ctx production_test_ctx%rowtype;
  v_before_raw jsonb;
  v_before_fg numeric(18,4);
begin
  select * into v_ctx from production_test_ctx;

  perform icecream_erp.close_production_order(
    v_ctx.order_id,
    v_ctx.organization_id,
    v_ctx.actor_user_profile_id,
    v_ctx.actor_user_account_id,
    format('Close via %s', v_ctx.test_token)
  );

  if not exists (
    select 1
    from icecream_erp.production_orders
    where id = v_ctx.order_id
      and status = 'CLOSED'
      and is_locked = true
  ) then
    raise exception 'close_production_order did not close and lock the order.';
  end if;

  begin
    perform icecream_erp.save_planned_production_order(
      v_ctx.organization_id,
      v_ctx.actor_user_profile_id,
      v_ctx.actor_user_account_id,
      v_ctx.finished_good_item_id,
      v_ctx.planned_quantity,
      v_ctx.production_warehouse_id,
      v_ctx.finished_goods_warehouse_id,
      v_ctx.branch_id,
      current_date,
      current_date + 1,
      'NORMAL',
      'Expected closed-order edit rejection.',
      v_ctx.order_id
    );
    raise exception 'Closed-order edit unexpectedly succeeded.';
  exception
    when others then
      if position('planned production orders can be edited' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;

  select raw_qty_after_issue, fg_qty_after_receipt
  into v_before_raw, v_before_fg
  from production_test_ctx
  where test_token = v_ctx.test_token;

  perform icecream_erp.reopen_production_order(
    v_ctx.order_id,
    v_ctx.organization_id,
    v_ctx.actor_user_profile_id,
    v_ctx.actor_user_account_id,
    format('Reopen via %s', v_ctx.test_token)
  );

  if not exists (
    select 1
    from icecream_erp.production_orders
    where id = v_ctx.order_id
      and status = 'RELEASED'
      and is_locked = false
  ) then
    raise exception 'reopen_production_order did not return the order to RELEASED.';
  end if;

  if exists (
    select 1
    from (
      select
        sb.item_id::text as item_id,
        sb.quantity_available as quantity_available
      from icecream_erp.stock_balances sb
      where sb.organization_id = v_ctx.organization_id
        and sb.warehouse_id = v_ctx.raw_material_warehouse_id
        and sb.item_id in (
          select distinct component_item_id
          from icecream_erp.production_issue_lines
          where production_issue_id = v_ctx.issue_id
        )
    ) current_raw
    where coalesce((v_before_raw ->> current_raw.item_id)::numeric, 0) <> current_raw.quantity_available
  ) then
    raise exception 'Reopen changed raw-material stock, which must not happen.';
  end if;

  if coalesce((
    select sb.quantity_available
    from icecream_erp.stock_balances sb
    where sb.organization_id = v_ctx.organization_id
      and sb.item_id = v_ctx.finished_good_item_id
      and sb.warehouse_id = v_ctx.finished_goods_warehouse_id
  ), 0) <> v_before_fg then
    raise exception 'Reopen changed finished-goods stock, which must not happen.';
  end if;

  raise notice 'Close, closed-order edit rejection, and reopen verification succeeded.';
end;
$$;

do $$
declare
  v_ctx production_test_ctx%rowtype;
  v_before_receipt_fg numeric(18,4);
  v_before_issue_raw jsonb;
begin
  select * into v_ctx from production_test_ctx;
  v_before_receipt_fg := v_ctx.fg_qty_after_receipt;
  v_before_issue_raw := v_ctx.raw_qty_after_issue;

  perform icecream_erp.reverse_production_receipt(
    v_ctx.receipt_id,
    v_ctx.organization_id,
    v_ctx.actor_user_profile_id,
    v_ctx.actor_user_account_id,
    format('Reverse receipt via %s', v_ctx.test_token)
  );

  if not exists (
    select 1
    from icecream_erp.production_receipts
    where id = v_ctx.receipt_id
      and posting_status = 'REVERSED'
  ) then
    raise exception 'reverse_production_receipt did not mark the receipt as REVERSED.';
  end if;

  if coalesce((
    select sb.quantity_available
    from icecream_erp.stock_balances sb
    where sb.organization_id = v_ctx.organization_id
      and sb.item_id = v_ctx.finished_good_item_id
      and sb.warehouse_id = v_ctx.finished_goods_warehouse_id
  ), 0) <> v_ctx.fg_qty_before_receipt then
    raise exception 'Finished-goods stock was not restored to the pre-receipt balance.';
  end if;

  perform icecream_erp.reverse_production_issue(
    v_ctx.issue_id,
    v_ctx.organization_id,
    v_ctx.actor_user_profile_id,
    v_ctx.actor_user_account_id,
    format('Reverse issue via %s', v_ctx.test_token)
  );

  if not exists (
    select 1
    from icecream_erp.production_issues
    where id = v_ctx.issue_id
      and posting_status = 'REVERSED'
  ) then
    raise exception 'reverse_production_issue did not mark the issue as REVERSED.';
  end if;

  if exists (
    select 1
    from (
      select
        sb.item_id::text as item_id,
        sb.quantity_available as quantity_available
      from icecream_erp.stock_balances sb
      where sb.organization_id = v_ctx.organization_id
        and sb.warehouse_id = v_ctx.raw_material_warehouse_id
        and sb.item_id in (
          select distinct component_item_id
          from icecream_erp.production_issue_lines
          where production_issue_id = v_ctx.issue_id
        )
    ) current_raw
    where coalesce((v_ctx.raw_qty_before_issue ->> current_raw.item_id)::numeric, 0) <> current_raw.quantity_available
  ) then
    raise exception 'Raw-material stock was not restored to the pre-issue balance.';
  end if;

  if not exists (
    select 1
    from icecream_erp.production_order_relationship_map
    where production_order_id = v_ctx.order_id
      and document_type = 'production_issue'
      and document_id = v_ctx.issue_id
      and posting_status = 'REVERSED'
  ) then
    raise exception 'Relationship map does not show the reversed issue document.';
  end if;

  if not exists (
    select 1
    from icecream_erp.production_order_relationship_map
    where production_order_id = v_ctx.order_id
      and document_type = 'production_receipt'
      and document_id = v_ctx.receipt_id
      and posting_status = 'REVERSED'
  ) then
    raise exception 'Relationship map does not show the reversed receipt document.';
  end if;

  if not exists (
    select 1
    from icecream_erp.production_document_links
    where production_order_id = v_ctx.order_id
      and to_document_id in (v_ctx.issue_id, v_ctx.receipt_id)
  ) then
    raise exception 'Document links were not preserved for the issue and receipt documents.';
  end if;

  if not exists (
    select 1
    from icecream_erp.production_order_status_history
    where production_order_id = v_ctx.order_id
      and new_status in ('PLANNED', 'RELEASED', 'CLOSED')
  ) then
    raise exception 'Status history entries were not recorded for the order lifecycle.';
  end if;

  if (
    select count(*)
    from icecream_erp.audit_logs al
    where al.organization_id = v_ctx.organization_id
      and al.entity_id in (v_ctx.order_id, v_ctx.issue_id, v_ctx.receipt_id)
      and al.action in (
        'PRODUCTION_ORDER_CREATED',
        'PRODUCTION_ORDER_RELEASED',
        'PRODUCTION_ORDER_CLOSED',
        'PRODUCTION_ORDER_REOPENED',
        'PRODUCTION_ISSUE_POSTED',
        'PRODUCTION_ISSUE_REVERSED',
        'PRODUCTION_RECEIPT_POSTED',
        'PRODUCTION_RECEIPT_REVERSED'
      )
  ) < 8 then
    raise exception 'Expected audit-log entries were not found for the full production workflow.';
  end if;

  raise notice 'Reversal, relationship-map, status-history, and audit-log verification succeeded.';
end;
$$;

select
  order_number,
  issue_number,
  receipt_number
from production_test_ctx
\gset

rollback;

do $$
begin
  if exists (
    select 1
    from icecream_erp.production_issues
    where idempotency_key = :'issue_idempotency_key'
  ) then
    raise exception 'Rollback verification failed: issue idempotency key still exists after ROLLBACK.';
  end if;

  if exists (
    select 1
    from icecream_erp.production_receipts
    where idempotency_key = :'receipt_idempotency_key'
  ) then
    raise exception 'Rollback verification failed: receipt idempotency key still exists after ROLLBACK.';
  end if;

  if nullif(:'order_number', '') is not null and exists (
    select 1
    from icecream_erp.production_orders
    where production_order_number = :'order_number'
  ) then
    raise exception 'Rollback verification failed: production order % still exists after ROLLBACK.', :'order_number';
  end if;

  if nullif(:'issue_number', '') is not null and exists (
    select 1
    from icecream_erp.production_issues
    where issue_number = :'issue_number'
  ) then
    raise exception 'Rollback verification failed: production issue % still exists after ROLLBACK.', :'issue_number';
  end if;

  if nullif(:'receipt_number', '') is not null and exists (
    select 1
    from icecream_erp.production_receipts
    where receipt_number = :'receipt_number'
  ) then
    raise exception 'Rollback verification failed: production receipt % still exists after ROLLBACK.', :'receipt_number';
  end if;

  raise notice 'Rollback verification succeeded: no test-specific Production records remain.';
end;
$$;
