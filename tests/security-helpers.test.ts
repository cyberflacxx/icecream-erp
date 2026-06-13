import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getLockoutExpiry,
  isLoginAllowed,
  isSessionExpired,
  mergePermissions,
  normalizeUserStatus,
  resolveSecurityPolicy,
  shouldLockAccount,
} from '../src/lib/security';

test('normalizeUserStatus maps unknown values to INACTIVE', () => {
  assert.equal(normalizeUserStatus('unknown'), 'INACTIVE');
  assert.equal(normalizeUserStatus('active'), 'ACTIVE');
});

test('mergePermissions removes duplicates and sorts values', () => {
  assert.deepEqual(mergePermissions(['b.read', 'a.read'], ['a.read', 'c.read']), ['a.read', 'b.read', 'c.read']);
});

test('resolveSecurityPolicy applies defaults and minimums', () => {
  assert.deepEqual(resolveSecurityPolicy({ sessionTimeoutMinutes: 0, failedLoginLimit: -2 }), {
    failedLoginLimit: 1,
    lockoutDurationMinutes: 30,
    sessionTimeoutMinutes: 1,
  });
});

test('isLoginAllowed blocks inactive and locked accounts', () => {
  assert.equal(isLoginAllowed('ACTIVE', null), true);
  assert.equal(isLoginAllowed('INACTIVE', null), false);
  assert.equal(isLoginAllowed('LOCKED', null), false);
});

test('shouldLockAccount matches the configured failed login limit', () => {
  assert.equal(shouldLockAccount(4, 5), false);
  assert.equal(shouldLockAccount(5, 5), true);
});

test('getLockoutExpiry adds the requested lockout duration', () => {
  const now = new Date('2026-06-13T10:00:00.000Z');
  assert.equal(getLockoutExpiry(now, 15).toISOString(), '2026-06-13T10:15:00.000Z');
});

test('isSessionExpired evaluates timeout based on last activity', () => {
  const now = new Date('2026-06-13T10:16:00.000Z');
  assert.equal(isSessionExpired('2026-06-13T10:00:00.000Z', 15, now), true);
  assert.equal(isSessionExpired('2026-06-13T10:02:00.000Z', 15, now), false);
});
