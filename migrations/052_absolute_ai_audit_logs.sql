create table if not exists icecream_erp.ai_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id) on delete cascade,
  user_profile_id uuid null references icecream_erp.users(id) on delete set null,
  user_account_id uuid null references icecream_erp.user_accounts(id) on delete set null,
  session_id text null,
  conversation_id text null,
  request_id text not null,
  provider text not null default 'gemini',
  model text null,
  user_prompt text not null,
  tool_name text null,
  sanitized_tool_arguments jsonb null,
  tool_result_status text not null,
  response_summary text null,
  usage_metadata jsonb null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_ai_audit_logs_org_created_at
  on icecream_erp.ai_audit_logs (organization_id, created_at desc);

create index if not exists idx_ai_audit_logs_request_id
  on icecream_erp.ai_audit_logs (request_id);

create index if not exists idx_ai_audit_logs_conversation_id
  on icecream_erp.ai_audit_logs (conversation_id);

alter table icecream_erp.ai_audit_logs enable row level security;

drop policy if exists deny_anon on icecream_erp.ai_audit_logs;
create policy deny_anon on icecream_erp.ai_audit_logs
  for all
  to anon
  using (false);

drop policy if exists service_role_full_access on icecream_erp.ai_audit_logs;
create policy service_role_full_access on icecream_erp.ai_audit_logs
  for all
  to service_role
  using (true)
  with check (true);

grant all on table icecream_erp.ai_audit_logs to service_role;

notify pgrst, 'reload schema';
