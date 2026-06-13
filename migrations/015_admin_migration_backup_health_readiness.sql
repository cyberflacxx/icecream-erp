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
