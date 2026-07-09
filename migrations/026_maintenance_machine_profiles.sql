create table if not exists icecream_erp.machine_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id) on delete cascade,
  machine_id uuid not null unique references icecream_erp.machines(id) on delete cascade,
  branch_name text,
  serial_number text,
  manufacturer text,
  model text,
  purchase_cost numeric(18, 2) not null default 0,
  health_status text,
  service_interval_days integer not null default 0,
  service_provider text,
  last_service_cost numeric(18, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_machine_profiles_org on icecream_erp.machine_profiles(organization_id);
create index if not exists idx_machine_profiles_machine on icecream_erp.machine_profiles(machine_id);
