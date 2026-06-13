export const ALERT_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'READ', 'FAILED', 'DISMISSED', 'ARCHIVED'] as const;
export const REMINDER_STATUSES = ['PENDING', 'SENT', 'COMPLETED', 'CANCELLED', 'FAILED'] as const;
export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'] as const;

export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

type Primitive = string | number | boolean | null | undefined;

export function normalizeNotificationValue(value: Primitive) {
  return String(value ?? '').trim();
}

export function normalizeNotificationCode(value: Primitive) {
  return normalizeNotificationValue(value).toUpperCase().replace(/\s+/g, '_');
}

export function toInteger(value: Primitive, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

export function severityRank(value: Primitive) {
  switch (normalizeNotificationCode(value)) {
    case 'CRITICAL':
      return 5;
    case 'HIGH':
      return 4;
    case 'MEDIUM':
      return 3;
    case 'LOW':
      return 2;
    default:
      return 1;
  }
}

export function isSeverityAtLeast(value: Primitive, minimum: Primitive) {
  return severityRank(value) >= severityRank(minimum);
}

export function mapSeverityToNotificationType(value: Primitive) {
  switch (normalizeNotificationCode(value)) {
    case 'CRITICAL':
    case 'HIGH':
      return 'ERROR';
    case 'MEDIUM':
      return 'ACTION_REQUIRED';
    case 'LOW':
      return 'WARNING';
    default:
      return 'INFO';
  }
}

export function sortNotificationsByPriority<T extends { createdAt?: Primitive; isRead?: boolean; severity?: Primitive }>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) return severityDelta;
    const unreadDelta = Number(Boolean(left.isRead)) - Number(Boolean(right.isRead));
    if (unreadDelta !== 0) return unreadDelta;
    return new Date(String(right.createdAt ?? 0)).getTime() - new Date(String(left.createdAt ?? 0)).getTime();
  });
}

export function renderNotificationTemplate(template: string, values: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => String(values[key] ?? ''));
}

export function collectTemplatePlaceholders(template: string) {
  return Array.from(new Set(Array.from(template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1])));
}

export function validateTemplatePlaceholders(template: Primitive) {
  const value = normalizeNotificationValue(template);
  const unmatchedOpen = (value.match(/\{\{/g) ?? []).length;
  const unmatchedClose = (value.match(/\}\}/g) ?? []).length;
  if (unmatchedOpen !== unmatchedClose) return 'template placeholders are malformed.';
  return null;
}

export function validateNotificationRule(input: Record<string, Primitive>) {
  if (!normalizeNotificationValue(input.ruleName)) return 'rule name is required.';
  if (!normalizeNotificationValue(input.module)) return 'module is required.';
  if (!normalizeNotificationValue(input.eventType)) return 'event type is required.';
  if (!normalizeNotificationValue(input.severity)) return 'severity is required.';
  if (!normalizeNotificationValue(input.channel)) return 'channel is required.';
  if (!normalizeNotificationValue(input.recipientRoleName) && !normalizeNotificationValue(input.recipientUserId)) {
    return 'recipient user or recipient role is required.';
  }
  return null;
}

export function validateNotificationTemplate(input: Record<string, Primitive>) {
  if (!normalizeNotificationValue(input.templateName)) return 'template name is required.';
  if (!normalizeNotificationValue(input.module)) return 'module is required.';
  if (!normalizeNotificationValue(input.eventType)) return 'event type is required.';
  if (!normalizeNotificationValue(input.titleTemplate)) return 'notification title is required.';
  if (!normalizeNotificationValue(input.messageTemplate)) return 'notification message is required.';
  if (!normalizeNotificationValue(input.channel)) return 'channel is required.';
  return validateTemplatePlaceholders(input.titleTemplate) ?? validateTemplatePlaceholders(input.messageTemplate);
}

export function validateNotificationPreference(input: Record<string, Primitive>) {
  if (!normalizeNotificationValue(input.module)) return 'module is required.';
  if (!normalizeNotificationValue(input.channel)) return 'channel is required.';
  if (!normalizeNotificationValue(input.minimumSeverity)) return 'minimum severity is required.';
  return null;
}

export function validateEscalationRule(input: Record<string, Primitive>) {
  if (!normalizeNotificationValue(input.module)) return 'module is required.';
  if (!normalizeNotificationValue(input.eventType)) return 'event type is required.';
  if (!normalizeNotificationValue(input.initialRecipientRoleName)) return 'initial recipient role is required.';
  if (!normalizeNotificationValue(input.escalationRecipientRoleName)) return 'escalation recipient role is required.';
  if (!normalizeNotificationValue(input.severity)) return 'severity is required.';
  if (toInteger(input.escalationDelayMinutes, 0) <= 0) return 'escalation delay must be greater than zero.';
  return null;
}

export function validateReminderRule(input: Record<string, Primitive>) {
  if (!normalizeNotificationValue(input.module)) return 'module is required.';
  if (!normalizeNotificationValue(input.documentType)) return 'document type is required.';
  if (!normalizeNotificationValue(input.reminderEvent)) return 'reminder event is required.';
  if (!normalizeNotificationValue(input.dueTimeRule)) return 'due time rule is required.';
  if (!normalizeNotificationValue(input.recipientRoleName)) return 'recipient role is required.';
  if (!normalizeNotificationValue(input.message)) return 'notification message is required.';
  return null;
}

export function resolveNotificationLink(input: {
  documentId?: Primitive;
  documentType?: Primitive;
  eventType?: Primitive;
  moduleName?: Primitive;
  referenceId?: Primitive;
}) {
  const documentId = normalizeNotificationValue(input.documentId || input.referenceId);
  const documentType = normalizeNotificationCode(input.documentType);
  const eventType = normalizeNotificationCode(input.eventType);
  const moduleName = normalizeNotificationCode(input.moduleName);

  if (documentType === 'PURCHASE_REQUISITION') return documentId ? `/procurement/requisitions` : '/procurement/requisitions';
  if (documentType === 'PURCHASE_ORDER') return documentId ? `/procurement/purchase-orders/${documentId}` : '/procurement/purchase-orders';
  if (documentType === 'SALES_INVOICE' || eventType === 'INVOICE_APPROVED') return documentId ? `/sales/invoices/${documentId}` : '/sales/invoices';
  if (documentType === 'SALES_DISPATCH' || eventType === 'DISPATCH_READY' || eventType === 'DISPATCH_POSTED') return documentId ? `/sales/dispatches` : '/sales/dispatches';
  if (documentType === 'JOURNAL_ENTRY' || eventType === 'JOURNAL_POSTED') return documentId ? `/finance/journals` : '/finance/journals';
  if (documentType === 'QUALITY_INSPECTION' || eventType === 'QC_FAILED') return '/quality/inspections';
  if (documentType === 'BRANCH_SHIFT_CLOSE' || eventType === 'BRANCH_SHIFT_CLOSURE_DUE') return '/branches';
  if (eventType === 'LOW_STOCK' || moduleName === 'INVENTORY') return '/inventory/stock-balances';
  if (eventType === 'SUPPLIER_SHORTAGE_CREATED') return '/procurement/shortages';
  if (moduleName === 'WORKFLOWS') return '/workflows';
  return '/notifications';
}
