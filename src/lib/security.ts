export { hasPermissionAccess } from './permission-access';

export const USER_ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'LOCKED', 'SUSPENDED', 'PASSWORD_RESET_REQUIRED'] as const;
export const SESSION_STATUSES = ['ACTIVE', 'EXPIRED', 'LOGGED_OUT', 'REVOKED'] as const;
export const LOGIN_ATTEMPT_STATUSES = ['SUCCESS', 'FAILED', 'LOCKED_OUT', 'PASSWORD_RESET_REQUIRED'] as const;

export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type LoginAttemptStatus = (typeof LOGIN_ATTEMPT_STATUSES)[number];

export interface SecurityPolicySettings {
  failedLoginLimit: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
}

export function normalizeUserStatus(value: string | null | undefined): UserAccountStatus {
  const normalized = String(value ?? 'ACTIVE').trim().toUpperCase();

  if (USER_ACCOUNT_STATUSES.includes(normalized as UserAccountStatus)) {
    return normalized as UserAccountStatus;
  }

  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'LOCKED') return 'LOCKED';
  if (normalized === 'SUSPENDED') return 'SUSPENDED';
  if (normalized === 'PASSWORD_RESET_REQUIRED') return 'PASSWORD_RESET_REQUIRED';

  return 'INACTIVE';
}

export function mergePermissions(...permissionSets: Array<string[] | null | undefined>) {
  return Array.from(
    new Set(
      permissionSets.flatMap((permissionSet) =>
        (permissionSet ?? []).filter((permission): permission is string => Boolean(permission?.trim())),
      ),
    ),
  ).sort();
}

export function resolveSecurityPolicy(
  raw: Partial<SecurityPolicySettings> | null | undefined,
): SecurityPolicySettings {
  return {
    failedLoginLimit: Math.max(1, raw?.failedLoginLimit ?? 5),
    lockoutDurationMinutes: Math.max(1, raw?.lockoutDurationMinutes ?? 30),
    sessionTimeoutMinutes: Math.max(1, raw?.sessionTimeoutMinutes ?? 15),
  };
}

export function isLockedUntil(lockedUntil: string | Date | null | undefined, now = new Date()) {
  if (!lockedUntil) return false;
  return new Date(lockedUntil).getTime() > now.getTime();
}

export function isLoginAllowed(status: string | null | undefined, lockedUntil?: string | Date | null) {
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

export function isSessionExpired(
  lastActivityAt: string | Date | null | undefined,
  timeoutMinutes: number,
  now = new Date(),
) {
  if (!lastActivityAt) return false;

  const lastActivityMs = new Date(lastActivityAt).getTime();
  const timeoutMs = Math.max(1, timeoutMinutes) * 60_000;

  return lastActivityMs + timeoutMs <= now.getTime();
}

export function getLockoutExpiry(now: Date, lockoutDurationMinutes: number) {
  return new Date(now.getTime() + Math.max(1, lockoutDurationMinutes) * 60_000);
}

export function shouldLockAccount(failedAttempts: number, failedLoginLimit: number) {
  return failedAttempts >= Math.max(1, failedLoginLimit);
}
