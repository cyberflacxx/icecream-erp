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
