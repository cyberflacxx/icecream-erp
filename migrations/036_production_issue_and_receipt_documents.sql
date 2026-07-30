-- 036_production_issue_and_receipt_documents.sql
-- Additive production issue/receipt document tables and document links.
-- Rollback approach: archive documents first, then drop tables in reverse dependency order.

create table if not exists icecream_erp.production_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  branch_id uuid null references icecream_erp.branches(id),
  production_order_id uuid not null references icecream_erp.production_orders(id),
  issue_number text not null,
  issue_date date not null default current_date,
  production_warehouse_id uuid not null references icecream_erp.warehouses(id),
  department text null,
  shift text null,
  posting_status text not null default 'DRAFT',
  total_quantity numeric(18,4) not null default 0,
  total_cost numeric(18,2) not null default 0,
  remarks text null,
  idempotency_key text null,
  issued_by uuid null references icecream_erp.users(id),
  approved_by uuid null references icecream_erp.users(id),
  posted_by uuid null references icecream_erp.users(id),
  posted_at timestamptz null,
  reversed_by uuid null references icecream_erp.users(id),
  reversed_at timestamptz null,
  reversal_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_issues_status_check check (posting_status in ('DRAFT', 'POSTED', 'REVERSED')),
  unique (organization_id, issue_number)
);

create table if not exists icecream_erp.production_issue_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  production_issue_id uuid not null references icecream_erp.production_issues(id) on delete cascade,
  production_order_id uuid not null references icecream_erp.production_orders(id),
  production_order_component_id uuid not null references icecream_erp.production_order_components(id),
  component_item_id uuid not null references icecream_erp.items(id),
  component_number_snapshot text not null,
  component_description_snapshot text not null,
  planned_quantity numeric(18,4) not null default 0,
  released_requirement numeric(18,4) not null default 0,
  previously_issued_quantity numeric(18,4) not null default 0,
  current_issue_quantity numeric(18,4) not null default 0,
  total_issued_quantity numeric(18,4) not null default 0,
  available_quantity_snapshot numeric(18,4) not null default 0,
  warehouse_id uuid not null references icecream_erp.warehouses(id),
  batch_number text null,
  expiry_date date null,
  uom_id uuid null references icecream_erp.units_of_measure(id),
  unit_cost numeric(18,4) not null default 0,
  line_cost numeric(18,2) not null default 0,
  variance numeric(18,4) not null default 0,
  remarks text null,
  created_at timestamptz not null default now()
);

create table if not exists icecream_erp.production_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  branch_id uuid null references icecream_erp.branches(id),
  production_order_id uuid not null references icecream_erp.production_orders(id),
  receipt_number text not null,
  receipt_date date not null default current_date,
  finished_goods_warehouse_id uuid not null references icecream_erp.warehouses(id),
  posting_status text not null default 'DRAFT',
  total_completed_quantity numeric(18,4) not null default 0,
  total_rejected_quantity numeric(18,4) not null default 0,
  total_wastage_quantity numeric(18,4) not null default 0,
  total_cost numeric(18,2) not null default 0,
  remarks text null,
  idempotency_key text null,
  received_by uuid null references icecream_erp.users(id),
  posted_by uuid null references icecream_erp.users(id),
  posted_at timestamptz null,
  reversed_by uuid null references icecream_erp.users(id),
  reversed_at timestamptz null,
  reversal_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_receipts_status_check check (posting_status in ('DRAFT', 'POSTED', 'REVERSED')),
  unique (organization_id, receipt_number)
);

create table if not exists icecream_erp.production_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  production_receipt_id uuid not null references icecream_erp.production_receipts(id) on delete cascade,
  production_order_id uuid not null references icecream_erp.production_orders(id),
  finished_product_id uuid not null references icecream_erp.items(id),
  finished_product_number_snapshot text not null,
  finished_product_description_snapshot text not null,
  planned_quantity numeric(18,4) not null default 0,
  released_quantity numeric(18,4) not null default 0,
  previously_received_quantity numeric(18,4) not null default 0,
  current_completed_quantity numeric(18,4) not null default 0,
  current_rejected_quantity numeric(18,4) not null default 0,
  current_wastage_quantity numeric(18,4) not null default 0,
  total_received_quantity numeric(18,4) not null default 0,
  remaining_quantity numeric(18,4) not null default 0,
  uom_id uuid null references icecream_erp.units_of_measure(id),
  batch_number text null,
  production_date date null,
  expiry_date date null,
  unit_production_cost numeric(18,4) not null default 0,
  total_production_cost numeric(18,2) not null default 0,
  warehouse_id uuid not null references icecream_erp.warehouses(id),
  remarks text null,
  created_at timestamptz not null default now()
);

create table if not exists icecream_erp.production_document_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  production_order_id uuid not null references icecream_erp.production_orders(id) on delete cascade,
  from_document_type text not null,
  from_document_id uuid not null,
  to_document_type text not null,
  to_document_id uuid not null,
  relationship_type text not null,
  created_by uuid null references icecream_erp.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, from_document_type, from_document_id, to_document_type, to_document_id, relationship_type)
);

create unique index if not exists idx_production_issues_idempotency
  on icecream_erp.production_issues (organization_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists idx_production_receipts_idempotency
  on icecream_erp.production_receipts (organization_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_production_issues_order
  on icecream_erp.production_issues (production_order_id, posting_status, issue_date);
create index if not exists idx_production_issue_lines_issue
  on icecream_erp.production_issue_lines (production_issue_id, component_item_id);
create index if not exists idx_production_receipts_order
  on icecream_erp.production_receipts (production_order_id, posting_status, receipt_date);
create index if not exists idx_production_receipt_lines_receipt
  on icecream_erp.production_receipt_lines (production_receipt_id, finished_product_id);
create index if not exists idx_production_document_links_order
  on icecream_erp.production_document_links (production_order_id, created_at);

alter table icecream_erp.production_issues enable row level security;
alter table icecream_erp.production_issue_lines enable row level security;
alter table icecream_erp.production_receipts enable row level security;
alter table icecream_erp.production_receipt_lines enable row level security;
alter table icecream_erp.production_document_links enable row level security;

drop policy if exists "service_role_full_access" on icecream_erp.production_issues;
create policy "service_role_full_access" on icecream_erp.production_issues for all to service_role using (true) with check (true);
drop policy if exists "service_role_full_access" on icecream_erp.production_issue_lines;
create policy "service_role_full_access" on icecream_erp.production_issue_lines for all to service_role using (true) with check (true);
drop policy if exists "service_role_full_access" on icecream_erp.production_receipts;
create policy "service_role_full_access" on icecream_erp.production_receipts for all to service_role using (true) with check (true);
drop policy if exists "service_role_full_access" on icecream_erp.production_receipt_lines;
create policy "service_role_full_access" on icecream_erp.production_receipt_lines for all to service_role using (true) with check (true);
drop policy if exists "service_role_full_access" on icecream_erp.production_document_links;
create policy "service_role_full_access" on icecream_erp.production_document_links for all to service_role using (true) with check (true);

grant all on
  icecream_erp.production_issues,
  icecream_erp.production_issue_lines,
  icecream_erp.production_receipts,
  icecream_erp.production_receipt_lines,
  icecream_erp.production_document_links
to service_role;

notify pgrst, 'reload schema';
