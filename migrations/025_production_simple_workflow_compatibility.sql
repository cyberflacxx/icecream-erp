-- Compatibility support for the simplified production flow.
-- Keeps legacy production/inventory column names in sync with the current API names.

alter table if exists icecream_erp.production_batches
  add column if not exists actual_quantity numeric(18,4) not null default 0,
  add column if not exists actual_yield_percentage numeric(8,2) not null default 0;

update icecream_erp.production_batches
set
  actual_quantity = coalesce(nullif(actual_quantity, 0), actual_output, actual_qty, 0),
  actual_yield_percentage = coalesce(nullif(actual_yield_percentage, 0), efficiency_percentage, yield_percent, 0)
where true;

alter table if exists icecream_erp.production_batches
  alter column shift set default 'DAY';

create or replace function icecream_erp.sync_production_batches_compat()
returns trigger
language plpgsql
as $$
begin
  if new.shift is null then
    new.shift := 'DAY'::icecream_erp.shift_type;
  end if;

  if new.planned_quantity is null or new.planned_quantity = 0 then
    new.planned_quantity := coalesce(new.planned_qty, 0);
  end if;
  if new.planned_qty is null then
    new.planned_qty := coalesce(new.planned_quantity, 0);
  end if;

  if new.expected_output is null or new.expected_output = 0 then
    new.expected_output := coalesce(new.planned_quantity, new.planned_qty, 0);
  end if;

  if new.production_date is null and new.planned_date is not null then
    new.production_date := new.planned_date::timestamptz;
  end if;
  if new.planned_date is null and new.production_date is not null then
    new.planned_date := new.production_date::date;
  end if;

  if new.actual_output is null or new.actual_output = 0 then
    new.actual_output := coalesce(new.actual_quantity, new.actual_qty, 0);
  end if;
  if new.actual_quantity is null or new.actual_quantity = 0 then
    new.actual_quantity := coalesce(new.actual_output, new.actual_qty, 0);
  end if;
  if new.actual_qty is null then
    new.actual_qty := coalesce(new.actual_output, new.actual_quantity, 0);
  end if;

  if new.wastage_quantity is null or new.wastage_quantity = 0 then
    new.wastage_quantity := coalesce(new.wastage_qty, 0);
  end if;
  if new.wastage_qty is null then
    new.wastage_qty := coalesce(new.wastage_quantity, 0);
  end if;

  if new.efficiency_percentage is null or new.efficiency_percentage = 0 then
    new.efficiency_percentage := coalesce(new.actual_yield_percentage, new.yield_percent, 0);
  end if;
  if new.actual_yield_percentage is null or new.actual_yield_percentage = 0 then
    new.actual_yield_percentage := coalesce(new.efficiency_percentage, new.yield_percent, 0);
  end if;
  if new.yield_percent is null then
    new.yield_percent := coalesce(new.efficiency_percentage, new.actual_yield_percentage, 0);
  end if;

  if new.material_cost is null or new.material_cost = 0 then
    new.material_cost := coalesce(new.total_material_cost, 0);
  end if;
  if new.total_material_cost is null then
    new.total_material_cost := coalesce(new.material_cost, 0);
  end if;

  if new.labour_cost is null or new.labour_cost = 0 then
    new.labour_cost := coalesce(new.total_labour_cost, 0);
  end if;
  if new.total_labour_cost is null then
    new.total_labour_cost := coalesce(new.labour_cost, 0);
  end if;

  if new.overhead_cost is null or new.overhead_cost = 0 then
    new.overhead_cost := coalesce(new.total_overhead_cost, 0);
  end if;
  if new.total_overhead_cost is null then
    new.total_overhead_cost := coalesce(new.overhead_cost, 0);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_production_batches_compat on icecream_erp.production_batches;
create trigger trg_sync_production_batches_compat
before insert or update on icecream_erp.production_batches
for each row execute function icecream_erp.sync_production_batches_compat();

alter table if exists icecream_erp.production_batch_materials
  add column if not exists item_type text null;

update icecream_erp.production_batch_materials
set item_type = coalesce(item_type, 'RAW_MATERIAL')
where item_type is null;

alter table if exists icecream_erp.production_batch_outputs
  add column if not exists output_item_id uuid null,
  add column if not exists quality_status text not null default 'PENDING',
  add column if not exists quantity_approved numeric(18,4) not null default 0;

update icecream_erp.production_batch_outputs
set
  output_item_id = coalesce(output_item_id, item_id),
  quantity_approved = coalesce(nullif(quantity_approved, 0), actual_quantity, 0),
  quality_status = coalesce(quality_status, 'PENDING')
where true;

create or replace function icecream_erp.sync_production_batch_outputs_compat()
returns trigger
language plpgsql
as $$
begin
  if new.output_item_id is null then
    new.output_item_id := new.item_id;
  end if;
  if new.item_id is null then
    new.item_id := new.output_item_id;
  end if;
  if new.quantity_approved is null then
    new.quantity_approved := coalesce(new.actual_quantity, 0);
  end if;
  if new.quality_status is null then
    new.quality_status := 'PENDING';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_production_batch_outputs_compat on icecream_erp.production_batch_outputs;
create trigger trg_sync_production_batch_outputs_compat
before insert or update on icecream_erp.production_batch_outputs
for each row execute function icecream_erp.sync_production_batch_outputs_compat();

alter table if exists icecream_erp.stock_movements
  add column if not exists running_balance numeric(18,3) not null default 0,
  add column if not exists source_warehouse_id uuid null,
  add column if not exists destination_warehouse_id uuid null;

update icecream_erp.stock_movements
set running_balance = coalesce(nullif(running_balance, 0), quantity, 0)
where running_balance is null or running_balance = 0;

alter table if exists icecream_erp.stock_transfers
  add column if not exists from_warehouse_id uuid null,
  add column if not exists to_warehouse_id uuid null;

update icecream_erp.stock_transfers
set
  from_warehouse_id = coalesce(from_warehouse_id, from_warehouse),
  to_warehouse_id = coalesce(to_warehouse_id, to_warehouse)
where true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_transfers_from_warehouse_id_fkey'
      and conrelid = 'icecream_erp.stock_transfers'::regclass
  ) then
    alter table icecream_erp.stock_transfers
      add constraint stock_transfers_from_warehouse_id_fkey
      foreign key (from_warehouse_id) references icecream_erp.warehouses(id) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_transfers_to_warehouse_id_fkey'
      and conrelid = 'icecream_erp.stock_transfers'::regclass
  ) then
    alter table icecream_erp.stock_transfers
      add constraint stock_transfers_to_warehouse_id_fkey
      foreign key (to_warehouse_id) references icecream_erp.warehouses(id) not valid;
  end if;
end $$;

create or replace function icecream_erp.sync_stock_transfers_compat()
returns trigger
language plpgsql
as $$
begin
  if new.from_warehouse_id is null then
    new.from_warehouse_id := new.from_warehouse;
  end if;
  if new.from_warehouse is null then
    new.from_warehouse := new.from_warehouse_id;
  end if;
  if new.to_warehouse_id is null then
    new.to_warehouse_id := new.to_warehouse;
  end if;
  if new.to_warehouse is null then
    new.to_warehouse := new.to_warehouse_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_stock_transfers_compat on icecream_erp.stock_transfers;
create trigger trg_sync_stock_transfers_compat
before insert or update on icecream_erp.stock_transfers
for each row execute function icecream_erp.sync_stock_transfers_compat();

alter table if exists icecream_erp.stock_transfer_items
  add column if not exists quantity_requested numeric(18,3),
  add column if not exists quantity_sent numeric(18,3) not null default 0,
  add column if not exists quantity_received numeric(18,3) not null default 0,
  add column if not exists notes text null;

update icecream_erp.stock_transfer_items
set
  quantity_requested = coalesce(nullif(quantity_requested, 0), quantity, 0),
  quantity_sent = coalesce(nullif(quantity_sent, 0), quantity, 0),
  quantity_received = coalesce(nullif(quantity_received, 0), quantity, 0),
  notes = coalesce(notes, remarks)
where true;

create or replace function icecream_erp.sync_stock_transfer_items_compat()
returns trigger
language plpgsql
as $$
begin
  if new.quantity_requested is null then
    new.quantity_requested := coalesce(new.quantity, new.quantity_sent, new.quantity_received, 0);
  end if;
  if new.quantity_sent is null or new.quantity_sent = 0 then
    new.quantity_sent := coalesce(new.quantity, new.quantity_requested, 0);
  end if;
  if new.quantity_received is null or new.quantity_received = 0 then
    new.quantity_received := coalesce(new.quantity, new.quantity_sent, new.quantity_requested, 0);
  end if;
  if new.quantity is null then
    new.quantity := coalesce(new.quantity_requested, new.quantity_sent, new.quantity_received, 0);
  end if;
  if new.notes is null then
    new.notes := new.remarks;
  end if;
  if new.remarks is null then
    new.remarks := new.notes;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_stock_transfer_items_compat on icecream_erp.stock_transfer_items;
create trigger trg_sync_stock_transfer_items_compat
before insert or update on icecream_erp.stock_transfer_items
for each row execute function icecream_erp.sync_stock_transfer_items_compat();

alter table if exists icecream_erp.audit_logs
  add column if not exists entity_type text null,
  add column if not exists entity_id uuid null,
  add column if not exists user_profile_id uuid null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists icecream_erp.audit_logs
  alter column organization_id drop not null,
  alter column table_name drop not null,
  alter column table_name set default 'system';

update icecream_erp.audit_logs
set
  entity_type = coalesce(entity_type, table_name),
  entity_id = coalesce(entity_id, record_id),
  user_profile_id = coalesce(user_profile_id, user_id),
  metadata = coalesce(metadata, '{}'::jsonb)
where true;

create or replace function icecream_erp.sync_audit_logs_compat()
returns trigger
language plpgsql
as $$
begin
  if new.entity_type is null then
    new.entity_type := new.table_name;
  end if;
  if new.table_name is null then
    new.table_name := coalesce(new.entity_type, 'system');
  end if;
  if new.entity_id is null then
    new.entity_id := new.record_id;
  end if;
  if new.record_id is null then
    new.record_id := new.entity_id;
  end if;
  if new.user_profile_id is null then
    new.user_profile_id := new.user_id;
  end if;
  if new.user_id is null then
    new.user_id := new.user_profile_id;
  end if;
  if new.metadata is null then
    new.metadata := '{}'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_audit_logs_compat on icecream_erp.audit_logs;
create trigger trg_sync_audit_logs_compat
before insert or update on icecream_erp.audit_logs
for each row execute function icecream_erp.sync_audit_logs_compat();

notify pgrst, 'reload schema';
