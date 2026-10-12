-- Absolute ERP final workflow hardening: item-specific UOM conversion and BOM version audit support.
-- Safe to run after review. Does not mutate production transaction data.

set search_path = icecream_erp, public;

alter table if exists icecream_erp.units_of_measure
  add column if not exists dimension text,
  add column if not exists symbol text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'icecream_erp'
      and table_name = 'units_of_measure'
      and column_name = 'unit_type'
  ) then
    update icecream_erp.units_of_measure
    set dimension = coalesce(nullif(dimension, ''), unit_type)
    where dimension is null;
  end if;
end $$;

create table if not exists icecream_erp.item_uom_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  item_id uuid not null references icecream_erp.items(id),
  from_uom_id uuid not null references icecream_erp.units_of_measure(id),
  to_uom_id uuid not null references icecream_erp.units_of_measure(id),
  conversion_factor numeric(24,8) not null,
  is_active boolean not null default true,
  notes text null,
  created_by uuid null references icecream_erp.users(id),
  updated_by uuid null references icecream_erp.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_uom_conversions_positive_factor check (conversion_factor > 0),
  constraint item_uom_conversions_distinct_units check (from_uom_id <> to_uom_id)
);

create unique index if not exists item_uom_conversions_unique_active
  on icecream_erp.item_uom_conversions (organization_id, item_id, from_uom_id, to_uom_id)
  where is_active;

create index if not exists item_uom_conversions_item_idx
  on icecream_erp.item_uom_conversions (organization_id, item_id, is_active);

create index if not exists item_uom_conversions_unit_pair_idx
  on icecream_erp.item_uom_conversions (organization_id, from_uom_id, to_uom_id, is_active);

alter table if exists icecream_erp.purchase_order_items
  add column if not exists transaction_quantity numeric(24,6),
  add column if not exists transaction_uom_id uuid references icecream_erp.units_of_measure(id),
  add column if not exists base_quantity numeric(24,6),
  add column if not exists base_uom_id uuid references icecream_erp.units_of_measure(id),
  add column if not exists uom_conversion_factor numeric(24,8);

alter table if exists icecream_erp.goods_received_note_items
  add column if not exists transaction_quantity numeric(24,6),
  add column if not exists transaction_uom_id uuid references icecream_erp.units_of_measure(id),
  add column if not exists base_quantity numeric(24,6),
  add column if not exists base_uom_id uuid references icecream_erp.units_of_measure(id),
  add column if not exists uom_conversion_factor numeric(24,8);

alter table if exists icecream_erp.stock_movements
  add column if not exists transaction_quantity numeric(24,6),
  add column if not exists transaction_uom_id uuid references icecream_erp.units_of_measure(id),
  add column if not exists base_quantity numeric(24,6),
  add column if not exists base_uom_id uuid references icecream_erp.units_of_measure(id),
  add column if not exists uom_conversion_factor numeric(24,8);

alter table if exists icecream_erp.production_issue_lines
  add column if not exists transaction_quantity numeric(24,6),
  add column if not exists transaction_uom_id uuid references icecream_erp.units_of_measure(id),
  add column if not exists base_quantity numeric(24,6),
  add column if not exists base_uom_id uuid references icecream_erp.units_of_measure(id),
  add column if not exists uom_conversion_factor numeric(24,8);

create table if not exists icecream_erp.recipe_version_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  recipe_id uuid not null references icecream_erp.recipes(id),
  previous_recipe_id uuid null references icecream_erp.recipes(id),
  version_number integer not null,
  change_type text not null,
  changed_by uuid null references icecream_erp.users(id),
  changed_at timestamptz not null default now(),
  before_values jsonb null,
  after_values jsonb null,
  reason text null
);

create index if not exists recipe_version_history_recipe_idx
  on icecream_erp.recipe_version_history (organization_id, recipe_id, changed_at desc);


-- RLS HARDENING FOR NEW ERP TABLES
alter table icecream_erp.item_uom_conversions enable row level security;
alter table icecream_erp.recipe_version_history enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'item_uom_conversions'
      and policyname = 'item_uom_conversions_deny_anon'
  ) then
    create policy item_uom_conversions_deny_anon
      on icecream_erp.item_uom_conversions
      for all
      to anon
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'item_uom_conversions'
      and policyname = 'item_uom_conversions_service_role_full_access'
  ) then
    create policy item_uom_conversions_service_role_full_access
      on icecream_erp.item_uom_conversions
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'recipe_version_history'
      and policyname = 'recipe_version_history_deny_anon'
  ) then
    create policy recipe_version_history_deny_anon
      on icecream_erp.recipe_version_history
      for all
      to anon
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'recipe_version_history'
      and policyname = 'recipe_version_history_service_role_full_access'
  ) then
    create policy recipe_version_history_service_role_full_access
      on icecream_erp.recipe_version_history
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

grant select, insert, update on icecream_erp.item_uom_conversions to authenticated, service_role;
grant select, insert on icecream_erp.recipe_version_history to authenticated, service_role;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
