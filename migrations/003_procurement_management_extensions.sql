create table if not exists icecream_erp.supplier_items (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  supplier_id uuid not null,
  item_id uuid not null,
  last_price numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

create unique index if not exists idx_supplier_items_unique on icecream_erp.supplier_items (supplier_id, item_id);

create table if not exists icecream_erp.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  supplier_id uuid not null,
  purchase_order_id uuid null,
  goods_received_note_id uuid null,
  invoice_number text not null,
  invoice_date date not null,
  due_date date null,
  invoice_total numeric(18,2) not null default 0,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_supplier_invoices_number on icecream_erp.supplier_invoices (organization_id, invoice_number);
create index if not exists idx_supplier_invoices_supplier on icecream_erp.supplier_invoices (supplier_id);
create index if not exists idx_supplier_invoices_purchase_order on icecream_erp.supplier_invoices (purchase_order_id);
create index if not exists idx_supplier_invoices_status on icecream_erp.supplier_invoices (status);

create table if not exists icecream_erp.supplier_invoice_items (
  id uuid primary key default gen_random_uuid(),
  supplier_invoice_id uuid not null references icecream_erp.supplier_invoices (id) on delete cascade,
  item_id uuid not null,
  quantity_invoiced numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  po_unit_cost numeric(18,2) null,
  unit_cost_reference numeric(18,2) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplier_invoice_items_invoice on icecream_erp.supplier_invoice_items (supplier_invoice_id);
create index if not exists idx_supplier_invoice_items_item on icecream_erp.supplier_invoice_items (item_id);

create table if not exists icecream_erp.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  supplier_id uuid not null,
  supplier_invoice_id uuid not null references icecream_erp.supplier_invoices (id),
  payment_date date not null,
  payment_method text not null,
  reference_number text null,
  amount_paid numeric(18,2) not null default 0,
  status text not null default 'POSTED',
  remarks text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_supplier_payments_invoice on icecream_erp.supplier_payments (supplier_invoice_id);
create index if not exists idx_supplier_payments_supplier on icecream_erp.supplier_payments (supplier_id);
create index if not exists idx_supplier_payments_date on icecream_erp.supplier_payments (payment_date);

alter table if exists icecream_erp.supplier_shortages
  add column if not exists procurement_note text null,
  add column if not exists supplier_response text null;

alter table if exists icecream_erp.suppliers
  add column if not exists approved_status text null,
  add column if not exists currency text null,
  add column if not exists credit_terms text null;
