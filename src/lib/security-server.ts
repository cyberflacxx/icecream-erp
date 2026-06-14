import { createHash, createHmac, randomBytes } from 'crypto';

import { ROLE_PERMISSIONS, ROLES } from '@/lib/auth-roles';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  getLockoutExpiry,
  isLoginAllowed,
  isSessionExpired,
  mergePermissions,
  normalizeUserStatus,
  resolveSecurityPolicy,
  shouldLockAccount,
  type LoginAttemptStatus,
  type SecurityPolicySettings,
  type UserAccountStatus,
} from '@/lib/security';

export interface ResolvedRole {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
}

export interface ResolvedPermission {
  id: string;
  code: string;
  name: string;
  module: string;
}

export interface SecurityUserProfile {
  id: string;
  userAccountId: string | null;
  authId: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  fullName: string;
  firstName: string;
  lastName: string;
  workId: string;
  status: UserAccountStatus;
  branchId: string | null;
  organizationId: string;
  role: string;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLogin: string | null;
}

export interface SecurityContextProfile extends SecurityUserProfile {
  roles: ResolvedRole[];
  permissions: string[];
  branchAssignments: string[];
  warehouseAssignments: string[];
  sessionTimeoutMinutes: number;
}

export interface SystemSecuritySettings extends SecurityPolicySettings {
  passwordMinLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialCharacter: boolean;
  sensitiveActionPasswordRequired: boolean;
}

function securityService() {
  return createServiceRoleClient().schema('icecream_erp');
}

async function selectFirstAvailableUserColumns(candidates: string[]) {
  const service = securityService();

  for (const selectClause of candidates) {
    const { error } = await service.from('users').select(selectClause).limit(1);
    if (!error) return selectClause;
  }

  return candidates[candidates.length - 1] ?? 'id';
}

async function findUserRowBy(
  field: 'auth_id' | 'work_id',
  value: string,
  selectClause: string,
) {
  const service = securityService();

  const withDeletedAtFilter = field === 'auth_id'
    ? service.from('users').select(selectClause).eq('auth_id', value).is('deleted_at', null).maybeSingle()
    : service.from('users').select(selectClause).ilike('work_id', value).is('deleted_at', null).maybeSingle();

  const { data, error } = await withDeletedAtFilter;
  if (!error) return data;

  if (!error.message.toLowerCase().includes('deleted_at')) {
    return null;
  }

  const withoutDeletedAtFilter = field === 'auth_id'
    ? service.from('users').select(selectClause).eq('auth_id', value).maybeSingle()
    : service.from('users').select(selectClause).ilike('work_id', value).maybeSingle();

  return (await withoutDeletedAtFilter).data ?? null;
}

async function getFallbackOrganizationId() {
  const service = securityService();
  try {
    const { data } = await service.from('organizations').select('id').limit(1).maybeSingle();
    if (data?.id) return String(data.id);
  } catch {}
  return 'absolute-ice-cream';
}

function passwordResetSecret() {
  return (
    process.env.PASSWORD_RESET_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_REGISTRATION_KEY ||
    process.env.IMPERSONATE_KEY ||
    'password-reset-secret'
  );
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signPasswordResetToken(payload: string) {
  return base64UrlEncode(createHmac('sha256', passwordResetSecret()).update(payload).digest());
}

function mapBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

function mapNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getSystemSecuritySettings(): Promise<SystemSecuritySettings> {
  const service = securityService();

  const { data } = await service
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'session_timeout_minutes',
      'failed_login_limit',
      'lockout_duration_minutes',
      'password_min_length',
      'require_uppercase',
      'require_lowercase',
      'require_number',
      'require_special_character',
      'sensitive_action_password_required',
    ]);

  const settingMap = new Map<string, unknown>();
  for (const row of data ?? []) {
    const record = row as { setting_key: string; setting_value: unknown };
    settingMap.set(record.setting_key, record.setting_value);
  }

  const policy = resolveSecurityPolicy({
    failedLoginLimit: mapNumber(settingMap.get('failed_login_limit'), 5),
    lockoutDurationMinutes: mapNumber(settingMap.get('lockout_duration_minutes'), 30),
    sessionTimeoutMinutes: mapNumber(settingMap.get('session_timeout_minutes'), 15),
  });

  return {
    ...policy,
    passwordMinLength: Math.max(6, mapNumber(settingMap.get('password_min_length'), 8)),
    requireUppercase: mapBoolean(settingMap.get('require_uppercase'), false),
    requireLowercase: mapBoolean(settingMap.get('require_lowercase'), true),
    requireNumber: mapBoolean(settingMap.get('require_number'), true),
    requireSpecialCharacter: mapBoolean(settingMap.get('require_special_character'), false),
    sensitiveActionPasswordRequired: mapBoolean(settingMap.get('sensitive_action_password_required'), false),
  };
}

export async function updateSystemSecuritySettings(
  updates: Partial<SystemSecuritySettings>,
  userProfileId?: string,
) {
  const service = securityService();
  const rows = Object.entries(updates).map(([key, value]) => ({
    setting_key: key
      .replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`)
      .replace(/^failed_login_limit$/, 'failed_login_limit')
      .replace(/^lockout_duration_minutes$/, 'lockout_duration_minutes')
      .replace(/^session_timeout_minutes$/, 'session_timeout_minutes'),
    setting_value: value,
    updated_by: userProfileId ?? null,
  }));

  if (rows.length === 0) return;

  const { error } = await service.from('system_settings').upsert(rows, { onConflict: 'setting_key' });
  if (error) throw error;
}

function getLegacyPermissions(role: string) {
  return ROLE_PERMISSIONS[role] ?? [];
}

function getFallbackResolvedRoles(legacyRole: string) {
  const matchedRole = ROLES.find((role) => role.id === legacyRole) ?? ROLES.find((role) => role.id === 'staff');
  if (!matchedRole) return [] as ResolvedRole[];

  return [{
    id: matchedRole.id,
    name: matchedRole.name,
    description: matchedRole.description,
    isSystemRole: true,
  }] satisfies ResolvedRole[];
}

async function resolveRolesForUser(userProfileId: string) {
  const service = securityService();

  const { data: userRoles } = await service
    .from('user_roles')
    .select('role_id, roles(id, name, description, is_system_role)')
    .eq('user_profile_id', userProfileId);

  const roles = (userRoles ?? [])
    .map((row) => {
      const roleValue = (row as { roles?: Array<Record<string, unknown>> | Record<string, unknown> | null }).roles;
      const role = Array.isArray(roleValue) ? roleValue[0] : roleValue;
      if (!role?.id || !role?.name) return null;
      return {
        id: String(role.id),
        name: String(role.name),
        description: role.description ? String(role.description) : null,
        isSystemRole: Boolean(role.is_system_role),
      } satisfies ResolvedRole;
    })
    .filter((role): role is ResolvedRole => Boolean(role));

  return roles;
}

async function resolvePermissionsForRoles(roleIds: string[]) {
  if (roleIds.length === 0) return [] as ResolvedPermission[];

  const service = securityService();
  const { data: rolePermissions } = await service
    .from('role_permissions')
    .select('permission_id, permissions(id, code, name, module)')
    .in('role_id', roleIds);

  return (rolePermissions ?? [])
    .map((row) => {
      const permissionValue = (row as { permissions?: Array<Record<string, unknown>> | Record<string, unknown> | null }).permissions;
      const permission = Array.isArray(permissionValue) ? permissionValue[0] : permissionValue;
      if (!permission?.id || !permission?.code || !permission?.module) return null;
      return {
        id: String(permission.id),
        code: String(permission.code),
        name: String(permission.name ?? permission.code),
        module: String(permission.module),
      } satisfies ResolvedPermission;
    })
    .filter((permission): permission is ResolvedPermission => Boolean(permission));
}

async function resolveAssignments(table: 'user_branch_assignments' | 'user_warehouse_assignments', userProfileId: string) {
  const service = securityService();
  const idField = table === 'user_branch_assignments' ? 'branch_id' : 'warehouse_id';
  const { data } = await service
    .from(table)
    .select(`${idField}, is_active`)
    .eq('user_profile_id', userProfileId)
    .eq('is_active', true);

  return (data ?? [])
    .map((row) => {
      const value = (row as Record<string, unknown>)[idField];
      return value ? String(value) : null;
    })
    .filter((value): value is string => Boolean(value));
}

function normalizeProfileRow(row: Record<string, unknown>, organizationId: string): SecurityUserProfile {
  const normalizedStatus = String(row.status ?? 'active').toUpperCase();
  return {
    id: String(row.id),
    userAccountId: row.user_account_id ? String(row.user_account_id) : null,
    authId: row.auth_id ? String(row.auth_id) : null,
    email: String(row.email ?? ''),
    phone: row.phone ? String(row.phone) : null,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    fullName: String(row.full_name ?? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    workId: String(row.work_id ?? ''),
    status: normalizeUserStatus(normalizedStatus),
    branchId: row.branch_id ? String(row.branch_id) : null,
    organizationId,
    role: String(row.role ?? 'staff'),
    failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
    lockedUntil: row.locked_until ? String(row.locked_until) : null,
    lastLogin: row.last_login ? String(row.last_login) : null,
  };
}

export async function findSecurityUserProfileByAuthId(authId: string) {
  const organizationId = await getFallbackOrganizationId();
  const selectClause = await selectFirstAvailableUserColumns([
    'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role, failed_login_attempts, locked_until, last_login, user_account_id',
    'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role, last_login, user_account_id',
    'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role',
  ]);
  const data = await findUserRowBy('auth_id', authId, selectClause);

  if (!data) return null;
  return normalizeProfileRow(data as unknown as Record<string, unknown>, organizationId);
}

export async function findSecurityUserProfileByWorkId(workId: string) {
  const organizationId = await getFallbackOrganizationId();
  const selectClause = await selectFirstAvailableUserColumns([
    'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role, failed_login_attempts, locked_until, last_login, user_account_id',
    'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role, last_login, user_account_id',
    'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role',
  ]);
  const data = await findUserRowBy('work_id', workId, selectClause);

  if (!data) return null;
  return normalizeProfileRow(data as unknown as Record<string, unknown>, organizationId);
}

export async function buildSecurityContextProfile(profile: SecurityUserProfile) {
  const [resolvedRoles, branchAssignments, warehouseAssignments, settings] = await Promise.all([
    resolveRolesForUser(profile.id),
    resolveAssignments('user_branch_assignments', profile.id).catch(() => [] as string[]),
    resolveAssignments('user_warehouse_assignments', profile.id).catch(() => [] as string[]),
    getSystemSecuritySettings(),
  ]);

  const roles = resolvedRoles.length > 0 ? resolvedRoles : getFallbackResolvedRoles(profile.role);
  const roleIds = roles.map((role) => role.id);
  const permissions = await resolvePermissionsForRoles(roleIds);

  return {
    ...profile,
    roles,
    permissions: mergePermissions(
      permissions.map((permission) => permission.code),
      getLegacyPermissions(profile.role),
    ),
    branchAssignments: branchAssignments.length > 0 ? branchAssignments : profile.branchId ? [profile.branchId] : [],
    warehouseAssignments,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
  } satisfies SecurityContextProfile;
}

export function canAccessBranch(profile: Pick<SecurityContextProfile, 'branchId' | 'branchAssignments' | 'permissions'>, branchId: string) {
  if (profile.permissions.includes('view_all_branches')) return true;
  const allowedBranches = new Set([profile.branchId, ...profile.branchAssignments].filter(Boolean));
  return allowedBranches.has(branchId);
}

export async function recordLoginAttempt(input: {
  workId: string;
  status: LoginAttemptStatus;
  userProfileId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  reason?: string | null;
}) {
  const service = securityService();
  try {
    await service.from('login_attempts').insert({
      user_profile_id: input.userProfileId ?? null,
      work_id: input.workId,
      status: input.status,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      details: input.reason ? { reason: input.reason } : null,
    });
  } catch {}
}

export async function recordSecurityEvent(input: {
  organizationId?: string | null;
  userProfileId?: string | null;
  eventType: string;
  status?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const service = securityService();
  try {
    await service.from('security_events').insert({
      organization_id: input.organizationId ?? null,
      user_profile_id: input.userProfileId ?? null,
      event_type: input.eventType,
      status: input.status ?? 'SUCCESS',
      details: input.details ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch {}
}

export async function recordAuditLog(input: {
  organizationId?: string | null;
  userProfileId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const service = securityService();
  try {
    await service.from('audit_logs').insert({
      organization_id: input.organizationId ?? null,
      user_profile_id: input.userProfileId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch {}
}

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function registerSession(input: {
  userAccountId?: string | null;
  userProfileId: string;
  accessToken: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  timeoutMinutes: number;
}) {
  const service = securityService();
  const tokenHash = hashSessionToken(input.accessToken);
  const expiresAt = new Date(Date.now() + Math.max(1, input.timeoutMinutes) * 60_000).toISOString();

  try {
    await service.from('auth_sessions').upsert({
      token: tokenHash,
      user_account_id: input.userAccountId ?? input.userProfileId,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'token' });
  } catch {}

  try {
    await service.from('session_activities').insert({
      session_token: tokenHash,
      user_profile_id: input.userProfileId,
      activity_type: 'ACTIVE',
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch {}

  return tokenHash;
}

export async function touchSessionActivity(input: {
  userAccountId?: string | null;
  userProfileId: string;
  accessToken: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  timeoutMinutes: number;
}) {
  return registerSession(input);
}

export async function revokeSession(sessionToken: string, userProfileId?: string | null) {
  const service = securityService();
  const { error } = await service
    .from('auth_sessions')
    .delete()
    .eq('token', sessionToken)
    .match(userProfileId ? { user_account_id: userProfileId } : {});

  if (error) throw error;

  try {
    await service.from('session_activities').insert({
      session_token: sessionToken,
      user_profile_id: userProfileId ?? null,
      activity_type: 'REVOKED',
    });
  } catch {}
}

export async function listUserSessions() {
  const service = securityService();
  const { data, error } = await service
    .from('auth_sessions')
    .select('id, token, ip_address, user_agent, expires_at, created_at, updated_at, user_account_id')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listSecurityEvents(filters: Record<string, string | undefined>) {
  const service = securityService();
  let query = service
    .from('security_events')
    .select('id, event_type, status, details, ip_address, user_agent, created_at, user_profile_id', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.eventType) query = query.eq('event_type', filters.eventType);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.userProfileId) query = query.eq('user_profile_id', filters.userProfileId);

  return query;
}

export async function incrementFailedLogin(profile: SecurityUserProfile, settings?: SystemSecuritySettings) {
  const service = securityService();
  const policy = settings ?? await getSystemSecuritySettings();
  const failedLoginAttempts = profile.failedLoginAttempts + 1;
  const shouldLock = shouldLockAccount(failedLoginAttempts, policy.failedLoginLimit);
  const updates: Record<string, unknown> = {
    failed_login_attempts: failedLoginAttempts,
  };

  if (shouldLock) {
    updates.status = 'LOCKED';
    updates.locked_until = getLockoutExpiry(new Date(), policy.lockoutDurationMinutes).toISOString();
  }

  const { error } = await service.from('users').update(updates).eq('id', profile.id);
  if (error && !error.message.toLowerCase().includes('failed_login_attempts') && !error.message.toLowerCase().includes('locked_until')) {
    throw error;
  }

  return {
    failedLoginAttempts,
    locked: shouldLock,
    lockedUntil: shouldLock ? String(updates.locked_until) : profile.lockedUntil,
  };
}

export async function clearFailedLogin(profileId: string) {
  const service = securityService();
  const { error } = await service.from('users').update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login: new Date().toISOString(),
    status: 'active',
  }).eq('id', profileId);
  if (error && !error.message.toLowerCase().includes('failed_login_attempts') && !error.message.toLowerCase().includes('locked_until')) {
    throw error;
  }
}

export async function ensureActiveSession(profile: SecurityContextProfile, accessToken?: string | null) {
  const service = securityService();
  if (!accessToken) return { active: true };

  const tokenHash = hashSessionToken(accessToken);
  const { data } = await service
    .from('auth_sessions')
    .select('updated_at, expires_at')
    .eq('token', tokenHash)
    .maybeSingle();

  const sessionRow = data ? (data as unknown as Record<string, unknown>) : null;
  const lastActivityAt = sessionRow?.updated_at ?? sessionRow?.expires_at ?? profile.lastLogin;
  if (isSessionExpired(lastActivityAt as string | null | undefined, profile.sessionTimeoutMinutes)) {
    try {
      await service.from('auth_sessions').delete().eq('token', tokenHash);
    } catch {}
    return { active: false, tokenHash };
  }

  return { active: true, tokenHash };
}

export function createPasswordResetToken() {
  return randomBytes(24).toString('hex');
}

export async function createPasswordResetRequest(profile: SecurityUserProfile) {
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const payload = base64UrlEncode(JSON.stringify({
    authId: profile.authId,
    expiresAt,
    organizationId: profile.organizationId,
    userAccountId: profile.userAccountId ?? profile.id,
    userProfileId: profile.id,
    workId: profile.workId,
  }));
  const signature = signPasswordResetToken(payload);
  return { token: `${payload}.${signature}`, expiresAt };
}

export async function consumePasswordResetToken(token: string) {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  if (signPasswordResetToken(payload) !== signature) return null;

  const decoded = JSON.parse(base64UrlDecode(payload)) as {
    authId?: string | null;
    expiresAt?: string;
    organizationId?: string;
    userAccountId?: string;
    userProfileId?: string;
  };

  if (!decoded.authId || !decoded.userAccountId || !decoded.userProfileId || !decoded.organizationId || !decoded.expiresAt) {
    return null;
  }

  if (new Date(decoded.expiresAt).getTime() < Date.now()) {
    return null;
  }

  return {
    authId: decoded.authId,
    id: createPasswordResetToken(),
    organizationId: decoded.organizationId,
    userAccountId: decoded.userAccountId,
    userProfileId: decoded.userProfileId,
  };
}

export function assertLoginAllowed(profile: SecurityUserProfile) {
  return isLoginAllowed(profile.status, profile.lockedUntil);
}
