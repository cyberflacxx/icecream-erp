create table if not exists icecream_erp.sales_customer_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_sales_customer_groups_code on icecream_erp.sales_customer_groups (code);

create table if not exists icecream_erp.sales_product_prices (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  price_list_code text not null,
  flavour_id uuid null,
  chocolate_type_id uuid null,
  selling_price numeric(18,2) not null default 0,
  effective_date date null,
  expiry_date date null,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_product_prices_item on icecream_erp.sales_product_prices (item_id);
create index if not exists idx_sales_product_prices_code on icecream_erp.sales_product_prices (price_list_code);

create table if not exists icecream_erp.sales_discount_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_group_id uuid null,
  item_id uuid null,
  minimum_quantity numeric(18,3) not null default 0,
  discount_type text not null default 'PERCENTAGE',
  discount_value numeric(18,2) not null default 0,
  maximum_allowed_discount numeric(18,2) null,
  approval_required boolean not null default false,
  approval_status text not null default 'PENDING',
  approved_by uuid null,
  approved_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_discount_rules_group on icecream_erp.sales_discount_rules (customer_group_id);
create index if not exists idx_sales_discount_rules_item on icecream_erp.sales_discount_rules (item_id);

create table if not exists icecream_erp.sales_dispatch_notes (
  id uuid primary key default gen_random_uuid(),
  dispatch_note_number text not null,
  invoice_id uuid not null,
  customer_id uuid not null,
  warehouse_id uuid not null,
  dispatch_date date not null,
  status text not null default 'PENDING',
  vehicle_reference text null,
  dispatched_by uuid null,
  posted_at timestamptz null,
  voided_at timestamptz null,
  voided_by uuid null,
  void_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_sales_dispatch_notes_number on icecream_erp.sales_dispatch_notes (dispatch_note_number);
create index if not exists idx_sales_dispatch_notes_invoice on icecream_erp.sales_dispatch_notes (invoice_id);
create index if not exists idx_sales_dispatch_notes_customer on icecream_erp.sales_dispatch_notes (customer_id);
create index if not exists idx_sales_dispatch_notes_status on icecream_erp.sales_dispatch_notes (status);

create table if not exists icecream_erp.sales_dispatch_note_items (
  id uuid primary key default gen_random_uuid(),
  dispatch_note_id uuid not null references icecream_erp.sales_dispatch_notes (id) on delete cascade,
  invoice_item_id uuid not null,
  item_id uuid not null,
  quantity_invoiced numeric(18,3) not null default 0,
  quantity_dispatched numeric(18,3) not null default 0,
  batch_number text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_dispatch_note_items_dispatch on icecream_erp.sales_dispatch_note_items (dispatch_note_id);
create index if not exists idx_sales_dispatch_note_items_invoice_item on icecream_erp.sales_dispatch_note_items (invoice_item_id);

create table if not exists icecream_erp.goods_return_voucher_items (
  id uuid primary key default gen_random_uuid(),
  goods_return_voucher_id uuid not null references icecream_erp.goods_return_vouchers (id) on delete cascade,
  item_id uuid not null,
  quantity_returned numeric(18,3) not null default 0,
  unit_price numeric(18,2) not null default 0,
  reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_goods_return_voucher_items_voucher on icecream_erp.goods_return_voucher_items (goods_return_voucher_id);

create table if not exists icecream_erp.sales_credit_notes (
  id uuid primary key default gen_random_uuid(),
  credit_note_number text not null,
  customer_id uuid not null,
  invoice_id uuid null,
  customer_return_id uuid null,
  amount numeric(18,2) not null default 0,
  reason text not null,
  status text not null default 'DRAFT',
  approved_by uuid null,
  approved_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_sales_credit_notes_number on icecream_erp.sales_credit_notes (credit_note_number);
create index if not exists idx_sales_credit_notes_customer on icecream_erp.sales_credit_notes (customer_id);

create table if not exists icecream_erp.sales_journals (
  id uuid primary key default gen_random_uuid(),
  journal_number text not null,
  journal_date date not null,
  customer_id uuid null,
  invoice_id uuid null,
  account_name text not null,
  debit_amount numeric(18,2) not null default 0,
  credit_amount numeric(18,2) not null default 0,
  description text null,
  status text not null default 'DRAFT',
  posted_by uuid null,
  posted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_sales_journals_number on icecream_erp.sales_journals (journal_number);
create index if not exists idx_sales_journals_date on icecream_erp.sales_journals (journal_date);

alter table if exists icecream_erp.customers
  add column if not exists customer_group_id uuid null,
  add column if not exists credit_allowed boolean not null default false,
  add column if not exists price_list_code text null,
  add column if not exists tax_number text null;

alter table if exists icecream_erp.quotations
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null;

alter table if exists icecream_erp.sales_orders
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists stock_available boolean null;

alter table if exists icecream_erp.invoices
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists posted_by uuid null,
  add column if not exists posted_at timestamptz null,
  add column if not exists voided_by uuid null,
  add column if not exists voided_at timestamptz null,
  add column if not exists void_reason text null;

alter table if exists icecream_erp.customer_returns
  add column if not exists qc_status text null,
  add column if not exists qc_note text null,
  add column if not exists final_stock_action text null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists goods_return_voucher_id uuid null;

alter table if exists icecream_erp.payments
  add column if not exists invoice_id uuid null,
  add column if not exists status text not null default 'PENDING';
