"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const notifications_1 = require("../src/lib/notifications");
(0, node_test_1.default)('notification rule validation enforces recipient, module, event, severity, and channel', () => {
    strict_1.default.equal((0, notifications_1.validateNotificationRule)({}), 'rule name is required.');
    strict_1.default.equal((0, notifications_1.validateNotificationRule)({
        ruleName: 'Low stock',
        module: 'inventory',
        eventType: 'LOW_STOCK',
        severity: 'HIGH',
        channel: 'IN_APP',
    }), 'recipient user or recipient role is required.');
    strict_1.default.equal((0, notifications_1.validateNotificationRule)({
        ruleName: 'Low stock',
        module: 'inventory',
        eventType: 'LOW_STOCK',
        severity: 'HIGH',
        channel: 'IN_APP',
        recipientRoleName: 'Stores Manager',
    }), null);
});
(0, node_test_1.default)('notification templates validate placeholders and render values', () => {
    strict_1.default.equal((0, notifications_1.validateNotificationTemplate)({
        templateName: 'Broken',
        module: 'inventory',
        eventType: 'LOW_STOCK',
        titleTemplate: 'Low stock {{itemName}',
        messageTemplate: 'Quantity {{quantityOnHand}}',
        channel: 'IN_APP',
    }), 'template placeholders are malformed.');
    strict_1.default.equal((0, notifications_1.renderNotificationTemplate)('Low stock: {{itemName}} at {{quantityOnHand}}', {
        itemName: 'Cone Mix',
        quantityOnHand: 4,
    }), 'Low stock: Cone Mix at 4');
});
(0, node_test_1.default)('preference, escalation, and reminder validation enforce required fields', () => {
    strict_1.default.equal((0, notifications_1.validateNotificationPreference)({ module: 'inventory', channel: 'IN_APP' }), 'minimum severity is required.');
    strict_1.default.equal((0, notifications_1.validateEscalationRule)({
        module: 'finance',
        eventType: 'RECEIVABLE_OVERDUE',
        initialRecipientRoleName: 'Accountant',
        escalationRecipientRoleName: 'Finance Manager',
        escalationDelayMinutes: 0,
        severity: 'HIGH',
    }), 'escalation delay must be greater than zero.');
    strict_1.default.equal((0, notifications_1.validateReminderRule)({
        module: 'branch operations',
        documentType: 'branch_shift_close',
        reminderEvent: 'BRANCH_SHIFT_CLOSURE_DUE',
        dueTimeRule: '30 minutes before close',
        recipientRoleName: 'Branch Controller',
        message: 'Shift closure due.',
    }), null);
});
(0, node_test_1.default)('severity ranking and sorting prioritize critical unread alerts', () => {
    strict_1.default.equal((0, notifications_1.isSeverityAtLeast)('CRITICAL', 'HIGH'), true);
    strict_1.default.equal((0, notifications_1.isSeverityAtLeast)('LOW', 'MEDIUM'), false);
    const ordered = (0, notifications_1.sortNotificationsByPriority)([
        { id: '1', severity: 'LOW', isRead: false, createdAt: '2025-01-01T00:00:00.000Z' },
        { id: '2', severity: 'CRITICAL', isRead: true, createdAt: '2025-01-01T00:00:00.000Z' },
        { id: '3', severity: 'CRITICAL', isRead: false, createdAt: '2025-01-02T00:00:00.000Z' },
    ]);
    strict_1.default.deepEqual(ordered.map((row) => row.id), ['3', '2', '1']);
});
(0, node_test_1.default)('notification links resolve to existing dashboard routes', () => {
    strict_1.default.equal((0, notifications_1.resolveNotificationLink)({ moduleName: 'inventory', eventType: 'LOW_STOCK' }), '/inventory/stock-balances');
    strict_1.default.equal((0, notifications_1.resolveNotificationLink)({ documentType: 'sales_invoice', documentId: 'inv-1' }), '/sales/invoices/inv-1');
    strict_1.default.equal((0, notifications_1.resolveNotificationLink)({ moduleName: 'workflows', eventType: 'JOURNAL_POSTED' }), '/finance/journals');
});
