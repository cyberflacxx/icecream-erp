create table if not exists icecream_erp.supplier_shortages (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null,
  po_item_id uuid not null,
  supplier_id uuid null,
  item_id uuid not null,
  ordered_quantity numeric(18,3) not null default 0,
  received_quantity numeric(18,3) not null default 0,
  shortage_quantity numeric(18,3) not null default 0,
  expected_resolution_date date null,
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplier_shortages_purchase_order on icecream_erp.supplier_shortages (purchase_order_id);
create index if not exists idx_supplier_shortages_supplier on icecream_erp.supplier_shortages (supplier_id);
create index if not exists idx_supplier_shortages_item on icecream_erp.supplier_shortages (item_id);
create index if not exists idx_supplier_shortages_status on icecream_erp.supplier_shortages (status);

create table if not exists icecream_erp.inventory_stock_takes (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null,
  stock_take_date date not null,
  counted_by uuid not null,
  approval_request_id uuid null,
  status text not null default 'DRAFT',
  reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_stock_takes_warehouse on icecream_erp.inventory_stock_takes (warehouse_id);
create index if not exists idx_inventory_stock_takes_status on icecream_erp.inventory_stock_takes (status);

create table if not exists icecream_erp.inventory_stock_take_items (
  id uuid primary key default gen_random_uuid(),
  stock_take_id uuid not null references icecream_erp.inventory_stock_takes (id) on delete cascade,
  item_id uuid not null,
  system_quantity numeric(18,3) not null default 0,
  physical_quantity numeric(18,3) not null default 0,
  variance_quantity numeric(18,3) not null default 0,
  variance_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_stock_take_items_take on icecream_erp.inventory_stock_take_items (stock_take_id);
create index if not exists idx_inventory_stock_take_items_item on icecream_erp.inventory_stock_take_items (item_id);

create table if not exists icecream_erp.goods_return_vouchers (
  id uuid primary key default gen_random_uuid(),
  customer_return_id uuid null,
  invoice_id uuid null,
  customer_id uuid null,
  warehouse_id uuid not null,
  return_reason text not null,
  qc_status text not null default 'PENDING',
  qc_note text null,
  final_stock_action text null,
  created_by uuid not null,
  approved_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_goods_return_vouchers_invoice on icecream_erp.goods_return_vouchers (invoice_id);
create index if not exists idx_goods_return_vouchers_warehouse on icecream_erp.goods_return_vouchers (warehouse_id);
create index if not exists idx_goods_return_vouchers_qc_status on icecream_erp.goods_return_vouchers (qc_status);

alter table if exists icecream_erp.stock_movements
  add column if not exists source_warehouse_id uuid null,
  add column if not exists destination_warehouse_id uuid null,
  add column if not exists batch_number text null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists posted_at timestamptz null,
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by uuid null,
  add column if not exists void_reason text null;

create index if not exists idx_stock_movements_batch_number on icecream_erp.stock_movements (batch_number);
create index if not exists idx_stock_movements_reference on icecream_erp.stock_movements (reference_type, reference_id);

alter table if exists icecream_erp.warehouses
  add column if not exists warehouse_type text null;

alter table if exists icecream_erp.items
  add column if not exists stock_type text null,
  add column if not exists default_warehouse_id uuid null,
  add column if not exists costing_method text null;
