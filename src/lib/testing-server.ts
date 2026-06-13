import type { AuthContext } from '@/lib/api-auth';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  buildCsv,
  buildTestingNumber,
  canApproveHandover,
  canSignOffUat,
  getDefaultHandoverChecklist,
  getDocumentationTemplates,
  getSeedTestCases,
  normalizeTestingCode,
  normalizeTestingValue,
  parseSteps,
  shouldCreateBugForFailedTest,
  validateBugReport,
  validateDocumentationRecord,
  validateReleaseNote,
  validateTestCase,
  validateTestRun,
  validateTrainingSession,
  validateUatSession,
} from '@/lib/testing';

type Row = Record<string, unknown>;

function testingService() {
  return createServiceRoleClient().schema('icecream_erp');
}

async function nextNumber(table: string, column: string, prefix: string) {
  const { count, error } = await testingService().from(table).select(column, { count: 'exact', head: true });
  if (error) throw error;
  return buildTestingNumber(prefix, (count ?? 0) + 1);
}

async function ensureTestingSeeds(ctx: AuthContext) {
  const service = testingService();
  const [testCases, documents, handoverItems] = await Promise.all([
    service.from('testing_test_cases').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId),
    service.from('testing_documents').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId),
    service.from('testing_handover_checklist').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId),
  ]);
  if (testCases.error) throw testCases.error;
  if (documents.error) throw documents.error;
  if (handoverItems.error) throw handoverItems.error;

  if ((testCases.count ?? 0) === 0) {
    const payload = getSeedTestCases().map((item, index) => ({
      organization_id: ctx.organizationId,
      test_case_number: buildTestingNumber('TC', index + 1),
      category: item.category,
      module_name: item.moduleName,
      scenario: item.scenario,
      preconditions: item.preconditions,
      test_steps: item.testSteps,
      expected_result: item.expectedResult,
      priority: item.priority,
      assigned_tester_name: item.relatedRole,
      status: 'NOT_STARTED',
      related_role: item.relatedRole,
      workflow_stage: item.workflowStage,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }));
    const { error } = await service.from('testing_test_cases').insert(payload);
    if (error) throw error;
  }

  if ((documents.count ?? 0) === 0) {
    const payload = getDocumentationTemplates().map((item) => ({
      organization_id: ctx.organizationId,
      title: item.title,
      document_type: item.documentType,
      version: item.version,
      module_name: item.moduleName,
      content: item.content,
      author_name: 'System Seed',
      status: item.status,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }));
    const { error } = await service.from('testing_documents').insert(payload);
    if (error) throw error;
  }

  if ((handoverItems.count ?? 0) === 0) {
    const payload = getDefaultHandoverChecklist().map((item) => ({
      organization_id: ctx.organizationId,
      category: item.category,
      task: item.task,
      owner_name: item.ownerName,
      status: 'NOT_STARTED',
      approval_status: 'PENDING',
      remarks: item.remarks,
      is_critical: item.isCritical,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }));
    const { error } = await service.from('testing_handover_checklist').insert(payload);
    if (error) throw error;
  }
}

export async function getTestingDashboard(ctx: AuthContext) {
  await ensureTestingSeeds(ctx);
  const service = testingService();
  const [testCases, bugs, uat, handover] = await Promise.all([
    service.from('testing_test_cases').select('status', { count: 'exact' }).eq('organization_id', ctx.organizationId),
    service.from('testing_bug_reports').select('status, severity', { count: 'exact' }).eq('organization_id', ctx.organizationId),
    service.from('testing_uat_sessions').select('status, sign_off_status').eq('organization_id', ctx.organizationId).order('session_date', { ascending: false }).limit(5),
    service.from('testing_handover_checklist').select('status, approval_status, is_critical').eq('organization_id', ctx.organizationId),
  ]);
  if (testCases.error) throw testCases.error;
  if (bugs.error) throw bugs.error;
  if (uat.error) throw uat.error;
  if (handover.error) throw handover.error;

  const cases = (testCases.data ?? []) as Row[];
  const bugRows = (bugs.data ?? []) as Row[];
  const handoverRows = (handover.data ?? []) as Row[];
  const total = cases.length;
  const passed = cases.filter((row) => normalizeTestingCode(row.status as string) === 'PASSED').length;
  const failed = cases.filter((row) => normalizeTestingCode(row.status as string) === 'FAILED').length;
  const blocked = cases.filter((row) => normalizeTestingCode(row.status as string) === 'BLOCKED').length;
  const retest = cases.filter((row) => normalizeTestingCode(row.status as string) === 'RETEST_REQUIRED').length;
  const openBugs = bugRows.filter((row) => !['CLOSED', 'REJECTED'].includes(normalizeTestingCode(row.status as string))).length;
  const criticalBugs = bugRows.filter((row) => normalizeTestingCode(row.severity as string) === 'CRITICAL' && !['CLOSED', 'REJECTED'].includes(normalizeTestingCode(row.status as string))).length;
  const readiness = canApproveHandover(
    handoverRows.map((row) => ({
      approvalStatus: row.approval_status as string,
      isCritical: Boolean(row.is_critical),
      status: row.status as string,
    })),
  );

  return {
    totalTestCases: total,
    passedTestCases: passed,
    failedTestCases: failed,
    blockedTestCases: blocked,
    openBugs,
    criticalBugs,
    retestRequired: retest,
    uatStatus: (uat.data?.[0] as Row | undefined)?.sign_off_status ?? 'PLANNED',
    handoverReadiness: readiness ? 'READY' : 'BLOCKED',
  };
}

export async function listTestCases(ctx: AuthContext) {
  await ensureTestingSeeds(ctx);
  const { data, error } = await testingService().from('testing_test_cases').select('*').eq('organization_id', ctx.organizationId).order('test_case_number');
  if (error) throw error;
  return data ?? [];
}

export async function createTestCase(ctx: AuthContext, body: Record<string, unknown>) {
  const validation = validateTestCase(body);
  if (validation) throw new Error(validation);
  const number = await nextNumber('testing_test_cases', 'id', 'TC');
  const payload = {
    organization_id: ctx.organizationId,
    test_case_number: number,
    category: normalizeTestingValue(body.category) || 'End-to-End Testing',
    module_name: normalizeTestingValue(body.moduleName),
    scenario: normalizeTestingValue(body.scenario),
    preconditions: normalizeTestingValue(body.preconditions) || null,
    test_steps: parseSteps(body.testSteps as string | Array<string>),
    expected_result: normalizeTestingValue(body.expectedResult),
    actual_result: normalizeTestingValue(body.actualResult) || null,
    priority: normalizeTestingCode(body.priority as string || 'MEDIUM'),
    assigned_tester_id: body.assignedTesterId ? String(body.assignedTesterId) : null,
    assigned_tester_name: normalizeTestingValue(body.assignedTesterName) || null,
    status: normalizeTestingCode(body.status as string || 'NOT_STARTED'),
    related_role: normalizeTestingValue(body.relatedRole) || null,
    workflow_stage: normalizeTestingValue(body.workflowStage) || null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  };
  const { data, error } = await testingService().from('testing_test_cases').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateTestCase(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const updates: Row = { updated_by: ctx.userId, updated_at: new Date().toISOString() };
  if (body.category !== undefined) updates.category = normalizeTestingValue(body.category as string);
  if (body.moduleName !== undefined) updates.module_name = normalizeTestingValue(body.moduleName as string);
  if (body.scenario !== undefined) updates.scenario = normalizeTestingValue(body.scenario as string);
  if (body.preconditions !== undefined) updates.preconditions = normalizeTestingValue(body.preconditions as string) || null;
  if (body.testSteps !== undefined) updates.test_steps = parseSteps(body.testSteps as string | Array<string>);
  if (body.expectedResult !== undefined) updates.expected_result = normalizeTestingValue(body.expectedResult as string);
  if (body.actualResult !== undefined) updates.actual_result = normalizeTestingValue(body.actualResult as string) || null;
  if (body.priority !== undefined) updates.priority = normalizeTestingCode(body.priority as string);
  if (body.assignedTesterId !== undefined) updates.assigned_tester_id = body.assignedTesterId ? String(body.assignedTesterId) : null;
  if (body.assignedTesterName !== undefined) updates.assigned_tester_name = normalizeTestingValue(body.assignedTesterName as string) || null;
  if (body.status !== undefined) updates.status = normalizeTestingCode(body.status as string);
  const { data, error } = await testingService().from('testing_test_cases').update(updates).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function listTestRuns(ctx: AuthContext) {
  const { data, error } = await testingService().from('testing_test_runs').select('*, testing_test_cases(test_case_number, scenario)').eq('organization_id', ctx.organizationId).order('test_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTestRun(ctx: AuthContext, body: Record<string, unknown>) {
  const validation = validateTestRun(body);
  if (validation) throw new Error(validation);
  const payload = {
    organization_id: ctx.organizationId,
    test_case_id: String(body.testCaseId),
    test_date: normalizeTestingValue(body.testDate) || new Date().toISOString().slice(0, 10),
    tester_id: body.testerId ? String(body.testerId) : null,
    tester_name: normalizeTestingValue(body.testerName),
    actual_result: normalizeTestingValue(body.actualResult),
    status: normalizeTestingCode(body.status as string),
    comments: normalizeTestingValue(body.comments) || null,
    evidence_attachment: body.evidenceAttachment ?? null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  };
  const service = testingService();
  const { data, error } = await service.from('testing_test_runs').insert(payload).select('*').single();
  if (error) throw error;

  await service.from('testing_test_cases').update({
    actual_result: payload.actual_result,
    status: payload.status,
    updated_at: new Date().toISOString(),
    updated_by: ctx.userId,
  }).eq('id', payload.test_case_id);

  let relatedBug = null;
  if (shouldCreateBugForFailedTest(payload.status) && body.autoCreateBug !== false) {
    relatedBug = await createBug(ctx, {
      actualResult: payload.actual_result,
      description: normalizeTestingValue(body.comments) || 'Auto-created from failed test run.',
      expectedResult: normalizeTestingValue(body.expectedResult),
      moduleName: normalizeTestingValue(body.moduleName) || 'testing',
      priority: normalizeTestingValue(body.priority) || 'HIGH',
      relatedTestCaseId: payload.test_case_id,
      relatedTestRunId: (data as Row).id,
      severity: normalizeTestingValue(body.severity) || 'HIGH',
      stepsToReproduce: normalizeTestingValue(body.stepsToReproduce) || 'Run the linked test case and observe the failure.',
      title: normalizeTestingValue(body.bugTitle) || `Failed test: ${payload.test_case_id}`,
    });
    await service.from('testing_test_runs').update({ related_bug_id: (relatedBug as Row).id }).eq('id', (data as Row).id);
  }

  return { ...data, relatedBug };
}

export async function updateTestRun(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const updates: Row = { updated_by: ctx.userId, updated_at: new Date().toISOString() };
  if (body.actualResult !== undefined) updates.actual_result = normalizeTestingValue(body.actualResult as string);
  if (body.status !== undefined) updates.status = normalizeTestingCode(body.status as string);
  if (body.comments !== undefined) updates.comments = normalizeTestingValue(body.comments as string) || null;
  if (body.evidenceAttachment !== undefined) updates.evidence_attachment = body.evidenceAttachment;
  const { data, error } = await testingService().from('testing_test_runs').update(updates).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function listBugs(ctx: AuthContext) {
  const { data, error } = await testingService().from('testing_bug_reports').select('*').eq('organization_id', ctx.organizationId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createBug(ctx: AuthContext, body: Record<string, unknown>) {
  const validation = validateBugReport(body);
  if (validation) throw new Error(validation);
  const bugNumber = await nextNumber('testing_bug_reports', 'id', 'BUG');
  const payload = {
    organization_id: ctx.organizationId,
    bug_number: bugNumber,
    module_name: normalizeTestingValue(body.moduleName),
    title: normalizeTestingValue(body.title),
    description: normalizeTestingValue(body.description),
    steps_to_reproduce: normalizeTestingValue(body.stepsToReproduce) || null,
    expected_result: normalizeTestingValue(body.expectedResult) || null,
    actual_result: normalizeTestingValue(body.actualResult) || null,
    priority: normalizeTestingCode(body.priority as string),
    severity: normalizeTestingCode(body.severity as string),
    assigned_to: body.assignedTo ? String(body.assignedTo) : null,
    assigned_to_name: normalizeTestingValue(body.assignedToName) || null,
    reported_by: ctx.userId,
    reported_by_name: normalizeTestingValue(body.reportedByName) || ctx.workId,
    related_test_case_id: body.relatedTestCaseId ? String(body.relatedTestCaseId) : null,
    related_test_run_id: body.relatedTestRunId ? String(body.relatedTestRunId) : null,
    status: normalizeTestingCode(body.status as string || 'OPEN'),
    created_by: ctx.userId,
    updated_by: ctx.userId,
  };
  const { data, error } = await testingService().from('testing_bug_reports').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateBug(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const updates: Row = { updated_by: ctx.userId, updated_at: new Date().toISOString() };
  if (body.moduleName !== undefined) updates.module_name = normalizeTestingValue(body.moduleName as string);
  if (body.title !== undefined) updates.title = normalizeTestingValue(body.title as string);
  if (body.description !== undefined) updates.description = normalizeTestingValue(body.description as string);
  if (body.stepsToReproduce !== undefined) updates.steps_to_reproduce = normalizeTestingValue(body.stepsToReproduce as string) || null;
  if (body.expectedResult !== undefined) updates.expected_result = normalizeTestingValue(body.expectedResult as string) || null;
  if (body.actualResult !== undefined) updates.actual_result = normalizeTestingValue(body.actualResult as string) || null;
  if (body.priority !== undefined) updates.priority = normalizeTestingCode(body.priority as string);
  if (body.severity !== undefined) updates.severity = normalizeTestingCode(body.severity as string);
  if (body.status !== undefined) updates.status = normalizeTestingCode(body.status as string);
  const { data, error } = await testingService().from('testing_bug_reports').update(updates).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function assignBug(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const { data, error } = await testingService().from('testing_bug_reports').update({
    assigned_to: body.assignedTo ? String(body.assignedTo) : null,
    assigned_to_name: normalizeTestingValue(body.assignedToName) || null,
    status: 'IN_PROGRESS',
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  }).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function closeBug(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const service = testingService();
  const { data: bug, error: bugError } = await service.from('testing_bug_reports').select('*').eq('organization_id', ctx.organizationId).eq('id', id).single();
  if (bugError) throw bugError;
  const assignedTo = String((bug as Row).assigned_to ?? '');
  const roleNames = ctx.roles.map((role) => role.name.toLowerCase());
  const canClose = assignedTo === ctx.userId || ctx.permissions.includes('settings.manage') || roleNames.some((role) => role.includes('manager') || role.includes('admin'));
  if (!canClose) throw new Error('Only the assigned user, an admin, or an authorized manager can close this bug.');

  const { data, error } = await service.from('testing_bug_reports').update({
    status: 'CLOSED',
    resolution_notes: normalizeTestingValue(body.resolutionNotes) || 'Closed after retest.',
    closed_at: new Date().toISOString(),
    closed_by: ctx.userId,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function reopenBug(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const { data, error } = await testingService().from('testing_bug_reports').update({
    status: 'RETESTING',
    resolution_notes: normalizeTestingValue(body.reopenReason) || 'Reopened for retest.',
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  }).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function listUatSessions(ctx: AuthContext) {
  const { data, error } = await testingService().from('testing_uat_sessions').select('*, testing_uat_participants(*)').eq('organization_id', ctx.organizationId).order('session_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createUatSession(ctx: AuthContext, body: Record<string, unknown>) {
  const participants = Array.isArray(body.participants) ? (body.participants as Array<Record<string, unknown>>) : [];
  const validation = validateUatSession({ moduleName: body.moduleName as string, participants, sessionDate: body.sessionDate as string });
  if (validation) throw new Error(validation);
  const service = testingService();
  const { data, error } = await service.from('testing_uat_sessions').insert({
    organization_id: ctx.organizationId,
    session_name: normalizeTestingValue(body.sessionName) || `UAT ${normalizeTestingValue(body.moduleName)}`,
    module_name: normalizeTestingValue(body.moduleName),
    session_date: normalizeTestingValue(body.sessionDate),
    test_scope: normalizeTestingValue(body.testScope) || null,
    outcome: normalizeTestingValue(body.outcome) || null,
    feedback: normalizeTestingValue(body.feedback) || null,
    sign_off_status: normalizeTestingCode(body.signOffStatus as string || 'PLANNED'),
    status: normalizeTestingCode(body.status as string || 'PLANNED'),
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  if (participants.length > 0) {
    const { error: participantError } = await service.from('testing_uat_participants').insert(
      participants.map((participant) => ({
        organization_id: ctx.organizationId,
        uat_session_id: (data as Row).id,
        participant_name: normalizeTestingValue(participant.participantName as string),
        participant_role: normalizeTestingValue(participant.participantRole as string),
        participant_user_id: participant.participantUserId ? String(participant.participantUserId) : null,
        attendance_status: normalizeTestingCode(participant.attendanceStatus as string || 'PLANNED'),
        created_by: ctx.userId,
        updated_by: ctx.userId,
      })),
    );
    if (participantError) throw participantError;
  }
  return data;
}

export async function updateUatSession(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const updates: Row = { updated_by: ctx.userId, updated_at: new Date().toISOString() };
  if (body.sessionName !== undefined) updates.session_name = normalizeTestingValue(body.sessionName as string);
  if (body.moduleName !== undefined) updates.module_name = normalizeTestingValue(body.moduleName as string);
  if (body.sessionDate !== undefined) updates.session_date = normalizeTestingValue(body.sessionDate as string);
  if (body.testScope !== undefined) updates.test_scope = normalizeTestingValue(body.testScope as string) || null;
  if (body.outcome !== undefined) updates.outcome = normalizeTestingValue(body.outcome as string) || null;
  if (body.feedback !== undefined) updates.feedback = normalizeTestingValue(body.feedback as string) || null;
  if (body.signOffStatus !== undefined) updates.sign_off_status = normalizeTestingCode(body.signOffStatus as string);
  if (body.status !== undefined) updates.status = normalizeTestingCode(body.status as string);
  const { data, error } = await testingService().from('testing_uat_sessions').update(updates).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function signOffUatSession(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const service = testingService();
  const { data: bugs, error: bugError } = await service.from('testing_bug_reports').select('severity, status').eq('organization_id', ctx.organizationId);
  if (bugError) throw bugError;
  if (!canSignOffUat((bugs ?? []) as Array<{ severity?: string; status?: string }>)) {
    throw new Error('UAT sign-off is blocked while critical bugs remain open.');
  }
  const signOffDate = normalizeTestingValue(body.signOffDate) || new Date().toISOString().slice(0, 10);
  const { data, error } = await service.from('testing_uat_signoffs').insert({
    organization_id: ctx.organizationId,
    uat_session_id: id,
    signed_by: ctx.userId,
    signed_by_name: normalizeTestingValue(body.signedByName) || ctx.workId,
    role_name: normalizeTestingValue(body.roleName) || ctx.role,
    sign_off_date: signOffDate,
    decision: normalizeTestingCode(body.decision as string || 'SIGNED_OFF'),
    remarks: normalizeTestingValue(body.remarks) || null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
    signed_off_at: new Date().toISOString(),
    signed_off_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  await service.from('testing_uat_sessions').update({
    sign_off_status: 'SIGNED_OFF',
    status: 'SIGNED_OFF',
    signed_off_at: new Date().toISOString(),
    signed_off_by: ctx.userId,
    updated_at: new Date().toISOString(),
    updated_by: ctx.userId,
  }).eq('organization_id', ctx.organizationId).eq('id', id);
  await recordAuditLog({
    action: 'TESTING_UAT_SIGNED_OFF',
    entityId: id,
    entityType: 'testing_uat_session',
    newValues: { decision: (data as Row).decision, signOffDate },
    organizationId: ctx.organizationId,
    userProfileId: ctx.userId,
  });
  return data;
}

export async function listTrainingSessions(ctx: AuthContext) {
  const { data, error } = await testingService().from('testing_training_sessions').select('*, testing_training_attendance(*)').eq('organization_id', ctx.organizationId).order('session_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTrainingSession(ctx: AuthContext, body: Record<string, unknown>) {
  const validation = validateTrainingSession(body);
  if (validation) throw new Error(validation);
  const service = testingService();
  const { data, error } = await service.from('testing_training_sessions').insert({
    organization_id: ctx.organizationId,
    training_title: normalizeTestingValue(body.trainingTitle),
    module_name: normalizeTestingValue(body.moduleName),
    trainer_name: normalizeTestingValue(body.trainerName),
    trainer_user_id: body.trainerUserId ? String(body.trainerUserId) : null,
    session_date: normalizeTestingValue(body.sessionDate),
    remarks: normalizeTestingValue(body.remarks) || null,
    status: normalizeTestingCode(body.status as string || 'PLANNED'),
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateTrainingSession(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const updates: Row = { updated_by: ctx.userId, updated_at: new Date().toISOString() };
  if (body.trainingTitle !== undefined) updates.training_title = normalizeTestingValue(body.trainingTitle as string);
  if (body.moduleName !== undefined) updates.module_name = normalizeTestingValue(body.moduleName as string);
  if (body.trainerName !== undefined) updates.trainer_name = normalizeTestingValue(body.trainerName as string);
  if (body.sessionDate !== undefined) updates.session_date = normalizeTestingValue(body.sessionDate as string);
  if (body.remarks !== undefined) updates.remarks = normalizeTestingValue(body.remarks as string) || null;
  if (body.status !== undefined) updates.status = normalizeTestingCode(body.status as string);
  const { data, error } = await testingService().from('testing_training_sessions').update(updates).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function recordTrainingAttendance(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const attendees = Array.isArray(body.attendees) ? (body.attendees as Array<Record<string, unknown>>) : [];
  if (attendees.length === 0) throw new Error('attendees are required.');
  const { error } = await testingService().from('testing_training_attendance').insert(
    attendees.map((attendee) => ({
      organization_id: ctx.organizationId,
      training_session_id: id,
      attendee_name: normalizeTestingValue(attendee.attendeeName as string),
      attendee_role: normalizeTestingValue(attendee.attendeeRole as string),
      attendee_user_id: attendee.attendeeUserId ? String(attendee.attendeeUserId) : null,
      attendance_status: normalizeTestingCode(attendee.attendanceStatus as string || 'PRESENT'),
      remarks: normalizeTestingValue(attendee.remarks as string) || null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })),
  );
  if (error) throw error;
  return { success: true };
}

export async function listDocumentation(ctx: AuthContext) {
  await ensureTestingSeeds(ctx);
  const { data, error } = await testingService().from('testing_documents').select('*').eq('organization_id', ctx.organizationId).order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createDocumentation(ctx: AuthContext, body: Record<string, unknown>) {
  const validation = validateDocumentationRecord(body);
  if (validation) throw new Error(validation);
  const { data, error } = await testingService().from('testing_documents').insert({
    organization_id: ctx.organizationId,
    title: normalizeTestingValue(body.title),
    document_type: normalizeTestingValue(body.documentType),
    version: normalizeTestingValue(body.version),
    module_name: normalizeTestingValue(body.moduleName) || 'testing',
    content: normalizeTestingValue(body.content),
    author_name: normalizeTestingValue(body.authorName) || ctx.workId,
    author_user_id: ctx.userId,
    reviewed_by: normalizeTestingValue(body.reviewedBy) || null,
    status: normalizeTestingCode(body.status as string || 'DRAFT'),
    last_updated_date: new Date().toISOString().slice(0, 10),
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateDocumentation(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const updates: Row = { updated_by: ctx.userId, updated_at: new Date().toISOString(), last_updated_date: new Date().toISOString().slice(0, 10) };
  if (body.title !== undefined) updates.title = normalizeTestingValue(body.title as string);
  if (body.documentType !== undefined) updates.document_type = normalizeTestingValue(body.documentType as string);
  if (body.version !== undefined) updates.version = normalizeTestingValue(body.version as string);
  if (body.moduleName !== undefined) updates.module_name = normalizeTestingValue(body.moduleName as string);
  if (body.content !== undefined) updates.content = normalizeTestingValue(body.content as string);
  if (body.reviewedBy !== undefined) updates.reviewed_by = normalizeTestingValue(body.reviewedBy as string) || null;
  if (body.status !== undefined) updates.status = normalizeTestingCode(body.status as string);
  const { data, error } = await testingService().from('testing_documents').update(updates).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function listReleaseNotes(ctx: AuthContext) {
  const { data, error } = await testingService().from('testing_release_notes').select('*').eq('organization_id', ctx.organizationId).order('release_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createReleaseNote(ctx: AuthContext, body: Record<string, unknown>) {
  const validation = validateReleaseNote(body);
  if (validation) throw new Error(validation);
  const { data, error } = await testingService().from('testing_release_notes').insert({
    organization_id: ctx.organizationId,
    release_version: normalizeTestingValue(body.releaseVersion),
    release_date: normalizeTestingValue(body.releaseDate),
    features_added: normalizeTestingValue(body.featuresAdded) || 'See release scope.',
    bugs_fixed: normalizeTestingValue(body.bugsFixed) || 'See bug tracker.',
    known_issues: normalizeTestingValue(body.knownIssues) || null,
    deployment_notes: normalizeTestingValue(body.deploymentNotes) || null,
    approved_by: body.approvedBy ? String(body.approvedBy) : null,
    approved_by_name: normalizeTestingValue(body.approvedByName) || null,
    approval_status: normalizeTestingCode(body.approvalStatus as string || 'DRAFT'),
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateReleaseNote(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const updates: Row = { updated_by: ctx.userId, updated_at: new Date().toISOString() };
  if (body.releaseVersion !== undefined) updates.release_version = normalizeTestingValue(body.releaseVersion as string);
  if (body.releaseDate !== undefined) updates.release_date = normalizeTestingValue(body.releaseDate as string);
  if (body.featuresAdded !== undefined) updates.features_added = normalizeTestingValue(body.featuresAdded as string);
  if (body.bugsFixed !== undefined) updates.bugs_fixed = normalizeTestingValue(body.bugsFixed as string);
  if (body.knownIssues !== undefined) updates.known_issues = normalizeTestingValue(body.knownIssues as string) || null;
  if (body.deploymentNotes !== undefined) updates.deployment_notes = normalizeTestingValue(body.deploymentNotes as string) || null;
  if (body.approvalStatus !== undefined) updates.approval_status = normalizeTestingCode(body.approvalStatus as string);
  const { data, error } = await testingService().from('testing_release_notes').update(updates).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function listHandoverChecklist(ctx: AuthContext) {
  await ensureTestingSeeds(ctx);
  const { data, error } = await testingService().from('testing_handover_checklist').select('*').eq('organization_id', ctx.organizationId).order('category');
  if (error) throw error;
  return data ?? [];
}

export async function createHandoverChecklistItem(ctx: AuthContext, body: Record<string, unknown>) {
  const { data, error } = await testingService().from('testing_handover_checklist').insert({
    organization_id: ctx.organizationId,
    category: normalizeTestingValue(body.category),
    task: normalizeTestingValue(body.task),
    owner_name: normalizeTestingValue(body.ownerName),
    owner_user_id: body.ownerUserId ? String(body.ownerUserId) : null,
    status: normalizeTestingCode(body.status as string || 'NOT_STARTED'),
    remarks: normalizeTestingValue(body.remarks) || null,
    is_critical: Boolean(body.isCritical),
    completed_date: normalizeTestingValue(body.completedDate) || null,
    approval_status: normalizeTestingCode(body.approvalStatus as string || 'PENDING'),
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateHandoverChecklistItem(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const updates: Row = { updated_by: ctx.userId, updated_at: new Date().toISOString() };
  if (body.category !== undefined) updates.category = normalizeTestingValue(body.category as string);
  if (body.task !== undefined) updates.task = normalizeTestingValue(body.task as string);
  if (body.ownerName !== undefined) updates.owner_name = normalizeTestingValue(body.ownerName as string);
  if (body.status !== undefined) updates.status = normalizeTestingCode(body.status as string);
  if (body.remarks !== undefined) updates.remarks = normalizeTestingValue(body.remarks as string) || null;
  if (body.isCritical !== undefined) updates.is_critical = Boolean(body.isCritical);
  if (body.completedDate !== undefined) updates.completed_date = normalizeTestingValue(body.completedDate as string) || null;
  if (body.approvalStatus !== undefined) updates.approval_status = normalizeTestingCode(body.approvalStatus as string);
  const { data, error } = await testingService().from('testing_handover_checklist').update(updates).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function approveHandoverChecklistItem(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const service = testingService();
  const { data: items, error: itemsError } = await service.from('testing_handover_checklist').select('id, status, approval_status, is_critical').eq('organization_id', ctx.organizationId);
  if (itemsError) throw itemsError;
  if (!canApproveHandover((items ?? []) as Array<{ isCritical?: boolean; status?: string; approvalStatus?: string }>)) {
    throw new Error('Handover approval is blocked while critical tasks remain incomplete.');
  }
  const { data, error } = await service.from('testing_handover_approvals').insert({
    organization_id: ctx.organizationId,
    handover_checklist_id: id,
    approved_by: ctx.userId,
    approved_by_name: normalizeTestingValue(body.approvedByName) || ctx.workId,
    approval_date: normalizeTestingValue(body.approvalDate) || new Date().toISOString().slice(0, 10),
    decision: normalizeTestingCode(body.decision as string || 'APPROVED'),
    remarks: normalizeTestingValue(body.remarks) || null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
    signed_off_at: new Date().toISOString(),
    signed_off_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  await service.from('testing_handover_checklist').update({
    approval_status: 'APPROVED',
    approved_at: new Date().toISOString(),
    approved_by: ctx.userId,
    status: 'COMPLETED',
    updated_at: new Date().toISOString(),
    updated_by: ctx.userId,
  }).eq('organization_id', ctx.organizationId).eq('id', id);
  await recordAuditLog({
    action: 'TESTING_HANDOVER_APPROVED',
    entityId: id,
    entityType: 'testing_handover_checklist',
    newValues: { decision: (data as Row).decision },
    organizationId: ctx.organizationId,
    userProfileId: ctx.userId,
  });
  return data;
}

export async function exportTestingReport(ctx: AuthContext, reportType: string) {
  switch (reportType) {
    case 'test-cases':
      return buildCsv((await listTestCases(ctx)) as Array<Record<string, unknown>>);
    case 'test-runs':
      return buildCsv((await listTestRuns(ctx)) as Array<Record<string, unknown>>);
    case 'bugs':
      return buildCsv((await listBugs(ctx)) as Array<Record<string, unknown>>);
    case 'uat':
      return buildCsv((await listUatSessions(ctx)) as Array<Record<string, unknown>>);
    case 'training':
      return buildCsv((await listTrainingSessions(ctx)) as Array<Record<string, unknown>>);
    case 'documentation':
      return buildCsv((await listDocumentation(ctx)) as Array<Record<string, unknown>>);
    case 'handover':
      return buildCsv((await listHandoverChecklist(ctx)) as Array<Record<string, unknown>>);
    default:
      throw new Error('Unsupported testing export type.');
  }
}
