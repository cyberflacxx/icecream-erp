-- Category-gated yield profiles. Stock remains in the existing item base UOM.
set search_path = icecream_erp, public;

create table if not exists icecream_erp.production_raw_material_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  item_id uuid not null references icecream_erp.items(id),
  purchase_uom_id uuid not null references icecream_erp.units_of_measure(id),
  purchase_quantity numeric(24,8) not null check (purchase_quantity > 0),
  conversion_uom_id uuid not null references icecream_erp.units_of_measure(id),
  conversion_quantity numeric(24,8) not null check (conversion_quantity > 0),
  production_output_uom_id uuid not null references icecream_erp.units_of_measure(id),
  production_output_quantity numeric(24,8) not null check (production_output_quantity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references icecream_erp.user_accounts(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references icecream_erp.user_accounts(id)
);

create unique index if not exists idx_production_raw_material_conversions_active_item
  on icecream_erp.production_raw_material_conversions (organization_id, item_id) where is_active;

create or replace function icecream_erp.validate_production_raw_material_conversion()
returns trigger language plpgsql security definer set search_path = icecream_erp, public as $$
declare v_item_org uuid; v_base_uom uuid; v_category_code text; v_factor numeric(24,8); v_profile_factor numeric(24,8);
begin
  if not new.is_active then new.updated_at := now(); return new; end if;
  select i.organization_id, coalesce(i.unit_of_measure_id, i.unit_id), c.code into v_item_org, v_base_uom, v_category_code
  from icecream_erp.items i join icecream_erp.item_categories c on c.id = i.category_id where i.id = new.item_id;
  if v_item_org is null or v_item_org <> new.organization_id then raise exception 'Production conversion item must belong to the same organization.'; end if;
  if v_category_code is distinct from 'RAW_MATERIAL_PRODUCTION' then raise exception 'Production conversion profiles are only allowed for RAW_MATERIAL_PRODUCTION items.'; end if;
  if v_base_uom is distinct from new.conversion_uom_id then raise exception 'Production conversion UOM must match the item base inventory UOM.'; end if;
  v_profile_factor := new.conversion_quantity / new.purchase_quantity;
  if new.purchase_uom_id = new.conversion_uom_id then
    if v_profile_factor <> 1 then raise exception 'Production conversion conflicts with the configured item UOM conversion.'; end if;
  else
    select conversion_factor into v_factor from icecream_erp.item_uom_conversions
    where organization_id = new.organization_id and item_id = new.item_id and from_uom_id = new.purchase_uom_id and to_uom_id = new.conversion_uom_id and is_active
    order by updated_at desc, created_at desc limit 1;
    if v_factor is null or v_factor <> v_profile_factor then raise exception 'Production conversion conflicts with the configured item UOM conversion.'; end if;
  end if;
  new.updated_at := now(); return new;
end; $$;

drop trigger if exists trg_validate_production_raw_material_conversion on icecream_erp.production_raw_material_conversions;
create trigger trg_validate_production_raw_material_conversion before insert or update on icecream_erp.production_raw_material_conversions
for each row execute function icecream_erp.validate_production_raw_material_conversion();

create or replace function icecream_erp.prevent_unsafe_production_conversion_category_change()
returns trigger language plpgsql security definer set search_path = icecream_erp, public as $$
declare v_new_category_code text;
begin
  if new.category_id is distinct from old.category_id and exists (select 1 from icecream_erp.production_raw_material_conversions p where p.item_id = old.id and p.organization_id = old.organization_id and p.is_active) then
    select code into v_new_category_code from icecream_erp.item_categories where id = new.category_id;
    if v_new_category_code is distinct from 'RAW_MATERIAL_PRODUCTION' then raise exception 'An item with an active production conversion profile cannot change category until the profile is safely retired.'; end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_prevent_unsafe_production_conversion_category_change on icecream_erp.items;
create trigger trg_prevent_unsafe_production_conversion_category_change before update of category_id on icecream_erp.items
for each row execute function icecream_erp.prevent_unsafe_production_conversion_category_change();

alter table icecream_erp.goods_received_note_items add column if not exists production_profile_id uuid references icecream_erp.production_raw_material_conversions(id), add column if not exists production_output_uom_id uuid references icecream_erp.units_of_measure(id), add column if not exists production_output_quantity_per_profile numeric(24,8), add column if not exists production_profile_purchase_quantity numeric(24,8), add column if not exists production_profile_conversion_quantity numeric(24,8);
alter table icecream_erp.stock_movements add column if not exists production_profile_id uuid references icecream_erp.production_raw_material_conversions(id), add column if not exists production_output_uom_id uuid references icecream_erp.units_of_measure(id), add column if not exists production_output_quantity_per_profile numeric(24,8), add column if not exists production_profile_purchase_quantity numeric(24,8), add column if not exists production_profile_conversion_quantity numeric(24,8);
alter table icecream_erp.production_issue_lines add column if not exists production_profile_id uuid references icecream_erp.production_raw_material_conversions(id), add column if not exists production_output_uom_id uuid references icecream_erp.units_of_measure(id), add column if not exists production_output_quantity_per_profile numeric(24,8), add column if not exists production_profile_purchase_quantity numeric(24,8), add column if not exists production_profile_conversion_quantity numeric(24,8);

create or replace function icecream_erp.snapshot_production_raw_material_conversion()
returns trigger language plpgsql security definer set search_path = icecream_erp, public as $$
declare v_item_id uuid; v_profile icecream_erp.production_raw_material_conversions%rowtype;
begin
  v_item_id := nullif(coalesce(to_jsonb(new)->>'item_id', to_jsonb(new)->>'component_item_id'), '')::uuid;
  if v_item_id is null or new.production_profile_id is not null then return new; end if;
  select * into v_profile from icecream_erp.production_raw_material_conversions where item_id = v_item_id and is_active order by updated_at desc, created_at desc limit 1;
  if found then
    new.production_profile_id := v_profile.id; new.production_output_uom_id := v_profile.production_output_uom_id; new.production_output_quantity_per_profile := v_profile.production_output_quantity;
    new.production_profile_purchase_quantity := v_profile.purchase_quantity; new.production_profile_conversion_quantity := v_profile.conversion_quantity;
  end if;
  return new;
end; $$;

drop trigger if exists trg_snapshot_production_profile_grn on icecream_erp.goods_received_note_items;
create trigger trg_snapshot_production_profile_grn before insert on icecream_erp.goods_received_note_items for each row execute function icecream_erp.snapshot_production_raw_material_conversion();
drop trigger if exists trg_snapshot_production_profile_stock_movement on icecream_erp.stock_movements;
create trigger trg_snapshot_production_profile_stock_movement before insert on icecream_erp.stock_movements for each row execute function icecream_erp.snapshot_production_raw_material_conversion();
drop trigger if exists trg_snapshot_production_profile_issue_line on icecream_erp.production_issue_lines;
create trigger trg_snapshot_production_profile_issue_line before insert on icecream_erp.production_issue_lines for each row execute function icecream_erp.snapshot_production_raw_material_conversion();

alter table icecream_erp.production_raw_material_conversions enable row level security;
create policy production_raw_material_conversions_authenticated_read on icecream_erp.production_raw_material_conversions for select to authenticated using (true);
create policy production_raw_material_conversions_service_role_all on icecream_erp.production_raw_material_conversions for all to service_role using (true) with check (true);
create policy production_raw_material_conversions_deny_anon on icecream_erp.production_raw_material_conversions for all to anon using (false) with check (false);
grant select, insert, update on icecream_erp.production_raw_material_conversions to authenticated, service_role;
notify pgrst, 'reload schema';
