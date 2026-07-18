"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const security_1 = require("../src/lib/security");
const admin_delete_server_1 = require("../src/lib/admin-delete-server");
const email_1 = require("../src/lib/email");
const registration_1 = require("../src/lib/registration");
const security_server_1 = require("../src/lib/security-server");
(0, node_test_1.default)('normalizeUserStatus maps unknown values to INACTIVE', () => {
    strict_1.default.equal((0, security_1.normalizeUserStatus)('unknown'), 'INACTIVE');
    strict_1.default.equal((0, security_1.normalizeUserStatus)('active'), 'ACTIVE');
});
(0, node_test_1.default)('mergePermissions removes duplicates and sorts values', () => {
    strict_1.default.deepEqual((0, security_1.mergePermissions)(['b.read', 'a.read'], ['a.read', 'c.read']), ['a.read', 'b.read', 'c.read']);
});
(0, node_test_1.default)('resolveSecurityPolicy applies defaults and minimums', () => {
    strict_1.default.deepEqual((0, security_1.resolveSecurityPolicy)({ sessionTimeoutMinutes: 0, failedLoginLimit: -2 }), {
        failedLoginLimit: 1,
        lockoutDurationMinutes: 30,
        sessionTimeoutMinutes: 1,
    });
});
(0, node_test_1.default)('isLoginAllowed blocks inactive and locked accounts', () => {
    strict_1.default.equal((0, security_1.isLoginAllowed)('ACTIVE', null), true);
    strict_1.default.equal((0, security_1.isLoginAllowed)('INACTIVE', null), false);
    strict_1.default.equal((0, security_1.isLoginAllowed)('LOCKED', null), false);
});
(0, node_test_1.default)('shouldLockAccount matches the configured failed login limit', () => {
    strict_1.default.equal((0, security_1.shouldLockAccount)(4, 5), false);
    strict_1.default.equal((0, security_1.shouldLockAccount)(5, 5), true);
});
(0, node_test_1.default)('getLockoutExpiry adds the requested lockout duration', () => {
    const now = new Date('2026-06-13T10:00:00.000Z');
    strict_1.default.equal((0, security_1.getLockoutExpiry)(now, 15).toISOString(), '2026-06-13T10:15:00.000Z');
});
(0, node_test_1.default)('isSessionExpired evaluates timeout based on last activity', () => {
    const now = new Date('2026-06-13T10:16:00.000Z');
    strict_1.default.equal((0, security_1.isSessionExpired)('2026-06-13T10:00:00.000Z', 15, now), true);
    strict_1.default.equal((0, security_1.isSessionExpired)('2026-06-13T10:02:00.000Z', 15, now), false);
});
(0, node_test_1.default)('hasPermissionAccess honors ERP permission aliases and dotted variants', () => {
    const permissions = ['production_batch.create', 'reports.production', 'stock_transfer.create'];
    strict_1.default.equal((0, security_1.hasPermissionAccess)(permissions, 'production.write'), true);
    strict_1.default.equal((0, security_1.hasPermissionAccess)(permissions, 'production.batch.create'), true);
    strict_1.default.equal((0, security_1.hasPermissionAccess)(permissions, 'reports.read'), true);
    strict_1.default.equal((0, security_1.hasPermissionAccess)(permissions, 'inventory.write'), true);
    strict_1.default.equal((0, security_1.hasPermissionAccess)(permissions, 'quality.write'), false);
});
(0, node_test_1.default)('hasPermissionAccess resolves sales customer aliases to legacy sales permissions', () => {
    const permissions = ['sales.write', 'sales.read'];
    strict_1.default.equal((0, security_1.hasPermissionAccess)(permissions, 'sales.customer.create'), true);
    strict_1.default.equal((0, security_1.hasPermissionAccess)(permissions, 'sales.customer.edit'), true);
    strict_1.default.equal((0, security_1.hasPermissionAccess)(permissions, 'sales.customer.view'), true);
    strict_1.default.equal((0, security_1.hasPermissionAccess)(permissions, 'sales.customer.deactivate'), true);
});
(0, node_test_1.default)('resolveAdminActionKeyValidation returns the expected messages for missing, missing-env, and invalid keys', () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv };
    try {
        delete process.env.SYSTEM_ADMIN_DELETE_KEY;
        delete process.env.ADMIN_DELETE_KEY;
        delete process.env.ADMIN_KEY;
        strict_1.default.deepEqual((0, admin_delete_server_1.resolveAdminActionKeyValidation)({ body: {}, request: new Request('https://example.test') }), {
            configuredKey: null,
            error: 'Admin action key is not configured.',
            suppliedKey: '',
        });
        process.env.ADMIN_KEY = 'shared-secret';
        strict_1.default.deepEqual((0, admin_delete_server_1.resolveAdminActionKeyValidation)({ body: {}, request: new Request('https://example.test') }), {
            configuredKey: 'shared-secret',
            error: 'Admin key is required.',
            suppliedKey: '',
        });
        strict_1.default.deepEqual((0, admin_delete_server_1.resolveAdminActionKeyValidation)({
            body: { adminKey: 'wrong-secret' },
            request: new Request('https://example.test'),
        }), {
            configuredKey: 'shared-secret',
            error: 'Invalid admin key.',
            suppliedKey: 'wrong-secret',
        });
    }
    finally {
        process.env = originalEnv;
    }
});
(0, node_test_1.default)('getSmtpConfig prefers canonical SMTP vars and strips spaces from app passwords', () => {
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
        strict_1.default.deepEqual((0, email_1.getSmtpConfig)(), {
            from: 'primary@test.local',
            host: 'smtp.primary.test',
            pass: 'abcdefghijklmnop',
            port: '587',
            secure: 'false',
            user: 'primary-user',
        });
    }
    finally {
        process.env = originalEnv;
    }
});
(0, node_test_1.default)('getSmtpReadiness reports missing SMTP requirements without exposing secrets', () => {
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
        strict_1.default.deepEqual((0, email_1.getSmtpReadiness)(), {
            ok: false,
            reason: 'SMTP host is not configured.',
        });
        process.env.SMTP_HOST = 'smtp.example.test';
        strict_1.default.deepEqual((0, email_1.getSmtpReadiness)(), {
            ok: false,
            reason: 'SMTP user is not configured.',
        });
        process.env.SMTP_USER = 'mailer@example.test';
        strict_1.default.deepEqual((0, email_1.getSmtpReadiness)(), {
            ok: false,
            reason: 'SMTP password is not configured.',
        });
    }
    finally {
        process.env = originalEnv;
    }
});
(0, node_test_1.default)('public registration role metadata loads only active database roles and excludes stale lead roles', async () => {
    const fakeService = {
        from() {
            return {
                select(selectClause) {
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
    };
    const roles = await (0, registration_1.getPublicRegistrationRoles)(fakeService);
    const superAdmin = roles.find((role) => role.id === 'super-admin-db');
    const branchManager = roles.find((role) => role.id === 'branch-manager-db');
    const procurementLead = roles.find((role) => role.name === 'Procurement Lead');
    strict_1.default.equal(superAdmin?.requiresBranch, false);
    strict_1.default.equal(superAdmin?.code, 'super_admin');
    strict_1.default.equal(branchManager?.requiresBranch, true);
    strict_1.default.equal(procurementLead, undefined);
});
(0, node_test_1.default)('public registration role metadata falls back safely when active columns are absent', async () => {
    const fakeService = {
        from() {
            return {
                select(selectClause) {
                    return {
                        order() {
                            if (selectClause.includes('is_active') ||
                                selectClause.includes('status') ||
                                selectClause.includes('description')) {
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
    };
    const roles = await (0, registration_1.getPublicRegistrationRoles)(fakeService);
    strict_1.default.deepEqual(roles.map((role) => ({ code: role.code, name: role.name })), [
        { code: 'branch_manager', name: 'Branch Manager' },
        { code: 'super_admin', name: 'Super Admin' },
    ]);
});
(0, node_test_1.default)('registration user account payload matches live icecream_erp.user_accounts columns', () => {
    const record = (0, registration_1.buildRegistrationUserAccountRecord)({
        email: ' ADMIN@EXAMPLE.COM ',
        firstName: 'Ada',
        idNumber: '12-345678x90',
        lastName: 'Lovelace',
        organizationId: 'org-1',
        roleId: 'role-1',
        userProfileId: 'profile-1',
        workId: 'AQI-20260001',
    });
    strict_1.default.deepEqual(record, {
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
    strict_1.default.equal('user_profile_id' in record, false);
});
(0, node_test_1.default)('registration error helpers keep server logs structured and frontend messages safe', () => {
    const duplicateEmailError = {
        code: '23505',
        details: 'Key (email)=(admin@example.com) already exists.',
        message: 'duplicate key value violates unique constraint "user_accounts_email_key"',
    };
    strict_1.default.deepEqual((0, registration_1.getSafeRegistrationErrorDetails)(duplicateEmailError, {
        step: 'create_user_account',
        table: 'user_accounts',
    }), {
        code: '23505',
        detail: 'Key (email)=(admin@example.com) already exists.',
        message: 'duplicate key value violates unique constraint "user_accounts_email_key"',
        step: 'create_user_account',
        table: 'user_accounts',
    });
    strict_1.default.equal((0, registration_1.getRegistrationClientErrorMessage)(duplicateEmailError), 'Email is already registered.');
    strict_1.default.equal((0, registration_1.getRegistrationClientErrorMessage)({
        code: '23505',
        details: 'Key (work_id)=(AQI-20260001) already exists.',
        message: 'duplicate key value violates unique constraint "users_work_id_key"',
    }), 'Work ID is already registered.');
    strict_1.default.equal((0, registration_1.getRegistrationClientErrorMessage)(new Error('unexpected failure')), registration_1.REGISTRATION_ACCOUNT_FAILURE_MESSAGE);
});
(0, node_test_1.default)('validatePasswordResetPassword enforces the configured password policy', () => {
    const strictPolicy = {
        passwordMinLength: 10,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialCharacter: true,
        requireUppercase: true,
    };
    strict_1.default.equal((0, security_server_1.validatePasswordResetPassword)('Short1!', strictPolicy), 'Password must be at least 10 characters long.');
    strict_1.default.equal((0, security_server_1.validatePasswordResetPassword)('longpassword1!', strictPolicy), 'Password must include at least one uppercase letter.');
    strict_1.default.equal((0, security_server_1.validatePasswordResetPassword)('LONGPASSWORD1!', strictPolicy), 'Password must include at least one lowercase letter.');
    strict_1.default.equal((0, security_server_1.validatePasswordResetPassword)('LongPassword!', strictPolicy), 'Password must include at least one number.');
    strict_1.default.equal((0, security_server_1.validatePasswordResetPassword)('LongPassword1', strictPolicy), 'Password must include at least one special character.');
    strict_1.default.equal((0, security_server_1.validatePasswordResetPassword)('LongPassword1!', strictPolicy), null);
});
