-- Production execution compatibility and costing extensions.
-- Adds the capture surfaces required for recipe formulas, WIP, worker/off-shift
-- counts, material closing stock, finished-goods transfer, and cost overrides.

alter table if exists icecream_erp.warehouses
  add column if not exists warehouse_type text null,
  add column if not exists production_role text null,
  add column if not exists is_production_warehouse boolean not null default false;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'warehouses' and column_name = 'type'
  ) then
    execute $sql$
      update icecream_erp.warehouses
      set warehouse_type = coalesce(warehouse_type, type::text)
      where true
    $sql$;
  end if;

  update icecream_erp.warehouses
  set
    production_role = coalesce(
      production_role,
      case
        when lower(coalesce(name, '')) like '%production%' then 'PRODUCTION'
        when lower(coalesce(name, '')) like '%store%' then 'STORES'
        when lower(coalesce(name, '')) like '%raw%' then 'STORES'
        else null
      end
    ),
    is_production_warehouse = is_production_warehouse or lower(coalesce(name, '')) like '%production%'
  where true;
end $$;

alter table if exists icecream_erp.items
  add column if not exists item_type text null,
  add column if not exists unit_of_measure_id uuid null,
  add column if not exists unit_cost numeric(18,4) not null default 0,
  add column if not exists default_warehouse_id uuid null,
  add column if not exists production_category text null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'items' and column_name = 'type'
  ) then
    execute $sql$
      update icecream_erp.items
      set item_type = coalesce(item_type, type::text)
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'items' and column_name = 'unit_id'
  ) then
    execute $sql$
      update icecream_erp.items
      set unit_of_measure_id = coalesce(unit_of_measure_id, unit_id)
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'items' and column_name = 'standard_cost'
  ) then
    execute $sql$
      update icecream_erp.items
      set unit_cost = coalesce(nullif(unit_cost, 0), standard_cost, 0)
      where true
    $sql$;
  end if;

  update icecream_erp.items
  set production_category = coalesce(
    production_category,
    case
      when item_type = 'RAW_MATERIAL' then 'ICE_CREAM_MAKING'
      when item_type = 'PACKAGING' then 'PACKAGING'
      when lower(coalesce(name, '')) like '%pack%' then 'PACKAGING'
      else null
    end
  )
  where true;
end $$;

alter table if exists icecream_erp.stock_balances
  add column if not exists quantity_on_hand numeric(18,4) not null default 0,
  add column if not exists quantity_available numeric(18,4) not null default 0,
  add column if not exists quantity_reserved numeric(18,4) not null default 0,
  add column if not exists last_updated timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'stock_balances' and column_name = 'quantity'
  ) then
    execute $sql$
      update icecream_erp.stock_balances
      set quantity_on_hand = case when quantity_on_hand = 0 then coalesce(quantity, 0) else quantity_on_hand end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'stock_balances' and column_name = 'reserved_qty'
  ) then
    execute $sql$
      update icecream_erp.stock_balances
      set quantity_reserved = case when quantity_reserved = 0 then coalesce(reserved_qty, 0) else quantity_reserved end
      where true
    $sql$;
  end if;

  update icecream_erp.stock_balances
  set
    quantity_available = case
      when quantity_available = 0 then greatest(coalesce(quantity_on_hand, 0) - coalesce(quantity_reserved, 0), 0)
      else quantity_available
    end,
    last_updated = coalesce(last_updated, now())
  where true;
end $$;

alter table if exists icecream_erp.recipes
  add column if not exists expected_output_quantity numeric(18,4) not null default 1,
  add column if not exists output_unit_id uuid null,
  add column if not exists finished_item_id uuid null,
  add column if not exists instructions text null,
  add column if not exists packaging_requirement text null,
  add column if not exists production_category text not null default 'ICE_CREAM_MAKING',
  add column if not exists deleted_at timestamptz null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'recipes' and column_name = 'batch_size'
  ) then
    execute $sql$
      update icecream_erp.recipes
      set expected_output_quantity = case
        when expected_output_quantity = 1 and batch_size is not null then batch_size
        else expected_output_quantity
      end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'recipes' and column_name = 'batch_unit_id'
  ) then
    execute $sql$
      update icecream_erp.recipes
      set output_unit_id = coalesce(output_unit_id, batch_unit_id)
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'recipes' and column_name = 'notes'
  ) then
    execute $sql$
      update icecream_erp.recipes
      set instructions = coalesce(instructions, notes)
      where true
    $sql$;
  end if;
end $$;

create table if not exists icecream_erp.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  item_id uuid not null,
  quantity_required numeric(18,4) not null default 0,
  unit_id uuid null,
  wastage_allowance_percent numeric(8,3) not null default 0,
  production_category text not null default 'ICE_CREAM_MAKING',
  notes text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'icecream_erp' and table_name = 'recipe_ingredients'
  ) then
    execute $sql$
      insert into icecream_erp.recipe_items (
        recipe_id,
        item_id,
        quantity_required,
        unit_id,
        wastage_allowance_percent,
        production_category,
        notes,
        sort_order
      )
      select
        recipe_id,
        item_id,
        quantity,
        unit_id,
        0,
        'ICE_CREAM_MAKING',
        notes,
        sort_order
      from icecream_erp.recipe_ingredients
      where not exists (
        select 1
        from icecream_erp.recipe_items ri
        where ri.recipe_id = recipe_ingredients.recipe_id
          and ri.item_id = recipe_ingredients.item_id
      )
    $sql$;
  end if;
end $$;

create table if not exists icecream_erp.recipe_packaging_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  item_id uuid not null,
  quantity_required numeric(18,4) not null default 0,
  unit_id uuid null,
  wastage_allowance_percent numeric(8,3) not null default 0,
  notes text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.production_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  plan_number text not null,
  plan_date date not null default current_date,
  shift text not null default 'DAY',
  production_line text null,
  production_category text not null default 'ICE_CREAM_MAKING',
  status text not null default 'DRAFT',
  created_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists icecream_erp.production_plans
  add column if not exists organization_id uuid null,
  add column if not exists plan_number text null,
  add column if not exists plan_date date not null default current_date,
  add column if not exists shift text not null default 'DAY',
  add column if not exists production_line text null,
  add column if not exists production_category text not null default 'ICE_CREAM_MAKING',
  add column if not exists status text not null default 'DRAFT',
  add column if not exists created_by uuid null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists deleted_at timestamptz null;

create table if not exists icecream_erp.production_plan_items (
  id uuid primary key default gen_random_uuid(),
  production_plan_id uuid not null,
  recipe_id uuid not null,
  planned_quantity numeric(18,4) not null default 0,
  expected_output numeric(18,4) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists icecream_erp.production_batches
  add column if not exists production_date timestamptz null,
  add column if not exists production_line text null,
  add column if not exists production_category text not null default 'ICE_CREAM_MAKING',
  add column if not exists planned_quantity numeric(18,4) not null default 0,
  add column if not exists expected_output numeric(18,4) not null default 0,
  add column if not exists actual_output numeric(18,4) not null default 0,
  add column if not exists quality_status text not null default 'PENDING',
  add column if not exists quality_notes text null,
  add column if not exists wastage_quantity numeric(18,4) not null default 0,
  add column if not exists wastage_percentage numeric(8,3) not null default 0,
  add column if not exists efficiency_percentage numeric(8,3) not null default 0,
  add column if not exists worker_count integer not null default 0,
  add column if not exists people_off_count integer not null default 0,
  add column if not exists labour_cost numeric(18,2) not null default 0,
  add column if not exists overhead_cost numeric(18,2) not null default 0,
  add column if not exists material_cost numeric(18,2) not null default 0,
  add column if not exists deleted_at timestamptz null,
  add column if not exists wastage_reason text null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'planned_date'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set production_date = coalesce(production_date, planned_date::timestamptz)
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'planned_qty'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set
        planned_quantity = case when planned_quantity = 0 then coalesce(planned_qty, 0) else planned_quantity end,
        expected_output = case when expected_output = 0 then coalesce(planned_qty, 0) else expected_output end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'actual_qty'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set actual_output = case when actual_output = 0 then coalesce(actual_qty, 0) else actual_output end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'wastage_qty'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set wastage_quantity = case when wastage_quantity = 0 then coalesce(wastage_qty, 0) else wastage_quantity end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'total_material_cost'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set material_cost = case when material_cost = 0 then coalesce(total_material_cost, 0) else material_cost end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'total_labour_cost'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set labour_cost = case when labour_cost = 0 then coalesce(total_labour_cost, 0) else labour_cost end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'total_overhead_cost'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set overhead_cost = case when overhead_cost = 0 then coalesce(total_overhead_cost, 0) else overhead_cost end
      where true
    $sql$;
  end if;
end $$;

create table if not exists icecream_erp.production_batch_materials (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  item_id uuid not null,
  unit_id uuid null,
  quantity_required numeric(18,4) not null default 0,
  quantity_issued numeric(18,4) not null default 0,
  quantity_actual numeric(18,4) not null default 0,
  quantity_remaining numeric(18,4) not null default 0,
  unit_cost numeric(18,4) not null default 0,
  total_cost numeric(18,2) not null default 0,
  variance numeric(18,4) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists icecream_erp.production_batch_materials
  add column if not exists quantity_remaining numeric(18,4) not null default 0,
  add column if not exists unit_cost numeric(18,4) not null default 0,
  add column if not exists total_cost numeric(18,2) not null default 0,
  add column if not exists notes text null;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'icecream_erp' and table_name = 'batch_material_usage'
  ) then
    execute $sql$
      insert into icecream_erp.production_batch_materials (
        batch_id,
        item_id,
        quantity_required,
        quantity_issued,
        quantity_actual,
        quantity_remaining,
        unit_cost,
        total_cost,
        variance,
        notes
      )
      select
        batch_id,
        item_id,
        standard_qty,
        actual_qty,
        actual_qty,
        greatest(standard_qty - actual_qty, 0),
        coalesce(unit_cost, 0),
        coalesce(total_cost, 0),
        coalesce(variance_qty, standard_qty - actual_qty),
        notes
      from icecream_erp.batch_material_usage
      where not exists (
        select 1
        from icecream_erp.production_batch_materials pbm
        where pbm.batch_id = batch_material_usage.batch_id
          and pbm.item_id = batch_material_usage.item_id
      )
    $sql$;
  end if;
end $$;

create table if not exists icecream_erp.production_batch_outputs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  item_id uuid not null,
  unit_id uuid null,
  expected_quantity numeric(18,4) not null default 0,
  actual_quantity numeric(18,4) not null default 0,
  wastage_quantity numeric(18,4) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into icecream_erp.production_batch_outputs (
  batch_id,
  item_id,
  unit_id,
  expected_quantity,
  actual_quantity,
  wastage_quantity
)
select
  pb.id,
  r.finished_item_id,
  r.output_unit_id,
  coalesce(pb.expected_output, 0),
  coalesce(pb.actual_output, 0),
  coalesce(pb.wastage_quantity, 0)
from icecream_erp.production_batches pb
join icecream_erp.recipes r on r.id = pb.recipe_id
where r.finished_item_id is not null
  and not exists (
    select 1
    from icecream_erp.production_batch_outputs pbo
    where pbo.batch_id = pb.id
  );

create table if not exists icecream_erp.production_worker_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  batch_id uuid not null,
  employee_id uuid null,
  worker_name text null,
  shift_name text not null default 'DAY',
  attendance_status text not null default 'PRESENT',
  is_off_shift boolean not null default false,
  hours_worked numeric(8,2) not null default 0,
  output_quantity numeric(18,4) not null default 0,
  remarks text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.production_stock_closures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  batch_id uuid null,
  item_id uuid not null,
  warehouse_id uuid not null,
  closure_date date not null default current_date,
  opening_quantity numeric(18,4) not null default 0,
  additional_quantity numeric(18,4) not null default 0,
  used_quantity numeric(18,4) not null default 0,
  remaining_quantity numeric(18,4) not null default 0,
  closing_quantity numeric(18,4) not null default 0,
  unit_cost numeric(18,4) not null default 0,
  notes text null,
  recorded_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.production_cost_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  batch_id uuid not null,
  material_id uuid null,
  item_id uuid not null,
  previous_unit_cost numeric(18,4) not null default 0,
  adjusted_unit_cost numeric(18,4) not null default 0,
  adjustment_reason text null,
  adjusted_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists icecream_erp.finished_goods_transfers (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null,
  source_warehouse_id uuid not null,
  destination_warehouse_id uuid not null,
  quantity_transferred numeric(18,4) not null default 0,
  received_by uuid null,
  transfer_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recipe_items_recipe
  on icecream_erp.recipe_items (recipe_id, sort_order);
create index if not exists idx_recipe_packaging_items_recipe
  on icecream_erp.recipe_packaging_items (recipe_id, sort_order);
create index if not exists idx_production_plan_items_plan
  on icecream_erp.production_plan_items (production_plan_id);
create index if not exists idx_production_batch_materials_batch
  on icecream_erp.production_batch_materials (batch_id, item_id);
create index if not exists idx_production_batch_outputs_batch
  on icecream_erp.production_batch_outputs (batch_id, item_id);
create index if not exists idx_production_worker_assignments_batch
  on icecream_erp.production_worker_assignments (batch_id, attendance_status);
create index if not exists idx_production_stock_closures_batch
  on icecream_erp.production_stock_closures (batch_id, closure_date);
create index if not exists idx_production_cost_overrides_batch
  on icecream_erp.production_cost_overrides (batch_id, item_id);
create index if not exists idx_finished_goods_transfers_batch
  on icecream_erp.finished_goods_transfers (production_batch_id);

grant all on all tables in schema icecream_erp to authenticated;
grant all on all tables in schema icecream_erp to service_role;

notify pgrst, 'reload schema';
