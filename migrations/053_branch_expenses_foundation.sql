-- Creates the branch expense table expected by branch operations routes.
-- Additive only; does not change shared Supabase roles or other schemas.

create table if not exists icecream_erp.branch_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations (id),
  branch_id uuid not null references icecream_erp.branches (id),
  expense_date timestamptz not null default now(),
  category text not null,
  description text not null,
  amount numeric(18,2) not null default 0,
  payment_method text not null default 'CASH',
  receipt_url text null,
  shift_close_id uuid null references icecream_erp.branch_shift_closes (id),
  status text not null default 'DRAFT',
  created_by uuid null references icecream_erp.users (id),
  posted_by uuid null references icecream_erp.users (id),
  posted_at timestamptz null,
  rejected_by uuid null references icecream_erp.users (id),
  rejected_at timestamptz null,
  rejection_reason text null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_branch_expenses_org_date
  on icecream_erp.branch_expenses (organization_id, expense_date desc);

create index if not exists idx_branch_expenses_branch_date
  on icecream_erp.branch_expenses (branch_id, expense_date desc);

create index if not exists idx_branch_expenses_shift_close
  on icecream_erp.branch_expenses (shift_close_id);

create index if not exists idx_branch_expenses_status
  on icecream_erp.branch_expenses (organization_id, status);

alter table icecream_erp.branch_expenses enable row level security;

drop policy if exists branch_expenses_service_role_full_access on icecream_erp.branch_expenses;
create policy branch_expenses_service_role_full_access
  on icecream_erp.branch_expenses
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists branch_expenses_deny_anon on icecream_erp.branch_expenses;
create policy branch_expenses_deny_anon
  on icecream_erp.branch_expenses
  for all
  to anon
  using (false)
  with check (false);

grant all on icecream_erp.branch_expenses to service_role;

notify pgrst, 'reload schema';
