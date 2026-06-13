import { createServiceRoleClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/security-server';
import {
  blocksSelfApproval,
  buildWorkflowHistoryAction,
  canEditWorkflowDocument,
  canPostWorkflowDocument,
  getDocumentLockReason,
  nextWorkflowStatusAfterApproval,
  normalizeWorkflowCode,
  normalizeWorkflowValue,
  validateApprovalRule,
  validateWorkflowActionComment,
  validateWorkflowDefinition,
} from '@/lib/workflow';

type WorkflowContext = {
  branchAssignments: string[];
  organizationId: string;
  permissions: string[];
  roles: Array<{ id: string; name: string }>;
  userId: string;
};

type DocumentConfig = {
  approvalStatusField?: string;
  approvedAtField?: string;
  approvedByField?: string;
  branchField?: string;
  documentType: string;
  moduleName: string;
  postedAtField?: string;
  postedByField?: string;
  postedFlagField?: string;
  referenceField?: string;
  statusField?: string;
  submittedAtField?: string;
  submittedByField?: string;
  table: string;
  voidedAtField?: string;
  voidedByField?: string;
  voidReasonField?: string;
};

const DOCUMENT_CONFIGS: Record<string, DocumentConfig> = {
  purchase_requisition: {
    moduleName: 'procurement',
    documentType: 'purchase_requisition',
    table: 'purchase_requisitions',
    statusField: 'status',
    approvalStatusField: 'approval_status',
    referenceField: 'requisition_number',
    submittedAtField: 'submitted_at',
    submittedByField: 'submitted_by',
    approvedAtField: 'approved_at',
    approvedByField: 'approved_by',
    branchField: 'branch_id',
  },
  sales_invoice: {
    moduleName: 'sales',
    documentType: 'sales_invoice',
    table: 'invoices',
    statusField: 'status',
    referenceField: 'invoice_number',
    approvedAtField: 'approved_at',
    approvedByField: 'approved_by',
    postedAtField: 'posted_at',
    postedByField: 'posted_by',
    branchField: 'branch_id',
  },
  sales_dispatch: {
    moduleName: 'sales',
    documentType: 'sales_dispatch',
    table: 'sales_dispatch_notes',
    statusField: 'status',
    referenceField: 'dispatch_number',
    postedAtField: 'posted_at',
    postedByField: 'dispatched_by',
    branchField: 'branch_id',
  },
  journal_entry: {
    moduleName: 'finance',
    documentType: 'journal_entry',
    table: 'journal_entries',
    statusField: 'status',
    referenceField: 'entry_number',
    postedAtField: 'posted_at',
    postedByField: 'posted_by',
    postedFlagField: 'is_posted',
    branchField: 'branch_id',
  },
  payroll: {
    moduleName: 'hr',
    documentType: 'payroll',
    table: 'hr_payroll_runs',
    statusField: 'status',
    referenceField: 'payroll_number',
    approvedAtField: 'approved_at',
    approvedByField: 'approved_by',
    postedAtField: 'posted_at',
    postedByField: 'posted_by',
    branchField: 'branch_id',
  },
};

export function workflowService() {
  return createServiceRoleClient().schema('icecream_erp');
}

function getDocumentConfig(documentType: string) {
  const config = DOCUMENT_CONFIGS[normalizeWorkflowCode(documentType).toLowerCase()];
  if (!config) {
    throw new Error(`Workflow document type ${documentType} is not configured.`);
  }
  return config;
}

async function fetchDocumentRecord(documentType: string, documentId: string, organizationId: string) {
  const config = getDocumentConfig(documentType);
  const service = workflowService();
  const selectFields = [
    'id',
    config.referenceField ?? 'id',
    config.statusField ?? 'status',
    config.branchField ?? 'branch_id',
    config.approvalStatusField ?? 'approval_status',
    config.approvedAtField ?? 'approved_at',
    config.approvedByField ?? 'approved_by',
    config.postedAtField ?? 'posted_at',
    config.postedByField ?? 'posted_by',
    config.postedFlagField ?? 'is_posted',
  ]
    .filter(Boolean)
    .join(', ');

  const { data, error } = await service
    .from(config.table)
    .select(selectFields)
    .eq('organization_id', organizationId)
    .eq('id', documentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Document not found.');
  return { config, record: data as unknown as Record<string, unknown> };
}

async function ensureBranchScope(ctx: WorkflowContext, branchId: string | null | undefined) {
  if (!branchId || ctx.permissions.includes('view_all_branches') || ctx.permissions.includes('settings.manage')) return;
  if (ctx.branchAssignments.includes(branchId)) return;
  throw new Error('You are not authorized to access this branch document.');
}

async function insertWorkflowHistory(input: {
  action: string;
  actorId?: string | null;
  documentId: string;
  documentReference?: string | null;
  documentType: string;
  fromStatus?: string | null;
  metadata?: Record<string, unknown>;
  moduleName: string;
  organizationId: string;
  toStatus?: string | null;
  comment?: string | null;
}) {
  const service = workflowService();
  await service.from('workflow_history').insert({
    action: input.action,
    action_at: new Date().toISOString(),
    action_comment: input.comment ?? null,
    actor_id: input.actorId ?? null,
    document_id: input.documentId,
    document_reference: input.documentReference ?? null,
    document_type: input.documentType,
    from_status: input.fromStatus ?? null,
    metadata: input.metadata ?? {},
    module_name: input.moduleName,
    organization_id: input.organizationId,
    to_status: input.toStatus ?? null,
  });
}

async function upsertDocumentLock(input: {
  documentId: string;
  documentType: string;
  lockedBy?: string | null;
  lockReason: string;
  moduleName: string;
  organizationId: string;
}) {
  const service = workflowService();
  await service.from('document_locks').upsert({
    document_id: input.documentId,
    document_type: input.documentType,
    is_active: true,
    lock_reason: input.lockReason,
    locked_at: new Date().toISOString(),
    locked_by: input.lockedBy ?? null,
    module_name: input.moduleName,
    organization_id: input.organizationId,
  }, { onConflict: 'organization_id,document_type,document_id,is_active' });
}

export async function isDocumentLocked(documentType: string, documentId: string, organizationId: string) {
  const service = workflowService();
  const { data, error } = await service
    .from('document_locks')
    .select('id, lock_reason, locked_at')
    .eq('organization_id', organizationId)
    .eq('document_type', documentType)
    .eq('document_id', documentId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function assertDocumentEditable(documentType: string, documentId: string, organizationId: string) {
  const lock = await isDocumentLocked(documentType, documentId, organizationId);
  if (lock) throw new Error(String((lock as Record<string, unknown>).lock_reason ?? 'Document is locked.'));

  const { record, config } = await fetchDocumentRecord(documentType, documentId, organizationId);
  const statusValue = config.statusField ? record[config.statusField] : record.status;
  if (!canEditWorkflowDocument(statusValue as string | undefined, false)) {
    throw new Error('Document can no longer be edited directly. Use correction, reversal, or void workflow.');
  }
}

export async function listWorkflowDashboard(organizationId: string) {
  const service = workflowService();
  const [approvals, postings, corrections, reversals, voids, history] = await Promise.all([
    service.from('approval_requests').select('id, module_name, document_type, status', { count: 'exact' }).eq('organization_id', organizationId),
    service.from('posting_logs').select('id, module_name, document_type, posting_status', { count: 'exact' }).eq('organization_id', organizationId),
    service.from('correction_requests').select('id, module_name, document_type, status', { count: 'exact' }).eq('organization_id', organizationId),
    service.from('reversal_logs').select('id, module_name, document_type, status', { count: 'exact' }).eq('organization_id', organizationId),
    service.from('void_logs').select('id, module_name, document_type, status', { count: 'exact' }).eq('organization_id', organizationId),
    service.from('workflow_history').select('id, module_name, document_type, document_reference, action, action_at').eq('organization_id', organizationId).order('action_at', { ascending: false }).limit(10),
  ]);
  if (approvals.error) throw approvals.error;
  if (postings.error) throw postings.error;
  if (corrections.error) throw corrections.error;
  if (reversals.error) throw reversals.error;
  if (voids.error) throw voids.error;
  if (history.error) throw history.error;

  const approvalRows = approvals.data ?? [];
  const correctionRows = corrections.data ?? [];
  const reversalRows = reversals.data ?? [];
  const voidRows = voids.data ?? [];
  const postingRows = postings.data ?? [];

  const moduleCounts = new Map<string, number>();
  for (const row of approvalRows) {
    const moduleName = String((row as Record<string, unknown>).module_name ?? 'general');
    moduleCounts.set(moduleName, (moduleCounts.get(moduleName) ?? 0) + 1);
  }

  return {
    pendingApprovals: approvalRows.filter((row) => String((row as Record<string, unknown>).status ?? '') === 'PENDING').length,
    pendingPostings: postingRows.filter((row) => String((row as Record<string, unknown>).posting_status ?? '') === 'PENDING').length,
    rejectedDocuments: approvalRows.filter((row) => String((row as Record<string, unknown>).status ?? '') === 'REJECTED').length,
    correctionRequests: correctionRows.filter((row) => String((row as Record<string, unknown>).status ?? '') === 'REQUESTED').length,
    reversalRequests: reversalRows.filter((row) => String((row as Record<string, unknown>).status ?? '') === 'REQUESTED').length,
    voidRequests: voidRows.filter((row) => String((row as Record<string, unknown>).status ?? '') === 'REQUESTED').length,
    overdueApprovals: approvalRows.filter((row) => {
      const requestedAt = new Date(String((row as Record<string, unknown>).requested_at ?? Date.now()));
      return Date.now() - requestedAt.getTime() > 48 * 60 * 60 * 1000 && String((row as Record<string, unknown>).status ?? '') === 'PENDING';
    }).length,
    approvalCountByModule: Array.from(moduleCounts, ([moduleName, count]) => ({ moduleName, count })),
    recentWorkflowActions: history.data ?? [],
  };
}

export async function listWorkflowDefinitions(organizationId: string) {
  const service = workflowService();
  const { data, error } = await service
    .from('approval_workflows')
    .select('id, name, module_name, document_type, action_name, description, is_active, self_approval_allowed, minimum_amount, maximum_amount, created_at')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createWorkflowDefinition(input: {
  body: { actionName?: string; description?: string; documentType?: string; isActive?: boolean; module?: string; name?: string; selfApprovalAllowed?: boolean };
  ctx: WorkflowContext;
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null };
}) {
  const validationError = validateWorkflowDefinition({
    documentType: input.body.documentType,
    module: input.body.module,
    name: input.body.name,
  });
  if (validationError) throw new Error(validationError);

  const service = workflowService();
  const { data, error } = await service
    .from('approval_workflows')
    .insert({
      action_name: normalizeWorkflowCode(input.body.actionName ?? 'APPROVE'),
      created_by: input.ctx.userId,
      description: normalizeWorkflowValue(input.body.description) || null,
      document_type: normalizeWorkflowCode(input.body.documentType),
      entity_type: `${normalizeWorkflowCode(input.body.module)}.${normalizeWorkflowCode(input.body.documentType)}`,
      is_active: input.body.isActive ?? true,
      module_name: normalizeWorkflowCode(input.body.module),
      name: normalizeWorkflowValue(input.body.name),
      organization_id: input.ctx.organizationId,
      self_approval_allowed: input.body.selfApprovalAllowed ?? false,
      updated_by: input.ctx.userId,
    })
    .select()
    .single();
  if (error) throw error;

  await recordAuditLog({
    action: 'WORKFLOW_DEFINITION_CREATED',
    entityId: String((data as Record<string, unknown>).id),
    entityType: 'approval_workflow',
    newValues: input.body as Record<string, unknown>,
    organizationId: input.ctx.organizationId,
    userProfileId: input.ctx.userId,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return data;
}

export async function updateWorkflowDefinition(input: {
  body: Record<string, unknown>;
  ctx: WorkflowContext;
  id: string;
}) {
  const updates: Record<string, unknown> = {
    updated_by: input.ctx.userId,
  };
  if (input.body.name !== undefined) updates.name = normalizeWorkflowValue(input.body.name as string);
  if (input.body.description !== undefined) updates.description = normalizeWorkflowValue(input.body.description as string) || null;
  if (input.body.module !== undefined) updates.module_name = normalizeWorkflowCode(input.body.module as string);
  if (input.body.documentType !== undefined) updates.document_type = normalizeWorkflowCode(input.body.documentType as string);
  if (input.body.actionName !== undefined) updates.action_name = normalizeWorkflowCode(input.body.actionName as string);
  if (input.body.isActive !== undefined) updates.is_active = Boolean(input.body.isActive);
  if (input.body.selfApprovalAllowed !== undefined) updates.self_approval_allowed = Boolean(input.body.selfApprovalAllowed);
  if (input.body.minimumAmount !== undefined) updates.minimum_amount = Number(input.body.minimumAmount);
  if (input.body.maximumAmount !== undefined) updates.maximum_amount = Number(input.body.maximumAmount);

  const { data, error } = await workflowService()
    .from('approval_workflows')
    .update(updates)
    .eq('organization_id', input.ctx.organizationId)
    .eq('id', input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listWorkflowSteps(organizationId: string) {
  const { data, error } = await workflowService()
    .from('approval_workflow_steps')
    .select('id, workflow_id, step_name, step_number, approval_level, role_id, approver_role_name, minimum_amount, maximum_amount, is_required, is_active')
    .order('step_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createWorkflowStep(input: {
  body: Record<string, unknown>;
  ctx: WorkflowContext;
}) {
  if (!normalizeWorkflowValue(input.body.workflowId as string)) throw new Error('workflowId is required.');
  if (Number(input.body.stepOrder ?? 0) <= 0) throw new Error('step order must be greater than zero.');
  if (!normalizeWorkflowValue(input.body.requiredRoleId as string)) throw new Error('requiredRoleId is required.');

  const { data, error } = await workflowService()
    .from('approval_workflow_steps')
    .insert({
      approval_level: Number(input.body.approvalLevel ?? input.body.stepOrder ?? 1),
      approver_role_name: normalizeWorkflowValue(input.body.requiredRoleName as string) || null,
      escalation_hours: input.body.escalationHours ? Number(input.body.escalationHours) : null,
      is_active: input.body.isActive ?? true,
      is_required: input.body.isRequired ?? true,
      level: 'LEVEL_ONE',
      maximum_amount: input.body.maximumAmount ? Number(input.body.maximumAmount) : null,
      minimum_amount: input.body.minimumAmount ? Number(input.body.minimumAmount) : null,
      role_id: String(input.body.requiredRoleId),
      step_name: normalizeWorkflowValue(input.body.stepName as string) || `Step ${String(input.body.stepOrder)}`,
      step_number: Number(input.body.stepOrder),
      workflow_id: String(input.body.workflowId),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorkflowStep(input: { body: Record<string, unknown>; id: string }) {
  const updates: Record<string, unknown> = {};
  if (input.body.stepName !== undefined) updates.step_name = normalizeWorkflowValue(input.body.stepName as string);
  if (input.body.stepOrder !== undefined) updates.step_number = Number(input.body.stepOrder);
  if (input.body.approvalLevel !== undefined) updates.approval_level = Number(input.body.approvalLevel);
  if (input.body.requiredRoleId !== undefined) updates.role_id = String(input.body.requiredRoleId);
  if (input.body.requiredRoleName !== undefined) updates.approver_role_name = normalizeWorkflowValue(input.body.requiredRoleName as string) || null;
  if (input.body.minimumAmount !== undefined) updates.minimum_amount = Number(input.body.minimumAmount);
  if (input.body.maximumAmount !== undefined) updates.maximum_amount = Number(input.body.maximumAmount);
  if (input.body.isRequired !== undefined) updates.is_required = Boolean(input.body.isRequired);
  if (input.body.isActive !== undefined) updates.is_active = Boolean(input.body.isActive);

  const { data, error } = await workflowService().from('approval_workflow_steps').update(updates).eq('id', input.id).select().single();
  if (error) throw error;
  return data;
}

export async function listApprovalRules(organizationId: string) {
  return listWorkflowDefinitions(organizationId);
}

export async function createApprovalRule(input: { body: Record<string, unknown>; ctx: WorkflowContext }) {
  const validationError = validateApprovalRule({
    action: input.body.action as string,
    approvalLevel: input.body.approvalLevel as string,
    documentType: input.body.documentType as string,
    maximumAmount: input.body.maximumAmount as string,
    minimumAmount: input.body.minimumAmount as string,
    module: input.body.module as string,
    requiredRoleId: input.body.requiredRoleId as string,
    selfApprovalAllowed: input.body.selfApprovalAllowed as string,
  });
  if (validationError) throw new Error(validationError);

  const workflow = await createWorkflowDefinition({
    body: {
      actionName: String(input.body.action ?? 'APPROVE'),
      description: String(input.body.description ?? ''),
      documentType: String(input.body.documentType ?? ''),
      isActive: input.body.isActive !== false,
      module: String(input.body.module ?? ''),
      name: String(input.body.workflowName ?? `${input.body.module}:${input.body.documentType}:${input.body.action}`),
      selfApprovalAllowed: Boolean(input.body.selfApprovalAllowed),
    },
    ctx: input.ctx,
  });

  await createWorkflowStep({
    body: {
      approvalLevel: Number(input.body.approvalLevel ?? 1),
      isActive: input.body.isActive !== false,
      isRequired: true,
      maximumAmount: input.body.maximumAmount,
      minimumAmount: input.body.minimumAmount,
      requiredRoleId: input.body.requiredRoleId,
      requiredRoleName: input.body.requiredRoleName,
      stepName: input.body.stepName ?? 'Primary Approval',
      stepOrder: 1,
      workflowId: (workflow as Record<string, unknown>).id,
    },
    ctx: input.ctx,
  });

  return workflow;
}

export async function updateApprovalRule(input: { body: Record<string, unknown>; ctx: WorkflowContext; id: string }) {
  return updateWorkflowDefinition(input);
}

export async function listApprovalRequests(organizationId: string) {
  const { data, error } = await workflowService()
    .from('approval_requests')
    .select('id, module_name, document_type, document_reference, entity_id, requested_by, requested_at, approver_role_name, approver_user_id, status, current_step, request_reason')
    .eq('organization_id', organizationId)
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function resolveWorkflowForDocument(organizationId: string, moduleName: string, documentType: string) {
  const { data, error } = await workflowService()
    .from('approval_workflows')
    .select('id, module_name, document_type, self_approval_allowed, approval_workflow_steps(id, step_number, approval_level, role_id, approver_role_name, is_required, is_active)')
    .eq('organization_id', organizationId)
    .eq('module_name', normalizeWorkflowCode(moduleName))
    .eq('document_type', normalizeWorkflowCode(documentType))
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

export async function submitWorkflowApproval(input: {
  body: { documentId?: string; documentReference?: string; documentType?: string; module?: string; reason?: string };
  ctx: WorkflowContext;
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null };
}) {
  const moduleName = normalizeWorkflowCode(input.body.module);
  const documentType = normalizeWorkflowCode(input.body.documentType);
  const documentId = normalizeWorkflowValue(input.body.documentId);
  if (!moduleName || !documentType || !documentId) throw new Error('module, documentType, and documentId are required.');

  const workflow = await resolveWorkflowForDocument(input.ctx.organizationId, moduleName, documentType);
  if (!workflow) throw new Error('No active workflow definition was found for this document.');
  const steps = Array.isArray(workflow.approval_workflow_steps) ? workflow.approval_workflow_steps : [];
  const activeSteps = steps
    .map((row) => row as Record<string, unknown>)
    .filter((row) => row.is_active !== false)
    .sort((a, b) => Number(a.step_number ?? 0) - Number(b.step_number ?? 0));
  if (activeSteps.length === 0) throw new Error('Workflow has no active steps.');
  const firstStep = activeSteps[0];

  const { record, config } = await fetchDocumentRecord(documentType, documentId, input.ctx.organizationId);
  await ensureBranchScope(input.ctx, String(record[config.branchField ?? 'branch_id'] ?? ''));
  if (!canEditWorkflowDocument(record[config.statusField ?? 'status'] as string | undefined, false)) {
    throw new Error('Only editable draft or rejected documents can be submitted.');
  }

  const { data, error } = await workflowService()
    .from('approval_requests')
    .insert({
      approver_role_id: firstStep.role_id ? String(firstStep.role_id) : null,
      approver_role_name: firstStep.approver_role_name ? String(firstStep.approver_role_name) : null,
      current_step: Number(firstStep.step_number ?? 1),
      document_reference: normalizeWorkflowValue(input.body.documentReference) || String(record[config.referenceField ?? 'id'] ?? documentId),
      document_type: documentType,
      entity_id: documentId,
      entity_type: `${moduleName}.${documentType}`,
      module_name: moduleName,
      organization_id: input.ctx.organizationId,
      request_reason: normalizeWorkflowValue(input.body.reason) || null,
      requested_by: input.ctx.userId,
      status: 'PENDING',
      submitted_at: new Date().toISOString(),
      submitted_by: input.ctx.userId,
      workflow_id: String(workflow.id),
    })
    .select()
    .single();
  if (error) throw error;

  const updates: Record<string, unknown> = {};
  if (config.statusField) updates[config.statusField] = 'submitted';
  if (config.approvalStatusField) updates[config.approvalStatusField] = 'PENDING_APPROVAL';
  if (config.submittedAtField) updates[config.submittedAtField] = new Date().toISOString();
  if (config.submittedByField) updates[config.submittedByField] = input.ctx.userId;
  if (Object.keys(updates).length > 0) {
    await workflowService().from(config.table).update(updates).eq('id', documentId);
  }

  await insertWorkflowHistory({
    action: buildWorkflowHistoryAction({ action: 'SUBMITTED', documentType, module: moduleName }),
    actorId: input.ctx.userId,
    comment: input.body.reason ?? null,
    documentId,
    documentReference: String((data as Record<string, unknown>).document_reference ?? ''),
    documentType,
    fromStatus: String(record[config.statusField ?? 'status'] ?? 'DRAFT'),
    moduleName,
    organizationId: input.ctx.organizationId,
    toStatus: 'SUBMITTED',
  });

  await recordAuditLog({
    action: 'WORKFLOW_APPROVAL_SUBMITTED',
    entityId: String((data as Record<string, unknown>).id),
    entityType: 'approval_request',
    newValues: { documentId, documentType, moduleName, reason: input.body.reason ?? null },
    organizationId: input.ctx.organizationId,
    userProfileId: input.ctx.userId,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return data;
}

async function getApprovalRequestOrThrow(id: string, organizationId: string) {
  const { data, error } = await workflowService()
    .from('approval_requests')
    .select('*, approval_workflows(id, self_approval_allowed), approval_actions(id, action, acted_at)')
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Approval request not found.');
  return data as Record<string, unknown>;
}

async function getWorkflowSteps(workflowId: string) {
  const { data, error } = await workflowService()
    .from('approval_workflow_steps')
    .select('id, step_number, approval_level, role_id, approver_role_name, is_active')
    .eq('workflow_id', workflowId)
    .eq('is_active', true)
    .order('step_number', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

function approverHasRole(ctx: WorkflowContext, requiredRoleId: string | null, requiredRoleName: string | null) {
  if (ctx.permissions.includes('settings.manage')) return true;
  if (requiredRoleId && ctx.roles.some((role) => role.id === requiredRoleId)) return true;
  if (requiredRoleName && ctx.roles.some((role) => normalizeWorkflowCode(role.name) === normalizeWorkflowCode(requiredRoleName))) return true;
  return false;
}

export async function approveWorkflowRequest(input: {
  comment?: string;
  ctx: WorkflowContext;
  id: string;
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null };
}) {
  const request = await getApprovalRequestOrThrow(input.id, input.ctx.organizationId);
  const validationError = validateWorkflowActionComment('approve', input.comment);
  if (validationError) throw new Error(validationError);
  if (String(request.status ?? '').toUpperCase() !== 'PENDING') throw new Error('Only pending requests can be approved.');

  const steps = await getWorkflowSteps(String(request.workflow_id));
  const currentStep = steps.find((row) => Number(row.step_number ?? 0) === Number(request.current_step ?? 1)) ?? steps[0];
  if (!currentStep) throw new Error('Workflow step not found.');
  if (!approverHasRole(input.ctx, currentStep.role_id ? String(currentStep.role_id) : null, currentStep.approver_role_name ? String(currentStep.approver_role_name) : null)) {
    throw new Error('You are not authorized to approve this workflow step.');
  }
  const workflowInfo = Array.isArray(request.approval_workflows) ? request.approval_workflows[0] : request.approval_workflows;
  if (blocksSelfApproval(request.requested_by as string, input.ctx.userId, workflowInfo?.self_approval_allowed)) {
    throw new Error('Self-approval is blocked for this workflow.');
  }

  await workflowService().from('approval_actions').insert({
    action: 'APPROVED',
    action_by: input.ctx.userId,
    action_comment: input.comment ?? null,
    action_status: 'APPROVED',
    acted_at: new Date().toISOString(),
    approval_request_id: input.id,
    comments: input.comment ?? null,
    document_id: String(request.entity_id ?? ''),
    document_type: String(request.document_type ?? ''),
    ip_address: input.requestMeta?.ipAddress ?? null,
    level: 'LEVEL_ONE',
    step_number: Number(request.current_step ?? 1),
  });

  const currentIndex = steps.findIndex((row) => Number(row.step_number ?? 0) === Number(request.current_step ?? 1));
  const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : null;
  const nextStatus = nextWorkflowStatusAfterApproval(Number(request.current_step ?? 1), steps.length);
  const approvalUpdates: Record<string, unknown> = {
    approval_date: new Date().toISOString(),
    approver_user_id: input.ctx.userId,
    current_step: nextStep ? Number(nextStep.step_number ?? Number(request.current_step ?? 1)) : Number(request.current_step ?? 1),
    status: nextStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
    completed_at: nextStatus === 'APPROVED' ? new Date().toISOString() : null,
  };
  if (nextStep) {
    approvalUpdates.approver_role_id = nextStep.role_id ? String(nextStep.role_id) : null;
    approvalUpdates.approver_role_name = nextStep.approver_role_name ? String(nextStep.approver_role_name) : null;
  }
  await workflowService().from('approval_requests').update(approvalUpdates).eq('id', input.id);

  const { config } = await fetchDocumentRecord(String(request.document_type ?? ''), String(request.entity_id ?? ''), input.ctx.organizationId);
  const documentUpdates: Record<string, unknown> = {};
  if (nextStatus === 'APPROVED') {
    if (config.statusField) documentUpdates[config.statusField] = 'approved';
    if (config.approvalStatusField) documentUpdates[config.approvalStatusField] = 'APPROVED';
    if (config.approvedAtField) documentUpdates[config.approvedAtField] = new Date().toISOString();
    if (config.approvedByField) documentUpdates[config.approvedByField] = input.ctx.userId;
  } else if (config.approvalStatusField) {
    documentUpdates[config.approvalStatusField] = 'PENDING_APPROVAL';
  }
  if (Object.keys(documentUpdates).length > 0) {
    await workflowService().from(config.table).update(documentUpdates).eq('id', String(request.entity_id ?? ''));
  }

  await insertWorkflowHistory({
    action: buildWorkflowHistoryAction({
      action: nextStatus === 'APPROVED' ? 'APPROVED' : 'ESCALATED',
      documentType: String(request.document_type ?? ''),
      module: String(request.module_name ?? ''),
    }),
    actorId: input.ctx.userId,
    comment: input.comment ?? null,
    documentId: String(request.entity_id ?? ''),
    documentReference: String(request.document_reference ?? ''),
    documentType: String(request.document_type ?? ''),
    fromStatus: 'PENDING_APPROVAL',
    moduleName: String(request.module_name ?? ''),
    organizationId: input.ctx.organizationId,
    toStatus: nextStatus,
  });

  return { approved: true, nextStatus, requestId: input.id };
}

export async function rejectWorkflowRequest(input: {
  comment?: string;
  ctx: WorkflowContext;
  id: string;
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null };
}) {
  const request = await getApprovalRequestOrThrow(input.id, input.ctx.organizationId);
  const validationError = validateWorkflowActionComment('reject', input.comment);
  if (validationError) throw new Error(validationError);
  if (String(request.status ?? '').toUpperCase() !== 'PENDING') throw new Error('Only pending requests can be rejected.');

  await workflowService().from('approval_actions').insert({
    action: 'REJECTED',
    action_by: input.ctx.userId,
    action_comment: input.comment ?? null,
    action_status: 'REJECTED',
    acted_at: new Date().toISOString(),
    approval_request_id: input.id,
    comments: input.comment ?? null,
    document_id: String(request.entity_id ?? ''),
    document_type: String(request.document_type ?? ''),
    ip_address: input.requestMeta?.ipAddress ?? null,
    level: 'LEVEL_ONE',
    step_number: Number(request.current_step ?? 1),
  });

  await workflowService().from('approval_requests').update({
    completed_at: new Date().toISOString(),
    rejected_at: new Date().toISOString(),
    rejected_by: input.ctx.userId,
    rejected_reason: input.comment ?? null,
    status: 'REJECTED',
  }).eq('id', input.id);

  const { config } = await fetchDocumentRecord(String(request.document_type ?? ''), String(request.entity_id ?? ''), input.ctx.organizationId);
  const documentUpdates: Record<string, unknown> = {};
  if (config.statusField) documentUpdates[config.statusField] = 'rejected';
  if (config.approvalStatusField) documentUpdates[config.approvalStatusField] = 'REJECTED';
  if (Object.keys(documentUpdates).length > 0) {
    await workflowService().from(config.table).update(documentUpdates).eq('id', String(request.entity_id ?? ''));
  }

  await insertWorkflowHistory({
    action: buildWorkflowHistoryAction({
      action: 'REJECTED',
      documentType: String(request.document_type ?? ''),
      module: String(request.module_name ?? ''),
    }),
    actorId: input.ctx.userId,
    comment: input.comment ?? null,
    documentId: String(request.entity_id ?? ''),
    documentReference: String(request.document_reference ?? ''),
    documentType: String(request.document_type ?? ''),
    fromStatus: 'PENDING_APPROVAL',
    moduleName: String(request.module_name ?? ''),
    organizationId: input.ctx.organizationId,
    toStatus: 'REJECTED',
  });

  return { rejected: true, requestId: input.id };
}

async function validatePostingPreconditions(input: {
  config: DocumentConfig;
  ctx: WorkflowContext;
  documentId: string;
  documentType: string;
  record: Record<string, unknown>;
}) {
  if (!canPostWorkflowDocument(input.record[input.config.statusField ?? 'status'] as string | undefined)) {
    throw new Error('Document must be approved before posting.');
  }
  if (input.documentType === 'sales_dispatch') {
    const { data, error } = await workflowService()
      .from('sales_dispatch_notes')
      .select('invoice_id, invoices(status, approved_at)')
      .eq('id', input.documentId)
      .single();
    if (error) throw error;
    const invoiceValue = (data as Record<string, unknown>).invoices;
    const invoice = (
      Array.isArray(invoiceValue) ? invoiceValue[0] : invoiceValue
    ) as Record<string, unknown> | null | undefined;
    if (!invoice || !invoice.approved_at) {
      throw new Error('Dispatch posting requires an approved invoice.');
    }
  }
  if (input.documentType === 'journal_entry') {
    const { data, error } = await workflowService()
      .from('journal_entry_lines')
      .select('debit_amount, credit_amount')
      .eq('journal_entry_id', input.documentId);
    if (error) throw error;
    const lines = (data ?? []) as Array<Record<string, unknown>>;
    const debit = lines.reduce((sum, row) => sum + Number(row.debit_amount ?? 0), 0);
    const credit = lines.reduce((sum, row) => sum + Number(row.credit_amount ?? 0), 0);
    if (lines.length < 2 || Math.abs(debit - credit) > 0.01) {
      throw new Error('Journal entry must be balanced before posting.');
    }
  }
}

export async function postWorkflowDocument(input: {
  ctx: WorkflowContext;
  documentId: string;
  documentType: string;
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null };
}) {
  const { config, record } = await fetchDocumentRecord(input.documentType, input.documentId, input.ctx.organizationId);
  await ensureBranchScope(input.ctx, String(record[config.branchField ?? 'branch_id'] ?? ''));
  const existingLock = await isDocumentLocked(config.documentType, input.documentId, input.ctx.organizationId);
  if (existingLock) throw new Error(String((existingLock as Record<string, unknown>).lock_reason ?? 'Document is locked.'));

  const reference = String(record[config.referenceField ?? 'id'] ?? input.documentId);
  const service = workflowService();
  let postingLogId: string | null = null;
  try {
    const { data: postingLog, error: logError } = await service.from('posting_logs').insert({
      document_id: input.documentId,
      document_reference: reference,
      document_type: config.documentType,
      module_name: config.moduleName,
      organization_id: input.ctx.organizationId,
      payload: { triggeredBy: input.ctx.userId },
      posting_action: 'POST',
      posting_status: 'PENDING',
      posted_by: input.ctx.userId,
    }).select().single();
    if (logError) throw logError;
    postingLogId = String((postingLog as Record<string, unknown>).id);

    await validatePostingPreconditions({
      config,
      ctx: input.ctx,
      documentId: input.documentId,
      documentType: config.documentType,
      record,
    });

    const updates: Record<string, unknown> = {};
    if (config.statusField) updates[config.statusField] = 'posted';
    if (config.postedAtField) updates[config.postedAtField] = new Date().toISOString();
    if (config.postedByField) updates[config.postedByField] = input.ctx.userId;
    if (config.postedFlagField) updates[config.postedFlagField] = true;
    const { data, error } = await service.from(config.table).update(updates).eq('id', input.documentId).select().single();
    if (error) throw error;

    await service.from('posting_logs').update({
      error_message: null,
      posted_at: new Date().toISOString(),
      posting_status: 'POSTED',
    }).eq('id', postingLogId);

    await upsertDocumentLock({
      documentId: input.documentId,
      documentType: config.documentType,
      lockedBy: input.ctx.userId,
      lockReason: getDocumentLockReason('POSTED'),
      moduleName: config.moduleName,
      organizationId: input.ctx.organizationId,
    });

    await insertWorkflowHistory({
      action: buildWorkflowHistoryAction({ action: 'POSTED', documentType: config.documentType, module: config.moduleName }),
      actorId: input.ctx.userId,
      documentId: input.documentId,
      documentReference: reference,
      documentType: config.documentType,
      fromStatus: String(record[config.statusField ?? 'status'] ?? 'APPROVED'),
      moduleName: config.moduleName,
      organizationId: input.ctx.organizationId,
      toStatus: 'POSTED',
    });

    await recordAuditLog({
      action: 'WORKFLOW_DOCUMENT_POSTED',
      entityId: input.documentId,
      entityType: config.documentType,
      newValues: { posted: true, postingLogId },
      organizationId: input.ctx.organizationId,
      userProfileId: input.ctx.userId,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return data;
  } catch (error) {
    if (postingLogId) {
      await service.from('posting_logs').update({
        error_message: error instanceof Error ? error.message : 'Posting failed.',
        posted_at: new Date().toISOString(),
        posting_status: 'FAILED',
      }).eq('id', postingLogId);
    }
    throw error;
  }
}

export async function listPostingLogs(organizationId: string) {
  const { data, error } = await workflowService()
    .from('posting_logs')
    .select('id, module_name, document_type, document_id, document_reference, posting_action, posting_status, posted_by, posted_at, error_message')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listWorkflowHistory(organizationId: string, documentType?: string, documentId?: string) {
  let query = workflowService()
    .from('workflow_history')
    .select('id, module_name, document_type, document_id, document_reference, action, from_status, to_status, action_comment, actor_id, action_at, metadata')
    .eq('organization_id', organizationId)
    .order('action_at', { ascending: false });
  if (documentType) query = query.eq('document_type', normalizeWorkflowCode(documentType));
  if (documentId) query = query.eq('document_id', documentId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listCorrections(organizationId: string) {
  const { data, error } = await workflowService()
    .from('correction_requests')
    .select('*')
    .eq('organization_id', organizationId)
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCorrectionRequest(input: {
  body: Record<string, unknown>;
  ctx: WorkflowContext;
}) {
  if (!normalizeWorkflowValue(input.body.documentId as string) || !normalizeWorkflowValue(input.body.documentType as string)) {
    throw new Error('documentId and documentType are required.');
  }
  if (!normalizeWorkflowValue(input.body.correctionReason as string)) throw new Error('correction reason is required.');
  if (!input.body.requestedChanges || typeof input.body.requestedChanges !== 'object') throw new Error('requested changes are required.');

  const { config, record } = await fetchDocumentRecord(String(input.body.documentType), String(input.body.documentId), input.ctx.organizationId);
  const { data, error } = await workflowService().from('correction_requests').insert({
    correction_reason: String(input.body.correctionReason),
    document_id: String(input.body.documentId),
    document_reference: String(input.body.documentReference ?? record[config.referenceField ?? 'id'] ?? input.body.documentId),
    document_type: config.documentType,
    module_name: config.moduleName,
    organization_id: input.ctx.organizationId,
    requested_by: input.ctx.userId,
    requested_changes: input.body.requestedChanges as Record<string, unknown>,
    status: 'REQUESTED',
  }).select().single();
  if (error) throw error;

  if (config.statusField) {
    await workflowService().from(config.table).update({ [config.statusField]: 'correction_requested' }).eq('id', String(input.body.documentId));
  }

  await insertWorkflowHistory({
    action: buildWorkflowHistoryAction({ action: 'CORRECTION_REQUESTED', documentType: config.documentType, module: config.moduleName }),
    actorId: input.ctx.userId,
    comment: String(input.body.correctionReason),
    documentId: String(input.body.documentId),
    documentReference: String(input.body.documentReference ?? ''),
    documentType: config.documentType,
    fromStatus: String(record[config.statusField ?? 'status'] ?? 'POSTED'),
    moduleName: config.moduleName,
    organizationId: input.ctx.organizationId,
    toStatus: 'CORRECTION_REQUESTED',
  });

  return data;
}

export async function approveCorrectionRequest(input: { ctx: WorkflowContext; id: string; comment?: string }) {
  const { data, error } = await workflowService().from('correction_requests').update({
    approved_at: new Date().toISOString(),
    approved_by: input.ctx.userId,
    status: 'APPROVED',
  }).eq('organization_id', input.ctx.organizationId).eq('id', input.id).select().single();
  if (error) throw error;
  await workflowService().from('correction_actions').insert({
    action: 'APPROVED',
    action_by: input.ctx.userId,
    action_comment: input.comment ?? null,
    correction_request_id: input.id,
    organization_id: input.ctx.organizationId,
  });
  return data;
}

export async function rejectCorrectionRequest(input: { ctx: WorkflowContext; id: string; comment?: string }) {
  const validationError = validateWorkflowActionComment('reject', input.comment);
  if (validationError) throw new Error(validationError);
  const { data, error } = await workflowService().from('correction_requests').update({
    rejected_at: new Date().toISOString(),
    rejected_by: input.ctx.userId,
    rejection_reason: input.comment ?? null,
    status: 'REJECTED',
  }).eq('organization_id', input.ctx.organizationId).eq('id', input.id).select().single();
  if (error) throw error;
  await workflowService().from('correction_actions').insert({
    action: 'REJECTED',
    action_by: input.ctx.userId,
    action_comment: input.comment ?? null,
    correction_request_id: input.id,
    organization_id: input.ctx.organizationId,
  });
  return data;
}

export async function applyCorrectionRequest(input: { ctx: WorkflowContext; id: string; comment?: string }) {
  const service = workflowService();
  const { data: request, error } = await service
    .from('correction_requests')
    .select('*')
    .eq('organization_id', input.ctx.organizationId)
    .eq('id', input.id)
    .single();
  if (error) throw error;
  if (String(request.status ?? '').toUpperCase() !== 'APPROVED') throw new Error('Only approved correction requests can be applied.');
  const { config } = await fetchDocumentRecord(String(request.document_type ?? ''), String(request.document_id ?? ''), input.ctx.organizationId);
  if (config.statusField) {
    await service.from(config.table).update({ [config.statusField]: 'corrected', updated_by: input.ctx.userId }).eq('id', String(request.document_id));
  }
  const { data, error: updateError } = await service.from('correction_requests').update({
    applied_at: new Date().toISOString(),
    applied_by: input.ctx.userId,
    status: 'APPLIED',
  }).eq('id', input.id).select().single();
  if (updateError) throw updateError;
  await upsertDocumentLock({
    documentId: String(request.document_id),
    documentType: String(request.document_type),
    lockedBy: input.ctx.userId,
    lockReason: getDocumentLockReason('CORRECTED'),
    moduleName: String(request.module_name),
    organizationId: input.ctx.organizationId,
  });
  return data;
}

export async function listReversals(organizationId: string) {
  const { data, error } = await workflowService().from('reversal_logs').select('*').eq('organization_id', organizationId).order('requested_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createReversalRequest(input: { body: Record<string, unknown>; ctx: WorkflowContext }) {
  if (!normalizeWorkflowValue(input.body.reversalReason as string)) throw new Error('reversal reason is required.');
  const config = getDocumentConfig(String(input.body.documentType ?? ''));
  const { data, error } = await workflowService().from('reversal_logs').insert({
    document_id: String(input.body.documentId ?? ''),
    document_reference: normalizeWorkflowValue(input.body.documentReference as string) || null,
    document_type: config.documentType,
    module_name: config.moduleName,
    organization_id: input.ctx.organizationId,
    requested_by: input.ctx.userId,
    reversal_reason: String(input.body.reversalReason),
    status: 'REQUESTED',
  }).select().single();
  if (error) throw error;
  return data;
}

export async function approveReversalRequest(input: { ctx: WorkflowContext; id: string }) {
  const { data, error } = await workflowService().from('reversal_logs').update({
    approved_at: new Date().toISOString(),
    approved_by: input.ctx.userId,
    status: 'APPROVED',
  }).eq('organization_id', input.ctx.organizationId).eq('id', input.id).select().single();
  if (error) throw error;
  return data;
}

export async function postReversalRequest(input: { ctx: WorkflowContext; id: string }) {
  const service = workflowService();
  const { data: reversal, error } = await service.from('reversal_logs').select('*').eq('organization_id', input.ctx.organizationId).eq('id', input.id).single();
  if (error) throw error;
  if (String(reversal.status ?? '').toUpperCase() !== 'APPROVED') throw new Error('Reversal must be approved before posting.');
  const { config } = await fetchDocumentRecord(String(reversal.document_type ?? ''), String(reversal.document_id ?? ''), input.ctx.organizationId);
  const updates: Record<string, unknown> = {};
  if (config.statusField) updates[config.statusField] = 'reversed';
  await service.from(config.table).update(updates).eq('id', String(reversal.document_id));
  const { data, error: updateError } = await service.from('reversal_logs').update({
    posted_at: new Date().toISOString(),
    posted_by: input.ctx.userId,
    status: 'POSTED',
  }).eq('id', input.id).select().single();
  if (updateError) throw updateError;
  await upsertDocumentLock({
    documentId: String(reversal.document_id),
    documentType: String(reversal.document_type),
    lockedBy: input.ctx.userId,
    lockReason: getDocumentLockReason('REVERSED'),
    moduleName: String(reversal.module_name),
    organizationId: input.ctx.organizationId,
  });
  return data;
}

export async function listVoids(organizationId: string) {
  const { data, error } = await workflowService().from('void_logs').select('*').eq('organization_id', organizationId).order('requested_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createVoidRequest(input: { body: Record<string, unknown>; ctx: WorkflowContext }) {
  if (!normalizeWorkflowValue(input.body.voidReason as string)) throw new Error('void reason is required.');
  const config = getDocumentConfig(String(input.body.documentType ?? ''));
  const { data, error } = await workflowService().from('void_logs').insert({
    document_id: String(input.body.documentId ?? ''),
    document_reference: normalizeWorkflowValue(input.body.documentReference as string) || null,
    document_type: config.documentType,
    module_name: config.moduleName,
    organization_id: input.ctx.organizationId,
    requested_by: input.ctx.userId,
    status: 'REQUESTED',
    void_reason: String(input.body.voidReason),
  }).select().single();
  if (error) throw error;
  return data;
}

export async function approveVoidRequest(input: { ctx: WorkflowContext; id: string }) {
  const { data, error } = await workflowService().from('void_logs').update({
    approved_at: new Date().toISOString(),
    approved_by: input.ctx.userId,
    status: 'APPROVED',
  }).eq('organization_id', input.ctx.organizationId).eq('id', input.id).select().single();
  if (error) throw error;
  return data;
}

export async function postVoidRequest(input: { ctx: WorkflowContext; id: string }) {
  const service = workflowService();
  const { data: voidRequest, error } = await service.from('void_logs').select('*').eq('organization_id', input.ctx.organizationId).eq('id', input.id).single();
  if (error) throw error;
  if (String(voidRequest.status ?? '').toUpperCase() !== 'APPROVED') throw new Error('Void request must be approved before posting.');
  const { config } = await fetchDocumentRecord(String(voidRequest.document_type ?? ''), String(voidRequest.document_id ?? ''), input.ctx.organizationId);
  const updates: Record<string, unknown> = {};
  if (config.statusField) updates[config.statusField] = 'voided';
  if (config.voidedAtField) updates[config.voidedAtField] = new Date().toISOString();
  if (config.voidedByField) updates[config.voidedByField] = input.ctx.userId;
  if (config.voidReasonField) updates[config.voidReasonField] = String(voidRequest.void_reason ?? '');
  await service.from(config.table).update(updates).eq('id', String(voidRequest.document_id));
  const { data, error: updateError } = await service.from('void_logs').update({
    status: 'POSTED',
    voided_at: new Date().toISOString(),
    voided_by: input.ctx.userId,
  }).eq('id', input.id).select().single();
  if (updateError) throw updateError;
  await upsertDocumentLock({
    documentId: String(voidRequest.document_id),
    documentType: String(voidRequest.document_type),
    lockedBy: input.ctx.userId,
    lockReason: getDocumentLockReason('VOIDED'),
    moduleName: String(voidRequest.module_name),
    organizationId: input.ctx.organizationId,
  });
  return data;
}

export async function addWorkflowComment(input: {
  body: { comment?: string; documentId?: string; documentReference?: string; documentType?: string; module?: string };
  ctx: WorkflowContext;
}) {
  if (!normalizeWorkflowValue(input.body.comment)) throw new Error('comment is required.');
  if (!normalizeWorkflowValue(input.body.documentId) || !normalizeWorkflowValue(input.body.documentType) || !normalizeWorkflowValue(input.body.module)) {
    throw new Error('module, documentType, and documentId are required.');
  }
  const { data, error } = await workflowService().from('workflow_comments').insert({
    comment: String(input.body.comment),
    created_by: input.ctx.userId,
    document_id: String(input.body.documentId),
    document_reference: normalizeWorkflowValue(input.body.documentReference) || null,
    document_type: normalizeWorkflowCode(input.body.documentType),
    module_name: normalizeWorkflowCode(input.body.module),
    organization_id: input.ctx.organizationId,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function getWorkflowComments(organizationId: string, documentType: string, documentId: string) {
  const { data, error } = await workflowService()
    .from('workflow_comments')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('document_type', normalizeWorkflowCode(documentType))
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
