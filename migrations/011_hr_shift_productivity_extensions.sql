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
