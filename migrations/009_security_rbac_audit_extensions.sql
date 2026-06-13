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
