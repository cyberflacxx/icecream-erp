-- Inventory and stores control tightening.
-- Safe additive changes only for the icecream_erp schema.

alter table if exists icecream_erp.goods_received_notes
  add column if not exists delivery_note_number text null,
  add column if not exists posted_by uuid null,
  add column if not exists posted_at timestamptz null,
  add column if not exists cancelled_by uuid null,
  add column if not exists cancelled_at timestamptz null;

alter table if exists icecream_erp.goods_received_note_items
  add column if not exists accepted_quantity numeric(18,3) not null default 0,
  add column if not exists damaged_quantity numeric(18,3) not null default 0,
  add column if not exists shortage_quantity numeric(18,3) not null default 0,
  add column if not exists remarks text null;

update icecream_erp.goods_received_note_items
set
  accepted_quantity = greatest(coalesce(quantity_received, 0) - coalesce(quantity_rejected, 0) - coalesce(damaged_quantity, 0), 0),
  shortage_quantity = greatest(coalesce(quantity_expected, 0) - coalesce(quantity_received, 0), 0)
where true;

alter table if exists icecream_erp.stock_transfer_items
  add column if not exists batch_number text null,
  add column if not exists expiry_date date null,
  add column if not exists remarks text null;

create unique index if not exists idx_warehouses_org_code_unique
  on icecream_erp.warehouses (organization_id, code);

create unique index if not exists idx_stock_transfers_org_transfer_number_unique
  on icecream_erp.stock_transfers (organization_id, transfer_number);

create unique index if not exists idx_stock_movements_reference_guard
  on icecream_erp.stock_movements (reference_type, reference_id, movement_type, warehouse_id, item_id)
  where reference_type is not null and reference_id is not null;

grant all on all tables in schema icecream_erp to service_role;
grant select, insert, update, delete on
  icecream_erp.goods_received_notes,
  icecream_erp.goods_received_note_items,
  icecream_erp.stock_transfer_items
to anon, authenticated, service_role;

notify pgrst, 'reload schema';
