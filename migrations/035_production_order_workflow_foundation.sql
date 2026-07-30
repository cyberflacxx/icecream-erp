-- 035_production_order_workflow_foundation.sql
-- Additive foundation for production-order workflow.
-- Deployment notes: apply after 034. This migration creates only icecream_erp objects,
-- enables RLS, grants service-role access, and does not alter shared PostgREST/auth roles.
-- Rollback approach: drop dependent production-order objects only after exporting live data.

create table if not exists icecream_erp.number_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  series_type text not null,
  prefix text not null,
  last_number integer not null default 0,
  padding integer not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, series_type)
);

create table if not exists icecream_erp.production_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  branch_id uuid null references icecream_erp.branches(id),
  production_order_number text not null,
  production_order_type text not null default 'STANDARD',
  product_id uuid not null references icecream_erp.items(id),
  product_number text not null,
  product_description_snapshot text not null,
  product_category_snapshot text null,
  bom_id uuid not null references icecream_erp.recipes(id),
  bom_version_id uuid null,
  bom_number text null,
  bom_version integer null,
  status text not null default 'PLANNED',
  planned_quantity numeric(18,4) not null,
  released_quantity numeric(18,4) not null default 0,
  completed_quantity numeric(18,4) not null default 0,
  received_quantity numeric(18,4) not null default 0,
  rejected_quantity numeric(18,4) not null default 0,
  wastage_quantity numeric(18,4) not null default 0,
  remaining_quantity numeric(18,4) generated always as (
    greatest(coalesce(released_quantity, 0) - coalesce(completed_quantity, 0) - coalesce(rejected_quantity, 0), 0)
  ) stored,
  uom_id uuid null references icecream_erp.units_of_measure(id),
  production_warehouse_id uuid not null references icecream_erp.warehouses(id),
  finished_goods_warehouse_id uuid not null references icecream_erp.warehouses(id),
  planned_start_date date null,
  planned_due_date date null,
  actual_start_date timestamptz null,
  actual_completion_date timestamptz null,
  priority text not null default 'NORMAL',
  planned_cost numeric(18,2) not null default 0,
  actual_cost numeric(18,2) not null default 0,
  cost_per_unit numeric(18,4) not null default 0,
  release_notes text null,
  closing_notes text null,
  remarks text null,
  created_by uuid null references icecream_erp.users(id),
  released_by uuid null references icecream_erp.users(id),
  released_at timestamptz null,
  closed_by uuid null references icecream_erp.users(id),
  closed_at timestamptz null,
  cancelled_by uuid null references icecream_erp.users(id),
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version_number integer not null default 1,
  is_locked boolean not null default false,
  constraint production_orders_status_check check (status in ('PLANNED', 'RELEASED', 'CLOSED', 'CANCELLED')),
  constraint production_orders_planned_qty_check check (planned_quantity > 0),
  constraint production_orders_released_qty_check check (released_quantity >= 0),
  constraint production_orders_completed_qty_check check (completed_quantity >= 0),
  constraint production_orders_rejected_qty_check check (rejected_quantity >= 0),
  constraint production_orders_wastage_qty_check check (wastage_quantity >= 0),
  unique (organization_id, production_order_number)
);

create table if not exists icecream_erp.production_order_components (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  production_order_id uuid not null references icecream_erp.production_orders(id) on delete cascade,
  component_item_id uuid not null references icecream_erp.items(id),
  component_number_snapshot text not null,
  component_description_snapshot text not null,
  component_type text null,
  bom_line_id uuid null,
  bom_line_type text not null default 'INGREDIENT',
  base_quantity numeric(18,4) not null default 0,
  base_ratio numeric(18,8) not null default 0,
  planned_quantity numeric(18,4) not null default 0,
  released_quantity numeric(18,4) not null default 0,
  issued_quantity numeric(18,4) not null default 0,
  returned_quantity numeric(18,4) not null default 0,
  available_quantity_snapshot numeric(18,4) not null default 0,
  shortage_quantity numeric(18,4) not null default 0,
  uom_id uuid null references icecream_erp.units_of_measure(id),
  warehouse_id uuid not null references icecream_erp.warehouses(id),
  issue_method text not null default 'MANUAL',
  scrap_percentage numeric(8,3) not null default 0,
  unit_cost_snapshot numeric(18,4) not null default 0,
  planned_cost numeric(18,2) not null default 0,
  actual_cost numeric(18,2) not null default 0,
  line_status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_order_components_qty_check check (
    planned_quantity >= 0 and released_quantity >= 0 and issued_quantity >= 0 and returned_quantity >= 0
  )
);

create table if not exists icecream_erp.production_order_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  production_order_id uuid not null references icecream_erp.production_orders(id) on delete cascade,
  previous_status text null,
  new_status text not null,
  source_action text not null,
  reason text null,
  notes text null,
  changed_by uuid null references icecream_erp.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists idx_production_orders_org_status
  on icecream_erp.production_orders (organization_id, status, planned_due_date);
create index if not exists idx_production_orders_product
  on icecream_erp.production_orders (organization_id, product_id);
create index if not exists idx_production_orders_branch
  on icecream_erp.production_orders (organization_id, branch_id);
create index if not exists idx_production_order_components_order
  on icecream_erp.production_order_components (production_order_id, component_item_id);
create index if not exists idx_production_order_status_history_order
  on icecream_erp.production_order_status_history (production_order_id, changed_at desc);
create index if not exists idx_number_series_org_type
  on icecream_erp.number_series (organization_id, series_type);

alter table icecream_erp.number_series enable row level security;
alter table icecream_erp.production_orders enable row level security;
alter table icecream_erp.production_order_components enable row level security;
alter table icecream_erp.production_order_status_history enable row level security;

drop policy if exists "service_role_full_access" on icecream_erp.number_series;
create policy "service_role_full_access"
  on icecream_erp.number_series for all to service_role
  using (true) with check (true);

drop policy if exists "service_role_full_access" on icecream_erp.production_orders;
create policy "service_role_full_access"
  on icecream_erp.production_orders for all to service_role
  using (true) with check (true);

drop policy if exists "service_role_full_access" on icecream_erp.production_order_components;
create policy "service_role_full_access"
  on icecream_erp.production_order_components for all to service_role
  using (true) with check (true);

drop policy if exists "service_role_full_access" on icecream_erp.production_order_status_history;
create policy "service_role_full_access"
  on icecream_erp.production_order_status_history for all to service_role
  using (true) with check (true);

drop policy if exists "deny_anon" on icecream_erp.production_orders;
create policy "deny_anon"
  on icecream_erp.production_orders for all to anon
  using (false) with check (false);

drop policy if exists "deny_anon" on icecream_erp.production_order_components;
create policy "deny_anon"
  on icecream_erp.production_order_components for all to anon
  using (false) with check (false);

drop policy if exists "deny_anon" on icecream_erp.production_order_status_history;
create policy "deny_anon"
  on icecream_erp.production_order_status_history for all to anon
  using (false) with check (false);

grant all on
  icecream_erp.number_series,
  icecream_erp.production_orders,
  icecream_erp.production_order_components,
  icecream_erp.production_order_status_history
to service_role;

notify pgrst, 'reload schema';
