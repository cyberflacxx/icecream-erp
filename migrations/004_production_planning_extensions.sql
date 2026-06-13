create table if not exists icecream_erp.production_flavours (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_production_flavours_code on icecream_erp.production_flavours (code);

create table if not exists icecream_erp.production_chocolate_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_production_chocolate_types_code on icecream_erp.production_chocolate_types (code);

alter table if exists icecream_erp.recipes
  add column if not exists flavour_id uuid null,
  add column if not exists chocolate_type_id uuid null,
  add column if not exists packaging_requirement text null;

create index if not exists idx_recipes_flavour on icecream_erp.recipes (flavour_id);
create index if not exists idx_recipes_chocolate_type on icecream_erp.recipes (chocolate_type_id);

create table if not exists icecream_erp.production_shift_targets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  shift text not null,
  target_date date not null,
  target_output_quantity numeric(18,3) not null default 0,
  target_workers numeric(18,3) not null default 0,
  target_production_time_hours numeric(18,2) not null default 0,
  target_material_usage numeric(18,3) not null default 0,
  approved_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_production_shift_targets_product on icecream_erp.production_shift_targets (product_id);
create index if not exists idx_production_shift_targets_date on icecream_erp.production_shift_targets (target_date);
create index if not exists idx_production_shift_targets_shift on icecream_erp.production_shift_targets (shift);

create table if not exists icecream_erp.finished_goods_transfers (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null,
  source_warehouse_id uuid not null,
  destination_warehouse_id uuid not null,
  quantity_transferred numeric(18,3) not null default 0,
  received_by uuid null,
  transfer_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finished_goods_transfers_batch on icecream_erp.finished_goods_transfers (production_batch_id);
create index if not exists idx_finished_goods_transfers_source on icecream_erp.finished_goods_transfers (source_warehouse_id);
create index if not exists idx_finished_goods_transfers_destination on icecream_erp.finished_goods_transfers (destination_warehouse_id);
