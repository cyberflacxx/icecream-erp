import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blocksSelfApproval,
  buildWorkflowHistoryAction,
  canEditWorkflowDocument,
  canPostWorkflowDocument,
  getDocumentLockReason,
  nextWorkflowStatusAfterApproval,
  validateApprovalRule,
  validateWorkflowActionComment,
  validateWorkflowDefinition,
} from '../src/lib/workflow';

test('workflow definition validation requires module, document type, and name', () => {
  assert.equal(validateWorkflowDefinition({}), 'module is required.');
  assert.equal(
    validateWorkflowDefinition({ module: 'sales' }),
    'documentType is required.',
  );
  assert.equal(
    validateWorkflowDefinition({ module: 'sales', documentType: 'invoice' }),
    'workflow name is required.',
  );
  assert.equal(
    validateWorkflowDefinition({ module: 'sales', documentType: 'invoice', name: 'Invoice Approval' }),
    null,
  );
});

test('approval rule validation enforces role, level, and threshold ordering', () => {
  assert.equal(validateApprovalRule({ module: 'sales', documentType: 'invoice', action: 'approve' }), 'requiredRoleId is required.');
  assert.equal(
    validateApprovalRule({ module: 'sales', documentType: 'invoice', action: 'approve', requiredRoleId: 'role-1', approvalLevel: 0 }),
    'approval level must be greater than zero.',
  );
  assert.equal(
    validateApprovalRule({
      module: 'sales',
      documentType: 'invoice',
      action: 'approve',
      requiredRoleId: 'role-1',
      approvalLevel: 1,
      minimumAmount: 100,
      maximumAmount: 20,
    }),
    'maximum amount must be greater than or equal to minimum amount.',
  );
  assert.equal(
    validateApprovalRule({
      module: 'sales',
      documentType: 'invoice',
      action: 'approve',
      requiredRoleId: 'role-1',
      approvalLevel: 2,
      minimumAmount: 100,
      maximumAmount: 500,
    }),
    null,
  );
});

test('workflow comment validation blocks missing rejection notes', () => {
  assert.equal(validateWorkflowActionComment('reject', ''), 'comment is required for this action.');
  assert.equal(validateWorkflowActionComment('approve', ''), null);
});

test('workflow edit and post guards respect status and lock state', () => {
  assert.equal(canEditWorkflowDocument('DRAFT', false), true);
  assert.equal(canEditWorkflowDocument('POSTED', false), false);
  assert.equal(canEditWorkflowDocument('REJECTED', true), false);
  assert.equal(canPostWorkflowDocument('APPROVED'), true);
  assert.equal(canPostWorkflowDocument('PENDING_APPROVAL'), false);
});

test('self approval blocking, next status, and history action are derived consistently', () => {
  assert.equal(blocksSelfApproval('user-1', 'user-1', false), true);
  assert.equal(blocksSelfApproval('user-1', 'user-2', false), false);
  assert.equal(nextWorkflowStatusAfterApproval(1, 2), 'PENDING_APPROVAL');
  assert.equal(nextWorkflowStatusAfterApproval(2, 2), 'APPROVED');
  assert.equal(
    buildWorkflowHistoryAction({ module: 'sales', documentType: 'invoice', action: 'approved' }),
    'SALES_INVOICE_APPROVED',
  );
});

test('document lock reason uses status-sensitive defaults', () => {
  assert.equal(getDocumentLockReason('POSTED'), 'Document posted and locked from direct edits.');
  assert.equal(getDocumentLockReason('REVERSED'), 'Document reversed and locked.');
  assert.equal(getDocumentLockReason('POSTED', 'Manual lock'), 'Manual lock');
});
