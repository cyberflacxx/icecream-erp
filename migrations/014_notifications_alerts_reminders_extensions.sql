alter table if exists icecream_erp.notifications
  add column if not exists module_name text null,
  add column if not exists event_type text null,
  add column if not exists severity text not null default 'INFO',
  add column if not exists status text not null default 'PENDING',
  add column if not exists channel text not null default 'IN_APP',
  add column if not exists link text null,
  add column if not exists branch_id uuid null,
  add column if not exists warehouse_id uuid null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists sent_at timestamptz null,
  add column if not exists sent_by uuid null,
  add column if not exists read_at timestamptz null,
  add column if not exists read_by uuid null,
  add column if not exists dismissed_at timestamptz null,
  add column if not exists dismissed_by uuid null,
  add column if not exists failed_at timestamptz null,
  add column if not exists failure_reason text null;

create index if not exists idx_notifications_module_status
  on icecream_erp.notifications (organization_id, user_profile_id, module_name, status, severity, created_at desc);

create index if not exists idx_notifications_document_lookup
  on icecream_erp.notifications (organization_id, reference_type, reference_id, status);

create table if not exists icecream_erp.notification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rule_name text not null,
  module_name text not null,
  event_type text not null,
  severity text not null default 'MEDIUM',
  recipient_role_name text null,
  recipient_user_id uuid null,
  recipient_branch_id uuid null,
  recipient_warehouse_id uuid null,
  channel text not null default 'IN_APP',
  template_id uuid null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_notification_rules_lookup
  on icecream_erp.notification_rules (organization_id, module_name, event_type, is_active);

create table if not exists icecream_erp.notification_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_name text not null,
  module_name text not null,
  event_type text not null,
  title_template text not null,
  message_template text not null,
  channel text not null default 'IN_APP',
  supported_placeholders jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_notification_templates_lookup
  on icecream_erp.notification_templates (organization_id, module_name, event_type, channel, is_active);

create table if not exists icecream_erp.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_profile_id uuid not null,
  module_name text not null,
  channel text not null default 'IN_APP',
  enabled boolean not null default true,
  minimum_severity text not null default 'INFO',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create unique index if not exists idx_notification_preferences_unique
  on icecream_erp.notification_preferences (organization_id, user_profile_id, module_name, channel);

create table if not exists icecream_erp.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  notification_id uuid null,
  recipient_user_id uuid null,
  channel text not null,
  delivery_status text not null default 'PENDING',
  sent_at timestamptz null,
  failure_reason text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notification_delivery_logs_lookup
  on icecream_erp.notification_delivery_logs (organization_id, recipient_user_id, channel, delivery_status, created_at desc);

create table if not exists icecream_erp.escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  event_type text not null,
  initial_recipient_role_name text not null,
  escalation_recipient_role_name text not null,
  escalation_delay_minutes integer not null,
  severity text not null default 'HIGH',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_escalation_rules_lookup
  on icecream_erp.escalation_rules (organization_id, module_name, event_type, is_active);

create table if not exists icecream_erp.escalation_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  notification_id uuid not null,
  escalation_rule_id uuid null,
  escalation_recipient_user_id uuid null,
  escalated_at timestamptz not null default now(),
  escalation_status text not null default 'PENDING',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_escalation_logs_lookup
  on icecream_erp.escalation_logs (organization_id, notification_id, escalated_at desc);

create table if not exists icecream_erp.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  reminder_event text not null,
  due_time_rule text not null,
  recipient_role_name text not null,
  message text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_reminder_rules_lookup
  on icecream_erp.reminder_rules (organization_id, module_name, document_type, is_active);

create table if not exists icecream_erp.reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_profile_id uuid not null,
  module_name text not null,
  document_type text not null,
  document_id text null,
  due_date timestamptz not null,
  reminder_event text not null,
  status text not null default 'PENDING',
  message text not null,
  branch_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  sent_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  failure_reason text null
);

create index if not exists idx_reminders_lookup
  on icecream_erp.reminders (organization_id, user_profile_id, module_name, status, due_date);

create table if not exists icecream_erp.communication_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  notification_id uuid null,
  channel text not null,
  action text not null,
  recipient_user_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_communication_audit_logs_lookup
  on icecream_erp.communication_audit_logs (organization_id, channel, action, created_at desc);
