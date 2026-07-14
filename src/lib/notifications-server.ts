import { recordAuditLog, recordSecurityEvent } from '@/lib/security-server';
import {
  isMissingColumnError,
  isMissingRelationshipError,
  isMissingTableError,
} from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  collectTemplatePlaceholders,
  isSeverityAtLeast,
  mapSeverityToNotificationType,
  normalizeNotificationCode,
  normalizeNotificationValue,
  renderNotificationTemplate,
  resolveNotificationLink,
  severityRank,
  sortNotificationsByPriority,
  toInteger,
  validateEscalationRule,
  validateNotificationPreference,
  validateNotificationRule,
  validateNotificationTemplate,
  validateReminderRule,
} from '@/lib/notifications';

type NotificationContext = {
  branchAssignments: string[];
  organizationId: string;
  permissions: string[];
  userId: string;
  warehouseAssignments: string[];
};

type NotificationRecord = Record<string, unknown>;
type NotificationServerError = Error & {
  notificationCode?: string;
  notificationDetail?: string | null;
  notificationStep?: string;
  notificationTable?: string | null;
};

const NOTIFICATION_SETTINGS_CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'] as const;
const NOTIFICATION_SETTINGS_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const NOTIFICATION_API_FAILURE_MESSAGE = 'Notification data is temporarily unavailable. Please try again later.';

export function notificationService() {
  return createServiceRoleClient().schema('icecream_erp');
}

function isMissingNotificationSchema(error: unknown, table: string, columns: string[] = []) {
  return (
    isMissingTableError(error, table) ||
    columns.some((column) => isMissingColumnError(error, table, column))
  );
}

export function buildNotificationSettingsFallback() {
  return {
    channels: [...NOTIFICATION_SETTINGS_CHANNELS],
    severities: [...NOTIFICATION_SETTINGS_SEVERITIES],
    rules: [] as NotificationRecord[],
    templates: [] as NotificationRecord[],
    preferences: [] as NotificationRecord[],
    escalationRules: [] as NotificationRecord[],
    reminderRules: [] as NotificationRecord[],
  };
}

export function buildNotificationAlertDashboardFallback() {
  return {
    stats: {
      criticalAlerts: 0,
      highAlerts: 0,
      pendingApprovals: 0,
      lowStockAlerts: 0,
      overdueInvoices: 0,
      supplierShortages: 0,
      qcFailures: 0,
      branchVariances: 0,
      securityAlerts: 0,
    },
    criticalAlerts: [] as NotificationRecord[],
    lowStockAlerts: [] as NotificationRecord[],
    pendingApprovals: [] as NotificationRecord[],
    overdueInvoices: [] as NotificationRecord[],
    supplierShortages: [] as NotificationRecord[],
    qcFailures: [] as NotificationRecord[],
    branchVariances: [] as NotificationRecord[],
    securityAlerts: [] as NotificationRecord[],
  };
}

function safeNotificationValue(value: unknown, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 300);
}

function getNotificationErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return safeNotificationValue((error as Record<string, unknown>).code, 'UNKNOWN');
  }

  return 'UNKNOWN';
}

function getNotificationErrorDetail(error: unknown) {
  if (typeof error === 'object' && error !== null && 'details' in error) {
    return safeNotificationValue((error as Record<string, unknown>).details, '') || null;
  }

  return null;
}

function getNotificationErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return safeNotificationValue(error.message, 'Unknown notification error');
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return safeNotificationValue((error as Record<string, unknown>).message, 'Unknown notification error');
  }
  return 'Unknown notification error';
}

function wrapNotificationError(error: unknown, step: string, table?: string | null) {
  const wrapped = (error instanceof Error ? error : new Error(getNotificationErrorMessage(error))) as NotificationServerError;
  wrapped.notificationCode = wrapped.notificationCode ?? getNotificationErrorCode(error);
  wrapped.notificationDetail = wrapped.notificationDetail ?? getNotificationErrorDetail(error);
  wrapped.notificationStep = wrapped.notificationStep ?? step;
  wrapped.notificationTable = wrapped.notificationTable ?? table ?? null;
  return wrapped;
}

function throwNotificationError(error: unknown, step: string, table?: string | null): never {
  throw wrapNotificationError(error, step, table);
}

export function getSafeNotificationErrorDetails(error: unknown) {
  const wrapped = error as NotificationServerError;
  return {
    code: wrapped.notificationCode ?? getNotificationErrorCode(error),
    detail: wrapped.notificationDetail ?? getNotificationErrorDetail(error),
    message: getNotificationErrorMessage(error),
    step: wrapped.notificationStep ?? 'notification_route_handler',
    table: wrapped.notificationTable ?? null,
  };
}

function isNotificationSettingsCompatibilityError(error: unknown) {
  return (
    isMissingNotificationSchema(error, 'notification_rules', ['organization_id', 'created_at']) ||
    isMissingNotificationSchema(error, 'notification_templates', ['organization_id', 'created_at']) ||
    isMissingNotificationSchema(error, 'notification_preferences', ['organization_id', 'user_profile_id', 'module_name']) ||
    isMissingNotificationSchema(error, 'escalation_rules', ['organization_id', 'created_at']) ||
    isMissingNotificationSchema(error, 'reminder_rules', ['organization_id', 'created_at'])
  );
}

function isNotificationAlertDashboardCompatibilityError(error: unknown) {
  return (
    isNotificationSettingsCompatibilityError(error) ||
    isMissingNotificationSchema(error, 'notifications', [
      'user_profile_id',
      'module_name',
      'event_type',
      'severity',
      'status',
      'channel',
      'link',
      'branch_id',
      'warehouse_id',
      'metadata',
      'sent_at',
      'sent_by',
      'read_at',
      'read_by',
      'dismissed_at',
      'dismissed_by',
      'failed_at',
      'failure_reason',
    ]) ||
    isMissingNotificationSchema(error, 'stock_balances', ['quantity_on_hand']) ||
    isMissingRelationshipError(error, 'stock_balances', 'items') ||
    isMissingNotificationSchema(error, 'supplier_shortages') ||
    isMissingNotificationSchema(error, 'approval_requests') ||
    isMissingNotificationSchema(error, 'invoices', ['balance_due']) ||
    isMissingRelationshipError(error, 'invoices', 'customers') ||
    isMissingNotificationSchema(error, 'quality_inspections') ||
    isMissingNotificationSchema(error, 'branch_shift_closes', ['cash_variance', 'stock_variance']) ||
    isMissingNotificationSchema(error, 'security_events')
  );
}

async function optionalNotificationRows(
  load: () => Promise<{ data: unknown[] | null; error: unknown }>,
  options: {
    table: string;
    columns?: string[];
    relationshipTargets?: string[];
  },
) {
  const result = await load();
  if (result.error) {
    if (
      isMissingNotificationSchema(result.error, options.table, options.columns) ||
      (options.relationshipTargets ?? []).some((target) =>
        isMissingRelationshipError(result.error, options.table, target),
      )
    ) {
      return [] as NotificationRecord[];
    }
    throwNotificationError(result.error, `read_${options.table}`, options.table);
  }
  return (result.data ?? []) as NotificationRecord[];
}

function notificationSupportsAdminScope(ctx: Pick<NotificationContext, 'permissions'>) {
  return ctx.permissions.includes('settings.manage') || ctx.permissions.includes('audit_log.read') || ctx.permissions.includes('view_audit_logs');
}

function canAccessNotificationRow(ctx: NotificationContext, row: NotificationRecord) {
  if (notificationSupportsAdminScope(ctx)) return true;
  if (String(row.user_profile_id ?? '') !== ctx.userId) return false;
  const branchId = String(row.branch_id ?? '');
  if (branchId && ctx.branchAssignments.length > 0 && !ctx.permissions.includes('view_all_branches') && !ctx.branchAssignments.includes(branchId)) {
    return false;
  }
  const warehouseId = String(row.warehouse_id ?? '');
  if (warehouseId && ctx.warehouseAssignments.length > 0 && !ctx.permissions.includes('view_all_warehouses') && !ctx.warehouseAssignments.includes(warehouseId)) {
    return false;
  }
  return true;
}

function mapNotificationRow(row: NotificationRecord) {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    message: String(row.message ?? ''),
    type: String(row.type ?? 'INFO'),
    severity: String(row.severity ?? row.type ?? 'INFO'),
    status: String(row.status ?? (row.is_read ? 'READ' : 'SENT')),
    channel: String(row.channel ?? 'IN_APP'),
    isRead: Boolean(row.is_read),
    module: String(row.module_name ?? ''),
    eventType: String(row.event_type ?? ''),
    referenceId: row.reference_id ? String(row.reference_id) : null,
    referenceType: row.reference_type ? String(row.reference_type) : null,
    documentId: row.reference_id ? String(row.reference_id) : null,
    documentType: row.reference_type ? String(row.reference_type) : null,
    branchId: row.branch_id ? String(row.branch_id) : null,
    warehouseId: row.warehouse_id ? String(row.warehouse_id) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    readAt: row.read_at ? String(row.read_at) : null,
    dismissedAt: row.dismissed_at ? String(row.dismissed_at) : null,
    link: String(
      row.link ??
        resolveNotificationLink({
          documentId: row.reference_id as string | undefined,
          documentType: row.reference_type as string | undefined,
          eventType: row.event_type as string | undefined,
          moduleName: row.module_name as string | undefined,
          referenceId: row.reference_id as string | undefined,
        }),
    ),
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  };
}

function isLegacyNotificationsCompatibilityError(error: unknown) {
  return isMissingNotificationSchema(error, 'notifications', [
    'user_profile_id',
    'module_name',
    'event_type',
    'severity',
    'status',
    'channel',
    'link',
    'branch_id',
    'warehouse_id',
    'metadata',
    'read_at',
    'dismissed_at',
  ]);
}

function mapLegacyNotificationRow(row: NotificationRecord) {
  return mapNotificationRow({
    ...row,
    channel: 'IN_APP',
    event_type: row.reference_type ?? null,
    link: resolveNotificationLink({
      documentId: row.reference_id ? String(row.reference_id) : undefined,
      documentType: row.reference_type ? String(row.reference_type) : undefined,
      referenceId: row.reference_id ? String(row.reference_id) : undefined,
    }),
    metadata: {},
    severity: row.type ?? 'INFO',
    status: Boolean(row.is_read) ? 'READ' : 'SENT',
    user_profile_id: row.user_profile_id ?? row.user_id ?? null,
  });
}

async function listLegacyNotifications(input: {
  ctx: NotificationContext;
  filters: {
    isRead?: boolean | null;
    limit?: number | null;
    module?: string | null;
    page?: number | null;
    pageSize?: number | null;
    severity?: string | null;
    status?: string | null;
    unreadOnly?: boolean | null;
  };
}) {
  const page = Math.max(1, toInteger(input.filters.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInteger(input.filters.pageSize ?? input.filters.limit, 20)));
  let query = notificationService()
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('organization_id', input.ctx.organizationId)
    .order('created_at', { ascending: false });

  if (!notificationSupportsAdminScope(input.ctx)) {
    query = query.eq('user_id', input.ctx.userId);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) {
    if (isMissingNotificationSchema(error, 'notifications')) {
      return {
        data: [],
        pagination: { page, pageSize, total: 0 },
      };
    }
    throwNotificationError(error, 'list_legacy_notifications', 'notifications');
  }

  let rows = (data ?? []).map((row) => mapLegacyNotificationRow(row as NotificationRecord));

  if (input.filters.module) {
    rows = [];
  }
  if (input.filters.severity) {
    const severity = normalizeNotificationCode(input.filters.severity);
    rows = rows.filter((row) => row.severity === severity);
  }
  if (input.filters.status) {
    const status = normalizeNotificationCode(input.filters.status);
    rows = rows.filter((row) => row.status === status);
  }
  if (input.filters.unreadOnly || input.filters.isRead === false) {
    rows = rows.filter((row) => !row.isRead);
  }
  if (input.filters.isRead === true) {
    rows = rows.filter((row) => row.isRead);
  }

  return {
    data: sortNotificationsByPriority(rows),
    pagination: {
      page,
      pageSize,
      total: count ?? rows.length,
    },
  };
}

async function listUsersByRole(input: {
  branchId?: string | null;
  organizationId: string;
  roleNames: string[];
  warehouseId?: string | null;
}) {
  if (input.roleNames.length === 0) return [] as string[];
  const service = notificationService();
  const normalizedNames = input.roleNames.map((roleName) => normalizeNotificationValue(roleName).toLowerCase());
  const { data, error } = await service
    .from('user_roles')
    .select('user_profile_id, roles(name), users!inner(branch_id, organization_id)')
    .eq('users.organization_id', input.organizationId);
  if (error) throw error;

  const rows = (data ?? []).filter((row) => {
    const roleValue = (row as { roles?: Array<Record<string, unknown>> | Record<string, unknown> | null }).roles;
    const role = Array.isArray(roleValue) ? roleValue[0] : roleValue;
    const name = String(role?.name ?? '').toLowerCase();
    if (!normalizedNames.includes(name)) return false;
    const userValue = (row as { users?: Array<Record<string, unknown>> | Record<string, unknown> | null }).users;
    const user = Array.isArray(userValue) ? userValue[0] : userValue;
    if (input.branchId && String(user?.branch_id ?? '') && String(user?.branch_id ?? '') !== input.branchId) return false;
    return true;
  });

  return Array.from(new Set(rows.map((row) => String((row as Record<string, unknown>).user_profile_id ?? '')).filter(Boolean)));
}

async function resolveRecipientUserIds(input: {
  branchId?: string | null;
  explicitUserIds?: string[];
  organizationId: string;
  recipientRoleNames?: string[];
  warehouseId?: string | null;
}) {
  const fromRoles = await listUsersByRole({
    branchId: input.branchId,
    organizationId: input.organizationId,
    roleNames: input.recipientRoleNames ?? [],
    warehouseId: input.warehouseId,
  });
  return Array.from(new Set([...(input.explicitUserIds ?? []), ...fromRoles].filter(Boolean)));
}

async function getActiveTemplate(input: {
  channel: string;
  eventType: string;
  moduleName: string;
  organizationId: string;
}) {
  const { data, error } = await notificationService()
    .from('notification_templates')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('module_name', input.moduleName)
    .eq('event_type', input.eventType)
    .eq('channel', input.channel)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (
      isMissingNotificationSchema(error, 'notification_templates', [
        'organization_id',
        'module_name',
        'event_type',
        'channel',
        'is_active',
        'created_at',
      ])
    ) return null;
    throw error;
  }
  return data as NotificationRecord | null;
}

async function getPreferencesForUsers(input: {
  channel: string;
  moduleName: string;
  organizationId: string;
  userIds: string[];
}) {
  if (input.userIds.length === 0) return new Map<string, NotificationRecord>();
  const { data, error } = await notificationService()
    .from('notification_preferences')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('module_name', input.moduleName)
    .eq('channel', input.channel)
    .eq('is_active', true)
    .in('user_profile_id', input.userIds);
  if (error) {
    if (
      isMissingNotificationSchema(error, 'notification_preferences', [
        'organization_id',
        'module_name',
        'channel',
        'is_active',
        'user_profile_id',
      ])
    ) {
      return new Map<string, NotificationRecord>();
    }
    throw error;
  }
  return new Map((data ?? []).map((row) => [String((row as NotificationRecord).user_profile_id), row as NotificationRecord]));
}

export async function listNotifications(input: {
  ctx: NotificationContext;
  filters?: {
    isRead?: boolean | null;
    limit?: number | null;
    module?: string | null;
    page?: number | null;
    pageSize?: number | null;
    severity?: string | null;
    status?: string | null;
    unreadOnly?: boolean | null;
  };
}) {
  const filters = input.filters ?? {};
  const page = Math.max(1, toInteger(filters.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInteger(filters.pageSize ?? filters.limit, 20)));
  let query = notificationService()
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('organization_id', input.ctx.organizationId)
    .order('created_at', { ascending: false });

  if (!notificationSupportsAdminScope(input.ctx)) {
    query = query.eq('user_profile_id', input.ctx.userId);
  }
  if (filters.module) query = query.eq('module_name', normalizeNotificationCode(filters.module));
  if (filters.severity) query = query.eq('severity', normalizeNotificationCode(filters.severity));
  if (filters.status) query = query.eq('status', normalizeNotificationCode(filters.status));
  if (filters.unreadOnly || filters.isRead === false) query = query.eq('is_read', false);
  if (filters.isRead === true) query = query.eq('is_read', true);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) {
    if (isMissingNotificationSchema(error, 'notifications')) {
      return {
        data: [],
        pagination: {
          page,
          pageSize,
          total: 0,
        },
      };
    }
    if (isLegacyNotificationsCompatibilityError(error)) {
      return listLegacyNotifications({ ctx: input.ctx, filters });
    }
    throwNotificationError(error, 'list_notifications', 'notifications');
  }

  const rows = (data ?? []).filter((row) => canAccessNotificationRow(input.ctx, row as NotificationRecord)).map((row) => mapNotificationRow(row as NotificationRecord));
  return {
    data: sortNotificationsByPriority(rows),
    pagination: {
      page,
      pageSize,
      total: count ?? rows.length,
    },
  };
}

export async function countUnreadNotifications(ctx: NotificationContext) {
  const modernResult = await notificationService()
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', ctx.organizationId)
    .eq('user_profile_id', ctx.userId)
    .eq('is_read', false);
  let count = modernResult.count;
  let error = modernResult.error;
  if (error) {
    if (isMissingNotificationSchema(error, 'notifications')) return 0;
    if (isLegacyNotificationsCompatibilityError(error)) {
      const legacyResult = await notificationService()
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', ctx.organizationId)
        .eq('user_id', ctx.userId)
        .eq('is_read', false);
      if (legacyResult.error) {
        if (isMissingNotificationSchema(legacyResult.error, 'notifications')) return 0;
        throwNotificationError(legacyResult.error, 'count_unread_notifications_legacy', 'notifications');
      }
      return legacyResult.count ?? 0;
    }
    throwNotificationError(error, 'count_unread_notifications', 'notifications');
  }
  return count ?? 0;
}

export async function markNotificationRead(input: { ctx: NotificationContext; id: string }) {
  const { data: existing, error: fetchError } = await notificationService()
    .from('notifications')
    .select('*')
    .eq('organization_id', input.ctx.organizationId)
    .eq('id', input.id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing || !canAccessNotificationRow(input.ctx, existing as NotificationRecord)) throw new Error('Notification not found');

  const { data, error } = await notificationService()
    .from('notifications')
    .update({
      is_read: true,
      status: 'READ',
      read_at: new Date().toISOString(),
      read_by: input.ctx.userId,
    })
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw error;
  return mapNotificationRow(data as NotificationRecord);
}

export async function dismissNotification(input: { ctx: NotificationContext; id: string }) {
  const { data: existing, error: fetchError } = await notificationService()
    .from('notifications')
    .select('*')
    .eq('organization_id', input.ctx.organizationId)
    .eq('id', input.id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing || !canAccessNotificationRow(input.ctx, existing as NotificationRecord)) throw new Error('Notification not found');

  const { data, error } = await notificationService()
    .from('notifications')
    .update({
      dismissed_at: new Date().toISOString(),
      dismissed_by: input.ctx.userId,
      status: 'DISMISSED',
    })
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw error;
  return mapNotificationRow(data as NotificationRecord);
}

export async function markAllNotificationsRead(ctx: NotificationContext) {
  const { error } = await notificationService()
    .from('notifications')
    .update({
      is_read: true,
      status: 'READ',
      read_at: new Date().toISOString(),
      read_by: ctx.userId,
    })
    .eq('organization_id', ctx.organizationId)
    .eq('user_profile_id', ctx.userId)
    .eq('is_read', false);
  if (error) throw error;
  return { updated: true };
}

export async function listNotificationRules(organizationId: string) {
  const { data, error } = await notificationService()
    .from('notification_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingNotificationSchema(error, 'notification_rules', ['organization_id', 'created_at'])) return [];
    throwNotificationError(error, 'list_notification_rules', 'notification_rules');
  }
  return data ?? [];
}

export async function createNotificationRule(input: { body: Record<string, unknown>; ctx: NotificationContext; requestMeta?: { ipAddress?: string | null; userAgent?: string | null } }) {
  const body = input.body as Record<string, string | number | boolean | null | undefined>;
  const validationError = validateNotificationRule(body as Record<string, string>);
  if (validationError) throw new Error(validationError);
  const payload = {
    organization_id: input.ctx.organizationId,
    rule_name: normalizeNotificationValue(body.ruleName),
    module_name: normalizeNotificationCode(body.module),
    event_type: normalizeNotificationCode(body.eventType),
    severity: normalizeNotificationCode(body.severity),
    recipient_role_name: normalizeNotificationValue(body.recipientRoleName) || null,
    recipient_user_id: normalizeNotificationValue(body.recipientUserId) || null,
    recipient_branch_id: normalizeNotificationValue(body.recipientBranchId) || null,
    recipient_warehouse_id: normalizeNotificationValue(body.recipientWarehouseId) || null,
    channel: normalizeNotificationCode(body.channel),
    template_id: normalizeNotificationValue(body.templateId) || null,
    is_active: body.isActive !== false,
    created_by: input.ctx.userId,
    updated_by: input.ctx.userId,
  };
  const { data, error } = await notificationService().from('notification_rules').insert(payload).select('*').single();
  if (error) throw error;
  await recordAuditLog({
    action: 'NOTIFICATION_RULE_CREATED',
    entityId: String((data as NotificationRecord).id),
    entityType: 'notification_rule',
    newValues: payload,
    organizationId: input.ctx.organizationId,
    userProfileId: input.ctx.userId,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });
  return data;
}

export async function updateNotificationRule(input: { body: Record<string, unknown>; ctx: NotificationContext; id: string; requestMeta?: { ipAddress?: string | null; userAgent?: string | null } }) {
  const updates: Record<string, unknown> = { updated_by: input.ctx.userId };
  if (input.body.ruleName !== undefined) updates.rule_name = normalizeNotificationValue(input.body.ruleName as string);
  if (input.body.module !== undefined) updates.module_name = normalizeNotificationCode(input.body.module as string);
  if (input.body.eventType !== undefined) updates.event_type = normalizeNotificationCode(input.body.eventType as string);
  if (input.body.severity !== undefined) updates.severity = normalizeNotificationCode(input.body.severity as string);
  if (input.body.recipientRoleName !== undefined) updates.recipient_role_name = normalizeNotificationValue(input.body.recipientRoleName as string) || null;
  if (input.body.recipientUserId !== undefined) updates.recipient_user_id = normalizeNotificationValue(input.body.recipientUserId as string) || null;
  if (input.body.recipientBranchId !== undefined) updates.recipient_branch_id = normalizeNotificationValue(input.body.recipientBranchId as string) || null;
  if (input.body.recipientWarehouseId !== undefined) updates.recipient_warehouse_id = normalizeNotificationValue(input.body.recipientWarehouseId as string) || null;
  if (input.body.channel !== undefined) updates.channel = normalizeNotificationCode(input.body.channel as string);
  if (input.body.templateId !== undefined) updates.template_id = normalizeNotificationValue(input.body.templateId as string) || null;
  if (input.body.isActive !== undefined) updates.is_active = Boolean(input.body.isActive);
  const { data, error } = await notificationService()
    .from('notification_rules')
    .update(updates)
    .eq('organization_id', input.ctx.organizationId)
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw error;
  await recordAuditLog({
    action: 'NOTIFICATION_RULE_UPDATED',
    entityId: input.id,
    entityType: 'notification_rule',
    newValues: updates,
    organizationId: input.ctx.organizationId,
    userProfileId: input.ctx.userId,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });
  return data;
}

export async function listNotificationTemplates(organizationId: string) {
  const { data, error } = await notificationService()
    .from('notification_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingNotificationSchema(error, 'notification_templates', ['organization_id', 'created_at'])) return [];
    throwNotificationError(error, 'list_notification_templates', 'notification_templates');
  }
  return data ?? [];
}

export async function createNotificationTemplate(input: { body: Record<string, unknown>; ctx: NotificationContext; requestMeta?: { ipAddress?: string | null; userAgent?: string | null } }) {
  const body = input.body as Record<string, string | number | boolean | null | undefined>;
  const validationError = validateNotificationTemplate(body as Record<string, string>);
  if (validationError) throw new Error(validationError);
  const titleTemplate = normalizeNotificationValue(body.titleTemplate);
  const messageTemplate = normalizeNotificationValue(body.messageTemplate);
  const payload = {
    organization_id: input.ctx.organizationId,
    template_name: normalizeNotificationValue(body.templateName),
    module_name: normalizeNotificationCode(body.module),
    event_type: normalizeNotificationCode(body.eventType),
    title_template: titleTemplate,
    message_template: messageTemplate,
    channel: normalizeNotificationCode(body.channel),
    supported_placeholders: Array.from(new Set([...collectTemplatePlaceholders(titleTemplate), ...collectTemplatePlaceholders(messageTemplate)])),
    is_active: body.isActive !== false,
    created_by: input.ctx.userId,
    updated_by: input.ctx.userId,
  };
  const { data, error } = await notificationService().from('notification_templates').insert(payload).select('*').single();
  if (error) throw error;
  await recordAuditLog({
    action: 'NOTIFICATION_TEMPLATE_CREATED',
    entityId: String((data as NotificationRecord).id),
    entityType: 'notification_template',
    newValues: payload,
    organizationId: input.ctx.organizationId,
    userProfileId: input.ctx.userId,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });
  return data;
}

export async function updateNotificationTemplate(input: { body: Record<string, unknown>; ctx: NotificationContext; id: string; requestMeta?: { ipAddress?: string | null; userAgent?: string | null } }) {
  const updates: Record<string, unknown> = { updated_by: input.ctx.userId };
  if (input.body.templateName !== undefined) updates.template_name = normalizeNotificationValue(input.body.templateName as string);
  if (input.body.module !== undefined) updates.module_name = normalizeNotificationCode(input.body.module as string);
  if (input.body.eventType !== undefined) updates.event_type = normalizeNotificationCode(input.body.eventType as string);
  if (input.body.titleTemplate !== undefined) updates.title_template = normalizeNotificationValue(input.body.titleTemplate as string);
  if (input.body.messageTemplate !== undefined) updates.message_template = normalizeNotificationValue(input.body.messageTemplate as string);
  if (input.body.channel !== undefined) updates.channel = normalizeNotificationCode(input.body.channel as string);
  if (input.body.isActive !== undefined) updates.is_active = Boolean(input.body.isActive);
  const placeholders = Array.from(
    new Set([
      ...collectTemplatePlaceholders(String(updates.title_template ?? '')),
      ...collectTemplatePlaceholders(String(updates.message_template ?? '')),
    ]),
  );
  if (placeholders.length > 0) updates.supported_placeholders = placeholders;
  const { data, error } = await notificationService()
    .from('notification_templates')
    .update(updates)
    .eq('organization_id', input.ctx.organizationId)
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw error;
  await recordAuditLog({
    action: 'NOTIFICATION_TEMPLATE_UPDATED',
    entityId: input.id,
    entityType: 'notification_template',
    newValues: updates,
    organizationId: input.ctx.organizationId,
    userProfileId: input.ctx.userId,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });
  return data;
}

export async function listNotificationPreferences(ctx: NotificationContext) {
  const { data, error } = await notificationService()
    .from('notification_preferences')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .eq('user_profile_id', ctx.userId)
    .order('module_name', { ascending: true });
  if (error) {
    if (isMissingNotificationSchema(error, 'notification_preferences', ['organization_id', 'user_profile_id', 'module_name'])) return [];
    throwNotificationError(error, 'list_notification_preferences', 'notification_preferences');
  }
  return data ?? [];
}

export async function upsertNotificationPreferences(input: { body: Array<Record<string, unknown>>; ctx: NotificationContext }) {
  const rows = input.body.map((row) => {
    const normalizedRow = row as Record<string, string | number | boolean | null | undefined>;
    const validationError = validateNotificationPreference(normalizedRow as Record<string, string>);
    if (validationError) throw new Error(validationError);
    return {
      organization_id: input.ctx.organizationId,
      user_profile_id: input.ctx.userId,
      module_name: normalizeNotificationCode(normalizedRow.module),
      channel: normalizeNotificationCode(normalizedRow.channel),
      enabled: normalizedRow.enabled !== false,
      minimum_severity: normalizeNotificationCode(normalizedRow.minimumSeverity),
      is_active: normalizedRow.isActive !== false,
      created_by: input.ctx.userId,
      updated_by: input.ctx.userId,
    };
  });
  const { data, error } = await notificationService()
    .from('notification_preferences')
    .upsert(rows, { onConflict: 'organization_id,user_profile_id,module_name,channel' })
    .select('*');
  if (error) throw error;
  return data ?? [];
}

export async function listEscalationRules(organizationId: string) {
  const { data, error } = await notificationService()
    .from('escalation_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingNotificationSchema(error, 'escalation_rules', ['organization_id', 'created_at'])) return [];
    throwNotificationError(error, 'list_escalation_rules', 'escalation_rules');
  }
  return data ?? [];
}

export async function createEscalationRule(input: { body: Record<string, unknown>; ctx: NotificationContext }) {
  const body = input.body as Record<string, string | number | boolean | null | undefined>;
  const validationError = validateEscalationRule(body as Record<string, string>);
  if (validationError) throw new Error(validationError);
  const payload = {
    organization_id: input.ctx.organizationId,
    module_name: normalizeNotificationCode(body.module),
    event_type: normalizeNotificationCode(body.eventType),
    initial_recipient_role_name: normalizeNotificationValue(body.initialRecipientRoleName),
    escalation_recipient_role_name: normalizeNotificationValue(body.escalationRecipientRoleName),
    escalation_delay_minutes: toInteger(body.escalationDelayMinutes, 0),
    severity: normalizeNotificationCode(body.severity),
    is_active: body.isActive !== false,
    created_by: input.ctx.userId,
    updated_by: input.ctx.userId,
  };
  const { data, error } = await notificationService().from('escalation_rules').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateEscalationRule(input: { body: Record<string, unknown>; ctx: NotificationContext; id: string }) {
  const updates: Record<string, unknown> = { updated_by: input.ctx.userId };
  if (input.body.module !== undefined) updates.module_name = normalizeNotificationCode(input.body.module as string);
  if (input.body.eventType !== undefined) updates.event_type = normalizeNotificationCode(input.body.eventType as string);
  if (input.body.initialRecipientRoleName !== undefined) updates.initial_recipient_role_name = normalizeNotificationValue(input.body.initialRecipientRoleName as string);
  if (input.body.escalationRecipientRoleName !== undefined) updates.escalation_recipient_role_name = normalizeNotificationValue(input.body.escalationRecipientRoleName as string);
  if (input.body.escalationDelayMinutes !== undefined) updates.escalation_delay_minutes = toInteger(input.body.escalationDelayMinutes as number, 0);
  if (input.body.severity !== undefined) updates.severity = normalizeNotificationCode(input.body.severity as string);
  if (input.body.isActive !== undefined) updates.is_active = Boolean(input.body.isActive);
  const { data, error } = await notificationService().from('escalation_rules').update(updates).eq('organization_id', input.ctx.organizationId).eq('id', input.id).select('*').single();
  if (error) throw error;
  return data;
}

export async function listReminderRules(organizationId: string) {
  const { data, error } = await notificationService().from('reminder_rules').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
  if (error) {
    if (isMissingNotificationSchema(error, 'reminder_rules', ['organization_id', 'created_at'])) return [];
    throwNotificationError(error, 'list_reminder_rules', 'reminder_rules');
  }
  return data ?? [];
}

export async function createReminderRule(input: { body: Record<string, unknown>; ctx: NotificationContext }) {
  const body = input.body as Record<string, string | number | boolean | null | undefined>;
  const validationError = validateReminderRule(body as Record<string, string>);
  if (validationError) throw new Error(validationError);
  const payload = {
    organization_id: input.ctx.organizationId,
    module_name: normalizeNotificationCode(body.module),
    document_type: normalizeNotificationCode(body.documentType),
    reminder_event: normalizeNotificationCode(body.reminderEvent),
    due_time_rule: normalizeNotificationValue(body.dueTimeRule),
    recipient_role_name: normalizeNotificationValue(body.recipientRoleName),
    message: normalizeNotificationValue(body.message),
    is_active: body.isActive !== false,
    created_by: input.ctx.userId,
    updated_by: input.ctx.userId,
  };
  const { data, error } = await notificationService().from('reminder_rules').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateReminderRule(input: { body: Record<string, unknown>; ctx: NotificationContext; id: string }) {
  const updates: Record<string, unknown> = { updated_by: input.ctx.userId };
  if (input.body.module !== undefined) updates.module_name = normalizeNotificationCode(input.body.module as string);
  if (input.body.documentType !== undefined) updates.document_type = normalizeNotificationCode(input.body.documentType as string);
  if (input.body.reminderEvent !== undefined) updates.reminder_event = normalizeNotificationCode(input.body.reminderEvent as string);
  if (input.body.dueTimeRule !== undefined) updates.due_time_rule = normalizeNotificationValue(input.body.dueTimeRule as string);
  if (input.body.recipientRoleName !== undefined) updates.recipient_role_name = normalizeNotificationValue(input.body.recipientRoleName as string);
  if (input.body.message !== undefined) updates.message = normalizeNotificationValue(input.body.message as string);
  if (input.body.isActive !== undefined) updates.is_active = Boolean(input.body.isActive);
  const { data, error } = await notificationService().from('reminder_rules').update(updates).eq('organization_id', input.ctx.organizationId).eq('id', input.id).select('*').single();
  if (error) throw error;
  return data;
}

export async function listNotificationDeliveryLogs(organizationId: string) {
  const { data, error } = await notificationService()
    .from('notification_delivery_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    if (isMissingNotificationSchema(error, 'notification_delivery_logs', ['organization_id', 'created_at'])) return [];
    throwNotificationError(error, 'list_notification_delivery_logs', 'notification_delivery_logs');
  }
  return data ?? [];
}

export async function getNotificationSettings(ctx: NotificationContext) {
  try {
    const [rules, templates, preferences, escalationRules, reminderRules] = await Promise.all([
      listNotificationRules(ctx.organizationId),
      listNotificationTemplates(ctx.organizationId),
      listNotificationPreferences(ctx),
      listEscalationRules(ctx.organizationId),
      listReminderRules(ctx.organizationId),
    ]);
    return {
      channels: [...NOTIFICATION_SETTINGS_CHANNELS],
      severities: [...NOTIFICATION_SETTINGS_SEVERITIES],
      rules,
      templates,
      preferences,
      escalationRules,
      reminderRules,
    };
  } catch (error) {
    if (isNotificationSettingsCompatibilityError(error)) {
      return buildNotificationSettingsFallback();
    }
    throw error;
  }
}

export async function emitNotificationEvent(input: {
  actorUserId?: string | null;
  branchId?: string | null;
  channel?: string | null;
  documentId?: string | null;
  documentType?: string | null;
  eventType: string;
  explicitTitle?: string | null;
  explicitMessage?: string | null;
  metadata?: Record<string, unknown>;
  moduleName: string;
  organizationId: string;
  recipientRoleNames?: string[];
  recipientUserIds?: string[];
  severity: string;
  warehouseId?: string | null;
}) {
  const moduleName = normalizeNotificationCode(input.moduleName);
  const eventType = normalizeNotificationCode(input.eventType);
  const fallbackChannel = normalizeNotificationCode(input.channel ?? 'IN_APP');
  const service = notificationService();

  const { data: rules, error: ruleError } = await service
    .from('notification_rules')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('module_name', moduleName)
    .eq('event_type', eventType)
    .eq('is_active', true);
  if (ruleError && !isMissingNotificationSchema(ruleError, 'notification_rules')) {
    throw ruleError;
  }

  const activeRules = (isMissingNotificationSchema(ruleError, 'notification_rules') ? [] : (rules ?? [])) as NotificationRecord[];
  const roleNames = [
    ...new Set([
      ...(input.recipientRoleNames ?? []),
      ...activeRules.map((rule) => normalizeNotificationValue(rule.recipient_role_name as string | undefined)).filter(Boolean),
    ]),
  ];
  const explicitUserIds = [
    ...new Set([
      ...(input.recipientUserIds ?? []),
      ...activeRules.map((rule) => normalizeNotificationValue(rule.recipient_user_id as string | undefined)).filter(Boolean),
    ]),
  ];
  const recipientUserIds = await resolveRecipientUserIds({
    branchId: input.branchId,
    explicitUserIds,
    organizationId: input.organizationId,
    recipientRoleNames: roleNames,
    warehouseId: input.warehouseId,
  });
  if (recipientUserIds.length === 0) return { created: 0, notificationIds: [] as string[] };

  const preferences = await getPreferencesForUsers({
    channel: fallbackChannel,
    moduleName,
    organizationId: input.organizationId,
    userIds: recipientUserIds,
  });

  const baseTemplate = await getActiveTemplate({
    channel: fallbackChannel,
    eventType,
    moduleName,
    organizationId: input.organizationId,
  });

  const createdIds: string[] = [];
  for (const userId of recipientUserIds) {
    const preference = preferences.get(userId);
    if (preference) {
      if (!Boolean(preference.enabled)) continue;
      if (!isSeverityAtLeast(input.severity, preference.minimum_severity as string | undefined)) continue;
    }

    const title = baseTemplate
      ? renderNotificationTemplate(String(baseTemplate.title_template ?? ''), input.metadata ?? {})
      : normalizeNotificationValue(input.explicitTitle) || `${moduleName.replace(/_/g, ' ')} ${eventType.replace(/_/g, ' ')}`;
    const message = baseTemplate
      ? renderNotificationTemplate(String(baseTemplate.message_template ?? ''), input.metadata ?? {})
      : normalizeNotificationValue(input.explicitMessage) || 'A new operational alert requires attention.';
    const notificationPayload = {
      organization_id: input.organizationId,
      user_profile_id: userId,
      title,
      message,
      type: mapSeverityToNotificationType(input.severity),
      is_read: false,
      reference_type: normalizeNotificationCode(input.documentType || eventType),
      reference_id: normalizeNotificationValue(input.documentId) || null,
      module_name: moduleName,
      event_type: eventType,
      severity: normalizeNotificationCode(input.severity),
      status: 'SENT',
      channel: fallbackChannel,
      link: resolveNotificationLink({
        documentId: input.documentId,
        documentType: input.documentType,
        eventType,
        moduleName,
      }),
      branch_id: normalizeNotificationValue(input.branchId) || null,
      warehouse_id: normalizeNotificationValue(input.warehouseId) || null,
      metadata: input.metadata ?? {},
      sent_at: new Date().toISOString(),
      sent_by: input.actorUserId ?? null,
    };
    const { data: notification, error: notificationError } = await service.from('notifications').insert(notificationPayload).select('*').single();
    if (notificationError) {
      if (isMissingNotificationSchema(notificationError, 'notifications')) {
        return { created: 0, notificationIds: [] as string[] };
      }
      throw notificationError;
    }
    createdIds.push(String((notification as NotificationRecord).id));

    const deliveryLogResult = await service.from('notification_delivery_logs').insert({
      organization_id: input.organizationId,
      notification_id: (notification as NotificationRecord).id,
      recipient_user_id: userId,
      channel: fallbackChannel,
      delivery_status: fallbackChannel === 'IN_APP' ? 'SENT' : 'FAILED',
      sent_at: new Date().toISOString(),
      failure_reason: fallbackChannel === 'IN_APP' ? null : `${fallbackChannel} delivery is not configured in this environment.`,
      payload: input.metadata ?? {},
    });
    if (deliveryLogResult.error && !isMissingNotificationSchema(deliveryLogResult.error, 'notification_delivery_logs')) {
      throw deliveryLogResult.error;
    }

    const communicationAuditResult = await service.from('communication_audit_logs').insert({
      organization_id: input.organizationId,
      notification_id: (notification as NotificationRecord).id,
      channel: fallbackChannel,
      action: 'NOTIFICATION_SENT',
      recipient_user_id: userId,
      payload: input.metadata ?? {},
      created_by: input.actorUserId ?? null,
    });
    if (communicationAuditResult.error && !isMissingNotificationSchema(communicationAuditResult.error, 'communication_audit_logs')) {
      throw communicationAuditResult.error;
    }
  }

  const escalationRules = await listEscalationRules(input.organizationId);
  const matchingEscalations = escalationRules.filter((rule) => String((rule as NotificationRecord).module_name ?? '') === moduleName && String((rule as NotificationRecord).event_type ?? '') === eventType);
  for (const rule of matchingEscalations) {
    const recipients = await resolveRecipientUserIds({
      branchId: input.branchId,
      explicitUserIds: [],
      organizationId: input.organizationId,
      recipientRoleNames: [String((rule as NotificationRecord).escalation_recipient_role_name ?? '')],
      warehouseId: input.warehouseId,
    });
    for (const notificationId of createdIds) {
      for (const userId of recipients) {
        const escalationLogResult = await service.from('escalation_logs').insert({
          organization_id: input.organizationId,
          notification_id: notificationId,
          escalation_rule_id: (rule as NotificationRecord).id,
          escalation_recipient_user_id: userId,
          escalation_status: 'PENDING',
          details: {
            delayMinutes: Number((rule as NotificationRecord).escalation_delay_minutes ?? 0),
          },
        });
        if (escalationLogResult.error && !isMissingNotificationSchema(escalationLogResult.error, 'escalation_logs')) {
          throw escalationLogResult.error;
        }
      }
    }
  }

  return { created: createdIds.length, notificationIds: createdIds };
}

export async function getNotificationAlertDashboard(ctx: NotificationContext) {
  try {
    const service = notificationService();
    const today = new Date().toISOString().slice(0, 10);
    const [stockBalances, shortages, approvals, invoices, inspections, shifts, securityEvents] = await Promise.all([
      optionalNotificationRows(
        async () =>
          service
            .from('stock_balances')
            .select('id, quantity_on_hand, warehouse_id, items(name, code, reorder_level)')
            .eq('organization_id', ctx.organizationId),
        {
          table: 'stock_balances',
          columns: ['organization_id', 'quantity_on_hand', 'warehouse_id'],
          relationshipTargets: ['items'],
        },
      ),
      optionalNotificationRows(
        async () =>
          service
            .from('supplier_shortages')
            .select('*')
            .eq('organization_id', ctx.organizationId)
            .order('created_at', { ascending: false })
            .limit(20),
        { table: 'supplier_shortages', columns: ['organization_id', 'created_at'] },
      ),
      optionalNotificationRows(
        async () =>
          service
            .from('approval_requests')
            .select('id, module_name, document_type, document_reference, status, requested_at')
            .eq('organization_id', ctx.organizationId)
            .eq('status', 'PENDING'),
        {
          table: 'approval_requests',
          columns: ['organization_id', 'module_name', 'document_type', 'document_reference', 'status', 'requested_at'],
        },
      ),
      optionalNotificationRows(
        async () =>
          service
            .from('invoices')
            .select('id, invoice_number, due_date, balance_due, status, customers(name)')
            .eq('organization_id', ctx.organizationId)
            .gt('balance_due', 0)
            .order('due_date', { ascending: true })
            .limit(20),
        {
          table: 'invoices',
          columns: ['organization_id', 'invoice_number', 'due_date', 'balance_due', 'status'],
          relationshipTargets: ['customers'],
        },
      ),
      optionalNotificationRows(
        async () =>
          service
            .from('quality_inspections')
            .select('id, inspection_number, qc_status, inspection_type, inspection_date')
            .eq('organization_id', ctx.organizationId)
            .order('inspection_date', { ascending: false })
            .limit(20),
        {
          table: 'quality_inspections',
          columns: ['organization_id', 'inspection_number', 'qc_status', 'inspection_type', 'inspection_date'],
        },
      ),
      optionalNotificationRows(
        async () =>
          service
            .from('branch_shift_closes')
            .select('id, branch_id, shift_date, cash_variance, stock_variance, status')
            .eq('organization_id', ctx.organizationId)
            .order('shift_date', { ascending: false })
            .limit(20),
        {
          table: 'branch_shift_closes',
          columns: ['organization_id', 'shift_date', 'cash_variance', 'stock_variance', 'status'],
        },
      ),
      optionalNotificationRows(
        async () =>
          service
            .from('security_events')
            .select('id, event_type, status, details, created_at')
            .eq('organization_id', ctx.organizationId)
            .order('created_at', { ascending: false })
            .limit(20),
        {
          table: 'security_events',
          columns: ['organization_id', 'event_type', 'status', 'details', 'created_at'],
        },
      ),
    ]);

    const lowStockAlerts = stockBalances.filter((row) => {
      const itemValue = (row as NotificationRecord).items;
      const item = Array.isArray(itemValue) ? itemValue[0] : itemValue;
      return Number((item as NotificationRecord | null)?.reorder_level ?? 0) > 0 && Number((row as NotificationRecord).quantity_on_hand ?? 0) <= Number((item as NotificationRecord | null)?.reorder_level ?? 0);
    });
    const overdueInvoices = invoices.filter((row) => String((row as NotificationRecord).due_date ?? '').slice(0, 10) < today);
    const qcFailures = inspections.filter((row) => ['FAILED', 'REJECTED'].includes(String((row as NotificationRecord).qc_status ?? '').toUpperCase()));
    const branchVariances = shifts.filter((row) => Math.abs(Number((row as NotificationRecord).cash_variance ?? 0)) > 0.01 || Math.abs(Number((row as NotificationRecord).stock_variance ?? 0)) > 0.01);
    const criticalNotifications = await listNotifications({
      ctx,
      filters: {
        limit: 10,
        page: 1,
        pageSize: 10,
        severity: 'CRITICAL',
      },
    });

    return {
      stats: {
        criticalAlerts: criticalNotifications.data.length,
        highAlerts: (await listNotifications({ ctx, filters: { limit: 20, severity: 'HIGH' } })).data.length,
        pendingApprovals: approvals.length,
        lowStockAlerts: lowStockAlerts.length,
        overdueInvoices: overdueInvoices.length,
        supplierShortages: shortages.length,
        qcFailures: qcFailures.length,
        branchVariances: branchVariances.length,
        securityAlerts: securityEvents.filter((row) => ['LOGIN_FAILED', 'ACCOUNT_LOCKED', 'UNAUTHORIZED_ACCESS_ATTEMPT'].includes(String((row as NotificationRecord).event_type ?? ''))).length,
      },
      criticalAlerts: criticalNotifications.data,
      lowStockAlerts: lowStockAlerts.slice(0, 10).map((row) => {
        const itemValue = (row as NotificationRecord).items;
        const item = Array.isArray(itemValue) ? itemValue[0] : itemValue;
        return {
          id: String((row as NotificationRecord).id ?? ''),
          code: String((item as NotificationRecord | null)?.code ?? ''),
          itemName: String((item as NotificationRecord | null)?.name ?? ''),
          quantityOnHand: Number((row as NotificationRecord).quantity_on_hand ?? 0),
          reorderLevel: Number((item as NotificationRecord | null)?.reorder_level ?? 0),
        };
      }),
      pendingApprovals: approvals,
      overdueInvoices: overdueInvoices.map((row) => ({
        id: String((row as NotificationRecord).id ?? ''),
        invoiceNumber: String((row as NotificationRecord).invoice_number ?? ''),
        dueDate: String((row as NotificationRecord).due_date ?? '').slice(0, 10),
        balanceDue: Number((row as NotificationRecord).balance_due ?? 0),
        customerName: String((((row as NotificationRecord).customers as NotificationRecord | NotificationRecord[] | null) instanceof Array ? (((row as NotificationRecord).customers as NotificationRecord[])[0]?.name) : (((row as NotificationRecord).customers as NotificationRecord | null)?.name)) ?? 'Walk-in'),
      })),
      supplierShortages: shortages,
      qcFailures: qcFailures,
      branchVariances: branchVariances,
      securityAlerts: securityEvents,
    };
  } catch (error) {
    if (isNotificationAlertDashboardCompatibilityError(error)) {
      return buildNotificationAlertDashboardFallback();
    }
    throw error;
  }
}

export async function emitOperationalNotifications(input: {
  actorUserId?: string | null;
  branchId?: string | null;
  documentId?: string | null;
  documentType?: string | null;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
  moduleName: string;
  organizationId: string;
  recipientRoleNames?: string[];
  recipientUserIds?: string[];
  severity: string;
  title: string;
  warehouseId?: string | null;
}) {
  return emitNotificationEvent({
    actorUserId: input.actorUserId,
    branchId: input.branchId,
    documentId: input.documentId,
    documentType: input.documentType,
    eventType: input.eventType,
    explicitMessage: input.message,
    explicitTitle: input.title,
    metadata: input.metadata,
    moduleName: input.moduleName,
    organizationId: input.organizationId,
    recipientRoleNames: input.recipientRoleNames,
    recipientUserIds: input.recipientUserIds,
    severity: input.severity,
    warehouseId: input.warehouseId,
  });
}

export async function emitLowStockNotificationIfNeeded(input: {
  actorUserId?: string | null;
  itemId: string;
  organizationId: string;
  warehouseId?: string | null;
}) {
  const { data: balance, error } = await notificationService()
    .from('stock_balances')
    .select('quantity_on_hand, warehouse_id, items(name, code, reorder_level)')
    .eq('organization_id', input.organizationId)
    .eq('item_id', input.itemId)
    .maybeSingle();
  if (error) throw error;
  if (!balance) return { emitted: false };

  const itemValue = (balance as NotificationRecord).items;
  const item = Array.isArray(itemValue) ? itemValue[0] : itemValue;
  const reorderLevel = Number((item as NotificationRecord | null)?.reorder_level ?? 0);
  const quantityOnHand = Number((balance as NotificationRecord).quantity_on_hand ?? 0);
  if (reorderLevel <= 0 || quantityOnHand > reorderLevel) return { emitted: false };

  await emitOperationalNotifications({
    actorUserId: input.actorUserId,
    documentId: input.itemId,
    documentType: 'inventory_item',
    eventType: 'LOW_STOCK',
    message: `${String((item as NotificationRecord | null)?.name ?? 'Item')} is below reorder level.`,
    metadata: {
      itemCode: String((item as NotificationRecord | null)?.code ?? ''),
      itemName: String((item as NotificationRecord | null)?.name ?? ''),
      quantityOnHand,
      reorderLevel,
    },
    moduleName: 'inventory',
    organizationId: input.organizationId,
    recipientRoleNames: ['Stores Manager', 'Procurement Officer'],
    severity: quantityOnHand <= Math.max(0, reorderLevel / 2) ? 'HIGH' : 'MEDIUM',
    title: 'Low stock alert',
    warehouseId: input.warehouseId ?? String((balance as NotificationRecord).warehouse_id ?? ''),
  });

  return { emitted: true };
}

export async function emitSecurityNotification(input: {
  actorUserId?: string | null;
  eventType: string;
  organizationId: string;
  details?: Record<string, unknown>;
  severity?: string;
}) {
  await recordSecurityEvent({
    organizationId: input.organizationId,
    userProfileId: input.actorUserId ?? null,
    eventType: input.eventType,
    status: severityRank(input.severity ?? 'HIGH') >= severityRank('HIGH') ? 'FAILED' : 'SUCCESS',
    details: input.details ?? {},
  });
  return emitOperationalNotifications({
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    message: normalizeNotificationValue((input.details ?? {}).message as string) || `${input.eventType} recorded.`,
    metadata: input.details ?? {},
    moduleName: 'SECURITY',
    organizationId: input.organizationId,
    recipientRoleNames: ['System Admin', 'Auditor'],
    severity: input.severity ?? 'HIGH',
    title: `${normalizeNotificationCode(input.eventType).replace(/_/g, ' ')} alert`,
  });
}
