create table if not exists icecream_erp.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations (id),
  supplier_id uuid not null references icecream_erp.suppliers (id),
  purchase_order_id uuid null references icecream_erp.purchase_orders (id),
  goods_received_note_id uuid null references icecream_erp.goods_received_notes (id),
  invoice_number text not null,
  invoice_date date not null default current_date,
  due_date date null,
  subtotal numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  invoice_total numeric(18,2) not null default 0,
  status text not null default 'PENDING',
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_supplier_invoices_number
  on icecream_erp.supplier_invoices (organization_id, invoice_number);
create index if not exists idx_supplier_invoices_supplier
  on icecream_erp.supplier_invoices (supplier_id);
create index if not exists idx_supplier_invoices_purchase_order
  on icecream_erp.supplier_invoices (purchase_order_id);
create index if not exists idx_supplier_invoices_status
  on icecream_erp.supplier_invoices (organization_id, status, invoice_date);

create table if not exists icecream_erp.supplier_invoice_items (
  id uuid primary key default gen_random_uuid(),
  supplier_invoice_id uuid not null references icecream_erp.supplier_invoices (id) on delete cascade,
  item_id uuid not null references icecream_erp.items (id),
  quantity_invoiced numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  po_unit_cost numeric(18,2) null,
  unit_cost_reference numeric(18,2) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplier_invoice_items_invoice
  on icecream_erp.supplier_invoice_items (supplier_invoice_id);
create index if not exists idx_supplier_invoice_items_item
  on icecream_erp.supplier_invoice_items (item_id);

create table if not exists icecream_erp.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations (id),
  supplier_id uuid not null references icecream_erp.suppliers (id),
  supplier_invoice_id uuid not null references icecream_erp.supplier_invoices (id),
  payment_date date not null default current_date,
  payment_method text not null,
  reference_number text null,
  amount_paid numeric(18,2) not null default 0,
  status text not null default 'POSTED',
  remarks text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_supplier_payments_invoice
  on icecream_erp.supplier_payments (supplier_invoice_id);
create index if not exists idx_supplier_payments_supplier
  on icecream_erp.supplier_payments (supplier_id);
create index if not exists idx_supplier_payments_date
  on icecream_erp.supplier_payments (organization_id, payment_date);

create table if not exists icecream_erp.supplier_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations (id),
  supplier_id uuid not null references icecream_erp.suppliers (id),
  grn_id uuid null references icecream_erp.goods_received_notes (id),
  return_number text not null,
  return_date date not null default current_date,
  reason text not null,
  total_value numeric(18,2) not null default 0,
  status text not null default 'pending_qc',
  created_by uuid null,
  updated_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_supplier_returns_number
  on icecream_erp.supplier_returns (organization_id, return_number);
create index if not exists idx_supplier_returns_supplier
  on icecream_erp.supplier_returns (supplier_id, return_date);
create index if not exists idx_supplier_returns_status
  on icecream_erp.supplier_returns (organization_id, status);

create table if not exists icecream_erp.supplier_return_items (
  id uuid primary key default gen_random_uuid(),
  supplier_return_id uuid not null references icecream_erp.supplier_returns (id) on delete cascade,
  item_id uuid not null references icecream_erp.items (id),
  quantity_returned numeric(18,3) not null default 0,
  reason text not null,
  qc_status text not null default 'PENDING_QC',
  qc_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplier_return_items_return
  on icecream_erp.supplier_return_items (supplier_return_id);
create index if not exists idx_supplier_return_items_item
  on icecream_erp.supplier_return_items (item_id);

create table if not exists icecream_erp.hr_production_worker_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations (id),
  batch_id uuid not null references icecream_erp.production_batches (id),
  employee_id uuid not null references icecream_erp.employees (id),
  schedule_id uuid null,
  product_id uuid null references icecream_erp.items (id),
  shift_name text not null,
  quantity_produced numeric(18,3) not null default 0,
  accepted_quantity numeric(18,3) not null default 0,
  rejected_quantity numeric(18,3) not null default 0,
  hours_worked_snapshot numeric(8,2) not null default 0,
  remarks text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_production_worker_outputs_batch
  on icecream_erp.hr_production_worker_outputs (batch_id, employee_id);
create index if not exists idx_hr_production_worker_outputs_product
  on icecream_erp.hr_production_worker_outputs (product_id, shift_name);
create index if not exists idx_hr_production_worker_outputs_org_created
  on icecream_erp.hr_production_worker_outputs (organization_id, created_at desc);

grant usage on schema icecream_erp to anon, authenticated, service_role;
grant select, insert, update, delete on
  icecream_erp.supplier_invoices,
  icecream_erp.supplier_invoice_items,
  icecream_erp.supplier_payments,
  icecream_erp.supplier_returns,
  icecream_erp.supplier_return_items,
  icecream_erp.hr_production_worker_outputs
to anon, authenticated, service_role;

notify pgrst, 'reload schema';
