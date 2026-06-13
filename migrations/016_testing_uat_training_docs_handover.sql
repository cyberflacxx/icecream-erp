ALTER TABLE IF EXISTS icecream_erp.permissions
  ADD COLUMN IF NOT EXISTS module text;

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_suites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  suite_name text NOT NULL,
  module_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  test_suite_id uuid REFERENCES icecream_erp.testing_test_suites(id) ON DELETE SET NULL,
  module_name text NOT NULL,
  scenario_name text NOT NULL,
  preconditions text,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  test_suite_id uuid REFERENCES icecream_erp.testing_test_suites(id) ON DELETE SET NULL,
  test_scenario_id uuid REFERENCES icecream_erp.testing_test_scenarios(id) ON DELETE SET NULL,
  test_case_number text NOT NULL,
  category text NOT NULL,
  module_name text NOT NULL,
  scenario text NOT NULL,
  preconditions text,
  test_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_result text NOT NULL,
  actual_result text,
  priority text NOT NULL DEFAULT 'MEDIUM',
  assigned_tester_id uuid,
  assigned_tester_name text,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  related_role text,
  workflow_stage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  UNIQUE (organization_id, test_case_number)
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  test_case_id uuid NOT NULL REFERENCES icecream_erp.testing_test_cases(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  instruction text NOT NULL,
  expected_result text,
  actual_result text,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  test_case_id uuid NOT NULL REFERENCES icecream_erp.testing_test_cases(id) ON DELETE CASCADE,
  test_date date NOT NULL,
  tester_id uuid,
  tester_name text NOT NULL,
  actual_result text NOT NULL,
  status text NOT NULL,
  comments text,
  evidence_attachment jsonb,
  related_bug_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  test_run_id uuid NOT NULL REFERENCES icecream_erp.testing_test_runs(id) ON DELETE CASCADE,
  result_summary text NOT NULL,
  status text NOT NULL,
  evidence_attachment jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  bug_number text NOT NULL,
  module_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  steps_to_reproduce text,
  expected_result text,
  actual_result text,
  priority text NOT NULL DEFAULT 'MEDIUM',
  severity text NOT NULL DEFAULT 'MEDIUM',
  assigned_to uuid,
  assigned_to_name text,
  reported_by uuid,
  reported_by_name text,
  related_test_case_id uuid REFERENCES icecream_erp.testing_test_cases(id) ON DELETE SET NULL,
  related_test_run_id uuid REFERENCES icecream_erp.testing_test_runs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN',
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  UNIQUE (organization_id, bug_number)
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_bug_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  bug_report_id uuid NOT NULL REFERENCES icecream_erp.testing_bug_reports(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_bug_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  bug_report_id uuid NOT NULL REFERENCES icecream_erp.testing_bug_reports(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_reference text NOT NULL,
  file_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_uat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  session_name text NOT NULL,
  module_name text NOT NULL,
  session_date date NOT NULL,
  test_scope text,
  outcome text,
  feedback text,
  sign_off_status text NOT NULL DEFAULT 'PLANNED',
  status text NOT NULL DEFAULT 'PLANNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  signed_off_at timestamptz,
  signed_off_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_uat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  uat_session_id uuid NOT NULL REFERENCES icecream_erp.testing_uat_sessions(id) ON DELETE CASCADE,
  participant_name text NOT NULL,
  participant_role text NOT NULL,
  participant_user_id uuid,
  attendance_status text NOT NULL DEFAULT 'PLANNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_uat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  uat_session_id uuid NOT NULL REFERENCES icecream_erp.testing_uat_sessions(id) ON DELETE CASCADE,
  participant_name text NOT NULL,
  feedback_text text NOT NULL,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_uat_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  uat_session_id uuid NOT NULL REFERENCES icecream_erp.testing_uat_sessions(id) ON DELETE CASCADE,
  signed_by uuid,
  signed_by_name text NOT NULL,
  role_name text NOT NULL,
  sign_off_date date NOT NULL,
  decision text NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  signed_off_at timestamptz,
  signed_off_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_training_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  module_name text NOT NULL,
  material_type text NOT NULL,
  content text NOT NULL,
  version text NOT NULL DEFAULT 'v1.0',
  status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  training_title text NOT NULL,
  module_name text NOT NULL,
  trainer_name text NOT NULL,
  trainer_user_id uuid,
  session_date date NOT NULL,
  remarks text,
  status text NOT NULL DEFAULT 'PLANNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_training_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  training_session_id uuid NOT NULL REFERENCES icecream_erp.testing_training_sessions(id) ON DELETE CASCADE,
  attendee_name text NOT NULL,
  attendee_role text NOT NULL,
  attendee_user_id uuid,
  attendance_status text NOT NULL DEFAULT 'PENDING',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  document_type text NOT NULL,
  version text NOT NULL,
  module_name text NOT NULL,
  content text NOT NULL,
  author_name text NOT NULL,
  author_user_id uuid,
  reviewed_by text,
  status text NOT NULL DEFAULT 'DRAFT',
  last_updated_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_release_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  release_version text NOT NULL,
  release_date date NOT NULL,
  features_added text NOT NULL,
  bugs_fixed text NOT NULL,
  known_issues text,
  deployment_notes text,
  approved_by uuid,
  approved_by_name text,
  approval_status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  closed_at timestamptz,
  closed_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_handover_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  category text NOT NULL,
  task text NOT NULL,
  owner_name text NOT NULL,
  owner_user_id uuid,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  remarks text,
  is_critical boolean NOT NULL DEFAULT false,
  completed_date date,
  approval_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid
);

CREATE TABLE IF NOT EXISTS icecream_erp.testing_handover_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  handover_checklist_id uuid NOT NULL REFERENCES icecream_erp.testing_handover_checklist(id) ON DELETE CASCADE,
  approved_by uuid,
  approved_by_name text NOT NULL,
  approval_date date NOT NULL,
  decision text NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  signed_off_at timestamptz,
  signed_off_by uuid
);

CREATE INDEX IF NOT EXISTS idx_testing_test_cases_module ON icecream_erp.testing_test_cases(organization_id, module_name);
CREATE INDEX IF NOT EXISTS idx_testing_test_cases_status ON icecream_erp.testing_test_cases(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_testing_test_cases_priority ON icecream_erp.testing_test_cases(organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_testing_test_runs_date ON icecream_erp.testing_test_runs(organization_id, test_date);
CREATE INDEX IF NOT EXISTS idx_testing_bugs_module ON icecream_erp.testing_bug_reports(organization_id, module_name);
CREATE INDEX IF NOT EXISTS idx_testing_bugs_status ON icecream_erp.testing_bug_reports(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_testing_bugs_priority ON icecream_erp.testing_bug_reports(organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_testing_bugs_assigned ON icecream_erp.testing_bug_reports(organization_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_testing_uat_date ON icecream_erp.testing_uat_sessions(organization_id, session_date);
CREATE INDEX IF NOT EXISTS idx_testing_docs_type ON icecream_erp.testing_documents(organization_id, document_type);
CREATE INDEX IF NOT EXISTS idx_testing_handover_status ON icecream_erp.testing_handover_checklist(organization_id, status);
