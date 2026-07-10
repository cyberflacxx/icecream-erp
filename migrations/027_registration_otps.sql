create table if not exists icecream_erp.registration_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  id_number text not null,
  role_id text not null,
  otp_hash text not null,
  payload_encrypted text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_registration_otps_email
  on icecream_erp.registration_otps (email);
create index if not exists idx_registration_otps_expires_at
  on icecream_erp.registration_otps (expires_at);

alter table if exists icecream_erp.registration_otps enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'registration_otps'
      and policyname = 'registration_otps_service_role_full_access'
  ) then
    create policy registration_otps_service_role_full_access
      on icecream_erp.registration_otps
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'registration_otps'
      and policyname = 'registration_otps_deny_anon'
  ) then
    create policy registration_otps_deny_anon
      on icecream_erp.registration_otps
      for all
      to anon
      using (false)
      with check (false);
  end if;
end $$;

grant all on table icecream_erp.registration_otps to service_role;
