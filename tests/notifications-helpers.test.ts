import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isSeverityAtLeast,
  renderNotificationTemplate,
  resolveNotificationLink,
  sortNotificationsByPriority,
  validateEscalationRule,
  validateNotificationPreference,
  validateNotificationRule,
  validateNotificationTemplate,
  validateReminderRule,
} from '../src/lib/notifications';

test('notification rule validation enforces recipient, module, event, severity, and channel', () => {
  assert.equal(validateNotificationRule({}), 'rule name is required.');
  assert.equal(
    validateNotificationRule({
      ruleName: 'Low stock',
      module: 'inventory',
      eventType: 'LOW_STOCK',
      severity: 'HIGH',
      channel: 'IN_APP',
    }),
    'recipient user or recipient role is required.',
  );
  assert.equal(
    validateNotificationRule({
      ruleName: 'Low stock',
      module: 'inventory',
      eventType: 'LOW_STOCK',
      severity: 'HIGH',
      channel: 'IN_APP',
      recipientRoleName: 'Stores Manager',
    }),
    null,
  );
});

test('notification templates validate placeholders and render values', () => {
  assert.equal(
    validateNotificationTemplate({
      templateName: 'Broken',
      module: 'inventory',
      eventType: 'LOW_STOCK',
      titleTemplate: 'Low stock {{itemName}',
      messageTemplate: 'Quantity {{quantityOnHand}}',
      channel: 'IN_APP',
    }),
    'template placeholders are malformed.',
  );

  assert.equal(
    renderNotificationTemplate('Low stock: {{itemName}} at {{quantityOnHand}}', {
      itemName: 'Cone Mix',
      quantityOnHand: 4,
    }),
    'Low stock: Cone Mix at 4',
  );
});

test('preference, escalation, and reminder validation enforce required fields', () => {
  assert.equal(validateNotificationPreference({ module: 'inventory', channel: 'IN_APP' }), 'minimum severity is required.');
  assert.equal(
    validateEscalationRule({
      module: 'finance',
      eventType: 'RECEIVABLE_OVERDUE',
      initialRecipientRoleName: 'Accountant',
      escalationRecipientRoleName: 'Finance Manager',
      escalationDelayMinutes: 0,
      severity: 'HIGH',
    }),
    'escalation delay must be greater than zero.',
  );
  assert.equal(
    validateReminderRule({
      module: 'branch operations',
      documentType: 'branch_shift_close',
      reminderEvent: 'BRANCH_SHIFT_CLOSURE_DUE',
      dueTimeRule: '30 minutes before close',
      recipientRoleName: 'Branch Controller',
      message: 'Shift closure due.',
    }),
    null,
  );
});

test('severity ranking and sorting prioritize critical unread alerts', () => {
  assert.equal(isSeverityAtLeast('CRITICAL', 'HIGH'), true);
  assert.equal(isSeverityAtLeast('LOW', 'MEDIUM'), false);

  const ordered = sortNotificationsByPriority([
    { id: '1', severity: 'LOW', isRead: false, createdAt: '2025-01-01T00:00:00.000Z' },
    { id: '2', severity: 'CRITICAL', isRead: true, createdAt: '2025-01-01T00:00:00.000Z' },
    { id: '3', severity: 'CRITICAL', isRead: false, createdAt: '2025-01-02T00:00:00.000Z' },
  ]);

  assert.deepEqual(ordered.map((row) => row.id), ['3', '2', '1']);
});

test('notification links resolve to existing dashboard routes', () => {
  assert.equal(resolveNotificationLink({ moduleName: 'inventory', eventType: 'LOW_STOCK' }), '/inventory/stock-balances');
  assert.equal(resolveNotificationLink({ documentType: 'sales_invoice', documentId: 'inv-1' }), '/sales/invoices/inv-1');
  assert.equal(resolveNotificationLink({ moduleName: 'workflows', eventType: 'JOURNAL_POSTED' }), '/finance/journals');
});
