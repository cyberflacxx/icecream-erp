export const WORKFLOW_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'READY_TO_POST',
  'POSTED',
  'PARTIALLY_POSTED',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
  'VOIDED',
  'REVERSED',
  'CORRECTION_REQUESTED',
  'CORRECTED',
] as const;

export const APPROVAL_ACTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'CANCELLED'] as const;
export const CORRECTION_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'APPLIED', 'CLOSED'] as const;
export const POSTING_STATUSES = ['PENDING', 'POSTED', 'FAILED', 'REVERSED', 'VOIDED'] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type ApprovalActionStatus = (typeof APPROVAL_ACTION_STATUSES)[number];
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];
export type PostingStatus = (typeof POSTING_STATUSES)[number];

type Primitive = string | number | boolean | null | undefined;

export interface WorkflowDefinitionInput {
  description?: Primitive;
  documentType?: Primitive;
  module?: Primitive;
  name?: Primitive;
}

export interface ApprovalRuleInput {
  action?: Primitive;
  approvalLevel?: Primitive;
  documentType?: Primitive;
  maximumAmount?: Primitive;
  minimumAmount?: Primitive;
  module?: Primitive;
  requiredRoleId?: Primitive;
  selfApprovalAllowed?: Primitive;
}

export function normalizeWorkflowValue(value: Primitive) {
  return String(value ?? '').trim();
}

export function normalizeWorkflowCode(value: Primitive) {
  return normalizeWorkflowValue(value).toUpperCase().replace(/\s+/g, '_');
}

export function toWorkflowNumber(value: Primitive, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function validateWorkflowDefinition(input: WorkflowDefinitionInput) {
  if (!normalizeWorkflowValue(input.module)) return 'module is required.';
  if (!normalizeWorkflowValue(input.documentType)) return 'documentType is required.';
  if (!normalizeWorkflowValue(input.name)) return 'workflow name is required.';
  return null;
}

export function validateApprovalRule(input: ApprovalRuleInput) {
  if (!normalizeWorkflowValue(input.module)) return 'module is required.';
  if (!normalizeWorkflowValue(input.documentType)) return 'documentType is required.';
  if (!normalizeWorkflowValue(input.action)) return 'action is required.';
  if (!normalizeWorkflowValue(input.requiredRoleId)) return 'requiredRoleId is required.';
  if (Math.trunc(toWorkflowNumber(input.approvalLevel, 0)) <= 0) return 'approval level must be greater than zero.';

  const minimum = toWorkflowNumber(input.minimumAmount, 0);
  const maximum = toWorkflowNumber(input.maximumAmount, 0);
  if (minimum < 0 || maximum < 0) return 'amount thresholds must not be negative.';
  if (maximum > 0 && maximum < minimum) return 'maximum amount must be greater than or equal to minimum amount.';
  return null;
}

export function requiresComment(action: Primitive) {
  const normalized = normalizeWorkflowCode(action);
  return normalized === 'REJECT' || normalized === 'REJECTED' || normalized === 'VOID' || normalized === 'REVERSE';
}

export function validateWorkflowActionComment(action: Primitive, comment: Primitive) {
  if (requiresComment(action) && !normalizeWorkflowValue(comment)) {
    return 'comment is required for this action.';
  }
  return null;
}

export function canEditWorkflowDocument(status: Primitive, isLocked: Primitive) {
  if (Boolean(isLocked)) return false;
  const normalized = normalizeWorkflowCode(status);
  return normalized === '' || normalized === 'DRAFT' || normalized === 'REJECTED';
}

export function canPostWorkflowDocument(status: Primitive) {
  const normalized = normalizeWorkflowCode(status);
  return normalized === 'APPROVED' || normalized === 'READY_TO_POST';
}

export function blocksSelfApproval(requestedBy: Primitive, actingUserId: Primitive, selfApprovalAllowed: Primitive) {
  if (Boolean(selfApprovalAllowed)) return false;
  const requester = normalizeWorkflowValue(requestedBy);
  const approver = normalizeWorkflowValue(actingUserId);
  return requester !== '' && approver !== '' && requester === approver;
}

export function nextWorkflowStatusAfterApproval(currentStep: number, totalSteps: number): WorkflowStatus {
  if (currentStep < totalSteps) return 'PENDING_APPROVAL';
  return 'APPROVED';
}

export function getDocumentLockReason(status: Primitive, explicitReason?: Primitive) {
  const normalized = normalizeWorkflowCode(status);
  if (normalizeWorkflowValue(explicitReason)) return normalizeWorkflowValue(explicitReason);
  if (normalized === 'POSTED') return 'Document posted and locked from direct edits.';
  if (normalized === 'VOIDED') return 'Document voided and locked.';
  if (normalized === 'REVERSED') return 'Document reversed and locked.';
  if (normalized === 'CORRECTED') return 'Document corrected through workflow.';
  return 'Document locked by workflow control.';
}

export function buildWorkflowHistoryAction(input: {
  action: Primitive;
  documentType: Primitive;
  module: Primitive;
}) {
  return `${normalizeWorkflowCode(input.module)}_${normalizeWorkflowCode(input.documentType)}_${normalizeWorkflowCode(input.action)}`;
}

export function isPostedLikeStatus(status: Primitive) {
  const normalized = normalizeWorkflowCode(status);
  return normalized === 'POSTED' || normalized === 'COMPLETED' || normalized === 'CLOSED';
}
