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
