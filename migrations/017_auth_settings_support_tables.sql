create table if not exists icecream_erp.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references icecream_erp.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user
  on icecream_erp.password_reset_tokens (user_account_id);
create index if not exists idx_password_reset_tokens_expires_at
  on icecream_erp.password_reset_tokens (expires_at);

create table if not exists icecream_erp.document_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id) on delete cascade,
  reference_type text not null,
  reference_id text not null,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  file_size integer not null default 0,
  uploaded_by uuid null references icecream_erp.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_document_files_organization
  on icecream_erp.document_files (organization_id);
create index if not exists idx_document_files_uploaded_by
  on icecream_erp.document_files (uploaded_by);
create index if not exists idx_document_files_reference
  on icecream_erp.document_files (reference_type, reference_id);
create index if not exists idx_document_files_file_name
  on icecream_erp.document_files (file_name);

alter table if exists icecream_erp.password_reset_tokens enable row level security;
alter table if exists icecream_erp.document_files enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'password_reset_tokens'
      and policyname = 'password_reset_tokens_service_role_full_access'
  ) then
    create policy password_reset_tokens_service_role_full_access
      on icecream_erp.password_reset_tokens
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'password_reset_tokens'
      and policyname = 'password_reset_tokens_deny_anon'
  ) then
    create policy password_reset_tokens_deny_anon
      on icecream_erp.password_reset_tokens
      for all
      to anon
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'document_files'
      and policyname = 'document_files_service_role_full_access'
  ) then
    create policy document_files_service_role_full_access
      on icecream_erp.document_files
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'document_files'
      and policyname = 'document_files_deny_anon'
  ) then
    create policy document_files_deny_anon
      on icecream_erp.document_files
      for all
      to anon
      using (false)
      with check (false);
  end if;
end $$;

grant all on table icecream_erp.password_reset_tokens to service_role;
grant all on table icecream_erp.document_files to service_role;
