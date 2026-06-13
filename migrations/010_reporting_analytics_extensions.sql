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
