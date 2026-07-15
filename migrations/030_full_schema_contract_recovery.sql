-- Consolidated additive schema contract recovery for Absolute Ice Cream ERP
-- Generated from existing additive repo migrations plus app-contract compatibility tables.
-- Scope: icecream_erp only. No destructive DDL. No global role/search_path changes.


-- ===== Begin 002_inventory_control_extensions.sql =====
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
-- ===== End 002_inventory_control_extensions.sql =====

-- ===== Begin 003_procurement_management_extensions.sql =====
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
-- ===== End 003_procurement_management_extensions.sql =====

-- ===== Begin 004_production_planning_extensions.sql =====
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
-- ===== End 004_production_planning_extensions.sql =====

-- ===== Begin 005_sales_dispatch_extensions.sql =====
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
-- ===== End 005_sales_dispatch_extensions.sql =====

-- ===== Begin 006_branch_operations_extensions.sql =====
create table if not exists icecream_erp.branch_user_assignments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  user_id uuid not null,
  role text not null,
  effective_date date not null default current_date,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_branch_user_assignments_active
  on icecream_erp.branch_user_assignments (branch_id, user_id, role)
  where is_active = true;
create index if not exists idx_branch_user_assignments_branch on icecream_erp.branch_user_assignments (branch_id);
create index if not exists idx_branch_user_assignments_user on icecream_erp.branch_user_assignments (user_id);

create table if not exists icecream_erp.branch_shift_targets (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  shift_date date not null,
  shift_type text not null,
  target_sales_amount numeric(18,2) not null default 0,
  target_stock_value numeric(18,2) not null default 0,
  target_cash_amount numeric(18,2) not null default 0,
  remarks text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_branch_shift_targets_branch on icecream_erp.branch_shift_targets (branch_id);
create index if not exists idx_branch_shift_targets_date on icecream_erp.branch_shift_targets (shift_date);

create table if not exists icecream_erp.branch_stock_receipts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  warehouse_id uuid not null,
  transfer_reference text not null,
  transfer_id uuid null,
  received_date date null,
  received_by uuid null,
  status text not null default 'PENDING',
  remarks text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz null,
  posted_by uuid null,
  voided_at timestamptz null,
  voided_by uuid null,
  void_reason text null
);

create unique index if not exists idx_branch_stock_receipts_reference on icecream_erp.branch_stock_receipts (transfer_reference);
create index if not exists idx_branch_stock_receipts_branch on icecream_erp.branch_stock_receipts (branch_id);
create index if not exists idx_branch_stock_receipts_status on icecream_erp.branch_stock_receipts (status);

create table if not exists icecream_erp.branch_stock_receipt_items (
  id uuid primary key default gen_random_uuid(),
  branch_stock_receipt_id uuid not null references icecream_erp.branch_stock_receipts (id) on delete cascade,
  item_id uuid not null,
  quantity_sent numeric(18,3) not null default 0,
  quantity_received numeric(18,3) not null default 0,
  shortage_quantity numeric(18,3) not null default 0,
  damaged_quantity numeric(18,3) not null default 0,
  remarks text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_branch_stock_receipt_items_receipt on icecream_erp.branch_stock_receipt_items (branch_stock_receipt_id);
create index if not exists idx_branch_stock_receipt_items_item on icecream_erp.branch_stock_receipt_items (item_id);

create table if not exists icecream_erp.branch_stock_ledger (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  warehouse_id uuid not null,
  item_id uuid not null,
  shift_close_id uuid null,
  reference_id uuid null,
  reference_type text not null,
  movement_type text not null,
  quantity numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  total_cost numeric(18,2) not null default 0,
  transaction_date timestamptz not null default now(),
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_branch_stock_ledger_branch on icecream_erp.branch_stock_ledger (branch_id);
create index if not exists idx_branch_stock_ledger_shift on icecream_erp.branch_stock_ledger (shift_close_id);
create index if not exists idx_branch_stock_ledger_item on icecream_erp.branch_stock_ledger (item_id);
create index if not exists idx_branch_stock_ledger_date on icecream_erp.branch_stock_ledger (transaction_date);

create table if not exists icecream_erp.branch_customers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  customer_id uuid null,
  customer_code text not null,
  customer_name text not null,
  phone_number text null,
  customer_type text not null default 'WALK_IN',
  credit_allowed boolean not null default false,
  credit_limit numeric(18,2) not null default 0,
  current_balance numeric(18,2) not null default 0,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_branch_customers_code on icecream_erp.branch_customers (branch_id, customer_code);
create index if not exists idx_branch_customers_branch on icecream_erp.branch_customers (branch_id);

create table if not exists icecream_erp.branch_payments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  shift_close_id uuid null,
  branch_sale_id uuid null,
  branch_customer_id uuid null,
  payment_date date not null,
  payment_method text not null,
  amount_paid numeric(18,2) not null default 0,
  reference_number text null,
  received_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz null,
  posted_by uuid null,
  status text not null default 'POSTED'
);

create index if not exists idx_branch_payments_branch on icecream_erp.branch_payments (branch_id);
create index if not exists idx_branch_payments_shift on icecream_erp.branch_payments (shift_close_id);
create index if not exists idx_branch_payments_sale on icecream_erp.branch_payments (branch_sale_id);

create table if not exists icecream_erp.branch_stock_counts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  shift_close_id uuid null,
  item_id uuid not null,
  system_quantity numeric(18,3) not null default 0,
  physical_quantity numeric(18,3) not null default 0,
  variance_quantity numeric(18,3) not null default 0,
  variance_reason text null,
  counted_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_branch_stock_counts_branch on icecream_erp.branch_stock_counts (branch_id);
create index if not exists idx_branch_stock_counts_shift on icecream_erp.branch_stock_counts (shift_close_id);

create table if not exists icecream_erp.branch_returns (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  shift_close_id uuid null,
  branch_sale_id uuid null,
  branch_customer_id uuid null,
  return_number text not null,
  item_id uuid not null,
  quantity_returned numeric(18,3) not null default 0,
  return_reason text not null,
  qc_status text not null default 'PENDING_QC',
  qc_note text null,
  final_action text null,
  goods_return_voucher_number text null,
  created_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'DRAFT'
);

create unique index if not exists idx_branch_returns_number on icecream_erp.branch_returns (return_number);
create index if not exists idx_branch_returns_branch on icecream_erp.branch_returns (branch_id);
create index if not exists idx_branch_returns_shift on icecream_erp.branch_returns (shift_close_id);

create table if not exists icecream_erp.branch_reconciliations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  shift_close_id uuid not null,
  sales_total numeric(18,2) not null default 0,
  cash_total numeric(18,2) not null default 0,
  expense_total numeric(18,2) not null default 0,
  stock_variance numeric(18,2) not null default 0,
  cash_variance numeric(18,2) not null default 0,
  profitability_amount numeric(18,2) not null default 0,
  reconciliation_note text null,
  reconciled_by uuid null,
  reconciled_at timestamptz null,
  approval_status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_branch_reconciliations_branch on icecream_erp.branch_reconciliations (branch_id);
create index if not exists idx_branch_reconciliations_shift on icecream_erp.branch_reconciliations (shift_close_id);

alter table if exists icecream_erp.branches
  add column if not exists location text null,
  add column if not exists default_warehouse_id uuid null;

alter table if exists icecream_erp.branch_sales
  add column if not exists status text not null default 'POSTED',
  add column if not exists shift_close_id uuid null,
  add column if not exists discount_amount numeric(18,2) not null default 0,
  add column if not exists tax_amount numeric(18,2) not null default 0,
  add column if not exists payment_status text not null default 'PAID',
  add column if not exists remarks text null,
  add column if not exists posted_at timestamptz null,
  add column if not exists posted_by uuid null,
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by uuid null,
  add column if not exists void_reason text null;

alter table if exists icecream_erp.branch_expenses
  add column if not exists status text not null default 'DRAFT',
  add column if not exists shift_close_id uuid null,
  add column if not exists rejected_by uuid null,
  add column if not exists rejected_at timestamptz null,
  add column if not exists rejection_reason text null,
  add column if not exists posted_at timestamptz null,
  add column if not exists posted_by uuid null;

alter table if exists icecream_erp.branch_shift_closes
  add column if not exists opening_cash numeric(18,2) not null default 0,
  add column if not exists cash_sales numeric(18,2) not null default 0,
  add column if not exists credit_sales numeric(18,2) not null default 0,
  add column if not exists payments_received numeric(18,2) not null default 0,
  add column if not exists physical_cash numeric(18,2) not null default 0,
  add column if not exists physical_closing_stock numeric(18,2) not null default 0,
  add column if not exists reconciled_at timestamptz null,
  add column if not exists reconciled_by uuid null,
  add column if not exists closed_at timestamptz null;
-- ===== End 006_branch_operations_extensions.sql =====

-- ===== Begin 007_finance_accounting_extensions.sql =====
create table if not exists icecream_erp.fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  period_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'OPEN',
  is_locked boolean not null default false,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid null,
  approved_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null
);

create unique index if not exists idx_fiscal_periods_name
  on icecream_erp.fiscal_periods (organization_id, period_name);
create index if not exists idx_fiscal_periods_dates
  on icecream_erp.fiscal_periods (organization_id, start_date, end_date);
create index if not exists idx_fiscal_periods_status
  on icecream_erp.fiscal_periods (organization_id, status, is_locked);

create table if not exists icecream_erp.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  expense_date date not null,
  category text not null,
  branch_id uuid null,
  department_id uuid null,
  account_id uuid null,
  amount numeric(18,2) not null default 0,
  payment_method text not null default 'Cash',
  supporting_document text null,
  description text not null,
  source_document text null,
  status text not null default 'DRAFT',
  created_by uuid null,
  updated_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  rejected_by uuid null,
  rejected_at timestamptz null,
  rejection_reason text null,
  posted_by uuid null,
  posted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_finance_expenses_org
  on icecream_erp.finance_expenses (organization_id, expense_date);
create index if not exists idx_finance_expenses_status
  on icecream_erp.finance_expenses (organization_id, status);
create index if not exists idx_finance_expenses_branch
  on icecream_erp.finance_expenses (branch_id);
create index if not exists idx_finance_expenses_account
  on icecream_erp.finance_expenses (account_id);

create table if not exists icecream_erp.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bank_account_id uuid not null references icecream_erp.bank_accounts (id),
  transaction_date date not null,
  transaction_type text not null,
  amount numeric(18,2) not null default 0,
  reference_number text null,
  description text null,
  source_document text null,
  status text not null default 'POSTED',
  created_by uuid null,
  posted_by uuid null,
  posted_at timestamptz null,
  reversed_by uuid null,
  reversed_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bank_transactions_org
  on icecream_erp.bank_transactions (organization_id, transaction_date);
create index if not exists idx_bank_transactions_account
  on icecream_erp.bank_transactions (bank_account_id);
create index if not exists idx_bank_transactions_status
  on icecream_erp.bank_transactions (organization_id, status);

create table if not exists icecream_erp.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cash_account_id uuid not null references icecream_erp.cash_accounts (id),
  transaction_date date not null,
  transaction_type text not null,
  amount numeric(18,2) not null default 0,
  source text null,
  reference text null,
  counterparty text null,
  remarks text null,
  status text not null default 'POSTED',
  created_by uuid null,
  posted_by uuid null,
  posted_at timestamptz null,
  reversed_by uuid null,
  reversed_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cash_transactions_org
  on icecream_erp.cash_transactions (organization_id, transaction_date);
create index if not exists idx_cash_transactions_account
  on icecream_erp.cash_transactions (cash_account_id);
create index if not exists idx_cash_transactions_status
  on icecream_erp.cash_transactions (organization_id, status);
-- ===== End 007_finance_accounting_extensions.sql =====

-- ===== Begin 008_quality_control_returns_extensions.sql =====
create table if not exists icecream_erp.quality_check_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_name text not null,
  inspection_type text not null,
  active_status boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_quality_check_templates_unique
  on icecream_erp.quality_check_templates (organization_id, template_name, inspection_type);

create table if not exists icecream_erp.quality_check_parameters (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references icecream_erp.quality_check_templates (id) on delete cascade,
  parameter_name text not null,
  expected_standard text null,
  minimum_value numeric(18,3) null,
  maximum_value numeric(18,3) null,
  required_flag boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quality_check_parameters_template
  on icecream_erp.quality_check_parameters (template_id);

create table if not exists icecream_erp.quality_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  inspection_number text not null,
  inspection_type text not null,
  reference_document text null,
  reference_id uuid null,
  supplier_id uuid null,
  customer_id uuid null,
  branch_id uuid null,
  production_batch_id uuid null,
  item_id uuid null,
  batch_number text null,
  inspection_date date not null default current_date,
  quantity_inspected numeric(18,3) not null default 0,
  quantity_passed numeric(18,3) not null default 0,
  quantity_failed numeric(18,3) not null default 0,
  qc_status text not null default 'PENDING',
  remarks text null,
  inspected_by uuid null,
  inspected_at timestamptz null,
  approved_by uuid null,
  approved_at timestamptz null,
  posted_by uuid null,
  posted_at timestamptz null,
  closed_by uuid null,
  closed_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_quality_inspections_number
  on icecream_erp.quality_inspections (organization_id, inspection_number);
create index if not exists idx_quality_inspections_type
  on icecream_erp.quality_inspections (organization_id, inspection_type, qc_status);
create index if not exists idx_quality_inspections_item
  on icecream_erp.quality_inspections (item_id);
create index if not exists idx_quality_inspections_batch
  on icecream_erp.quality_inspections (production_batch_id);

create table if not exists icecream_erp.goods_return_vouchers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  return_number text not null,
  return_source text not null,
  customer_id uuid null,
  branch_id uuid null,
  supplier_id uuid null,
  invoice_id uuid null,
  dispatch_id uuid null,
  branch_sale_id uuid null,
  received_by uuid null,
  return_warehouse_id uuid null,
  return_date date not null default current_date,
  status text not null default 'DRAFT',
  qc_status text not null default 'PENDING_QC',
  created_by uuid null,
  updated_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  posted_by uuid null,
  posted_at timestamptz null,
  closed_by uuid null,
  closed_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_goods_return_vouchers_number
  on icecream_erp.goods_return_vouchers (organization_id, return_number);

create table if not exists icecream_erp.goods_return_voucher_items (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references icecream_erp.goods_return_vouchers (id) on delete cascade,
  item_id uuid not null,
  quantity_returned numeric(18,3) not null default 0,
  return_reason text not null,
  unit_cost numeric(18,2) not null default 0,
  total_value numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_goods_return_voucher_items_voucher
  on icecream_erp.goods_return_voucher_items (voucher_id);

create table if not exists icecream_erp.return_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  voucher_item_id uuid not null references icecream_erp.goods_return_voucher_items (id) on delete cascade,
  goods_return_voucher_id uuid not null references icecream_erp.goods_return_vouchers (id) on delete cascade,
  quantity_returned numeric(18,3) not null default 0,
  quantity_reusable numeric(18,3) not null default 0,
  quantity_damaged numeric(18,3) not null default 0,
  quantity_expired numeric(18,3) not null default 0,
  quantity_rework numeric(18,3) not null default 0,
  quantity_waste numeric(18,3) not null default 0,
  final_classification text not null default 'QUALITY_HOLD',
  qc_note text null,
  approval_status text not null default 'PENDING',
  inspected_by uuid null,
  inspected_at timestamptz null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_return_inspections_voucher
  on icecream_erp.return_inspections (goods_return_voucher_id, final_classification);

create table if not exists icecream_erp.quality_control_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  inspection_id uuid null references icecream_erp.quality_inspections (id) on delete cascade,
  return_inspection_id uuid null references icecream_erp.return_inspections (id) on delete cascade,
  production_batch_id uuid null,
  goods_received_note_id uuid null,
  market_report_id uuid null,
  note_type text not null default 'GENERAL',
  note text not null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists icecream_erp.damaged_goods_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  item_id uuid not null,
  warehouse_id uuid null,
  batch_number text null,
  quantity numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  total_value numeric(18,2) not null default 0,
  damage_reason text not null,
  source_reference text null,
  status text not null default 'PENDING',
  recorded_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.expired_goods_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  item_id uuid not null,
  warehouse_id uuid null,
  batch_number text null,
  expiry_date date null,
  quantity_expired numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  total_value numeric(18,2) not null default 0,
  remarks text null,
  status text not null default 'PENDING',
  recorded_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.rework_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  production_batch_id uuid null,
  item_id uuid null,
  quantity numeric(18,3) not null default 0,
  reason text not null,
  status text not null default 'PENDING',
  created_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.reusable_stock_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  return_inspection_id uuid not null references icecream_erp.return_inspections (id) on delete cascade,
  item_id uuid not null,
  quantity_reusable numeric(18,3) not null default 0,
  source_warehouse_id uuid null,
  destination_warehouse_id uuid null,
  inventory_movement_reference text null,
  approval_note text null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.waste_disposal_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  damaged_goods_record_id uuid null references icecream_erp.damaged_goods_records (id) on delete set null,
  expired_goods_record_id uuid null references icecream_erp.expired_goods_records (id) on delete set null,
  item_id uuid not null,
  quantity_disposed numeric(18,3) not null default 0,
  disposal_method text not null,
  disposal_date date not null default current_date,
  witness text null,
  remarks text null,
  status text not null default 'PENDING',
  approved_by uuid null,
  approved_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.market_quality_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  report_number text not null,
  market_location text not null,
  visit_date date not null,
  visited_by uuid null,
  products_checked text null,
  customer_feedback text null,
  product_condition text null,
  competitor_observation text null,
  quality_issue_found text null,
  recommended_action text null,
  supporting_images jsonb null,
  status text not null default 'DRAFT',
  created_by uuid null,
  updated_by uuid null,
  reviewed_by uuid null,
  reviewed_at timestamptz null,
  submitted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_market_quality_reports_number
  on icecream_erp.market_quality_reports (organization_id, report_number);

create table if not exists icecream_erp.market_report_findings (
  id uuid primary key default gen_random_uuid(),
  market_report_id uuid not null references icecream_erp.market_quality_reports (id) on delete cascade,
  finding_type text not null,
  product_name text null,
  notes text not null,
  recommendation text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_market_report_findings_report
  on icecream_erp.market_report_findings (market_report_id);

alter table if exists icecream_erp.customer_returns
  add column if not exists goods_return_voucher_id uuid null,
  add column if not exists return_warehouse_id uuid null;

alter table if exists icecream_erp.branch_returns
  add column if not exists goods_return_voucher_id uuid null,
  add column if not exists return_warehouse_id uuid null;
-- ===== End 008_quality_control_returns_extensions.sql =====

-- ===== Begin 009_security_rbac_audit_extensions.sql =====
create table if not exists icecream_erp.user_branch_assignments (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null,
  branch_id uuid not null,
  role_name text null,
  effective_date date not null default current_date,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_user_branch_assignments_unique_active
  on icecream_erp.user_branch_assignments (user_profile_id, branch_id);
create index if not exists idx_user_branch_assignments_user
  on icecream_erp.user_branch_assignments (user_profile_id, is_active);
create index if not exists idx_user_branch_assignments_branch
  on icecream_erp.user_branch_assignments (branch_id, is_active);

create table if not exists icecream_erp.user_warehouse_assignments (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null,
  warehouse_id uuid not null,
  access_level text null,
  effective_date date not null default current_date,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_user_warehouse_assignments_unique_active
  on icecream_erp.user_warehouse_assignments (user_profile_id, warehouse_id);
create index if not exists idx_user_warehouse_assignments_user
  on icecream_erp.user_warehouse_assignments (user_profile_id, is_active);
create index if not exists idx_user_warehouse_assignments_warehouse
  on icecream_erp.user_warehouse_assignments (warehouse_id, is_active);

create table if not exists icecream_erp.user_department_assignments (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null,
  department_id uuid not null,
  effective_date date not null default current_date,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_user_department_assignments_unique_active
  on icecream_erp.user_department_assignments (user_profile_id, department_id);
create index if not exists idx_user_department_assignments_user
  on icecream_erp.user_department_assignments (user_profile_id, is_active);

create table if not exists icecream_erp.login_attempts (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid null,
  work_id text not null,
  status text not null,
  ip_address text null,
  user_agent text null,
  details jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_user
  on icecream_erp.login_attempts (user_profile_id, created_at desc);
create index if not exists idx_login_attempts_work_id
  on icecream_erp.login_attempts (work_id, created_at desc);
create index if not exists idx_login_attempts_ip
  on icecream_erp.login_attempts (ip_address, created_at desc);

create table if not exists icecream_erp.session_activities (
  id uuid primary key default gen_random_uuid(),
  session_token text not null,
  user_profile_id uuid null,
  activity_type text not null,
  ip_address text null,
  user_agent text null,
  details jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_activities_token
  on icecream_erp.session_activities (session_token, created_at desc);
create index if not exists idx_session_activities_user
  on icecream_erp.session_activities (user_profile_id, created_at desc);

create table if not exists icecream_erp.security_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  user_profile_id uuid null,
  event_type text not null,
  status text not null default 'SUCCESS',
  details jsonb null,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_events_org
  on icecream_erp.security_events (organization_id, created_at desc);
create index if not exists idx_security_events_user
  on icecream_erp.security_events (user_profile_id, created_at desc);
create index if not exists idx_security_events_type
  on icecream_erp.security_events (event_type, created_at desc);
create index if not exists idx_security_events_ip
  on icecream_erp.security_events (ip_address, created_at desc);

create table if not exists icecream_erp.system_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_system_settings_key
  on icecream_erp.system_settings (setting_key);

alter table if exists icecream_erp.users
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists locked_until timestamptz null,
  add column if not exists last_login timestamptz null,
  add column if not exists user_account_id uuid null;

create index if not exists idx_users_failed_login_attempts
  on icecream_erp.users (failed_login_attempts);
create index if not exists idx_users_locked_until
  on icecream_erp.users (locked_until);
create index if not exists idx_users_user_account_id
  on icecream_erp.users (user_account_id);

alter table if exists icecream_erp.auth_sessions
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_auth_sessions_token
  on icecream_erp.auth_sessions (token);
-- ===== End 009_security_rbac_audit_extensions.sql =====

-- ===== Begin 010_reporting_analytics_extensions.sql =====
create table if not exists icecream_erp.report_definitions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  report_code text not null,
  name text not null,
  description text null,
  required_permission text not null,
  route_path text not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_report_definitions_unique
  on icecream_erp.report_definitions (category, report_code);
create index if not exists idx_report_definitions_category
  on icecream_erp.report_definitions (category, is_active);

create table if not exists icecream_erp.report_run_histories (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null,
  report_category text not null,
  report_type text not null,
  branch_id uuid null,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'READY',
  export_format text null,
  generated_at timestamptz not null default now(),
  generated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_report_run_histories_user
  on icecream_erp.report_run_histories (user_profile_id, generated_at desc);
create index if not exists idx_report_run_histories_type
  on icecream_erp.report_run_histories (report_category, report_type, status);
create index if not exists idx_report_run_histories_branch
  on icecream_erp.report_run_histories (branch_id, generated_at desc);

create table if not exists icecream_erp.report_exports (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null,
  report_category text not null,
  report_type text not null,
  branch_id uuid null,
  export_format text not null default 'CSV',
  file_name text not null,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'EXPORTED',
  exported_at timestamptz not null default now(),
  exported_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_report_exports_user
  on icecream_erp.report_exports (user_profile_id, exported_at desc);
create index if not exists idx_report_exports_type
  on icecream_erp.report_exports (report_category, report_type, status);

create table if not exists icecream_erp.saved_report_filters (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null,
  role_name text null,
  report_category text not null,
  report_type text not null,
  filter_name text not null,
  filter_values jsonb not null default '{}'::jsonb,
  visibility text not null default 'private',
  is_default boolean not null default false,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_report_filters_user
  on icecream_erp.saved_report_filters (user_profile_id, created_at desc);
create index if not exists idx_saved_report_filters_type
  on icecream_erp.saved_report_filters (report_category, report_type);

create table if not exists icecream_erp.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  widget_name text not null,
  widget_type text not null,
  report_source text not null,
  roles_allowed jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dashboard_widgets_type
  on icecream_erp.dashboard_widgets (widget_type, is_active);

create table if not exists icecream_erp.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid null,
  role_name text null,
  layout_name text not null,
  layout_definition jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.report_schedules (
  id uuid primary key default gen_random_uuid(),
  report_category text not null,
  report_type text not null,
  schedule_name text not null,
  frequency text not null,
  export_format text not null default 'CSV',
  recipients jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ===== End 010_reporting_analytics_extensions.sql =====

-- ===== Begin 011_hr_shift_productivity_extensions.sql =====
create table if not exists icecream_erp.hr_job_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  department_id uuid null,
  role_name text not null,
  description text null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hr_job_roles_unique
  on icecream_erp.hr_job_roles (organization_id, role_name);
create index if not exists idx_hr_job_roles_department
  on icecream_erp.hr_job_roles (department_id, is_active);

create table if not exists icecream_erp.hr_employee_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null,
  employment_type text not null default 'FULL_TIME',
  basic_rate numeric(18,2) not null default 0,
  hourly_rate numeric(18,2) not null default 0,
  shift_rate numeric(18,2) not null default 0,
  start_date date not null default current_date,
  end_date date null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hr_employee_contracts_active
  on icecream_erp.hr_employee_contracts (employee_id, is_active);
create index if not exists idx_hr_employee_contracts_org
  on icecream_erp.hr_employee_contracts (organization_id, start_date, end_date);

create table if not exists icecream_erp.hr_employee_branch_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null,
  branch_id uuid not null,
  is_primary boolean not null default false,
  start_date date not null default current_date,
  end_date date null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hr_employee_branch_assignments_active
  on icecream_erp.hr_employee_branch_assignments (employee_id, branch_id, is_active);
create index if not exists idx_hr_employee_branch_assignments_branch
  on icecream_erp.hr_employee_branch_assignments (branch_id, is_active);

create table if not exists icecream_erp.hr_employee_warehouse_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null,
  warehouse_id uuid not null,
  is_primary boolean not null default false,
  start_date date not null default current_date,
  end_date date null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hr_employee_warehouse_assignments_active
  on icecream_erp.hr_employee_warehouse_assignments (employee_id, warehouse_id, is_active);
create index if not exists idx_hr_employee_warehouse_assignments_warehouse
  on icecream_erp.hr_employee_warehouse_assignments (warehouse_id, is_active);

create table if not exists icecream_erp.hr_shift_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shift_name text not null,
  start_time text not null,
  end_time text not null,
  standard_shift_hours numeric(8,2) not null default 12,
  default_department_id uuid null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hr_shift_definitions_unique
  on icecream_erp.hr_shift_definitions (organization_id, shift_name);
create index if not exists idx_hr_shift_definitions_department
  on icecream_erp.hr_shift_definitions (default_department_id, is_active);

create table if not exists icecream_erp.hr_shift_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shift_definition_id uuid not null,
  department_id uuid null,
  branch_id uuid null,
  shift_date date not null,
  status text not null default 'DRAFT',
  scheduled_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  closed_by uuid null,
  closed_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_shift_schedules_org_date
  on icecream_erp.hr_shift_schedules (organization_id, shift_date, status);
create index if not exists idx_hr_shift_schedules_branch
  on icecream_erp.hr_shift_schedules (branch_id, shift_date);
create index if not exists idx_hr_shift_schedules_department
  on icecream_erp.hr_shift_schedules (department_id, shift_date);

create table if not exists icecream_erp.hr_shift_schedule_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  schedule_id uuid not null,
  employee_id uuid not null,
  role_on_shift text null,
  override_overlap boolean not null default false,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hr_shift_schedule_employees_unique
  on icecream_erp.hr_shift_schedule_employees (schedule_id, employee_id);
create index if not exists idx_hr_shift_schedule_employees_employee
  on icecream_erp.hr_shift_schedule_employees (employee_id, schedule_id);

create table if not exists icecream_erp.hr_shift_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shift_definition_id uuid not null,
  department_id uuid null,
  branch_id uuid null,
  product_id uuid null,
  target_date date not null,
  target_output_quantity numeric(18,3) not null default 0,
  target_workers integer not null default 0,
  target_labour_hours numeric(18,2) not null default 0,
  target_labour_cost numeric(18,2) not null default 0,
  approved_by uuid null,
  approved_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_shift_targets_date
  on icecream_erp.hr_shift_targets (organization_id, target_date);
create index if not exists idx_hr_shift_targets_shift
  on icecream_erp.hr_shift_targets (shift_definition_id, target_date);

create table if not exists icecream_erp.hr_attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null,
  schedule_id uuid null,
  branch_id uuid null,
  shift_definition_id uuid null,
  attendance_date date not null,
  shift_name text not null,
  attendance_status text not null default 'PRESENT',
  clock_in_time timestamptz null,
  clock_out_time timestamptz null,
  late_minutes integer not null default 0,
  overtime_hours numeric(8,2) not null default 0,
  hours_worked numeric(8,2) not null default 0,
  remarks text null,
  approval_status text not null default 'DRAFT',
  approved_by uuid null,
  approved_at timestamptz null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hr_attendance_records_unique
  on icecream_erp.hr_attendance_records (employee_id, attendance_date, shift_name);
create index if not exists idx_hr_attendance_records_org_date
  on icecream_erp.hr_attendance_records (organization_id, attendance_date, attendance_status);
create index if not exists idx_hr_attendance_records_branch
  on icecream_erp.hr_attendance_records (branch_id, attendance_date);

create table if not exists icecream_erp.hr_production_worker_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null,
  employee_id uuid not null,
  schedule_id uuid null,
  product_id uuid null,
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

create table if not exists icecream_erp.hr_labour_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null,
  employee_id uuid null,
  schedule_id uuid null,
  department_id uuid null,
  branch_id uuid null,
  shift_name text not null,
  rate_type text not null,
  rate numeric(18,2) not null default 0,
  hours_worked numeric(8,2) not null default 0,
  labour_cost numeric(18,2) not null default 0,
  overhead_allocation numeric(18,2) not null default 0,
  total_cost numeric(18,2) not null default 0,
  approval_status text not null default 'DRAFT',
  approved_by uuid null,
  approved_at timestamptz null,
  posted_by uuid null,
  posted_at timestamptz null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_labour_cost_allocations_batch
  on icecream_erp.hr_labour_cost_allocations (batch_id, shift_name);
create index if not exists idx_hr_labour_cost_allocations_branch
  on icecream_erp.hr_labour_cost_allocations (branch_id, approval_status);

create table if not exists icecream_erp.hr_branch_staff_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null,
  branch_id uuid not null,
  schedule_id uuid null,
  shift_definition_id uuid null,
  shift_date date not null,
  shift_name text not null,
  status text not null default 'OPEN',
  closed_by uuid null,
  closed_at timestamptz null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_branch_staff_shifts_branch
  on icecream_erp.hr_branch_staff_shifts (branch_id, shift_date, shift_name);
create index if not exists idx_hr_branch_staff_shifts_employee
  on icecream_erp.hr_branch_staff_shifts (employee_id, shift_date);

create table if not exists icecream_erp.hr_overtime_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null,
  branch_id uuid null,
  attendance_record_id uuid null,
  shift_definition_id uuid null,
  overtime_date date not null,
  shift_name text not null,
  overtime_hours numeric(8,2) not null default 0,
  reason text not null,
  requested_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  rejected_by uuid null,
  rejected_at timestamptz null,
  rejection_reason text null,
  status text not null default 'PENDING_APPROVAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_overtime_records_org
  on icecream_erp.hr_overtime_records (organization_id, overtime_date, status);
create index if not exists idx_hr_overtime_records_employee
  on icecream_erp.hr_overtime_records (employee_id, overtime_date);

create table if not exists icecream_erp.hr_payroll_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  period_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'DRAFT',
  is_locked boolean not null default false,
  approved_by uuid null,
  approved_at timestamptz null,
  posted_by uuid null,
  posted_at timestamptz null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null
);

create unique index if not exists idx_hr_payroll_periods_unique
  on icecream_erp.hr_payroll_periods (organization_id, period_name);
create index if not exists idx_hr_payroll_periods_dates
  on icecream_erp.hr_payroll_periods (organization_id, start_date, end_date, status);

create table if not exists icecream_erp.hr_payroll_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  payroll_period_id uuid not null,
  employee_id uuid not null,
  basic_pay numeric(18,2) not null default 0,
  overtime_pay numeric(18,2) not null default 0,
  allowances numeric(18,2) not null default 0,
  deductions numeric(18,2) not null default 0,
  gross_pay numeric(18,2) not null default 0,
  net_pay numeric(18,2) not null default 0,
  status text not null default 'DRAFT',
  approved_by uuid null,
  approved_at timestamptz null,
  posted_by uuid null,
  posted_at timestamptz null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null
);

create unique index if not exists idx_hr_payroll_summaries_unique
  on icecream_erp.hr_payroll_summaries (payroll_period_id, employee_id);
create index if not exists idx_hr_payroll_summaries_status
  on icecream_erp.hr_payroll_summaries (organization_id, status);

alter table if exists icecream_erp.employees
  add column if not exists department_id uuid null,
  add column if not exists job_role_id uuid null,
  add column if not exists employment_type text null,
  add column if not exists full_name text null,
  add column if not exists warehouse_id uuid null,
  add column if not exists hourly_rate numeric(18,2) not null default 0,
  add column if not exists shift_rate numeric(18,2) not null default 0,
  add column if not exists basic_rate numeric(18,2) not null default 0,
  add column if not exists updated_by uuid null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists voided_by uuid null,
  add column if not exists voided_at timestamptz null,
  add column if not exists void_reason text null;

create index if not exists idx_employees_department_id
  on icecream_erp.employees (department_id);
create index if not exists idx_employees_job_role_id
  on icecream_erp.employees (job_role_id);
create index if not exists idx_employees_warehouse_id
  on icecream_erp.employees (warehouse_id);

alter table if exists icecream_erp.attendances
  add column if not exists attendance_status text not null default 'PRESENT',
  add column if not exists late_minutes integer not null default 0,
  add column if not exists overtime_hours numeric(8,2) not null default 0,
  add column if not exists schedule_id uuid null,
  add column if not exists shift_definition_id uuid null,
  add column if not exists branch_id uuid null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists approval_status text not null default 'DRAFT';

create index if not exists idx_attendances_status
  on icecream_erp.attendances (attendance_status, approval_status);

alter table if exists icecream_erp.production_batches
  add column if not exists worker_count integer not null default 0,
  add column if not exists labour_cost numeric(18,2) not null default 0,
  add column if not exists overhead_cost numeric(18,2) not null default 0;

create index if not exists idx_production_batches_worker_count
  on icecream_erp.production_batches (worker_count);
-- ===== End 011_hr_shift_productivity_extensions.sql =====

-- ===== Begin 012_settings_masterdata_import_export_extensions.sql =====
create table if not exists icecream_erp.system_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  setting_key text not null,
  setting_value jsonb not null,
  module_name text not null default 'settings',
  description text null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz null,
  deactivated_by uuid null
);

create unique index if not exists idx_system_settings_unique_key
  on icecream_erp.system_settings (setting_key);
create index if not exists idx_system_settings_module
  on icecream_erp.system_settings (organization_id, module_name, is_active);

create table if not exists icecream_erp.unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  from_unit_id uuid not null,
  to_unit_id uuid not null,
  conversion_factor numeric(18,6) not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_unit_conversions_unique
  on icecream_erp.unit_conversions (organization_id, from_unit_id, to_unit_id);
create index if not exists idx_unit_conversions_active
  on icecream_erp.unit_conversions (organization_id, is_active);

create table if not exists icecream_erp.settings_flavours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_flavours_unique
  on icecream_erp.settings_flavours (organization_id, code);

create table if not exists icecream_erp.settings_chocolate_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_chocolate_types_unique
  on icecream_erp.settings_chocolate_types (organization_id, code);

create table if not exists icecream_erp.settings_box_sizes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  box_capacity numeric(18,3) not null default 0,
  unit_id uuid null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_box_sizes_unique
  on icecream_erp.settings_box_sizes (organization_id, code);

create table if not exists icecream_erp.settings_product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  item_id uuid not null,
  code text not null,
  name text not null,
  flavour_id uuid null,
  chocolate_type_id uuid null,
  size_label text null,
  packaging text null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_product_variants_unique
  on icecream_erp.settings_product_variants (organization_id, code);
create index if not exists idx_settings_product_variants_item
  on icecream_erp.settings_product_variants (item_id, is_active);

create table if not exists icecream_erp.settings_packaging_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  product_item_id uuid not null,
  packaging_item_id uuid not null,
  quantity_required numeric(18,3) not null default 0,
  unit_id uuid null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_packaging_rules_unique
  on icecream_erp.settings_packaging_rules (organization_id, product_item_id, packaging_item_id);

create table if not exists icecream_erp.settings_payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  payment_type text not null default 'CASH',
  requires_reference boolean not null default false,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_payment_methods_unique
  on icecream_erp.settings_payment_methods (organization_id, code);

create table if not exists icecream_erp.settings_approval_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  action_name text not null,
  required_role text not null,
  approval_level text not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_settings_approval_settings_module
  on icecream_erp.settings_approval_settings (organization_id, module_name, document_type, is_active);

create table if not exists icecream_erp.settings_expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_expense_categories_unique
  on icecream_erp.settings_expense_categories (organization_id, code);

create table if not exists icecream_erp.settings_customer_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  credit_limit numeric(18,2) null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_customer_groups_unique
  on icecream_erp.settings_customer_groups (organization_id, code);

create table if not exists icecream_erp.settings_import_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  template_name text not null,
  module_name text not null,
  data_type text not null,
  required_columns jsonb not null default '[]'::jsonb,
  optional_columns jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_import_templates_unique
  on icecream_erp.settings_import_templates (template_name);

create table if not exists icecream_erp.settings_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  data_type text not null,
  file_name text not null,
  status text not null default 'UPLOADED',
  total_rows integer not null default 0,
  successful_rows integer not null default 0,
  failed_rows integer not null default 0,
  error_summary text null,
  imported_at timestamptz not null default now(),
  imported_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_settings_import_batches_org
  on icecream_erp.settings_import_batches (organization_id, created_at desc, status);

create table if not exists icecream_erp.settings_import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null,
  row_number integer not null,
  raw_row_data jsonb not null,
  validation_status text not null default 'VALID',
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_settings_import_batch_rows_batch
  on icecream_erp.settings_import_batch_rows (import_batch_id, row_number);

create table if not exists icecream_erp.settings_export_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  data_type text not null,
  export_format text not null default 'CSV',
  filters jsonb not null default '{}'::jsonb,
  file_name text not null,
  status text not null default 'EXPORTED',
  exported_at timestamptz not null default now(),
  exported_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_settings_export_batches_org
  on icecream_erp.settings_export_batches (organization_id, created_at desc, data_type);

alter table if exists icecream_erp.number_series
  add column if not exists reset_frequency text not null default 'NEVER',
  add column if not exists deactivated_at timestamptz null,
  add column if not exists deactivated_by uuid null;

alter table if exists icecream_erp.item_categories
  add column if not exists code text null,
  add column if not exists stock_category text null,
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz null;

create unique index if not exists idx_item_categories_code_unique
  on icecream_erp.item_categories (organization_id, code)
  where code is not null;

alter table if exists icecream_erp.units_of_measure
  add column if not exists code text null,
  add column if not exists unit_type text null,
  add column if not exists is_base_unit boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz null;

create unique index if not exists idx_units_of_measure_code_unique
  on icecream_erp.units_of_measure (organization_id, code)
  where code is not null;
-- ===== End 012_settings_masterdata_import_export_extensions.sql =====

-- ===== Begin 013_workflow_control_extensions.sql =====
create table if not exists icecream_erp.posting_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  posting_action text not null,
  required_status_before_posting text not null default 'APPROVED',
  business_effect text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_posting_rules_lookup
  on icecream_erp.posting_rules (organization_id, module_name, document_type, is_active);

create table if not exists icecream_erp.posting_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  posting_action text not null,
  posting_status text not null default 'PENDING',
  posted_by uuid null,
  posted_at timestamptz null,
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posting_logs_document
  on icecream_erp.posting_logs (organization_id, module_name, document_type, document_id, posting_status);

create table if not exists icecream_erp.document_locks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  lock_reason text not null,
  locked_by uuid null,
  locked_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_document_locks_active_document
  on icecream_erp.document_locks (organization_id, document_type, document_id, is_active);

create table if not exists icecream_erp.workflow_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  action text not null,
  from_status text null,
  to_status text null,
  action_comment text null,
  actor_id uuid null,
  action_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_history_document
  on icecream_erp.workflow_history (organization_id, document_type, document_id, action_at desc);

create table if not exists icecream_erp.workflow_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  comment text not null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflow_comments_document
  on icecream_erp.workflow_comments (organization_id, document_type, document_id, created_at desc);

create table if not exists icecream_erp.correction_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  correction_reason text not null,
  requested_changes jsonb not null default '{}'::jsonb,
  status text not null default 'REQUESTED',
  approved_by uuid null,
  approved_at timestamptz null,
  rejected_by uuid null,
  rejected_at timestamptz null,
  rejection_reason text null,
  applied_by uuid null,
  applied_at timestamptz null,
  closed_at timestamptz null,
  closed_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_correction_requests_lookup
  on icecream_erp.correction_requests (organization_id, module_name, document_type, status, requested_by);

create table if not exists icecream_erp.correction_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  correction_request_id uuid not null references icecream_erp.correction_requests(id) on delete cascade,
  action text not null,
  action_comment text null,
  action_by uuid null,
  action_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_correction_actions_request
  on icecream_erp.correction_actions (organization_id, correction_request_id, action_at desc);

create table if not exists icecream_erp.reversal_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  reversal_document_id text null,
  reversal_reason text not null,
  status text not null default 'REQUESTED',
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  approved_by uuid null,
  approved_at timestamptz null,
  posted_by uuid null,
  posted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reversal_logs_lookup
  on icecream_erp.reversal_logs (organization_id, module_name, document_type, status, requested_by);

create table if not exists icecream_erp.void_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  void_reason text not null,
  status text not null default 'REQUESTED',
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  approved_by uuid null,
  approved_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_void_logs_lookup
  on icecream_erp.void_logs (organization_id, module_name, document_type, status, requested_by);

create table if not exists icecream_erp.workflow_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  recipient_user_id uuid null,
  notification_type text not null,
  status text not null default 'PENDING',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);

create index if not exists idx_workflow_notifications_lookup
  on icecream_erp.workflow_notifications (organization_id, recipient_user_id, status, created_at desc);

create table if not exists icecream_erp.workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  from_status text not null,
  to_status text not null,
  transition_action text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflow_transitions_lookup
  on icecream_erp.workflow_transitions (organization_id, module_name, document_type, from_status, is_active);

alter table if exists icecream_erp.approval_workflows
  add column if not exists module_name text null,
  add column if not exists document_type text null,
  add column if not exists action_name text null,
  add column if not exists self_approval_allowed boolean not null default false,
  add column if not exists minimum_amount numeric(18,2) null,
  add column if not exists maximum_amount numeric(18,2) null,
  add column if not exists created_by uuid null,
  add column if not exists updated_by uuid null;

create index if not exists idx_approval_workflows_workflow_lookup
  on icecream_erp.approval_workflows (organization_id, module_name, document_type, action_name, is_active);

alter table if exists icecream_erp.approval_workflow_steps
  add column if not exists step_name text null,
  add column if not exists approval_level integer null,
  add column if not exists minimum_amount numeric(18,2) null,
  add column if not exists maximum_amount numeric(18,2) null,
  add column if not exists approver_role_name text null,
  add column if not exists is_active boolean not null default true;

create index if not exists idx_approval_workflow_steps_lookup
  on icecream_erp.approval_workflow_steps (workflow_id, is_active, approval_level);

alter table if exists icecream_erp.approval_requests
  add column if not exists module_name text null,
  add column if not exists document_type text null,
  add column if not exists document_reference text null,
  add column if not exists request_reason text null,
  add column if not exists approver_role_id uuid null,
  add column if not exists approver_role_name text null,
  add column if not exists approver_user_id uuid null,
  add column if not exists approval_date timestamptz null,
  add column if not exists submitted_at timestamptz null,
  add column if not exists submitted_by uuid null,
  add column if not exists rejected_at timestamptz null,
  add column if not exists rejected_by uuid null,
  add column if not exists rejected_reason text null;

create index if not exists idx_approval_requests_workflow_lookup
  on icecream_erp.approval_requests (organization_id, module_name, document_type, status, requested_by);

alter table if exists icecream_erp.approval_actions
  add column if not exists document_type text null,
  add column if not exists document_id text null,
  add column if not exists ip_address inet null,
  add column if not exists action_status text null,
  add column if not exists action_comment text null;

create index if not exists idx_approval_actions_document
  on icecream_erp.approval_actions (document_type, document_id, acted_at desc);
-- ===== End 013_workflow_control_extensions.sql =====

-- ===== Begin 014_notifications_alerts_reminders_extensions.sql =====
alter table if exists icecream_erp.notifications
  add column if not exists module_name text null,
  add column if not exists event_type text null,
  add column if not exists severity text not null default 'INFO',
  add column if not exists status text not null default 'PENDING',
  add column if not exists channel text not null default 'IN_APP',
  add column if not exists link text null,
  add column if not exists branch_id uuid null,
  add column if not exists warehouse_id uuid null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists sent_at timestamptz null,
  add column if not exists sent_by uuid null,
  add column if not exists read_at timestamptz null,
  add column if not exists read_by uuid null,
  add column if not exists dismissed_at timestamptz null,
  add column if not exists dismissed_by uuid null,
  add column if not exists failed_at timestamptz null,
  add column if not exists failure_reason text null;

create index if not exists idx_notifications_module_status
  on icecream_erp.notifications (organization_id, user_profile_id, module_name, status, severity, created_at desc);

create index if not exists idx_notifications_document_lookup
  on icecream_erp.notifications (organization_id, reference_type, reference_id, status);

create table if not exists icecream_erp.notification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rule_name text not null,
  module_name text not null,
  event_type text not null,
  severity text not null default 'MEDIUM',
  recipient_role_name text null,
  recipient_user_id uuid null,
  recipient_branch_id uuid null,
  recipient_warehouse_id uuid null,
  channel text not null default 'IN_APP',
  template_id uuid null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_notification_rules_lookup
  on icecream_erp.notification_rules (organization_id, module_name, event_type, is_active);

create table if not exists icecream_erp.notification_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_name text not null,
  module_name text not null,
  event_type text not null,
  title_template text not null,
  message_template text not null,
  channel text not null default 'IN_APP',
  supported_placeholders jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_notification_templates_lookup
  on icecream_erp.notification_templates (organization_id, module_name, event_type, channel, is_active);

create table if not exists icecream_erp.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_profile_id uuid not null,
  module_name text not null,
  channel text not null default 'IN_APP',
  enabled boolean not null default true,
  minimum_severity text not null default 'INFO',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create unique index if not exists idx_notification_preferences_unique
  on icecream_erp.notification_preferences (organization_id, user_profile_id, module_name, channel);

create table if not exists icecream_erp.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  notification_id uuid null,
  recipient_user_id uuid null,
  channel text not null,
  delivery_status text not null default 'PENDING',
  sent_at timestamptz null,
  failure_reason text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notification_delivery_logs_lookup
  on icecream_erp.notification_delivery_logs (organization_id, recipient_user_id, channel, delivery_status, created_at desc);

create table if not exists icecream_erp.escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  event_type text not null,
  initial_recipient_role_name text not null,
  escalation_recipient_role_name text not null,
  escalation_delay_minutes integer not null,
  severity text not null default 'HIGH',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_escalation_rules_lookup
  on icecream_erp.escalation_rules (organization_id, module_name, event_type, is_active);

create table if not exists icecream_erp.escalation_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  notification_id uuid not null,
  escalation_rule_id uuid null,
  escalation_recipient_user_id uuid null,
  escalated_at timestamptz not null default now(),
  escalation_status text not null default 'PENDING',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_escalation_logs_lookup
  on icecream_erp.escalation_logs (organization_id, notification_id, escalated_at desc);

create table if not exists icecream_erp.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  reminder_event text not null,
  due_time_rule text not null,
  recipient_role_name text not null,
  message text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_reminder_rules_lookup
  on icecream_erp.reminder_rules (organization_id, module_name, document_type, is_active);

create table if not exists icecream_erp.reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_profile_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text null,
  due_date timestamptz not null,
  reminder_event text not null,
  status text not null default 'PENDING',
  message text not null,
  branch_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  sent_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  failure_reason text null
);

create index if not exists idx_reminders_lookup
  on icecream_erp.reminders (organization_id, user_profile_id, module_name, status, due_date);

create table if not exists icecream_erp.communication_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  notification_id uuid null,
  channel text not null,
  action text not null,
  recipient_user_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_communication_audit_logs_lookup
  on icecream_erp.communication_audit_logs (organization_id, channel, action, created_at desc);
-- ===== End 014_notifications_alerts_reminders_extensions.sql =====

-- ===== Begin 015_admin_migration_backup_health_readiness.sql =====
alter table if exists icecream_erp.settings_import_templates
  add column if not exists template_version text not null default 'v1',
  add column if not exists sample_file_name text null,
  add column if not exists remarks text null;

alter table if exists icecream_erp.settings_import_batches
  add column if not exists batch_number text null,
  add column if not exists template_version text not null default 'v1',
  add column if not exists remarks text null,
  add column if not exists approval_status text not null default 'PENDING_APPROVAL',
  add column if not exists approved_at timestamptz null,
  add column if not exists approved_by uuid null,
  add column if not exists validation_report jsonb not null default '{}'::jsonb,
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by uuid null,
  add column if not exists void_reason text null;

create unique index if not exists idx_settings_import_batches_batch_number
  on icecream_erp.settings_import_batches (batch_number)
  where batch_number is not null;

alter table if exists icecream_erp.settings_import_batch_rows
  add column if not exists normalized_row_data jsonb null,
  add column if not exists error_messages jsonb not null default '[]'::jsonb,
  add column if not exists imported_record_id text null,
  add column if not exists imported_table text null;

create table if not exists icecream_erp.opening_stock_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  migration_batch_id uuid null,
  warehouse_id uuid not null,
  item_id uuid not null,
  opening_quantity numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  total_value numeric(18,2) not null default 0,
  batch_number text null,
  expiry_date date null,
  remarks text null,
  posting_status text not null default 'DRAFT',
  posted_at timestamptz null,
  posted_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_opening_stock_balances_lookup
  on icecream_erp.opening_stock_balances (organization_id, warehouse_id, item_id, posting_status);

create table if not exists icecream_erp.opening_customer_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  migration_batch_id uuid null,
  customer_id uuid not null,
  opening_invoice_reference text not null,
  opening_balance numeric(18,2) not null default 0,
  due_date date null,
  remarks text null,
  posting_status text not null default 'DRAFT',
  posted_at timestamptz null,
  posted_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_opening_customer_balances_lookup
  on icecream_erp.opening_customer_balances (organization_id, customer_id, posting_status);

create table if not exists icecream_erp.opening_supplier_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  migration_batch_id uuid null,
  supplier_id uuid not null,
  opening_invoice_reference text not null,
  opening_balance numeric(18,2) not null default 0,
  due_date date null,
  remarks text null,
  posting_status text not null default 'DRAFT',
  posted_at timestamptz null,
  posted_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_opening_supplier_balances_lookup
  on icecream_erp.opening_supplier_balances (organization_id, supplier_id, posting_status);

create table if not exists icecream_erp.opening_account_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  migration_batch_id uuid null,
  account_id uuid not null,
  debit_amount numeric(18,2) not null default 0,
  credit_amount numeric(18,2) not null default 0,
  reference text null,
  remarks text null,
  posting_status text not null default 'DRAFT',
  posted_at timestamptz null,
  posted_by uuid null,
  journal_entry_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_opening_account_balances_lookup
  on icecream_erp.opening_account_balances (organization_id, account_id, posting_status);

create table if not exists icecream_erp.opening_branch_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  migration_batch_id uuid null,
  branch_id uuid not null,
  opening_sales_balance numeric(18,2) not null default 0,
  opening_expense_balance numeric(18,2) not null default 0,
  opening_stock_value numeric(18,2) not null default 0,
  remarks text null,
  posting_status text not null default 'DRAFT',
  posted_at timestamptz null,
  posted_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_opening_branch_balances_lookup
  on icecream_erp.opening_branch_balances (organization_id, branch_id, posting_status);

create table if not exists icecream_erp.backup_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  backup_type text not null,
  backup_frequency text null,
  backup_location text null,
  retention_days integer null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create table if not exists icecream_erp.backup_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  backup_job_id uuid null,
  backup_type text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  status text not null default 'PENDING',
  file_reference text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_backup_logs_lookup
  on icecream_erp.backup_logs (organization_id, status, started_at desc);

create table if not exists icecream_erp.restore_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  backup_log_id uuid null,
  backup_reference text null,
  test_date timestamptz not null default now(),
  tested_by uuid null,
  result text not null,
  remarks text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_restore_tests_lookup
  on icecream_erp.restore_tests (organization_id, test_date desc, result);

create table if not exists icecream_erp.system_health_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  check_type text not null,
  status text not null default 'UNKNOWN',
  checked_at timestamptz not null default now(),
  checked_by uuid null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists icecream_erp.system_health_metrics (
  id uuid primary key default gen_random_uuid(),
  health_check_id uuid not null references icecream_erp.system_health_checks(id) on delete cascade,
  metric_name text not null,
  metric_value text null,
  status text not null default 'UNKNOWN',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_system_health_metrics_lookup
  on icecream_erp.system_health_metrics (health_check_id, status);

create table if not exists icecream_erp.error_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  module_name text not null,
  error_type text not null,
  message_summary text not null,
  severity text not null default 'MEDIUM',
  details jsonb not null default '{}'::jsonb,
  resolved_status text not null default 'OPEN',
  resolved_at timestamptz null,
  resolved_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_error_logs_lookup
  on icecream_erp.error_logs (organization_id, severity, resolved_status, created_at desc);

create table if not exists icecream_erp.data_integrity_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  check_type text not null,
  status text not null default 'UNKNOWN',
  checked_at timestamptz not null default now(),
  checked_by uuid null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists icecream_erp.data_integrity_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  integrity_check_id uuid null references icecream_erp.data_integrity_checks(id) on delete set null,
  issue_type text not null,
  affected_table text not null,
  affected_record text null,
  affected_module text null,
  severity text not null default 'MEDIUM',
  resolution_status text not null default 'OPEN',
  resolution_notes text null,
  resolved_at timestamptz null,
  resolved_by uuid null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_data_integrity_issues_lookup
  on icecream_erp.data_integrity_issues (organization_id, severity, resolution_status, created_at desc);

create table if not exists icecream_erp.deployment_checklists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  checklist_name text not null,
  status text not null default 'NOT_STARTED',
  remarks text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create table if not exists icecream_erp.deployment_checklist_items (
  id uuid primary key default gen_random_uuid(),
  deployment_checklist_id uuid null references icecream_erp.deployment_checklists(id) on delete cascade,
  organization_id uuid null,
  category text not null,
  task text not null,
  owner text null,
  status text not null default 'NOT_STARTED',
  remarks text null,
  completed_date timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_deployment_checklist_items_lookup
  on icecream_erp.deployment_checklist_items (organization_id, category, status, created_at desc);

create table if not exists icecream_erp.environment_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  check_name text not null,
  status text not null default 'UNKNOWN',
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_environment_checks_lookup
  on icecream_erp.environment_checks (organization_id, status, checked_at desc);

create table if not exists icecream_erp.go_live_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  requested_by uuid null,
  requested_date timestamptz not null default now(),
  readiness_status text not null default 'NOT_STARTED',
  approved_by uuid null,
  approval_date timestamptz null,
  approval_remarks text null,
  status text not null default 'IN_PROGRESS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_go_live_approvals_lookup
  on icecream_erp.go_live_approvals (organization_id, status, requested_date desc);

create table if not exists icecream_erp.system_maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  maintenance_type text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);
-- ===== End 015_admin_migration_backup_health_readiness.sql =====

-- ===== Begin 016_testing_uat_training_docs_handover.sql =====
ALTER TABLE IF EXISTS icecream_erp.permissions
  ADD COLUMN IF NOT EXISTS module text;

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_suites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  suite_name text NOT NULL,
  module_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  test_suite_id uuid REFERENCES icecream_erp.testing_test_suites(id) ON DELETE SET NULL,
  module_name text NOT NULL,
  scenario_name text NOT NULL,
  preconditions text,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  test_suite_id uuid REFERENCES icecream_erp.testing_test_suites(id) ON DELETE SET NULL,
  test_scenario_id uuid REFERENCES icecream_erp.testing_test_scenarios(id) ON DELETE SET NULL,
  test_case_number text NOT NULL,
  category text NOT NULL,
  module_name text NOT NULL,
  scenario text NOT NULL,
  preconditions text,
  test_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_result text NOT NULL,
  actual_result text,
  priority text NOT NULL DEFAULT 'MEDIUM',
  assigned_tester_id uuid,
  assigned_tester_name text,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  related_role text,
  workflow_stage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  UNIQUE (organization_id, test_case_number)
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  test_case_id uuid NOT NULL REFERENCES icecream_erp.testing_test_cases(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  instruction text NOT NULL,
  expected_result text,
  actual_result text,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  test_case_id uuid NOT NULL REFERENCES icecream_erp.testing_test_cases(id) ON DELETE CASCADE,
  test_date date NOT NULL,
  tester_id uuid,
  tester_name text NOT NULL,
  actual_result text NOT NULL,
  status text NOT NULL,
  comments text,
  evidence_attachment jsonb,
  related_bug_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  test_run_id uuid NOT NULL REFERENCES icecream_erp.testing_test_runs(id) ON DELETE CASCADE,
  result_summary text NOT NULL,
  status text NOT NULL,
  evidence_attachment jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  bug_number text NOT NULL,
  module_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  steps_to_reproduce text,
  expected_result text,
  actual_result text,
  priority text NOT NULL DEFAULT 'MEDIUM',
  severity text NOT NULL DEFAULT 'MEDIUM',
  assigned_to uuid,
  assigned_to_name text,
  reported_by uuid,
  reported_by_name text,
  related_test_case_id uuid REFERENCES icecream_erp.testing_test_cases(id) ON DELETE SET NULL,
  related_test_run_id uuid REFERENCES icecream_erp.testing_test_runs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN',
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  UNIQUE (organization_id, bug_number)
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_bug_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  bug_report_id uuid NOT NULL REFERENCES icecream_erp.testing_bug_reports(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_bug_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  bug_report_id uuid NOT NULL REFERENCES icecream_erp.testing_bug_reports(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_reference text NOT NULL,
  file_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_uat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  session_name text NOT NULL,
  module_name text NOT NULL,
  session_date date NOT NULL,
  test_scope text,
  outcome text,
  feedback text,
  sign_off_status text NOT NULL DEFAULT 'PLANNED',
  status text NOT NULL DEFAULT 'PLANNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  signed_off_at timestamptz,
  signed_off_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_uat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  uat_session_id uuid NOT NULL REFERENCES icecream_erp.testing_uat_sessions(id) ON DELETE CASCADE,
  participant_name text NOT NULL,
  participant_role text NOT NULL,
  participant_user_id uuid,
  attendance_status text NOT NULL DEFAULT 'PLANNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_uat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  uat_session_id uuid NOT NULL REFERENCES icecream_erp.testing_uat_sessions(id) ON DELETE CASCADE,
  participant_name text NOT NULL,
  feedback_text text NOT NULL,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_uat_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  uat_session_id uuid NOT NULL REFERENCES icecream_erp.testing_uat_sessions(id) ON DELETE CASCADE,
  signed_by uuid,
  signed_by_name text NOT NULL,
  role_name text NOT NULL,
  sign_off_date date NOT NULL,
  decision text NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  signed_off_at timestamptz,
  signed_off_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_training_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  module_name text NOT NULL,
  material_type text NOT NULL,
  content text NOT NULL,
  version text NOT NULL DEFAULT 'v1.0',
  status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  training_title text NOT NULL,
  module_name text NOT NULL,
  trainer_name text NOT NULL,
  trainer_user_id uuid,
  session_date date NOT NULL,
  remarks text,
  status text NOT NULL DEFAULT 'PLANNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_training_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  training_session_id uuid NOT NULL REFERENCES icecream_erp.testing_training_sessions(id) ON DELETE CASCADE,
  attendee_name text NOT NULL,
  attendee_role text NOT NULL,
  attendee_user_id uuid,
  attendance_status text NOT NULL DEFAULT 'PENDING',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  document_type text NOT NULL,
  version text NOT NULL,
  module_name text NOT NULL,
  content text NOT NULL,
  author_name text NOT NULL,
  author_user_id uuid,
  reviewed_by text,
  status text NOT NULL DEFAULT 'DRAFT',
  last_updated_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_release_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  release_version text NOT NULL,
  release_date date NOT NULL,
  features_added text NOT NULL,
  bugs_fixed text NOT NULL,
  known_issues text,
  deployment_notes text,
  approved_by uuid,
  approved_by_name text,
  approval_status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  closed_at timestamptz,
  closed_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_handover_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  category text NOT NULL,
  task text NOT NULL,
  owner_name text NOT NULL,
  owner_user_id uuid,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  remarks text,
  is_critical boolean NOT NULL DEFAULT false,
  completed_date date,
  approval_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_handover_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  handover_checklist_id uuid NOT NULL REFERENCES icecream_erp.testing_handover_checklist(id) ON DELETE CASCADE,
  approved_by uuid,
  approved_by_name text NOT NULL,
  approval_date date NOT NULL,
  decision text NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  signed_off_at timestamptz,
  signed_off_by uuid
);

CREATE INDEX IF NOT EXISTS idx_testing_test_cases_module ON icecream_erp.testing_test_cases(organization_id, module_name);
CREATE INDEX IF NOT EXISTS idx_testing_test_cases_status ON icecream_erp.testing_test_cases(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_testing_test_cases_priority ON icecream_erp.testing_test_cases(organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_testing_test_runs_date ON icecream_erp.testing_test_runs(organization_id, test_date);
CREATE INDEX IF NOT EXISTS idx_testing_bugs_module ON icecream_erp.testing_bug_reports(organization_id, module_name);
CREATE INDEX IF NOT EXISTS idx_testing_bugs_status ON icecream_erp.testing_bug_reports(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_testing_bugs_priority ON icecream_erp.testing_bug_reports(organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_testing_bugs_assigned ON icecream_erp.testing_bug_reports(organization_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_testing_uat_date ON icecream_erp.testing_uat_sessions(organization_id, session_date);
CREATE INDEX IF NOT EXISTS idx_testing_docs_type ON icecream_erp.testing_documents(organization_id, document_type);
CREATE INDEX IF NOT EXISTS idx_testing_handover_status ON icecream_erp.testing_handover_checklist(organization_id, status);
-- ===== End 016_testing_uat_training_docs_handover.sql =====

-- ===== Begin 017_auth_settings_support_tables.sql =====
create table if not exists icecream_erp.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references icecream_erp.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user
  on icecream_erp.password_reset_tokens (user_account_id);
create index if not exists idx_password_reset_tokens_expires_at
  on icecream_erp.password_reset_tokens (expires_at);

create table if not exists icecream_erp.document_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id) on delete cascade,
  reference_type text not null,
  reference_id text not null,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  file_size integer not null default 0,
  uploaded_by uuid null references icecream_erp.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_document_files_organization
  on icecream_erp.document_files (organization_id);
create index if not exists idx_document_files_uploaded_by
  on icecream_erp.document_files (uploaded_by);
create index if not exists idx_document_files_reference
  on icecream_erp.document_files (reference_type, reference_id);
create index if not exists idx_document_files_file_name
  on icecream_erp.document_files (file_name);

alter table if exists icecream_erp.password_reset_tokens enable row level security;
alter table if exists icecream_erp.document_files enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'password_reset_tokens'
      and policyname = 'password_reset_tokens_service_role_full_access'
  ) then
    create policy password_reset_tokens_service_role_full_access
      on icecream_erp.password_reset_tokens
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'password_reset_tokens'
      and policyname = 'password_reset_tokens_deny_anon'
  ) then
    create policy password_reset_tokens_deny_anon
      on icecream_erp.password_reset_tokens
      for all
      to anon
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'document_files'
      and policyname = 'document_files_service_role_full_access'
  ) then
    create policy document_files_service_role_full_access
      on icecream_erp.document_files
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'document_files'
      and policyname = 'document_files_deny_anon'
  ) then
    create policy document_files_deny_anon
      on icecream_erp.document_files
      for all
      to anon
      using (false)
      with check (false);
  end if;
end $$;

grant all on table icecream_erp.password_reset_tokens to service_role;
grant all on table icecream_erp.document_files to service_role;
-- ===== End 017_auth_settings_support_tables.sql =====

-- ===== Begin 018_security_rbac_bootstrap.sql =====
create table if not exists icecream_erp.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id) on delete cascade,
  name text not null,
  description text null,
  is_system_role boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists icecream_erp.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  module text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references icecream_erp.roles(id) on delete cascade,
  permission_id uuid not null references icecream_erp.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table if not exists icecream_erp.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references icecream_erp.users(id) on delete cascade,
  role_id uuid not null references icecream_erp.roles(id) on delete cascade,
  assigned_by uuid null references icecream_erp.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_profile_id, role_id)
);

create index if not exists idx_roles_organization_id
  on icecream_erp.roles (organization_id);

create index if not exists idx_permissions_module
  on icecream_erp.permissions (module);

create index if not exists idx_role_permissions_role_id
  on icecream_erp.role_permissions (role_id);

create index if not exists idx_role_permissions_permission_id
  on icecream_erp.role_permissions (permission_id);

create index if not exists idx_user_roles_user_profile_id
  on icecream_erp.user_roles (user_profile_id);

create index if not exists idx_user_roles_role_id
  on icecream_erp.user_roles (role_id);

alter table icecream_erp.roles enable row level security;
alter table icecream_erp.permissions enable row level security;
alter table icecream_erp.role_permissions enable row level security;
alter table icecream_erp.user_roles enable row level security;

drop policy if exists "service_role_full_access" on icecream_erp.roles;
create policy "service_role_full_access"
  on icecream_erp.roles for all to service_role
  using (true) with check (true);

drop policy if exists "service_role_full_access" on icecream_erp.permissions;
create policy "service_role_full_access"
  on icecream_erp.permissions for all to service_role
  using (true) with check (true);

drop policy if exists "service_role_full_access" on icecream_erp.role_permissions;
create policy "service_role_full_access"
  on icecream_erp.role_permissions for all to service_role
  using (true) with check (true);

drop policy if exists "service_role_full_access" on icecream_erp.user_roles;
create policy "service_role_full_access"
  on icecream_erp.user_roles for all to service_role
  using (true) with check (true);

drop policy if exists "authenticated_read_roles" on icecream_erp.roles;
create policy "authenticated_read_roles"
  on icecream_erp.roles for select to authenticated
  using (true);

drop policy if exists "authenticated_read_permissions" on icecream_erp.permissions;
create policy "authenticated_read_permissions"
  on icecream_erp.permissions for select to authenticated
  using (true);

grant all on icecream_erp.roles to service_role;
grant all on icecream_erp.permissions to service_role;
grant all on icecream_erp.role_permissions to service_role;
grant all on icecream_erp.user_roles to service_role;
grant select on icecream_erp.roles to authenticated;
grant select on icecream_erp.permissions to authenticated;

with primary_org as (
  select id
  from icecream_erp.organizations
  order by created_at asc nulls last, id asc
  limit 1
),
seed_roles (legacy_role, name, description) as (
  values
    ('super_admin', 'Super Admin', 'Full system access'),
    ('branch_manager', 'Branch Manager', 'Manage a single branch'),
    ('manager', 'Manager', 'Operations management'),
    ('staff', 'Staff', 'Standard staff access')
)
insert into icecream_erp.roles (organization_id, name, description, is_system_role)
select primary_org.id, seed_roles.name, seed_roles.description, true
from primary_org
cross join seed_roles
where not exists (
  select 1
  from icecream_erp.roles existing
  where existing.organization_id = primary_org.id
    and lower(existing.name) = lower(seed_roles.name)
);

with seed_permissions (code, module) as (
  values
    ('users.read', 'users'),
    ('users.write', 'users'),
    ('users.delete', 'users'),
    ('branches.read', 'branches'),
    ('branches.write', 'branches'),
    ('inventory.read', 'inventory'),
    ('inventory.write', 'inventory'),
    ('inventory.delete', 'inventory'),
    ('procurement.read', 'procurement'),
    ('procurement.write', 'procurement'),
    ('procurement.approve', 'procurement'),
    ('procurement.supplier.view', 'procurement'),
    ('procurement.supplier.write', 'procurement'),
    ('production.read', 'production'),
    ('production.write', 'production'),
    ('sales.read', 'sales'),
    ('sales.write', 'sales'),
    ('finance.read', 'finance'),
    ('finance.write', 'finance'),
    ('reports.read', 'reports'),
    ('settings.read', 'settings'),
    ('settings.write', 'settings'),
    ('hr.read', 'hr'),
    ('hr.write', 'hr'),
    ('quality.read', 'quality'),
    ('quality.write', 'quality'),
    ('maintenance.read', 'maintenance'),
    ('maintenance.write', 'maintenance'),
    ('cost-accounting.read', 'cost-accounting'),
    ('cost-accounting.write', 'cost-accounting'),
    ('budget.read', 'budget'),
    ('budget.write', 'budget')
)
insert into icecream_erp.permissions (code, name, module)
select
  code,
  initcap(replace(replace(code, '.', ' '), '-', ' ')),
  module
from seed_permissions
where not exists (
  select 1
  from icecream_erp.permissions existing
  where existing.code = seed_permissions.code
);

with primary_org as (
  select id
  from icecream_erp.organizations
  order by created_at asc nulls last, id asc
  limit 1
),
role_lookup as (
  select
    r.id,
    case
      when lower(r.name) = 'super admin' then 'super_admin'
      when lower(r.name) = 'branch manager' then 'branch_manager'
      when lower(r.name) = 'manager' then 'manager'
      when lower(r.name) = 'staff' then 'staff'
      else null
    end as legacy_role
  from icecream_erp.roles r
  join primary_org on primary_org.id = r.organization_id
),
role_permission_seed (legacy_role, permission_code) as (
  values
    ('super_admin', 'users.read'),
    ('super_admin', 'users.write'),
    ('super_admin', 'users.delete'),
    ('super_admin', 'branches.read'),
    ('super_admin', 'branches.write'),
    ('super_admin', 'inventory.read'),
    ('super_admin', 'inventory.write'),
    ('super_admin', 'inventory.delete'),
    ('super_admin', 'procurement.read'),
    ('super_admin', 'procurement.write'),
    ('super_admin', 'procurement.approve'),
    ('super_admin', 'procurement.supplier.view'),
    ('super_admin', 'procurement.supplier.write'),
    ('super_admin', 'production.read'),
    ('super_admin', 'production.write'),
    ('super_admin', 'sales.read'),
    ('super_admin', 'sales.write'),
    ('super_admin', 'finance.read'),
    ('super_admin', 'finance.write'),
    ('super_admin', 'reports.read'),
    ('super_admin', 'settings.read'),
    ('super_admin', 'settings.write'),
    ('super_admin', 'hr.read'),
    ('super_admin', 'hr.write'),
    ('super_admin', 'quality.read'),
    ('super_admin', 'quality.write'),
    ('super_admin', 'maintenance.read'),
    ('super_admin', 'maintenance.write'),
    ('super_admin', 'cost-accounting.read'),
    ('super_admin', 'cost-accounting.write'),
    ('super_admin', 'budget.read'),
    ('super_admin', 'budget.write'),
    ('branch_manager', 'users.read'),
    ('branch_manager', 'users.write'),
    ('branch_manager', 'branches.read'),
    ('branch_manager', 'branches.write'),
    ('branch_manager', 'inventory.read'),
    ('branch_manager', 'inventory.write'),
    ('branch_manager', 'inventory.delete'),
    ('branch_manager', 'procurement.read'),
    ('branch_manager', 'procurement.write'),
    ('branch_manager', 'procurement.approve'),
    ('branch_manager', 'procurement.supplier.view'),
    ('branch_manager', 'procurement.supplier.write'),
    ('branch_manager', 'production.read'),
    ('branch_manager', 'production.write'),
    ('branch_manager', 'sales.read'),
    ('branch_manager', 'sales.write'),
    ('branch_manager', 'finance.read'),
    ('branch_manager', 'finance.write'),
    ('branch_manager', 'reports.read'),
    ('branch_manager', 'hr.read'),
    ('branch_manager', 'hr.write'),
    ('branch_manager', 'quality.read'),
    ('branch_manager', 'quality.write'),
    ('branch_manager', 'maintenance.read'),
    ('branch_manager', 'maintenance.write'),
    ('branch_manager', 'cost-accounting.read'),
    ('branch_manager', 'cost-accounting.write'),
    ('branch_manager', 'budget.read'),
    ('branch_manager', 'budget.write'),
    ('manager', 'inventory.read'),
    ('manager', 'inventory.write'),
    ('manager', 'procurement.read'),
    ('manager', 'procurement.write'),
    ('manager', 'procurement.supplier.view'),
    ('manager', 'production.read'),
    ('manager', 'production.write'),
    ('manager', 'sales.read'),
    ('manager', 'sales.write'),
    ('manager', 'finance.read'),
    ('manager', 'reports.read'),
    ('manager', 'quality.read'),
    ('manager', 'quality.write'),
    ('manager', 'maintenance.read'),
    ('manager', 'hr.read'),
    ('staff', 'inventory.read'),
    ('staff', 'production.read'),
    ('staff', 'sales.read'),
    ('staff', 'reports.read'),
    ('staff', 'quality.read'),
    ('staff', 'hr.read')
)
insert into icecream_erp.role_permissions (role_id, permission_id)
select distinct role_lookup.id, permissions.id
from role_permission_seed
join role_lookup on role_lookup.legacy_role = role_permission_seed.legacy_role
join icecream_erp.permissions permissions on permissions.code = role_permission_seed.permission_code
where role_lookup.legacy_role is not null
and not exists (
  select 1
  from icecream_erp.role_permissions existing
  where existing.role_id = role_lookup.id
    and existing.permission_id = permissions.id
);

with primary_org as (
  select id
  from icecream_erp.organizations
  order by created_at asc nulls last, id asc
  limit 1
),
role_lookup as (
  select
    r.id,
    case
      when lower(r.name) = 'super admin' then 'super_admin'
      when lower(r.name) = 'branch manager' then 'branch_manager'
      when lower(r.name) = 'manager' then 'manager'
      when lower(r.name) = 'staff' then 'staff'
      else null
    end as legacy_role
  from icecream_erp.roles r
  join primary_org on primary_org.id = r.organization_id
)
insert into icecream_erp.user_roles (user_profile_id, role_id, assigned_at)
select users.id, role_lookup.id, now()
from icecream_erp.users users
join role_lookup on role_lookup.legacy_role = coalesce(nullif(users.role, ''), 'staff')
where not exists (
  select 1
  from icecream_erp.user_roles existing
  where existing.user_profile_id = users.id
    and existing.role_id = role_lookup.id
);
-- ===== End 018_security_rbac_bootstrap.sql =====

-- ===== Begin 019_procurement_returns_payments_productivity.sql =====
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
-- ===== End 019_procurement_returns_payments_productivity.sql =====

-- ===== Begin 020_procurement_compatibility_columns.sql =====
alter table if exists icecream_erp.purchase_requisitions
  add column if not exists requisition_number text,
  add column if not exists request_date date,
  add column if not exists needed_by_date date,
  add column if not exists approval_status text,
  add column if not exists remarks text,
  add column if not exists deleted_at timestamptz null;

update icecream_erp.purchase_requisitions
set
  requisition_number = coalesce(requisition_number, pr_number),
  request_date = coalesce(request_date, created_at::date, current_date),
  needed_by_date = coalesce(needed_by_date, required_date),
  approval_status = coalesce(approval_status, status::text),
  remarks = coalesce(remarks, notes)
where
  requisition_number is null
  or request_date is null
  or needed_by_date is null
  or approval_status is null
  or remarks is null;

create unique index if not exists idx_purchase_requisitions_requisition_number
  on icecream_erp.purchase_requisitions (organization_id, requisition_number)
  where requisition_number is not null;

alter table if exists icecream_erp.purchase_requisition_items
  add column if not exists requisition_id uuid,
  add column if not exists unit_of_measure_id uuid,
  add column if not exists quantity_requested numeric(18,3),
  add column if not exists quantity_approved numeric(18,3),
  add column if not exists estimated_unit_cost numeric(18,2),
  add column if not exists remarks text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update icecream_erp.purchase_requisition_items
set
  requisition_id = coalesce(requisition_id, pr_id),
  quantity_requested = coalesce(quantity_requested, quantity),
  estimated_unit_cost = coalesce(estimated_unit_cost, estimated_cost),
  remarks = coalesce(remarks, notes)
where
  requisition_id is null
  or quantity_requested is null
  or estimated_unit_cost is null
  or remarks is null;

create index if not exists idx_purchase_requisition_items_requisition_id
  on icecream_erp.purchase_requisition_items (requisition_id);

alter table if exists icecream_erp.purchase_orders
  add column if not exists requisition_id uuid,
  add column if not exists expected_delivery_date date,
  add column if not exists discount_amount numeric(18,2) not null default 0,
  add column if not exists total numeric(18,2),
  add column if not exists deleted_at timestamptz null;

update icecream_erp.purchase_orders
set
  requisition_id = coalesce(requisition_id, pr_id),
  expected_delivery_date = coalesce(expected_delivery_date, expected_date),
  total = coalesce(total, total_amount)
where
  requisition_id is null
  or expected_delivery_date is null
  or total is null;

create index if not exists idx_purchase_orders_requisition_id
  on icecream_erp.purchase_orders (requisition_id);

alter table if exists icecream_erp.purchase_order_items
  add column if not exists purchase_order_id uuid,
  add column if not exists unit_of_measure_id uuid,
  add column if not exists quantity_ordered numeric(18,3),
  add column if not exists quantity_received numeric(18,3) not null default 0,
  add column if not exists unit_cost numeric(18,2),
  add column if not exists total_cost numeric(18,2),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update icecream_erp.purchase_order_items
set
  purchase_order_id = coalesce(purchase_order_id, po_id),
  quantity_ordered = coalesce(quantity_ordered, quantity),
  quantity_received = coalesce(quantity_received, received_qty),
  unit_cost = coalesce(unit_cost, unit_price),
  total_cost = coalesce(total_cost, line_total)
where
  purchase_order_id is null
  or quantity_ordered is null
  or unit_cost is null
  or total_cost is null;

create index if not exists idx_purchase_order_items_purchase_order_id
  on icecream_erp.purchase_order_items (purchase_order_id);

alter table if exists icecream_erp.goods_received_notes
  add column if not exists purchase_order_id uuid,
  add column if not exists quality_status text not null default 'pending',
  add column if not exists quality_notes text,
  add column if not exists deleted_at timestamptz null;

update icecream_erp.goods_received_notes
set purchase_order_id = coalesce(purchase_order_id, po_id)
where purchase_order_id is null;

create index if not exists idx_goods_received_notes_purchase_order_id
  on icecream_erp.goods_received_notes (purchase_order_id);

create table if not exists icecream_erp.goods_received_note_items (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid not null references icecream_erp.goods_received_notes (id) on delete cascade,
  goods_received_note_id uuid null references icecream_erp.goods_received_notes (id) on delete cascade,
  item_id uuid not null references icecream_erp.items (id),
  po_item_id uuid null references icecream_erp.purchase_order_items (id),
  purchase_order_item_id uuid null references icecream_erp.purchase_order_items (id),
  quantity_expected numeric(18,3) not null default 0,
  quantity_received numeric(18,3) not null default 0,
  quantity_rejected numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  batch_number text null,
  expiry_date date null,
  quality_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into icecream_erp.goods_received_note_items (
  grn_id,
  goods_received_note_id,
  item_id,
  po_item_id,
  purchase_order_item_id,
  quantity_expected,
  quantity_received,
  quantity_rejected,
  unit_cost,
  batch_number,
  expiry_date
)
select
  gi.grn_id,
  gi.grn_id,
  gi.item_id,
  gi.po_item_id,
  gi.po_item_id,
  coalesce(gi.ordered_qty, 0),
  coalesce(gi.received_qty, 0),
  coalesce(gi.rejected_qty, 0),
  coalesce(gi.unit_cost, 0),
  gi.batch_number,
  gi.expiry_date
from icecream_erp.grn_items gi
where not exists (
  select 1
  from icecream_erp.goods_received_note_items existing
  where existing.grn_id = gi.grn_id
    and existing.item_id = gi.item_id
    and coalesce(existing.po_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(gi.po_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create index if not exists idx_goods_received_note_items_grn_id
  on icecream_erp.goods_received_note_items (grn_id);
create index if not exists idx_goods_received_note_items_po_item_id
  on icecream_erp.goods_received_note_items (po_item_id);
create index if not exists idx_goods_received_note_items_item_id
  on icecream_erp.goods_received_note_items (item_id);

grant select, insert, update, delete on
  icecream_erp.purchase_requisitions,
  icecream_erp.purchase_requisition_items,
  icecream_erp.purchase_orders,
  icecream_erp.purchase_order_items,
  icecream_erp.goods_received_notes,
  icecream_erp.goods_received_note_items
to anon, authenticated, service_role;
-- ===== End 020_procurement_compatibility_columns.sql =====

-- ===== Begin 021_production_execution_costing.sql =====
-- Production execution compatibility and costing extensions.
-- Adds the capture surfaces required for recipe formulas, WIP, worker/off-shift
-- counts, material closing stock, finished-goods transfer, and cost overrides.

alter table if exists icecream_erp.warehouses
  add column if not exists warehouse_type text null,
  add column if not exists production_role text null,
  add column if not exists is_production_warehouse boolean not null default false;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'warehouses' and column_name = 'type'
  ) then
    execute $sql$
      update icecream_erp.warehouses
      set warehouse_type = coalesce(warehouse_type, type::text)
      where true
    $sql$;
  end if;

  update icecream_erp.warehouses
  set
    production_role = coalesce(
      production_role,
      case
        when lower(coalesce(name, '')) like '%production%' then 'PRODUCTION'
        when lower(coalesce(name, '')) like '%store%' then 'STORES'
        when lower(coalesce(name, '')) like '%raw%' then 'STORES'
        else null
      end
    ),
    is_production_warehouse = is_production_warehouse or lower(coalesce(name, '')) like '%production%'
  where true;
end $$;

alter table if exists icecream_erp.items
  add column if not exists item_type text null,
  add column if not exists unit_of_measure_id uuid null,
  add column if not exists unit_cost numeric(18,4) not null default 0,
  add column if not exists default_warehouse_id uuid null,
  add column if not exists production_category text null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'items' and column_name = 'type'
  ) then
    execute $sql$
      update icecream_erp.items
      set item_type = coalesce(item_type, type::text)
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'items' and column_name = 'unit_id'
  ) then
    execute $sql$
      update icecream_erp.items
      set unit_of_measure_id = coalesce(unit_of_measure_id, unit_id)
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'items' and column_name = 'standard_cost'
  ) then
    execute $sql$
      update icecream_erp.items
      set unit_cost = coalesce(nullif(unit_cost, 0), standard_cost, 0)
      where true
    $sql$;
  end if;

  update icecream_erp.items
  set production_category = coalesce(
    production_category,
    case
      when item_type = 'RAW_MATERIAL' then 'ICE_CREAM_MAKING'
      when item_type = 'PACKAGING' then 'PACKAGING'
      when lower(coalesce(name, '')) like '%pack%' then 'PACKAGING'
      else null
    end
  )
  where true;
end $$;

alter table if exists icecream_erp.stock_balances
  add column if not exists quantity_on_hand numeric(18,4) not null default 0,
  add column if not exists quantity_available numeric(18,4) not null default 0,
  add column if not exists quantity_reserved numeric(18,4) not null default 0,
  add column if not exists last_updated timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'stock_balances' and column_name = 'quantity'
  ) then
    execute $sql$
      update icecream_erp.stock_balances
      set quantity_on_hand = case when quantity_on_hand = 0 then coalesce(quantity, 0) else quantity_on_hand end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'stock_balances' and column_name = 'reserved_qty'
  ) then
    execute $sql$
      update icecream_erp.stock_balances
      set quantity_reserved = case when quantity_reserved = 0 then coalesce(reserved_qty, 0) else quantity_reserved end
      where true
    $sql$;
  end if;

  update icecream_erp.stock_balances
  set
    quantity_available = case
      when quantity_available = 0 then greatest(coalesce(quantity_on_hand, 0) - coalesce(quantity_reserved, 0), 0)
      else quantity_available
    end,
    last_updated = coalesce(last_updated, now())
  where true;
end $$;

alter table if exists icecream_erp.recipes
  add column if not exists expected_output_quantity numeric(18,4) not null default 1,
  add column if not exists output_unit_id uuid null,
  add column if not exists finished_item_id uuid null,
  add column if not exists instructions text null,
  add column if not exists packaging_requirement text null,
  add column if not exists production_category text not null default 'ICE_CREAM_MAKING',
  add column if not exists deleted_at timestamptz null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'recipes' and column_name = 'batch_size'
  ) then
    execute $sql$
      update icecream_erp.recipes
      set expected_output_quantity = case
        when expected_output_quantity = 1 and batch_size is not null then batch_size
        else expected_output_quantity
      end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'recipes' and column_name = 'batch_unit_id'
  ) then
    execute $sql$
      update icecream_erp.recipes
      set output_unit_id = coalesce(output_unit_id, batch_unit_id)
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'recipes' and column_name = 'notes'
  ) then
    execute $sql$
      update icecream_erp.recipes
      set instructions = coalesce(instructions, notes)
      where true
    $sql$;
  end if;
end $$;

create table if not exists icecream_erp.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  item_id uuid not null,
  quantity_required numeric(18,4) not null default 0,
  unit_id uuid null,
  wastage_allowance_percent numeric(8,3) not null default 0,
  production_category text not null default 'ICE_CREAM_MAKING',
  notes text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'icecream_erp' and table_name = 'recipe_ingredients'
  ) then
    execute $sql$
      insert into icecream_erp.recipe_items (
        recipe_id,
        item_id,
        quantity_required,
        unit_id,
        wastage_allowance_percent,
        production_category,
        notes,
        sort_order
      )
      select
        recipe_id,
        item_id,
        quantity,
        unit_id,
        0,
        'ICE_CREAM_MAKING',
        notes,
        sort_order
      from icecream_erp.recipe_ingredients
      where not exists (
        select 1
        from icecream_erp.recipe_items ri
        where ri.recipe_id = recipe_ingredients.recipe_id
          and ri.item_id = recipe_ingredients.item_id
      )
    $sql$;
  end if;
end $$;

create table if not exists icecream_erp.recipe_packaging_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  item_id uuid not null,
  quantity_required numeric(18,4) not null default 0,
  unit_id uuid null,
  wastage_allowance_percent numeric(8,3) not null default 0,
  notes text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.production_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  plan_number text not null,
  plan_date date not null default current_date,
  shift text not null default 'DAY',
  production_line text null,
  production_category text not null default 'ICE_CREAM_MAKING',
  status text not null default 'DRAFT',
  created_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists icecream_erp.production_plans
  add column if not exists organization_id uuid null,
  add column if not exists plan_number text null,
  add column if not exists plan_date date not null default current_date,
  add column if not exists shift text not null default 'DAY',
  add column if not exists production_line text null,
  add column if not exists production_category text not null default 'ICE_CREAM_MAKING',
  add column if not exists status text not null default 'DRAFT',
  add column if not exists created_by uuid null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists deleted_at timestamptz null;

create table if not exists icecream_erp.production_plan_items (
  id uuid primary key default gen_random_uuid(),
  production_plan_id uuid not null,
  recipe_id uuid not null,
  planned_quantity numeric(18,4) not null default 0,
  expected_output numeric(18,4) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists icecream_erp.production_batches
  add column if not exists production_date timestamptz null,
  add column if not exists production_line text null,
  add column if not exists production_category text not null default 'ICE_CREAM_MAKING',
  add column if not exists planned_quantity numeric(18,4) not null default 0,
  add column if not exists expected_output numeric(18,4) not null default 0,
  add column if not exists actual_output numeric(18,4) not null default 0,
  add column if not exists quality_status text not null default 'PENDING',
  add column if not exists quality_notes text null,
  add column if not exists wastage_quantity numeric(18,4) not null default 0,
  add column if not exists wastage_percentage numeric(8,3) not null default 0,
  add column if not exists efficiency_percentage numeric(8,3) not null default 0,
  add column if not exists worker_count integer not null default 0,
  add column if not exists people_off_count integer not null default 0,
  add column if not exists labour_cost numeric(18,2) not null default 0,
  add column if not exists overhead_cost numeric(18,2) not null default 0,
  add column if not exists material_cost numeric(18,2) not null default 0,
  add column if not exists deleted_at timestamptz null,
  add column if not exists wastage_reason text null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'planned_date'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set production_date = coalesce(production_date, planned_date::timestamptz)
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'planned_qty'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set
        planned_quantity = case when planned_quantity = 0 then coalesce(planned_qty, 0) else planned_quantity end,
        expected_output = case when expected_output = 0 then coalesce(planned_qty, 0) else expected_output end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'actual_qty'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set actual_output = case when actual_output = 0 then coalesce(actual_qty, 0) else actual_output end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'wastage_qty'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set wastage_quantity = case when wastage_quantity = 0 then coalesce(wastage_qty, 0) else wastage_quantity end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'total_material_cost'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set material_cost = case when material_cost = 0 then coalesce(total_material_cost, 0) else material_cost end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'total_labour_cost'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set labour_cost = case when labour_cost = 0 then coalesce(total_labour_cost, 0) else labour_cost end
      where true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'icecream_erp' and table_name = 'production_batches' and column_name = 'total_overhead_cost'
  ) then
    execute $sql$
      update icecream_erp.production_batches
      set overhead_cost = case when overhead_cost = 0 then coalesce(total_overhead_cost, 0) else overhead_cost end
      where true
    $sql$;
  end if;
end $$;

create table if not exists icecream_erp.production_batch_materials (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  item_id uuid not null,
  unit_id uuid null,
  quantity_required numeric(18,4) not null default 0,
  quantity_issued numeric(18,4) not null default 0,
  quantity_actual numeric(18,4) not null default 0,
  quantity_remaining numeric(18,4) not null default 0,
  unit_cost numeric(18,4) not null default 0,
  total_cost numeric(18,2) not null default 0,
  variance numeric(18,4) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists icecream_erp.production_batch_materials
  add column if not exists quantity_remaining numeric(18,4) not null default 0,
  add column if not exists unit_cost numeric(18,4) not null default 0,
  add column if not exists total_cost numeric(18,2) not null default 0,
  add column if not exists notes text null;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'icecream_erp' and table_name = 'batch_material_usage'
  ) then
    execute $sql$
      insert into icecream_erp.production_batch_materials (
        batch_id,
        item_id,
        quantity_required,
        quantity_issued,
        quantity_actual,
        quantity_remaining,
        unit_cost,
        total_cost,
        variance,
        notes
      )
      select
        batch_id,
        item_id,
        standard_qty,
        actual_qty,
        actual_qty,
        greatest(standard_qty - actual_qty, 0),
        coalesce(unit_cost, 0),
        coalesce(total_cost, 0),
        coalesce(variance_qty, standard_qty - actual_qty),
        notes
      from icecream_erp.batch_material_usage
      where not exists (
        select 1
        from icecream_erp.production_batch_materials pbm
        where pbm.batch_id = batch_material_usage.batch_id
          and pbm.item_id = batch_material_usage.item_id
      )
    $sql$;
  end if;
end $$;

create table if not exists icecream_erp.production_batch_outputs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  item_id uuid not null,
  unit_id uuid null,
  expected_quantity numeric(18,4) not null default 0,
  actual_quantity numeric(18,4) not null default 0,
  wastage_quantity numeric(18,4) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into icecream_erp.production_batch_outputs (
  batch_id,
  item_id,
  unit_id,
  expected_quantity,
  actual_quantity,
  wastage_quantity
)
select
  pb.id,
  r.finished_item_id,
  r.output_unit_id,
  coalesce(pb.expected_output, 0),
  coalesce(pb.actual_output, 0),
  coalesce(pb.wastage_quantity, 0)
from icecream_erp.production_batches pb
join icecream_erp.recipes r on r.id = pb.recipe_id
where r.finished_item_id is not null
  and not exists (
    select 1
    from icecream_erp.production_batch_outputs pbo
    where pbo.batch_id = pb.id
  );

create table if not exists icecream_erp.production_worker_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  batch_id uuid not null,
  employee_id uuid null,
  worker_name text null,
  shift_name text not null default 'DAY',
  attendance_status text not null default 'PRESENT',
  is_off_shift boolean not null default false,
  hours_worked numeric(8,2) not null default 0,
  output_quantity numeric(18,4) not null default 0,
  remarks text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.production_stock_closures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  batch_id uuid null,
  item_id uuid not null,
  warehouse_id uuid not null,
  closure_date date not null default current_date,
  opening_quantity numeric(18,4) not null default 0,
  additional_quantity numeric(18,4) not null default 0,
  used_quantity numeric(18,4) not null default 0,
  remaining_quantity numeric(18,4) not null default 0,
  closing_quantity numeric(18,4) not null default 0,
  unit_cost numeric(18,4) not null default 0,
  notes text null,
  recorded_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.production_cost_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  batch_id uuid not null,
  material_id uuid null,
  item_id uuid not null,
  previous_unit_cost numeric(18,4) not null default 0,
  adjusted_unit_cost numeric(18,4) not null default 0,
  adjustment_reason text null,
  adjusted_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists icecream_erp.finished_goods_transfers (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null,
  source_warehouse_id uuid not null,
  destination_warehouse_id uuid not null,
  quantity_transferred numeric(18,4) not null default 0,
  received_by uuid null,
  transfer_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recipe_items_recipe
  on icecream_erp.recipe_items (recipe_id, sort_order);
create index if not exists idx_recipe_packaging_items_recipe
  on icecream_erp.recipe_packaging_items (recipe_id, sort_order);
create index if not exists idx_production_plan_items_plan
  on icecream_erp.production_plan_items (production_plan_id);
create index if not exists idx_production_batch_materials_batch
  on icecream_erp.production_batch_materials (batch_id, item_id);
create index if not exists idx_production_batch_outputs_batch
  on icecream_erp.production_batch_outputs (batch_id, item_id);
create index if not exists idx_production_worker_assignments_batch
  on icecream_erp.production_worker_assignments (batch_id, attendance_status);
create index if not exists idx_production_stock_closures_batch
  on icecream_erp.production_stock_closures (batch_id, closure_date);
create index if not exists idx_production_cost_overrides_batch
  on icecream_erp.production_cost_overrides (batch_id, item_id);
create index if not exists idx_finished_goods_transfers_batch
  on icecream_erp.finished_goods_transfers (production_batch_id);

grant all on all tables in schema icecream_erp to authenticated;
grant all on all tables in schema icecream_erp to service_role;
-- ===== End 021_production_execution_costing.sql =====

-- ===== Begin 022_sales_capture_stock_workflow.sql =====
alter table if exists icecream_erp.invoices
  add column if not exists warehouse_id uuid null,
  add column if not exists sales_order_id uuid null;

create index if not exists idx_invoices_warehouse
  on icecream_erp.invoices (warehouse_id);

create index if not exists idx_invoices_sales_order
  on icecream_erp.invoices (sales_order_id);
-- ===== End 022_sales_capture_stock_workflow.sql =====

-- ===== Begin 023_inventory_stores_controls.sql =====
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
-- ===== End 023_inventory_stores_controls.sql =====

-- ===== Begin 024_procurement_workflow_hq_receipts.sql =====
alter table if exists icecream_erp.suppliers
  add column if not exists document_name text null,
  add column if not exists document_url text null;

alter table if exists icecream_erp.purchase_requisitions
  add column if not exists approver_user_id uuid null references icecream_erp.users (id),
  add column if not exists approved_by uuid null references icecream_erp.users (id),
  add column if not exists approved_at timestamptz null,
  add column if not exists rejected_by uuid null references icecream_erp.users (id),
  add column if not exists rejected_at timestamptz null;

create index if not exists idx_purchase_requisitions_approver_user_id
  on icecream_erp.purchase_requisitions (approver_user_id);

alter table if exists icecream_erp.purchase_orders
  add column if not exists approver_user_id uuid null references icecream_erp.users (id),
  add column if not exists approved_by uuid null references icecream_erp.users (id),
  add column if not exists approved_at timestamptz null,
  add column if not exists rejected_by uuid null references icecream_erp.users (id),
  add column if not exists rejected_at timestamptz null,
  add column if not exists sent_at timestamptz null;

create index if not exists idx_purchase_orders_approver_user_id
  on icecream_erp.purchase_orders (approver_user_id);

alter table if exists icecream_erp.goods_received_notes
  add column if not exists supplier_id uuid null references icecream_erp.suppliers (id),
  add column if not exists entry_mode text not null default 'po_linked';

update icecream_erp.goods_received_notes
set
  supplier_id = coalesce(
    supplier_id,
    (
      select po.supplier_id
      from icecream_erp.purchase_orders po
      where po.id = goods_received_notes.purchase_order_id
      limit 1
    )
  ),
  entry_mode = case
    when coalesce(purchase_order_id, po_id) is null then 'manual'
    else 'po_linked'
  end
where
  supplier_id is null
  or entry_mode is null
  or entry_mode = '';

create index if not exists idx_goods_received_notes_supplier_id
  on icecream_erp.goods_received_notes (supplier_id);

create index if not exists idx_goods_received_notes_entry_mode
  on icecream_erp.goods_received_notes (organization_id, entry_mode);
-- ===== End 024_procurement_workflow_hq_receipts.sql =====

-- ===== Begin 025_production_simple_workflow_compatibility.sql =====
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
-- ===== End 025_production_simple_workflow_compatibility.sql =====

-- ===== Begin 026_maintenance_machine_profiles.sql =====
create table if not exists icecream_erp.machine_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id) on delete cascade,
  machine_id uuid not null unique references icecream_erp.machines(id) on delete cascade,
  branch_name text,
  serial_number text,
  manufacturer text,
  model text,
  purchase_cost numeric(18, 2) not null default 0,
  health_status text,
  service_interval_days integer not null default 0,
  service_provider text,
  last_service_cost numeric(18, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_machine_profiles_org on icecream_erp.machine_profiles(organization_id);
create index if not exists idx_machine_profiles_machine on icecream_erp.machine_profiles(machine_id);
-- ===== End 026_maintenance_machine_profiles.sql =====

-- ===== Begin 027_registration_otps.sql =====
create table if not exists icecream_erp.registration_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  id_number text not null,
  role_id text not null,
  otp_hash text not null,
  payload_encrypted text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_registration_otps_email
  on icecream_erp.registration_otps (email);
create index if not exists idx_registration_otps_expires_at
  on icecream_erp.registration_otps (expires_at);

alter table if exists icecream_erp.registration_otps enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'registration_otps'
      and policyname = 'registration_otps_service_role_full_access'
  ) then
    create policy registration_otps_service_role_full_access
      on icecream_erp.registration_otps
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'registration_otps'
      and policyname = 'registration_otps_deny_anon'
  ) then
    create policy registration_otps_deny_anon
      on icecream_erp.registration_otps
      for all
      to anon
      using (false)
      with check (false);
  end if;
end $$;

grant all on table icecream_erp.registration_otps to service_role;
-- ===== End 027_registration_otps.sql =====

-- ===== Begin 028_notification_center_schema_recovery.sql =====
alter table if exists icecream_erp.notifications
  add column if not exists user_profile_id uuid null,
  add column if not exists module_name text null,
  add column if not exists event_type text null,
  add column if not exists severity text not null default 'INFO',
  add column if not exists status text not null default 'PENDING',
  add column if not exists channel text not null default 'IN_APP',
  add column if not exists link text null,
  add column if not exists branch_id uuid null,
  add column if not exists warehouse_id uuid null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists sent_at timestamptz null,
  add column if not exists sent_by uuid null,
  add column if not exists read_at timestamptz null,
  add column if not exists read_by uuid null,
  add column if not exists dismissed_at timestamptz null,
  add column if not exists dismissed_by uuid null,
  add column if not exists failed_at timestamptz null,
  add column if not exists failure_reason text null;

update icecream_erp.notifications
set user_profile_id = user_id
where user_profile_id is null
  and user_id is not null;

create index if not exists idx_notifications_module_status
  on icecream_erp.notifications (organization_id, user_profile_id, module_name, status, severity, created_at desc);

create index if not exists idx_notifications_document_lookup
  on icecream_erp.notifications (organization_id, reference_type, reference_id, status);

create table if not exists icecream_erp.notification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rule_name text not null,
  module_name text not null,
  event_type text not null,
  severity text not null default 'MEDIUM',
  recipient_role_name text null,
  recipient_user_id uuid null,
  recipient_branch_id uuid null,
  recipient_warehouse_id uuid null,
  channel text not null default 'IN_APP',
  template_id uuid null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_notification_rules_lookup
  on icecream_erp.notification_rules (organization_id, module_name, event_type, is_active);

create table if not exists icecream_erp.notification_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_name text not null,
  module_name text not null,
  event_type text not null,
  title_template text not null,
  message_template text not null,
  channel text not null default 'IN_APP',
  supported_placeholders jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_notification_templates_lookup
  on icecream_erp.notification_templates (organization_id, module_name, event_type, channel, is_active);

create table if not exists icecream_erp.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_profile_id uuid not null,
  module_name text not null,
  channel text not null default 'IN_APP',
  enabled boolean not null default true,
  minimum_severity text not null default 'INFO',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create unique index if not exists idx_notification_preferences_unique
  on icecream_erp.notification_preferences (organization_id, user_profile_id, module_name, channel);

create table if not exists icecream_erp.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  notification_id uuid null,
  recipient_user_id uuid null,
  channel text not null,
  delivery_status text not null default 'PENDING',
  sent_at timestamptz null,
  failure_reason text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notification_delivery_logs_lookup
  on icecream_erp.notification_delivery_logs (organization_id, recipient_user_id, channel, delivery_status, created_at desc);

create table if not exists icecream_erp.escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  event_type text not null,
  initial_recipient_role_name text not null,
  escalation_recipient_role_name text not null,
  escalation_delay_minutes integer not null,
  severity text not null default 'HIGH',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_escalation_rules_lookup
  on icecream_erp.escalation_rules (organization_id, module_name, event_type, is_active);

create table if not exists icecream_erp.escalation_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  notification_id uuid not null,
  escalation_rule_id uuid null,
  escalation_recipient_user_id uuid null,
  escalated_at timestamptz not null default now(),
  escalation_status text not null default 'PENDING',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_escalation_logs_lookup
  on icecream_erp.escalation_logs (organization_id, notification_id, escalated_at desc);

create table if not exists icecream_erp.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  reminder_event text not null,
  due_time_rule text not null,
  recipient_role_name text not null,
  message text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_reminder_rules_lookup
  on icecream_erp.reminder_rules (organization_id, module_name, document_type, is_active);

create table if not exists icecream_erp.communication_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  notification_id uuid null,
  channel text not null,
  action text not null,
  recipient_user_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_communication_audit_logs_lookup
  on icecream_erp.communication_audit_logs (organization_id, channel, action, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'notification_rules',
    'notification_templates',
    'notification_preferences',
    'notification_delivery_logs',
    'escalation_rules',
    'escalation_logs',
    'reminder_rules',
    'communication_audit_logs'
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
-- ===== End 028_notification_center_schema_recovery.sql =====

-- ===== Begin 029_sales_schema_recovery.sql =====
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
-- ===== End 029_sales_schema_recovery.sql =====

-- ===== Begin 030 app-contract compatibility tables =====

create table if not exists icecream_erp.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  description text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_departments_org_code on icecream_erp.departments (organization_id, code);
create unique index if not exists idx_departments_org_name on icecream_erp.departments (organization_id, name);
create index if not exists idx_departments_deleted_at on icecream_erp.departments (deleted_at);

create table if not exists icecream_erp.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_code text not null,
  name text not null,
  description text null,
  category text not null,
  location text null,
  purchase_date date not null,
  purchase_cost numeric(18,2) not null default 0,
  useful_life_years integer not null default 1,
  residual_value numeric(18,2) not null default 0,
  depreciation_method text not null default 'STRAIGHT_LINE',
  current_value numeric(18,2) not null default 0,
  accumulated_dep numeric(18,2) not null default 0,
  is_active boolean not null default true,
  disposal_date date null,
  disposal_value numeric(18,2) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_fixed_assets_org_code on icecream_erp.fixed_assets (organization_id, asset_code);
create index if not exists idx_fixed_assets_org on icecream_erp.fixed_assets (organization_id);
create index if not exists idx_fixed_assets_category on icecream_erp.fixed_assets (category);
create index if not exists idx_fixed_assets_deleted_at on icecream_erp.fixed_assets (deleted_at);

create table if not exists icecream_erp.asset_depreciation (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references icecream_erp.fixed_assets(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  depreciation_amount numeric(18,2) not null default 0,
  accumulated_total numeric(18,2) not null default 0,
  book_value numeric(18,2) not null default 0,
  journal_entry_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_asset_depreciation_asset on icecream_erp.asset_depreciation (asset_id);
create index if not exists idx_asset_depreciation_period_start on icecream_erp.asset_depreciation (period_start);
create index if not exists idx_asset_depreciation_period_end on icecream_erp.asset_depreciation (period_end);

create table if not exists icecream_erp.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bank_account_id uuid not null references icecream_erp.bank_accounts(id),
  period_start date not null,
  period_end date not null,
  opening_balance numeric(18,2) not null default 0,
  closing_balance numeric(18,2) not null default 0,
  statement_balance numeric(18,2) not null default 0,
  outstanding_deposits numeric(18,2) not null default 0,
  outstanding_payments numeric(18,2) not null default 0,
  reconciled_balance numeric(18,2) not null default 0,
  is_reconciled boolean not null default false,
  reconciled_by uuid null,
  reconciled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bank_reconciliations_org on icecream_erp.bank_reconciliations (organization_id);
create index if not exists idx_bank_reconciliations_account on icecream_erp.bank_reconciliations (bank_account_id);
create index if not exists idx_bank_reconciliations_period on icecream_erp.bank_reconciliations (period_start, period_end);

create table if not exists icecream_erp.branch_sale_items (
  id uuid primary key default gen_random_uuid(),
  branch_sale_id uuid not null references icecream_erp.branch_sales(id) on delete cascade,
  item_id uuid not null references icecream_erp.items(id),
  quantity numeric(18,3) not null default 0,
  unit_price numeric(18,2) not null default 0,
  total_price numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_branch_sale_items_sale on icecream_erp.branch_sale_items (branch_sale_id);
create index if not exists idx_branch_sale_items_item on icecream_erp.branch_sale_items (item_id);

create table if not exists icecream_erp.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  item_id uuid not null references icecream_erp.items(id),
  warehouse_id uuid not null references icecream_erp.warehouses(id),
  batch_number text not null,
  manufactured_date date null,
  expiry_date date null,
  quantity_received numeric(18,3) not null default 0,
  quantity_remaining numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  supplier_id uuid null references icecream_erp.suppliers(id),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_inventory_batches_unique on icecream_erp.inventory_batches (warehouse_id, item_id, batch_number);
create index if not exists idx_inventory_batches_org on icecream_erp.inventory_batches (organization_id);
create index if not exists idx_inventory_batches_expiry on icecream_erp.inventory_batches (expiry_date);

create table if not exists icecream_erp.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references icecream_erp.journal_entries(id) on delete cascade,
  account_id uuid not null references icecream_erp.accounts(id),
  description text null,
  debit_amount numeric(18,2) not null default 0,
  credit_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journal_entry_lines_entry on icecream_erp.journal_entry_lines (journal_entry_id);
create index if not exists idx_journal_entry_lines_account on icecream_erp.journal_entry_lines (account_id);

create table if not exists icecream_erp.leave_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null references icecream_erp.employees(id),
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  days_requested numeric(8,2) not null default 0,
  reason text null,
  status text not null default 'PENDING',
  approved_by uuid null,
  approved_at timestamptz null,
  rejected_by uuid null,
  rejected_at timestamptz null,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_leave_applications_org on icecream_erp.leave_applications (organization_id);
create index if not exists idx_leave_applications_employee on icecream_erp.leave_applications (employee_id);
create index if not exists idx_leave_applications_status on icecream_erp.leave_applications (status);
create index if not exists idx_leave_applications_deleted_at on icecream_erp.leave_applications (deleted_at);

create table if not exists icecream_erp.machine_breakdowns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  machine_id uuid not null references icecream_erp.machines(id) on delete cascade,
  breakdown_code text null,
  issue_date date not null default current_date,
  issue_time timestamptz null,
  reported_by uuid null,
  issue_summary text not null,
  issue_description text null,
  severity text not null default 'MEDIUM',
  status text not null default 'OPEN',
  resolved_by uuid null,
  resolved_at timestamptz null,
  resolution_notes text null,
  downtime_hours numeric(18,2) not null default 0,
  estimated_cost numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_machine_breakdowns_machine on icecream_erp.machine_breakdowns (machine_id);
create index if not exists idx_machine_breakdowns_status on icecream_erp.machine_breakdowns (status);
create index if not exists idx_machine_breakdowns_deleted_at on icecream_erp.machine_breakdowns (deleted_at);

create table if not exists icecream_erp.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  machine_id uuid not null references icecream_erp.machines(id) on delete cascade,
  schedule_code text null,
  maintenance_type text not null default 'PREVENTIVE',
  scheduled_date date not null,
  description text not null,
  technician text null,
  status text not null default 'SCHEDULED',
  completed_date date null,
  completed_by uuid null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_maintenance_schedules_machine on icecream_erp.maintenance_schedules (machine_id);
create index if not exists idx_maintenance_schedules_status on icecream_erp.maintenance_schedules (status);
create index if not exists idx_maintenance_schedules_deleted_at on icecream_erp.maintenance_schedules (deleted_at);

create table if not exists icecream_erp.petty_cash_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_number text not null,
  branch_id uuid null references icecream_erp.branches(id),
  requested_by uuid null,
  request_date date not null default current_date,
  amount_requested numeric(18,2) not null default 0,
  amount_approved numeric(18,2) null,
  amount_disbursed numeric(18,2) null,
  purpose text not null,
  status text not null default 'PENDING',
  approved_by uuid null,
  approved_at timestamptz null,
  rejected_by uuid null,
  rejected_at timestamptz null,
  rejection_reason text null,
  disbursed_by uuid null,
  disbursed_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_petty_cash_requests_number on icecream_erp.petty_cash_requests (organization_id, request_number);
create index if not exists idx_petty_cash_requests_status on icecream_erp.petty_cash_requests (organization_id, status, request_date);
create index if not exists idx_petty_cash_requests_deleted_at on icecream_erp.petty_cash_requests (deleted_at);

create table if not exists icecream_erp.production_material_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  production_batch_id uuid not null references icecream_erp.production_batches(id) on delete cascade,
  request_number text not null,
  request_date date not null default current_date,
  requested_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  issued_by uuid null,
  issued_at timestamptz null,
  notes text null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_production_material_requests_number on icecream_erp.production_material_requests (organization_id, request_number);
create index if not exists idx_production_material_requests_batch on icecream_erp.production_material_requests (production_batch_id);
create index if not exists idx_production_material_requests_deleted_at on icecream_erp.production_material_requests (deleted_at);

create table if not exists icecream_erp.production_material_request_items (
  id uuid primary key default gen_random_uuid(),
  production_material_request_id uuid not null references icecream_erp.production_material_requests(id) on delete cascade,
  item_id uuid not null references icecream_erp.items(id),
  quantity_requested numeric(18,3) not null default 0,
  quantity_approved numeric(18,3) null,
  quantity_issued numeric(18,3) null,
  unit_of_measure_id uuid not null references icecream_erp.units_of_measure(id),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_production_material_request_items_request on icecream_erp.production_material_request_items (production_material_request_id);
create index if not exists idx_production_material_request_items_item on icecream_erp.production_material_request_items (item_id);

create table if not exists icecream_erp.production_wastage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  production_batch_id uuid not null references icecream_erp.production_batches(id),
  item_id uuid not null references icecream_erp.items(id),
  wastage_type text not null,
  quantity numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  total_cost numeric(18,2) not null default 0,
  reason text null,
  reported_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_production_wastage_batch on icecream_erp.production_wastage (production_batch_id);
create index if not exists idx_production_wastage_item on icecream_erp.production_wastage (item_id);
create index if not exists idx_production_wastage_deleted_at on icecream_erp.production_wastage (deleted_at);

create table if not exists icecream_erp.shift_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  production_batch_id uuid null references icecream_erp.production_batches(id),
  branch_id uuid null references icecream_erp.branches(id),
  report_date date not null,
  shift_type text not null,
  status text not null default 'OPEN',
  prepared_by uuid null,
  approved_by uuid null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_shift_reports_org on icecream_erp.shift_reports (organization_id, report_date);
create index if not exists idx_shift_reports_deleted_at on icecream_erp.shift_reports (deleted_at);

create table if not exists icecream_erp.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  adjustment_number text not null,
  warehouse_id uuid not null references icecream_erp.warehouses(id),
  adjustment_date date not null default current_date,
  reason text not null,
  status text not null default 'DRAFT',
  approval_request_id uuid null,
  notes text null,
  created_by uuid null,
  approved_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_stock_adjustments_number on icecream_erp.stock_adjustments (organization_id, adjustment_number);
create index if not exists idx_stock_adjustments_deleted_at on icecream_erp.stock_adjustments (deleted_at);

create table if not exists icecream_erp.stock_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references icecream_erp.stock_adjustments(id) on delete cascade,
  item_id uuid not null references icecream_erp.items(id),
  quantity_before numeric(18,3) not null default 0,
  quantity_adjusted numeric(18,3) not null default 0,
  quantity_after numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  movement_type text not null,
  reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stock_adjustment_items_adjustment on icecream_erp.stock_adjustment_items (adjustment_id);
create index if not exists idx_stock_adjustment_items_item on icecream_erp.stock_adjustment_items (item_id);

create table if not exists icecream_erp.tax_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  code text not null,
  rate numeric(8,4) not null default 0,
  is_active boolean not null default true,
  applies_to_sales boolean not null default true,
  applies_to_purchase boolean not null default true,
  account_id uuid null references icecream_erp.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists idx_tax_rates_org_code on icecream_erp.tax_rates (organization_id, code);
create index if not exists idx_tax_rates_deleted_at on icecream_erp.tax_rates (deleted_at);

create table if not exists icecream_erp.currencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  symbol text null,
  is_base_currency boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_currencies_org_code on icecream_erp.currencies (organization_id, code);
create index if not exists idx_currencies_base on icecream_erp.currencies (organization_id, is_base_currency);

create table if not exists icecream_erp.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  currency_code text not null,
  rate_date date not null default current_date,
  exchange_rate numeric(18,6) not null default 1,
  inverse_rate numeric(18,6) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_exchange_rates_unique on icecream_erp.exchange_rates (organization_id, currency_code, rate_date);

create table if not exists icecream_erp.opening_cash_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cash_account_id uuid not null references icecream_erp.cash_accounts(id),
  opening_date date not null default current_date,
  opening_balance numeric(18,2) not null default 0,
  posting_status text not null default 'DRAFT',
  posted_at timestamptz null,
  posted_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create unique index if not exists idx_opening_cash_balances_unique on icecream_erp.opening_cash_balances (organization_id, cash_account_id, opening_date);

create table if not exists icecream_erp.opening_bank_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bank_account_id uuid not null references icecream_erp.bank_accounts(id),
  opening_date date not null default current_date,
  opening_balance numeric(18,2) not null default 0,
  posting_status text not null default 'DRAFT',
  posted_at timestamptz null,
  posted_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create unique index if not exists idx_opening_bank_balances_unique on icecream_erp.opening_bank_balances (organization_id, bank_account_id, opening_date);

-- ===== End 030 app-contract compatibility tables =====

-- ===== Begin 030 contract compatibility columns =====

alter table if exists icecream_erp.units_of_measure
  add column if not exists code text null,
  add column if not exists unit_type text null,
  add column if not exists is_base_unit boolean not null default false,
  add column if not exists is_active boolean not null default true;

alter table if exists icecream_erp.branch_sales
  add column if not exists sale_number text null,
  add column if not exists payment_reference text null;

alter table if exists icecream_erp.branch_shift_closes
  add column if not exists shift_type text null,
  add column if not exists opening_stock_value numeric(18,2) not null default 0,
  add column if not exists stock_received_value numeric(18,2) not null default 0,
  add column if not exists stock_sold_value numeric(18,2) not null default 0,
  add column if not exists damaged_stock_value numeric(18,2) not null default 0,
  add column if not exists closing_stock_value numeric(18,2) not null default 0,
  add column if not exists expected_cash numeric(18,2) not null default 0,
  add column if not exists actual_cash numeric(18,2) not null default 0,
  add column if not exists cash_variance numeric(18,2) not null default 0,
  add column if not exists expenses_total numeric(18,2) not null default 0;

update icecream_erp.branch_shift_closes
set shift_type = coalesce(shift_type, shift::text)
where shift_type is null;

alter table if exists icecream_erp.budgets
  add column if not exists budget_code text null,
  add column if not exists budget_year integer null,
  add column if not exists budget_type text null,
  add column if not exists branch_id uuid null,
  add column if not exists department_id uuid null,
  add column if not exists total_budgeted numeric(18,2) not null default 0;

alter table if exists icecream_erp.customers
  add column if not exists customer_type text null,
  add column if not exists payment_terms text null;

alter table if exists icecream_erp.items
  add column if not exists deleted_at timestamptz null,
  add column if not exists item_category_id uuid null,
  add column if not exists reorder_quantity numeric(18,3) null,
  add column if not exists track_expiry boolean not null default false;

update icecream_erp.items
set item_category_id = coalesce(item_category_id, category_id),
    reorder_quantity = coalesce(reorder_quantity, reorder_qty)
where item_category_id is null
   or reorder_quantity is null;

alter table if exists icecream_erp.journal_entries
  add column if not exists reference_type text null,
  add column if not exists reference_id text null,
  add column if not exists is_posted boolean not null default false,
  add column if not exists posted_by uuid null,
  add column if not exists posted_at timestamptz null;

alter table if exists icecream_erp.machines
  add column if not exists code text null,
  add column if not exists machine_type text null,
  add column if not exists warranty_expiry date null,
  add column if not exists updated_at timestamptz not null default now();

update icecream_erp.machines
set code = coalesce(code, asset_number)
where code is null;

alter table if exists icecream_erp.suppliers
  add column if not exists current_balance numeric(18,2) not null default 0,
  add column if not exists deleted_at timestamptz null;

alter table if exists icecream_erp.roles
  add column if not exists code text null,
  add column if not exists module text null;

alter table if exists icecream_erp.users
  add column if not exists organization_id uuid null,
  add column if not exists deleted_at timestamptz null;

alter table if exists icecream_erp.invoices
  add column if not exists branch_id uuid null,
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists base_amount numeric(18,2) null;

alter table if exists icecream_erp.payments
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists base_amount numeric(18,2) null;

alter table if exists icecream_erp.sales_orders
  add column if not exists required_date date null,
  add column if not exists total numeric(18,2) not null default 0,
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists base_amount numeric(18,2) null;

update icecream_erp.sales_orders
set required_date = coalesce(required_date, delivery_date),
    total = coalesce(total, total_amount)
where required_date is null
   or total = 0;

alter table if exists icecream_erp.sales_order_items
  add column if not exists quantity_ordered numeric(18,3) null,
  add column if not exists discount_percent numeric(18,2) null;

update icecream_erp.sales_order_items
set quantity_ordered = coalesce(quantity_ordered, quantity),
    discount_percent = coalesce(discount_percent, discount_pct)
where quantity_ordered is null
   or discount_percent is null;

alter table if exists icecream_erp.bank_accounts
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1;

alter table if exists icecream_erp.cash_accounts
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1;

alter table if exists icecream_erp.finance_expenses
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists base_amount numeric(18,2) null;

alter table if exists icecream_erp.supplier_invoices
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists base_amount numeric(18,2) null;

alter table if exists icecream_erp.supplier_payments
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists base_amount numeric(18,2) null;

alter table if exists icecream_erp.purchase_orders
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists base_amount numeric(18,2) null;

alter table if exists icecream_erp.quotations
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists base_amount numeric(18,2) null;

-- ===== End 030 contract compatibility columns =====

-- ===== Begin 030 seeds =====

insert into icecream_erp.units_of_measure (
  organization_id, name, abbreviation, code, unit_type, is_base_unit, is_active
)
select
  org.id,
  seed.name,
  seed.abbreviation,
  seed.code,
  seed.unit_type,
  seed.is_base_unit,
  true
from icecream_erp.organizations org
cross join (
  values
    ('Each', 'EA', 'EA', 'COUNT', true),
    ('Kilogram', 'KG', 'KG', 'WEIGHT', true),
    ('Gram', 'G', 'G', 'WEIGHT', false),
    ('Litre', 'L', 'L', 'VOLUME', true),
    ('Millilitre', 'ML', 'ML', 'VOLUME', false),
    ('Box', 'BOX', 'BOX', 'PACK', false),
    ('Carton', 'CTN', 'CTN', 'PACK', false),
    ('Packet', 'PKT', 'PKT', 'PACK', false),
    ('Bag', 'BAG', 'BAG', 'PACK', false),
    ('Dozen', 'DZN', 'DZN', 'COUNT', false),
    ('Tray', 'TRY', 'TRY', 'PACK', false)
) as seed(name, abbreviation, code, unit_type, is_base_unit)
where not exists (
  select 1
  from icecream_erp.units_of_measure uom
  where uom.organization_id = org.id
    and (
      lower(uom.name) = lower(seed.name)
      or lower(coalesce(uom.code, '')) = lower(seed.code)
    )
);

insert into icecream_erp.currencies (
  organization_id, code, name, symbol, is_base_currency, is_active
)
select
  org.id,
  'USD',
  'US Dollar',
  '$',
  true,
  true
from icecream_erp.organizations org
where not exists (
  select 1
  from icecream_erp.currencies c
  where c.organization_id = org.id
);

insert into icecream_erp.exchange_rates (
  organization_id, currency_code, rate_date, exchange_rate, inverse_rate
)
select
  org.id,
  'USD',
  current_date,
  1,
  1
from icecream_erp.organizations org
where not exists (
  select 1
  from icecream_erp.exchange_rates rate
  where rate.organization_id = org.id
    and rate.currency_code = 'USD'
    and rate.rate_date = current_date
);

insert into icecream_erp.tax_rates (
  organization_id, name, code, rate, is_active, applies_to_sales, applies_to_purchase
)
select
  org.id,
  'VAT 15%',
  'VAT15',
  0.1500,
  true,
  true,
  true
from icecream_erp.organizations org
where not exists (
  select 1
  from icecream_erp.tax_rates rate
  where rate.organization_id = org.id
    and rate.code = 'VAT15'
);

-- ===== End 030 seeds =====

-- ===== Begin 030 scoped grants, RLS, and safe policies =====

grant usage on schema icecream_erp to anon, authenticated, service_role;
grant all on all tables in schema icecream_erp to service_role;
grant all on all sequences in schema icecream_erp to service_role;

do $$
declare
  rec record;
  service_policy_name text;
  anon_policy_name text;
begin
  for rec in
    select table_name
    from information_schema.tables
    where table_schema = 'icecream_erp'
      and table_type = 'BASE TABLE'
  loop
    execute format('alter table icecream_erp.%I enable row level security', rec.table_name);

    service_policy_name := rec.table_name || '_service_role_full_access';
    anon_policy_name := rec.table_name || '_deny_anon';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'icecream_erp'
        and tablename = rec.table_name
        and policyname = service_policy_name
    ) then
      execute format(
        'create policy %I on icecream_erp.%I for all to service_role using (true) with check (true)',
        service_policy_name,
        rec.table_name
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'icecream_erp'
        and tablename = rec.table_name
        and policyname = anon_policy_name
    ) then
      execute format(
        'create policy %I on icecream_erp.%I for all to anon using (false) with check (false)',
        anon_policy_name,
        rec.table_name
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';

-- ===== End 030 scoped grants, RLS, and safe policies =====
