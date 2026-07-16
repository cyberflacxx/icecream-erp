import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getLockoutExpiry,
  hasPermissionAccess,
  isLoginAllowed,
  isSessionExpired,
  mergePermissions,
  normalizeUserStatus,
  resolveSecurityPolicy,
  shouldLockAccount,
} from '../src/lib/security';
import { resolveAdminActionKeyValidation } from '../src/lib/admin-delete-server';
import { getSmtpConfig, getSmtpReadiness } from '../src/lib/email';
import {
  buildRegistrationUserAccountRecord,
  getPublicRegistrationRoles,
  getRegistrationClientErrorMessage,
  getSafeRegistrationErrorDetails,
  REGISTRATION_ACCOUNT_FAILURE_MESSAGE,
} from '../src/lib/registration';
import { validatePasswordResetPassword } from '../src/lib/security-server';

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

test('hasPermissionAccess honors ERP permission aliases and dotted variants', () => {
  const permissions = ['production_batch.create', 'reports.production', 'stock_transfer.create'];

  assert.equal(hasPermissionAccess(permissions, 'production.write'), true);
  assert.equal(hasPermissionAccess(permissions, 'production.batch.create'), true);
  assert.equal(hasPermissionAccess(permissions, 'reports.read'), true);
  assert.equal(hasPermissionAccess(permissions, 'inventory.write'), true);
  assert.equal(hasPermissionAccess(permissions, 'quality.write'), false);
});

test('hasPermissionAccess resolves sales customer aliases to legacy sales permissions', () => {
  const permissions = ['sales.write', 'sales.read'];

  assert.equal(hasPermissionAccess(permissions, 'sales.customer.create'), true);
  assert.equal(hasPermissionAccess(permissions, 'sales.customer.edit'), true);
  assert.equal(hasPermissionAccess(permissions, 'sales.customer.view'), true);
  assert.equal(hasPermissionAccess(permissions, 'sales.customer.deactivate'), true);
});

test('resolveAdminActionKeyValidation returns the expected messages for missing, missing-env, and invalid keys', () => {
  const originalEnv = process.env;
  process.env = { ...originalEnv };

  try {
    delete process.env.SYSTEM_ADMIN_DELETE_KEY;
    delete process.env.ADMIN_DELETE_KEY;
    delete process.env.ADMIN_KEY;

    assert.deepEqual(resolveAdminActionKeyValidation({ body: {}, request: new Request('https://example.test') }), {
      configuredKey: null,
      error: 'Admin action key is not configured.',
      suppliedKey: '',
    });

    process.env.ADMIN_KEY = 'shared-secret';
    assert.deepEqual(resolveAdminActionKeyValidation({ body: {}, request: new Request('https://example.test') }), {
      configuredKey: 'shared-secret',
      error: 'Admin key is required.',
      suppliedKey: '',
    });

    assert.deepEqual(resolveAdminActionKeyValidation({
      body: { adminKey: 'wrong-secret' },
      request: new Request('https://example.test'),
    }), {
      configuredKey: 'shared-secret',
      error: 'Invalid admin key.',
      suppliedKey: 'wrong-secret',
    });
  } finally {
    process.env = originalEnv;
  }
});

test('getSmtpConfig prefers canonical SMTP vars and strips spaces from app passwords', () => {
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    SMTP_HOST: 'smtp.primary.test',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'primary-user',
    SMTP_PASS: 'abcd efgh ijkl mnop',
    SMTP_FROM: 'primary@test.local',
    EMAIL_HOST: 'smtp.legacy.test',
    EMAIL_PORT: '465',
    EMAIL_SECURE: 'true',
    EMAIL_USER: 'legacy-user',
    EMAIL_PASS: 'legacy-pass',
    EMAIL_APP_PASSWORD: 'legacy app password',
    EMAIL_FROM: 'legacy@test.local',
    MAIL_FROM: 'mailfrom@test.local',
  };

  try {
    assert.deepEqual(getSmtpConfig(), {
      from: 'primary@test.local',
      host: 'smtp.primary.test',
      pass: 'abcdefghijklmnop',
      port: '587',
      secure: 'false',
      user: 'primary-user',
    });
  } finally {
    process.env = originalEnv;
  }
});

test('getSmtpReadiness reports missing SMTP requirements without exposing secrets', () => {
  const originalEnv = process.env;
  process.env = { ...originalEnv };

  try {
    delete process.env.SMTP_HOST;
    delete process.env.EMAIL_HOST;
    delete process.env.SMTP_USER;
    delete process.env.EMAIL_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_PASS;
    delete process.env.EMAIL_APP_PASSWORD;
    process.env.SMTP_PORT = '587';

    assert.deepEqual(getSmtpReadiness(), {
      ok: false,
      reason: 'SMTP host is not configured.',
    });

    process.env.SMTP_HOST = 'smtp.example.test';
    assert.deepEqual(getSmtpReadiness(), {
      ok: false,
      reason: 'SMTP user is not configured.',
    });

    process.env.SMTP_USER = 'mailer@example.test';
    assert.deepEqual(getSmtpReadiness(), {
      ok: false,
      reason: 'SMTP password is not configured.',
    });
  } finally {
    process.env = originalEnv;
  }
});

test('public registration role metadata loads only active database roles and excludes stale lead roles', async () => {
  const fakeService = {
    from() {
      return {
        select(selectClause: string) {
          return {
            order() {
              if (selectClause.includes('is_active')) {
                return Promise.resolve({
                  data: null,
                  error: {
                    message: 'column icecream_erp.roles.is_active does not exist',
                  },
                });
              }

              return Promise.resolve({
                data: [
                  { code: 'super_admin', description: 'Full system access', id: 'super-admin-db', name: 'Super Admin', status: 'ACTIVE' },
                  { code: 'branch_manager', description: 'Branch operations', id: 'branch-manager-db', name: 'Branch Manager', status: 'ACTIVE' },
                  { code: 'procurement_lead', description: 'Legacy lead role', id: 'procurement-lead-db', name: 'Procurement Lead', status: 'INACTIVE' },
                ],
                error: null,
              });
            },
          };
        },
      };
    },
  } as never;

  const roles = await getPublicRegistrationRoles(fakeService);
  const superAdmin = roles.find((role) => role.id === 'super-admin-db');
  const branchManager = roles.find((role) => role.id === 'branch-manager-db');
  const procurementLead = roles.find((role) => role.name === 'Procurement Lead');

  assert.equal(superAdmin?.requiresBranch, false);
  assert.equal(superAdmin?.code, 'super_admin');
  assert.equal(branchManager?.requiresBranch, true);
  assert.equal(procurementLead, undefined);
});

test('public registration role metadata falls back safely when active columns are absent', async () => {
  const fakeService = {
    from() {
      return {
        select(selectClause: string) {
          return {
            order() {
              if (
                selectClause.includes('is_active') ||
                selectClause.includes('status') ||
                selectClause.includes('description')
              ) {
                return Promise.resolve({
                  data: null,
                  error: {
                    message: `column ${selectClause.split(',').slice(-1)[0]?.trim() ?? 'roles.unknown'} does not exist`,
                  },
                });
              }

              return Promise.resolve({
                data: [
                  { code: 'super_admin', id: 'super-admin-db', name: 'Super Admin' },
                  { code: 'branch_manager', id: 'branch-manager-db', name: 'Branch Manager' },
                ],
                error: null,
              });
            },
          };
        },
      };
    },
  } as never;

  const roles = await getPublicRegistrationRoles(fakeService);

  assert.deepEqual(roles.map((role) => ({ code: role.code, name: role.name })), [
    { code: 'branch_manager', name: 'Branch Manager' },
    { code: 'super_admin', name: 'Super Admin' },
  ]);
});

test('registration user account payload matches live icecream_erp.user_accounts columns', () => {
  const record = buildRegistrationUserAccountRecord({
    email: ' ADMIN@EXAMPLE.COM ',
    firstName: 'Ada',
    idNumber: '12-345678x90',
    lastName: 'Lovelace',
    organizationId: 'org-1',
    roleId: 'role-1',
    userProfileId: 'profile-1',
    workId: 'AQI-20260001',
  });

  assert.deepEqual(record, {
    email: 'admin@example.com',
    first_name: 'Ada',
    id: 'profile-1',
    id_number: '12345678X90',
    is_active: true,
    last_name: 'Lovelace',
    organization_id: 'org-1',
    password_hash: 'SUPABASE_AUTH_MANAGED',
    role_id: 'role-1',
    updated_at: record.updated_at,
    work_id: 'AQI-20260001',
  });
  assert.equal('user_profile_id' in record, false);
});

test('registration error helpers keep server logs structured and frontend messages safe', () => {
  const duplicateEmailError = {
    code: '23505',
    details: 'Key (email)=(admin@example.com) already exists.',
    message: 'duplicate key value violates unique constraint "user_accounts_email_key"',
  };

  assert.deepEqual(getSafeRegistrationErrorDetails(duplicateEmailError, {
    step: 'create_user_account',
    table: 'user_accounts',
  }), {
    code: '23505',
    detail: 'Key (email)=(admin@example.com) already exists.',
    message: 'duplicate key value violates unique constraint "user_accounts_email_key"',
    step: 'create_user_account',
    table: 'user_accounts',
  });

  assert.equal(getRegistrationClientErrorMessage(duplicateEmailError), 'Email is already registered.');
  assert.equal(getRegistrationClientErrorMessage({
    code: '23505',
    details: 'Key (work_id)=(AQI-20260001) already exists.',
    message: 'duplicate key value violates unique constraint "users_work_id_key"',
  }), 'Work ID is already registered.');
  assert.equal(getRegistrationClientErrorMessage(new Error('unexpected failure')), REGISTRATION_ACCOUNT_FAILURE_MESSAGE);
});

test('validatePasswordResetPassword enforces the configured password policy', () => {
  const strictPolicy = {
    passwordMinLength: 10,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialCharacter: true,
    requireUppercase: true,
  };

  assert.equal(validatePasswordResetPassword('Short1!', strictPolicy), 'Password must be at least 10 characters long.');
  assert.equal(validatePasswordResetPassword('longpassword1!', strictPolicy), 'Password must include at least one uppercase letter.');
  assert.equal(validatePasswordResetPassword('LONGPASSWORD1!', strictPolicy), 'Password must include at least one lowercase letter.');
  assert.equal(validatePasswordResetPassword('LongPassword!', strictPolicy), 'Password must include at least one number.');
  assert.equal(validatePasswordResetPassword('LongPassword1', strictPolicy), 'Password must include at least one special character.');
  assert.equal(validatePasswordResetPassword('LongPassword1!', strictPolicy), null);
});
