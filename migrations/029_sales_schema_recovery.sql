create table if not exists icecream_erp.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null,
  customer_id uuid not null,
  quotation_date date not null,
  valid_until date null,
  notes text null,
  status text not null default 'DRAFT',
  subtotal numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  total_amount numeric(18,2) not null default 0,
  approved_by uuid null,
  approved_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_quotations_number
  on icecream_erp.quotations (quotation_number);
create index if not exists idx_quotations_customer
  on icecream_erp.quotations (customer_id);
create index if not exists idx_quotations_date
  on icecream_erp.quotations (quotation_date desc);

create table if not exists icecream_erp.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references icecream_erp.quotations (id) on delete cascade,
  item_id uuid not null,
  quantity numeric(18,3) not null default 0,
  unit_price numeric(18,2) not null default 0,
  discount_percent numeric(18,2) null,
  total_price numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotation_items_quotation
  on icecream_erp.quotation_items (quotation_id);
create index if not exists idx_quotation_items_item
  on icecream_erp.quotation_items (item_id);

create table if not exists icecream_erp.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references icecream_erp.invoices (id) on delete cascade,
  item_id uuid not null,
  quantity numeric(18,3) not null default 0,
  unit_price numeric(18,2) not null default 0,
  discount_percent numeric(18,2) null,
  total_price numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoice_items_invoice
  on icecream_erp.invoice_items (invoice_id);
create index if not exists idx_invoice_items_item
  on icecream_erp.invoice_items (item_id);

create table if not exists icecream_erp.payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null,
  customer_id uuid not null,
  invoice_id uuid null,
  payment_date date not null,
  amount numeric(18,2) not null default 0,
  payment_method text not null,
  reference_number text null,
  notes text null,
  status text not null default 'PENDING',
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_payments_number
  on icecream_erp.payments (payment_number);
create index if not exists idx_payments_customer
  on icecream_erp.payments (customer_id);
create index if not exists idx_payments_invoice
  on icecream_erp.payments (invoice_id);
create index if not exists idx_payments_date
  on icecream_erp.payments (payment_date desc);

create table if not exists icecream_erp.customer_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null,
  customer_id uuid not null,
  invoice_id uuid null,
  return_date date not null,
  reason text not null,
  total_value numeric(18,2) not null default 0,
  status text not null default 'DRAFT',
  qc_status text null,
  qc_note text null,
  final_stock_action text null,
  goods_return_voucher_id uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_customer_returns_number
  on icecream_erp.customer_returns (return_number);
create index if not exists idx_customer_returns_customer
  on icecream_erp.customer_returns (customer_id);
create index if not exists idx_customer_returns_invoice
  on icecream_erp.customer_returns (invoice_id);

create table if not exists icecream_erp.delivery_notes (
  id uuid primary key default gen_random_uuid(),
  delivery_number text not null,
  sales_order_id uuid not null,
  delivery_date date not null,
  notes text null,
  status text not null default 'draft',
  delivered_by uuid null,
  confirmed_by uuid null,
  confirmed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_delivery_notes_number
  on icecream_erp.delivery_notes (delivery_number);
create index if not exists idx_delivery_notes_sales_order
  on icecream_erp.delivery_notes (sales_order_id);

create table if not exists icecream_erp.sales_customer_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_sales_customer_groups_code
  on icecream_erp.sales_customer_groups (code);

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

create index if not exists idx_sales_product_prices_item
  on icecream_erp.sales_product_prices (item_id);
create index if not exists idx_sales_product_prices_code
  on icecream_erp.sales_product_prices (price_list_code);

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

create index if not exists idx_sales_discount_rules_group
  on icecream_erp.sales_discount_rules (customer_group_id);
create index if not exists idx_sales_discount_rules_item
  on icecream_erp.sales_discount_rules (item_id);

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

create unique index if not exists idx_sales_dispatch_notes_number
  on icecream_erp.sales_dispatch_notes (dispatch_note_number);
create index if not exists idx_sales_dispatch_notes_invoice
  on icecream_erp.sales_dispatch_notes (invoice_id);
create index if not exists idx_sales_dispatch_notes_customer
  on icecream_erp.sales_dispatch_notes (customer_id);
create index if not exists idx_sales_dispatch_notes_status
  on icecream_erp.sales_dispatch_notes (status);

create table if not exists icecream_erp.sales_dispatch_note_items (
  id uuid primary key default gen_random_uuid(),
  dispatch_note_id uuid not null references icecream_erp.sales_dispatch_notes (id) on delete cascade,
  invoice_item_id uuid null,
  item_id uuid not null,
  quantity_invoiced numeric(18,3) not null default 0,
  quantity_dispatched numeric(18,3) not null default 0,
  batch_number text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_dispatch_note_items_dispatch
  on icecream_erp.sales_dispatch_note_items (dispatch_note_id);
create index if not exists idx_sales_dispatch_note_items_invoice_item
  on icecream_erp.sales_dispatch_note_items (invoice_item_id);

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

create unique index if not exists idx_sales_credit_notes_number
  on icecream_erp.sales_credit_notes (credit_note_number);
create index if not exists idx_sales_credit_notes_customer
  on icecream_erp.sales_credit_notes (customer_id);

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

create unique index if not exists idx_sales_journals_number
  on icecream_erp.sales_journals (journal_number);
create index if not exists idx_sales_journals_date
  on icecream_erp.sales_journals (journal_date);

alter table if exists icecream_erp.customers
  add column if not exists customer_group_id uuid null,
  add column if not exists credit_allowed boolean not null default false,
  add column if not exists price_list_code text null,
  add column if not exists tax_number text null,
  add column if not exists current_balance numeric(18,2) not null default 0,
  add column if not exists deleted_at timestamptz null;

update icecream_erp.customers
set current_balance = outstanding_balance
where current_balance = 0
  and outstanding_balance <> 0;

alter table if exists icecream_erp.sales_orders
  add column if not exists quotation_id uuid null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists stock_available boolean null,
  add column if not exists deleted_at timestamptz null;

alter table if exists icecream_erp.sales_order_items
  add column if not exists quantity_delivered numeric(18,3) not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists icecream_erp.invoices
  add column if not exists total numeric(18,2) not null default 0,
  add column if not exists amount_paid numeric(18,2) not null default 0,
  add column if not exists discount_amount numeric(18,2) not null default 0,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists posted_by uuid null,
  add column if not exists posted_at timestamptz null,
  add column if not exists voided_by uuid null,
  add column if not exists voided_at timestamptz null,
  add column if not exists void_reason text null,
  add column if not exists deleted_at timestamptz null;

update icecream_erp.invoices
set total = total_amount
where total = 0
  and total_amount <> 0;

update icecream_erp.invoices
set amount_paid = paid_amount
where amount_paid = 0
  and paid_amount <> 0;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'quotations',
    'quotation_items',
    'invoice_items',
    'payments',
    'customer_returns',
    'delivery_notes',
    'sales_customer_groups',
    'sales_product_prices',
    'sales_discount_rules',
    'sales_dispatch_notes',
    'sales_dispatch_note_items',
    'sales_credit_notes',
    'sales_journals'
  ]
  loop
    execute format('grant all on table icecream_erp.%I to service_role', table_name);
    execute format('alter table icecream_erp.%I enable row level security', table_name);

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'icecream_erp'
        and tablename = table_name
        and policyname = table_name || '_service_role_full_access'
    ) then
      execute format(
        'create policy %I on icecream_erp.%I for all to service_role using (true) with check (true)',
        table_name || '_service_role_full_access',
        table_name
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'icecream_erp'
        and tablename = table_name
        and policyname = table_name || '_deny_anon'
    ) then
      execute format(
        'create policy %I on icecream_erp.%I for all to anon using (false) with check (false)',
        table_name || '_deny_anon',
        table_name
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
