-- Review-only migration for HR employee transfer workflow.
-- Scope: icecream_erp only. Do not run blindly in production without backup/rehearsal.

set search_path = icecream_erp, public;

create table if not exists icecream_erp.hr_employee_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null references icecream_erp.employees(id),
  from_branch_id uuid null,
  to_branch_id uuid null,
  from_warehouse_id uuid null,
  to_warehouse_id uuid null,
  from_department text null,
  to_department text null,
  effective_date date not null,
  reason text null,
  notes text null,
  status text not null default 'PENDING',
  requested_by uuid null,
  requested_at timestamptz not null default now(),
  approved_by uuid null,
  approved_at timestamptz null,
  completed_by uuid null,
  completed_at timestamptz null,
  cancelled_by uuid null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_employee_transfers_org_employee_idx
  on icecream_erp.hr_employee_transfers (organization_id, employee_id, created_at desc);

create unique index if not exists hr_employee_transfers_one_pending_uq
  on icecream_erp.hr_employee_transfers (organization_id, employee_id)
  where status in ('PENDING', 'APPROVED');

comment on table icecream_erp.hr_employee_transfers is
  'State-aware employee assignment transfers. Completion updates the existing employee assignment; it never creates duplicate employees.';

notify pgrst, 'reload schema';
