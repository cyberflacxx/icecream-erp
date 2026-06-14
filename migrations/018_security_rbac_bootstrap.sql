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

notify pgrst;
