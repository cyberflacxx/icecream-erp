create table if not exists icecream_erp.posting_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  posting_action text not null,
  required_status_before_posting text not null default 'APPROVED',
  business_effect text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_posting_rules_lookup
  on icecream_erp.posting_rules (organization_id, module_name, document_type, is_active);

create table if not exists icecream_erp.posting_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  posting_action text not null,
  posting_status text not null default 'PENDING',
  posted_by uuid null,
  posted_at timestamptz null,
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posting_logs_document
  on icecream_erp.posting_logs (organization_id, module_name, document_type, document_id, posting_status);

create table if not exists icecream_erp.document_locks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  lock_reason text not null,
  locked_by uuid null,
  locked_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_document_locks_active_document
  on icecream_erp.document_locks (organization_id, document_type, document_id, is_active);

create table if not exists icecream_erp.workflow_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  action text not null,
  from_status text null,
  to_status text null,
  action_comment text null,
  actor_id uuid null,
  action_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_history_document
  on icecream_erp.workflow_history (organization_id, document_type, document_id, action_at desc);

create table if not exists icecream_erp.workflow_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  comment text not null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflow_comments_document
  on icecream_erp.workflow_comments (organization_id, document_type, document_id, created_at desc);

create table if not exists icecream_erp.correction_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  correction_reason text not null,
  requested_changes jsonb not null default '{}'::jsonb,
  status text not null default 'REQUESTED',
  approved_by uuid null,
  approved_at timestamptz null,
  rejected_by uuid null,
  rejected_at timestamptz null,
  rejection_reason text null,
  applied_by uuid null,
  applied_at timestamptz null,
  closed_at timestamptz null,
  closed_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_correction_requests_lookup
  on icecream_erp.correction_requests (organization_id, module_name, document_type, status, requested_by);

create table if not exists icecream_erp.correction_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  correction_request_id uuid not null references icecream_erp.correction_requests(id) on delete cascade,
  action text not null,
  action_comment text null,
  action_by uuid null,
  action_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_correction_actions_request
  on icecream_erp.correction_actions (organization_id, correction_request_id, action_at desc);

create table if not exists icecream_erp.reversal_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  reversal_document_id text null,
  reversal_reason text not null,
  status text not null default 'REQUESTED',
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  approved_by uuid null,
  approved_at timestamptz null,
  posted_by uuid null,
  posted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reversal_logs_lookup
  on icecream_erp.reversal_logs (organization_id, module_name, document_type, status, requested_by);

create table if not exists icecream_erp.void_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  document_reference text null,
  void_reason text not null,
  status text not null default 'REQUESTED',
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  approved_by uuid null,
  approved_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_void_logs_lookup
  on icecream_erp.void_logs (organization_id, module_name, document_type, status, requested_by);

create table if not exists icecream_erp.workflow_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text not null,
  recipient_user_id uuid null,
  notification_type text not null,
  status text not null default 'PENDING',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);

create index if not exists idx_workflow_notifications_lookup
  on icecream_erp.workflow_notifications (organization_id, recipient_user_id, status, created_at desc);

create table if not exists icecream_erp.workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  from_status text not null,
  to_status text not null,
  transition_action text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflow_transitions_lookup
  on icecream_erp.workflow_transitions (organization_id, module_name, document_type, from_status, is_active);

alter table if exists icecream_erp.approval_workflows
  add column if not exists module_name text null,
  add column if not exists document_type text null,
  add column if not exists action_name text null,
  add column if not exists self_approval_allowed boolean not null default false,
  add column if not exists minimum_amount numeric(18,2) null,
  add column if not exists maximum_amount numeric(18,2) null,
  add column if not exists created_by uuid null,
  add column if not exists updated_by uuid null;

create index if not exists idx_approval_workflows_workflow_lookup
  on icecream_erp.approval_workflows (organization_id, module_name, document_type, action_name, is_active);

alter table if exists icecream_erp.approval_workflow_steps
  add column if not exists step_name text null,
  add column if not exists approval_level integer null,
  add column if not exists minimum_amount numeric(18,2) null,
  add column if not exists maximum_amount numeric(18,2) null,
  add column if not exists approver_role_name text null,
  add column if not exists is_active boolean not null default true;

create index if not exists idx_approval_workflow_steps_lookup
  on icecream_erp.approval_workflow_steps (workflow_id, is_active, approval_level);

alter table if exists icecream_erp.approval_requests
  add column if not exists module_name text null,
  add column if not exists document_type text null,
  add column if not exists document_reference text null,
  add column if not exists request_reason text null,
  add column if not exists approver_role_id uuid null,
  add column if not exists approver_role_name text null,
  add column if not exists approver_user_id uuid null,
  add column if not exists approval_date timestamptz null,
  add column if not exists submitted_at timestamptz null,
  add column if not exists submitted_by uuid null,
  add column if not exists rejected_at timestamptz null,
  add column if not exists rejected_by uuid null,
  add column if not exists rejected_reason text null;

create index if not exists idx_approval_requests_workflow_lookup
  on icecream_erp.approval_requests (organization_id, module_name, document_type, status, requested_by);

alter table if exists icecream_erp.approval_actions
  add column if not exists document_type text null,
  add column if not exists document_id text null,
  add column if not exists ip_address inet null,
  add column if not exists action_status text null,
  add column if not exists action_comment text null;

create index if not exists idx_approval_actions_document
  on icecream_erp.approval_actions (document_type, document_id, acted_at desc);
