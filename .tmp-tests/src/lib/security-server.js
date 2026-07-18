"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemSecuritySettings = getSystemSecuritySettings;
exports.updateSystemSecuritySettings = updateSystemSecuritySettings;
exports.findSecurityUserProfileByAuthId = findSecurityUserProfileByAuthId;
exports.findSecurityUserProfileByWorkId = findSecurityUserProfileByWorkId;
exports.buildSecurityContextProfile = buildSecurityContextProfile;
exports.canAccessBranch = canAccessBranch;
exports.recordLoginAttempt = recordLoginAttempt;
exports.recordSecurityEvent = recordSecurityEvent;
exports.recordAuditLog = recordAuditLog;
exports.registerSession = registerSession;
exports.touchSessionActivity = touchSessionActivity;
exports.revokeSession = revokeSession;
exports.listUserSessions = listUserSessions;
exports.listSecurityEvents = listSecurityEvents;
exports.incrementFailedLogin = incrementFailedLogin;
exports.clearFailedLogin = clearFailedLogin;
exports.ensureActiveSession = ensureActiveSession;
exports.createPasswordResetToken = createPasswordResetToken;
exports.validatePasswordResetPassword = validatePasswordResetPassword;
exports.createPasswordResetRequest = createPasswordResetRequest;
exports.consumePasswordResetToken = consumePasswordResetToken;
exports.markPasswordResetTokenUsed = markPasswordResetTokenUsed;
exports.assertLoginAllowed = assertLoginAllowed;
const crypto_1 = require("crypto");
const auth_roles_1 = require("./auth-roles");
const registration_1 = require("./registration");
const server_1 = require("./supabase/server");
const user_access_profile_1 = require("./user-access-profile");
const security_1 = require("./security");
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60000;
function securityService() {
    return (0, server_1.createServiceRoleClient)().schema('icecream_erp');
}
async function selectFirstAvailableUserColumns(candidates) {
    const service = securityService();
    for (const selectClause of candidates) {
        const { error } = await service.from('users').select(selectClause).limit(1);
        if (!error)
            return selectClause;
    }
    return candidates[candidates.length - 1] ?? 'id';
}
async function findUserRowBy(field, value, selectClause) {
    const service = securityService();
    const withDeletedAtFilter = field === 'auth_id'
        ? service.from('users').select(selectClause).eq('auth_id', value).is('deleted_at', null).maybeSingle()
        : service.from('users').select(selectClause).ilike('work_id', value).is('deleted_at', null).maybeSingle();
    const { data, error } = await withDeletedAtFilter;
    if (!error)
        return data;
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
        if (data?.id)
            return String(data.id);
    }
    catch { }
    return 'absolute-ice-cream';
}
function mapBoolean(value, fallback) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string')
        return value.toLowerCase() === 'true';
    return fallback;
}
function mapNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
async function getSystemSecuritySettings() {
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
    const settingMap = new Map();
    for (const row of data ?? []) {
        const record = row;
        settingMap.set(record.setting_key, record.setting_value);
    }
    const policy = (0, security_1.resolveSecurityPolicy)({
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
async function updateSystemSecuritySettings(updates, userProfileId) {
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
    if (rows.length === 0)
        return;
    const { error } = await service.from('system_settings').upsert(rows, { onConflict: 'setting_key' });
    if (error)
        throw error;
}
function getLegacyPermissions(role) {
    return auth_roles_1.ROLE_PERMISSIONS[role] ?? [];
}
function sanitizePermissionsForRole(role, permissions) {
    if (role === 'branch_manager') {
        const allowed = new Set(getLegacyPermissions(role));
        return permissions.filter((permission) => allowed.has(permission));
    }
    return permissions;
}
function getFallbackResolvedRoles(legacyRole) {
    const matchedRole = auth_roles_1.ROLES.find((role) => role.id === legacyRole) ?? auth_roles_1.ROLES.find((role) => role.id === 'staff');
    if (!matchedRole)
        return [];
    return [{
            id: matchedRole.id,
            name: matchedRole.name,
            description: matchedRole.description,
            isSystemRole: true,
        }];
}
async function resolveRolesForUser(userProfileId) {
    const service = securityService();
    const { data: userRoleRows, error: userRoleError } = await service
        .from('user_roles')
        .select('role_id')
        .eq('user_profile_id', userProfileId);
    if (userRoleError)
        throw userRoleError;
    const roleIds = Array.from(new Set((userRoleRows ?? [])
        .map((row) => row.role_id)
        .filter((value) => typeof value === 'string' && value.length > 0)));
    if (roleIds.length === 0)
        return [];
    const { data: roleRows, error: roleError } = await service
        .from('roles')
        .select('id, name, description, is_system_role')
        .in('id', roleIds);
    if (roleError)
        throw roleError;
    return (roleRows ?? [])
        .map((role) => {
        if (!role?.id || !role?.name)
            return null;
        return {
            id: String(role.id),
            name: String(role.name),
            description: role.description ? String(role.description) : null,
            isSystemRole: Boolean(role.is_system_role),
        };
    })
        .filter((role) => Boolean(role));
}
async function resolvePermissionsForRoles(roleIds) {
    if (roleIds.length === 0)
        return [];
    const service = securityService();
    const { data: rolePermissionRows, error: rolePermissionError } = await service
        .from('role_permissions')
        .select('permission_id')
        .in('role_id', roleIds);
    if (rolePermissionError)
        throw rolePermissionError;
    const permissionIds = Array.from(new Set((rolePermissionRows ?? [])
        .map((row) => row.permission_id)
        .filter((value) => typeof value === 'string' && value.length > 0)));
    if (permissionIds.length === 0)
        return [];
    const { data: permissionRows, error: permissionError } = await service
        .from('permissions')
        .select('id, code, name, module')
        .in('id', permissionIds);
    if (permissionError)
        throw permissionError;
    return (permissionRows ?? [])
        .map((permission) => {
        if (!permission?.id || !permission?.code || !permission?.module)
            return null;
        return {
            id: String(permission.id),
            code: String(permission.code),
            name: String(permission.name ?? permission.code),
            module: String(permission.module),
        };
    })
        .filter((permission) => Boolean(permission));
}
async function resolveAssignments(table, userProfileId) {
    const service = securityService();
    const idField = table === 'user_branch_assignments' ? 'branch_id' : 'warehouse_id';
    const { data } = await service
        .from(table)
        .select(`${idField}, is_active`)
        .eq('user_profile_id', userProfileId)
        .eq('is_active', true);
    return (data ?? [])
        .map((row) => {
        const value = row[idField];
        return value ? String(value) : null;
    })
        .filter((value) => Boolean(value));
}
async function resolveBranchAssignmentsDetailed(userProfileId) {
    const service = securityService();
    const { data, error } = await service
        .from('user_branch_assignments')
        .select('branch_id, role_name, is_active')
        .eq('user_profile_id', userProfileId)
        .eq('is_active', true);
    if (error) {
        throw error;
    }
    return (data ?? [])
        .map((row) => ({
        branchId: row.branch_id ? String(row.branch_id) : null,
        roleName: row.role_name ? String(row.role_name) : null,
    }))
        .filter((row) => row.branchId);
}
function normalizeProfileRow(row, organizationId) {
    const normalizedStatus = String(row.status ?? 'active').toUpperCase();
    const phoneMeta = (0, user_access_profile_1.parseUserPhoneValue)(row.phone);
    return {
        id: String(row.id),
        userAccountId: row.user_account_id ? String(row.user_account_id) : null,
        authId: row.auth_id ? String(row.auth_id) : null,
        email: String(row.email ?? ''),
        phone: phoneMeta.phone,
        avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
        fullName: String(row.full_name ?? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()),
        firstName: String(row.first_name ?? ''),
        lastName: String(row.last_name ?? ''),
        workId: String(row.work_id ?? ''),
        status: (0, security_1.normalizeUserStatus)(normalizedStatus),
        branchId: row.branch_id ? String(row.branch_id) : null,
        organizationId,
        role: phoneMeta.accessProfile ?? String(row.role ?? 'staff'),
        failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
        lockedUntil: row.locked_until ? String(row.locked_until) : null,
        lastLogin: row.last_login ? String(row.last_login) : null,
    };
}
async function findSecurityUserProfileByAuthId(authId) {
    const organizationId = await getFallbackOrganizationId();
    const selectClause = await selectFirstAvailableUserColumns([
        'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role, failed_login_attempts, locked_until, last_login, user_account_id',
        'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role, last_login, user_account_id',
        'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role',
    ]);
    const data = await findUserRowBy('auth_id', authId, selectClause);
    if (!data)
        return null;
    return normalizeProfileRow(data, organizationId);
}
async function findSecurityUserProfileByWorkId(workId) {
    const organizationId = await getFallbackOrganizationId();
    const selectClause = await selectFirstAvailableUserColumns([
        'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role, failed_login_attempts, locked_until, last_login, user_account_id',
        'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role, last_login, user_account_id',
        'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role',
    ]);
    const data = await findUserRowBy('work_id', workId, selectClause);
    if (!data)
        return null;
    return normalizeProfileRow(data, organizationId);
}
async function buildSecurityContextProfile(profile) {
    const [resolvedRoles, branchAssignmentDetails, warehouseAssignments, settings] = await Promise.all([
        resolveRolesForUser(profile.id),
        resolveBranchAssignmentsDetailed(profile.id).catch(() => []),
        resolveAssignments('user_warehouse_assignments', profile.id).catch(() => []),
        getSystemSecuritySettings(),
    ]);
    const detailedRoleName = branchAssignmentDetails.find((assignment) => assignment.roleName)?.roleName ?? null;
    const effectiveLegacyRole = detailedRoleName ? (0, registration_1.deriveLegacyRole)(detailedRoleName, profile.role) : profile.role;
    const roles = resolvedRoles.length > 0 ? resolvedRoles : getFallbackResolvedRoles(effectiveLegacyRole);
    const roleIds = roles.map((role) => role.id);
    const permissions = await resolvePermissionsForRoles(roleIds);
    const branchAssignments = branchAssignmentDetails
        .map((assignment) => assignment.branchId)
        .filter((value) => Boolean(value));
    return {
        ...profile,
        role: effectiveLegacyRole,
        roles,
        permissions: sanitizePermissionsForRole(effectiveLegacyRole, (0, security_1.mergePermissions)(permissions.map((permission) => permission.code), getLegacyPermissions(effectiveLegacyRole))),
        branchAssignments: branchAssignments.length > 0 ? branchAssignments : profile.branchId ? [profile.branchId] : [],
        warehouseAssignments,
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    };
}
function canAccessBranch(profile, branchId) {
    if (profile.permissions.includes('view_all_branches'))
        return true;
    const allowedBranches = new Set([profile.branchId, ...profile.branchAssignments].filter(Boolean));
    return allowedBranches.has(branchId);
}
async function recordLoginAttempt(input) {
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
    }
    catch { }
}
async function recordSecurityEvent(input) {
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
    }
    catch { }
}
async function recordAuditLog(input) {
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
    }
    catch { }
}
function hashSessionToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
async function registerSession(input) {
    const service = securityService();
    const tokenHash = hashSessionToken(input.accessToken);
    const expiresAt = new Date(Date.now() + Math.max(1, input.timeoutMinutes) * 60000).toISOString();
    try {
        await service.from('auth_sessions').upsert({
            token: tokenHash,
            user_account_id: input.userAccountId ?? input.userProfileId,
            ip_address: input.ipAddress ?? null,
            user_agent: input.userAgent ?? null,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'token' });
    }
    catch { }
    try {
        await service.from('session_activities').insert({
            session_token: tokenHash,
            user_profile_id: input.userProfileId,
            activity_type: 'ACTIVE',
            ip_address: input.ipAddress ?? null,
            user_agent: input.userAgent ?? null,
        });
    }
    catch { }
    return tokenHash;
}
async function touchSessionActivity(input) {
    return registerSession(input);
}
async function revokeSession(sessionToken, userProfileId) {
    const service = securityService();
    const { error } = await service
        .from('auth_sessions')
        .delete()
        .eq('token', sessionToken)
        .match(userProfileId ? { user_account_id: userProfileId } : {});
    if (error)
        throw error;
    try {
        await service.from('session_activities').insert({
            session_token: sessionToken,
            user_profile_id: userProfileId ?? null,
            activity_type: 'REVOKED',
        });
    }
    catch { }
}
async function listUserSessions() {
    const service = securityService();
    const { data, error } = await service
        .from('auth_sessions')
        .select('id, token, ip_address, user_agent, expires_at, created_at, updated_at, user_account_id')
        .order('updated_at', { ascending: false });
    if (error)
        throw error;
    return data ?? [];
}
async function listSecurityEvents(filters) {
    const service = securityService();
    let query = service
        .from('security_events')
        .select('id, event_type, status, details, ip_address, user_agent, created_at, user_profile_id', { count: 'exact' })
        .order('created_at', { ascending: false });
    if (filters.eventType)
        query = query.eq('event_type', filters.eventType);
    if (filters.status)
        query = query.eq('status', filters.status);
    if (filters.userProfileId)
        query = query.eq('user_profile_id', filters.userProfileId);
    return query;
}
async function incrementFailedLogin(profile, settings) {
    const service = securityService();
    const policy = settings ?? await getSystemSecuritySettings();
    const failedLoginAttempts = profile.failedLoginAttempts + 1;
    const shouldLock = (0, security_1.shouldLockAccount)(failedLoginAttempts, policy.failedLoginLimit);
    const updates = {
        failed_login_attempts: failedLoginAttempts,
    };
    if (shouldLock) {
        updates.status = 'LOCKED';
        updates.locked_until = (0, security_1.getLockoutExpiry)(new Date(), policy.lockoutDurationMinutes).toISOString();
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
async function clearFailedLogin(profileId) {
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
async function ensureActiveSession(profile, accessToken) {
    const service = securityService();
    if (!accessToken)
        return { active: true };
    const tokenHash = hashSessionToken(accessToken);
    const { data } = await service
        .from('auth_sessions')
        .select('updated_at, expires_at')
        .eq('token', tokenHash)
        .maybeSingle();
    const sessionRow = data ? data : null;
    const lastActivityAt = sessionRow?.updated_at ?? sessionRow?.expires_at ?? profile.lastLogin;
    if ((0, security_1.isSessionExpired)(lastActivityAt, profile.sessionTimeoutMinutes)) {
        try {
            await service.from('auth_sessions').delete().eq('token', tokenHash);
        }
        catch { }
        return { active: false, tokenHash };
    }
    return { active: true, tokenHash };
}
function createPasswordResetToken() {
    return (0, crypto_1.randomBytes)(24).toString('hex');
}
function hashPasswordResetToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
async function findSecurityUserProfileById(profileId) {
    const organizationId = await getFallbackOrganizationId();
    const selectClause = await selectFirstAvailableUserColumns([
        'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role, failed_login_attempts, locked_until, last_login, user_account_id',
        'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role, last_login, user_account_id',
        'id, auth_id, email, phone, avatar_url, full_name, first_name, last_name, work_id, status, branch_id, role',
    ]);
    const service = securityService();
    const withDeletedAtFilter = await service
        .from('users')
        .select(selectClause)
        .eq('id', profileId)
        .is('deleted_at', null)
        .maybeSingle();
    if (!withDeletedAtFilter.error) {
        const row = withDeletedAtFilter.data;
        return row ? normalizeProfileRow(row, organizationId) : null;
    }
    if (!withDeletedAtFilter.error.message.toLowerCase().includes('deleted_at')) {
        return null;
    }
    const fallback = await service
        .from('users')
        .select(selectClause)
        .eq('id', profileId)
        .maybeSingle();
    const row = fallback.data;
    return row ? normalizeProfileRow(row, organizationId) : null;
}
function validatePasswordResetPassword(password, settings) {
    if (password.length < settings.passwordMinLength) {
        return `Password must be at least ${settings.passwordMinLength} characters long.`;
    }
    if (settings.requireUppercase && !/[A-Z]/.test(password)) {
        return 'Password must include at least one uppercase letter.';
    }
    if (settings.requireLowercase && !/[a-z]/.test(password)) {
        return 'Password must include at least one lowercase letter.';
    }
    if (settings.requireNumber && !/[0-9]/.test(password)) {
        return 'Password must include at least one number.';
    }
    if (settings.requireSpecialCharacter && !/[^A-Za-z0-9]/.test(password)) {
        return 'Password must include at least one special character.';
    }
    return null;
}
async function createPasswordResetRequest(profile) {
    const service = securityService();
    const token = createPasswordResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString();
    const hashedToken = hashPasswordResetToken(token);
    const now = new Date().toISOString();
    const invalidateResult = await service
        .from('password_reset_tokens')
        .update({ updated_at: now, used_at: now })
        .eq('user_account_id', profile.id)
        .is('used_at', null);
    if (invalidateResult.error) {
        throw invalidateResult.error;
    }
    const tokenId = crypto.randomUUID();
    const insertResult = await service.from('password_reset_tokens').insert({
        id: tokenId,
        user_account_id: profile.id,
        token: hashedToken,
        expires_at: expiresAt,
        updated_at: now,
    });
    if (insertResult.error) {
        throw insertResult.error;
    }
    return { expiresAt, id: tokenId, token };
}
async function consumePasswordResetToken(token) {
    const service = securityService();
    const hashedToken = hashPasswordResetToken(token);
    const { data, error } = await service
        .from('password_reset_tokens')
        .select('id, user_account_id, expires_at, used_at')
        .eq('token', hashedToken)
        .maybeSingle();
    if (error) {
        throw error;
    }
    if (!data) {
        return null;
    }
    const tokenRow = data;
    if (!tokenRow.id || !tokenRow.user_account_id || tokenRow.used_at) {
        return null;
    }
    if (!tokenRow.expires_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
        await service
            .from('password_reset_tokens')
            .update({ updated_at: new Date().toISOString(), used_at: new Date().toISOString() })
            .eq('id', tokenRow.id)
            .is('used_at', null);
        return null;
    }
    const profile = await findSecurityUserProfileById(String(tokenRow.user_account_id));
    if (!profile?.authId) {
        return null;
    }
    return {
        authId: profile.authId,
        id: String(tokenRow.id),
        organizationId: profile.organizationId,
        userAccountId: String(tokenRow.user_account_id),
        userProfileId: profile.id,
    };
}
async function markPasswordResetTokenUsed(resetTokenId) {
    const service = securityService();
    const { error } = await service
        .from('password_reset_tokens')
        .update({ updated_at: new Date().toISOString(), used_at: new Date().toISOString() })
        .eq('id', resetTokenId)
        .is('used_at', null);
    if (error) {
        throw error;
    }
}
function assertLoginAllowed(profile) {
    return (0, security_1.isLoginAllowed)(profile.status, profile.lockedUntil);
}
