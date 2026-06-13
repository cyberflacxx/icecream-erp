type Primitive = string | number | boolean | null | undefined;

export const TEST_CATEGORIES = [
  'Authentication and Security',
  'Procurement',
  'Stores and Inventory',
  'Production Planning',
  'Batch Production',
  'Sales and Dispatch',
  'Branch Operations',
  'Finance',
  'Quality Control',
  'HR and Productivity',
  'Reports',
  'Workflows and Approvals',
  'Notifications',
  'Excel Import and Export',
  'Data Migration',
  'Backup and Health',
  'End-to-End Testing',
] as const;

export const TEST_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'PASSED',
  'FAILED',
  'BLOCKED',
  'RETEST_REQUIRED',
  'COMPLETED',
] as const;

export const BUG_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'FIXED',
  'RETESTING',
  'CLOSED',
  'REJECTED',
  'DEFERRED',
] as const;

export const BUG_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const UAT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'SIGNED_OFF', 'REWORK_REQUIRED'] as const;
export const DOCUMENTATION_TYPES = ['User Manual', 'Admin Manual', 'Technical Manual', 'Training Guide', 'Release Notes', 'Handover Document'] as const;

export function normalizeTestingValue(value: unknown) {
  return String(value ?? '').trim();
}

export function normalizeTestingCode(value: unknown) {
  return normalizeTestingValue(value).toUpperCase().replace(/\s+/g, '_');
}

export function toTestingNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseSteps(value: unknown | Array<string>) {
  if (Array.isArray(value)) return value.map((item) => normalizeTestingValue(item)).filter(Boolean);
  return normalizeTestingValue(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateTestCase(input: {
  moduleName?: unknown;
  scenario?: unknown;
  testSteps?: unknown | Array<string>;
  expectedResult?: unknown;
}) {
  if (!normalizeTestingValue(input.moduleName)) return 'module is required.';
  if (!normalizeTestingValue(input.scenario)) return 'scenario is required.';
  if (parseSteps(input.testSteps).length === 0) return 'steps are required.';
  if (!normalizeTestingValue(input.expectedResult)) return 'expected result is required.';
  return null;
}

export function validateTestRun(input: {
  testCaseId?: unknown;
  testerName?: unknown;
  actualResult?: unknown;
  status?: unknown;
  comments?: unknown;
}) {
  if (!normalizeTestingValue(input.testCaseId)) return 'test case is required.';
  if (!normalizeTestingValue(input.testerName)) return 'tester is required.';
  if (!normalizeTestingValue(input.actualResult)) return 'actual result is required.';
  if (!normalizeTestingValue(input.status)) return 'status is required.';
  if (normalizeTestingCode(input.status) === 'FAILED' && !normalizeTestingValue(input.comments)) {
    return 'comments are required for a failed test run.';
  }
  return null;
}

export function validateBugReport(input: {
  title?: unknown;
  moduleName?: unknown;
  description?: unknown;
  priority?: unknown;
  severity?: unknown;
}) {
  if (!normalizeTestingValue(input.title)) return 'title is required.';
  if (!normalizeTestingValue(input.moduleName)) return 'module is required.';
  if (!normalizeTestingValue(input.description)) return 'description is required.';
  if (!normalizeTestingValue(input.priority)) return 'priority is required.';
  if (!normalizeTestingValue(input.severity)) return 'severity is required.';
  return null;
}

export function validateUatSession(input: {
  sessionDate?: unknown;
  moduleName?: unknown;
  participants?: Array<Record<string, unknown>> | unknown;
}) {
  if (!normalizeTestingValue(input.sessionDate)) return 'date is required.';
  if (!normalizeTestingValue(input.moduleName)) return 'module is required.';
  if (Array.isArray(input.participants)) {
    if (input.participants.length === 0) return 'participants are required.';
  } else if (!normalizeTestingValue(input.participants)) {
    return 'participants are required.';
  }
  return null;
}

export function validateTrainingSession(input: {
  trainingTitle?: unknown;
  trainerName?: unknown;
  moduleName?: unknown;
  sessionDate?: unknown;
}) {
  if (!normalizeTestingValue(input.trainingTitle)) return 'training title is required.';
  if (!normalizeTestingValue(input.trainerName)) return 'trainer is required.';
  if (!normalizeTestingValue(input.moduleName)) return 'module is required.';
  if (!normalizeTestingValue(input.sessionDate)) return 'date is required.';
  return null;
}

export function validateDocumentationRecord(input: {
  title?: unknown;
  documentType?: unknown;
  version?: unknown;
  content?: unknown;
}) {
  if (!normalizeTestingValue(input.title)) return 'title is required.';
  if (!normalizeTestingValue(input.documentType)) return 'document type is required.';
  if (!normalizeTestingValue(input.version)) return 'version is required.';
  if (!normalizeTestingValue(input.content)) return 'content is required.';
  return null;
}

export function validateReleaseNote(input: {
  releaseVersion?: unknown;
  releaseDate?: unknown;
}) {
  if (!normalizeTestingValue(input.releaseVersion)) return 'release version is required.';
  if (!normalizeTestingValue(input.releaseDate)) return 'release date is required.';
  return null;
}

export function shouldCreateBugForFailedTest(status: unknown) {
  return normalizeTestingCode(status) === 'FAILED';
}

export function hasOpenCriticalBugs(bugs: Array<{ severity?: Primitive; status?: Primitive }>) {
  return bugs.some(
    (bug) =>
      normalizeTestingCode(bug.severity) === 'CRITICAL' &&
      !['CLOSED', 'REJECTED'].includes(normalizeTestingCode(bug.status)),
  );
}

export function canSignOffUat(bugs: Array<{ severity?: Primitive; status?: Primitive }>) {
  return !hasOpenCriticalBugs(bugs);
}

export function canApproveHandover(items: Array<{ isCritical?: boolean; status?: Primitive; approvalStatus?: Primitive }>) {
  return !items.some(
    (item) =>
      Boolean(item.isCritical) &&
      normalizeTestingCode(item.status) !== 'COMPLETED' &&
      normalizeTestingCode(item.approvalStatus) !== 'APPROVED',
  );
}

export function buildCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

export function buildTestingNumber(prefix: string, sequence: number) {
  return `${prefix}-${String(sequence).padStart(5, '0')}`;
}

export function getSeedTestCases() {
  const records = [
    ['Authentication and Security', 'security', 'Login and logout'],
    ['Authentication and Security', 'security', 'Session timeout'],
    ['Authentication and Security', 'security', 'Role-based access'],
    ['Procurement', 'procurement', 'Supplier creation'],
    ['Procurement', 'procurement', 'Purchase order approval'],
    ['Stores and Inventory', 'inventory', 'Goods receiving'],
    ['Stores and Inventory', 'inventory', 'Supplier shortage'],
    ['Stores and Inventory', 'inventory', 'Stock movement'],
    ['Stores and Inventory', 'inventory', 'Warehouse transfer'],
    ['Production Planning', 'production', 'Production plan'],
    ['Production Planning', 'production', 'Material request'],
    ['Batch Production', 'production', 'Batch production'],
    ['Quality Control', 'quality', 'QC inspection'],
    ['Stores and Inventory', 'inventory', 'Finished goods transfer'],
    ['Sales and Dispatch', 'sales', 'Customer creation'],
    ['Sales and Dispatch', 'sales', 'Sales invoice approval'],
    ['Sales and Dispatch', 'sales', 'Dispatch against approved invoice'],
    ['Sales and Dispatch', 'sales', 'Customer payment'],
    ['Branch Operations', 'branches', 'Branch stock receipt'],
    ['Branch Operations', 'branches', 'Branch sale'],
    ['Branch Operations', 'branches', 'Branch shift closure'],
    ['Reports', 'reports', 'Branch profitability report'],
    ['Finance', 'finance', 'Finance journal posting'],
    ['Finance', 'finance', 'Accounts receivable'],
    ['Finance', 'finance', 'Accounts payable'],
    ['Finance', 'finance', 'Production costing'],
    ['Finance', 'finance', 'Stock valuation'],
    ['Stores and Inventory', 'inventory', 'Goods return voucher'],
    ['Sales and Dispatch', 'sales', 'Credit note'],
    ['Excel Import and Export', 'settings', 'Excel import'],
    ['Excel Import and Export', 'settings', 'Excel export'],
    ['Backup and Health', 'admin', 'Backup log'],
    ['Backup and Health', 'admin', 'Deployment readiness'],
    ['Reports', 'reports', 'Audit log report'],
  ];

  return records.map(([category, moduleName, scenario], index) => ({
    category,
    moduleName,
    scenario,
    preconditions: 'User is authenticated and has the required role assignment.',
    testSteps: ['Open the module', `Execute the ${scenario.toLowerCase()} flow`, 'Verify status, audit trail, and notifications'],
    expectedResult: `${scenario} completes successfully and updates related records correctly.`,
    priority: index < 10 ? 'HIGH' : 'MEDIUM',
    relatedRole: 'Assigned tester',
    workflowStage: 'UAT',
  }));
}

export function getDocumentationTemplates() {
  return [
    ['User Manual', 'User Manual'],
    ['Administrator Manual', 'Admin Manual'],
    ['Finance User Guide', 'User Manual'],
    ['Stores User Guide', 'User Manual'],
    ['Production User Guide', 'User Manual'],
    ['Branch Controller Guide', 'User Manual'],
    ['Sales User Guide', 'User Manual'],
    ['Procurement User Guide', 'User Manual'],
    ['Quality Control Guide', 'User Manual'],
    ['Technical Setup Guide', 'Technical Manual'],
    ['Backup and Restore Guide', 'Technical Manual'],
    ['Go-Live Checklist', 'Handover Document'],
    ['Troubleshooting Guide', 'Technical Manual'],
  ].map(([title, documentType]) => ({
    title,
    documentType,
    moduleName: 'testing',
    version: 'v1.0',
    content: `${title}\n\nPurpose\n- Describe the procedure clearly.\n\nAudience\n- Relevant ERP users.\n\nSteps\n- Update this template with the live operating procedure.`,
    status: 'DRAFT',
  }));
}

export function getDefaultHandoverChecklist() {
  return [
    ['Testing', 'Complete core end-to-end workflow execution', true],
    ['UAT', 'Obtain UAT management sign-off', true],
    ['Training', 'Record attendance for all operational roles', true],
    ['Documentation', 'Publish signed user and admin manuals', true],
    ['Deployment', 'Confirm backups and restore test results', true],
    ['Support', 'Share support contacts and escalation path', false],
  ].map(([category, task, isCritical]) => ({
    category,
    task,
    isCritical,
    ownerName: 'Project Owner',
    remarks: '',
  }));
}
