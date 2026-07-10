"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOGIN_ATTEMPT_STATUSES = exports.SESSION_STATUSES = exports.USER_ACCOUNT_STATUSES = exports.hasPermissionAccess = void 0;
exports.normalizeUserStatus = normalizeUserStatus;
exports.mergePermissions = mergePermissions;
exports.resolveSecurityPolicy = resolveSecurityPolicy;
exports.isLockedUntil = isLockedUntil;
exports.isLoginAllowed = isLoginAllowed;
exports.isSessionExpired = isSessionExpired;
exports.getLockoutExpiry = getLockoutExpiry;
exports.shouldLockAccount = shouldLockAccount;
var permission_access_1 = require("./permission-access");
Object.defineProperty(exports, "hasPermissionAccess", { enumerable: true, get: function () { return permission_access_1.hasPermissionAccess; } });
exports.USER_ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'LOCKED', 'SUSPENDED', 'PASSWORD_RESET_REQUIRED'];
exports.SESSION_STATUSES = ['ACTIVE', 'EXPIRED', 'LOGGED_OUT', 'REVOKED'];
exports.LOGIN_ATTEMPT_STATUSES = ['SUCCESS', 'FAILED', 'LOCKED_OUT', 'PASSWORD_RESET_REQUIRED'];
function normalizeUserStatus(value) {
    const normalized = String(value ?? 'ACTIVE').trim().toUpperCase();
    if (exports.USER_ACCOUNT_STATUSES.includes(normalized)) {
        return normalized;
    }
    if (normalized === 'ACTIVE')
        return 'ACTIVE';
    if (normalized === 'LOCKED')
        return 'LOCKED';
    if (normalized === 'SUSPENDED')
        return 'SUSPENDED';
    if (normalized === 'PASSWORD_RESET_REQUIRED')
        return 'PASSWORD_RESET_REQUIRED';
    return 'INACTIVE';
}
function mergePermissions(...permissionSets) {
    return Array.from(new Set(permissionSets.flatMap((permissionSet) => (permissionSet ?? []).filter((permission) => Boolean(permission?.trim()))))).sort();
}
function resolveSecurityPolicy(raw) {
    return {
        failedLoginLimit: Math.max(1, raw?.failedLoginLimit ?? 5),
        lockoutDurationMinutes: Math.max(1, raw?.lockoutDurationMinutes ?? 30),
        sessionTimeoutMinutes: Math.max(1, raw?.sessionTimeoutMinutes ?? 15),
    };
}
function isLockedUntil(lockedUntil, now = new Date()) {
    if (!lockedUntil)
        return false;
    return new Date(lockedUntil).getTime() > now.getTime();
}
function isLoginAllowed(status, lockedUntil) {
    const normalizedStatus = normalizeUserStatus(status);
    if (normalizedStatus === 'LOCKED') {
        return false;
    }
    if (normalizedStatus === 'INACTIVE' || normalizedStatus === 'SUSPENDED') {
        return false;
    }
    if (isLockedUntil(lockedUntil)) {
        return false;
    }
    return true;
}
function isSessionExpired(lastActivityAt, timeoutMinutes, now = new Date()) {
    if (!lastActivityAt)
        return false;
    const lastActivityMs = new Date(lastActivityAt).getTime();
    const timeoutMs = Math.max(1, timeoutMinutes) * 60000;
    return lastActivityMs + timeoutMs <= now.getTime();
}
function getLockoutExpiry(now, lockoutDurationMinutes) {
    return new Date(now.getTime() + Math.max(1, lockoutDurationMinutes) * 60000);
}
function shouldLockAccount(failedAttempts, failedLoginLimit) {
    return failedAttempts >= Math.max(1, failedLoginLimit);
}
