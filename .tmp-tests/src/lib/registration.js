"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idNumberPattern = exports.registrationPasswordPolicy = void 0;
exports.isMissingPendingRegistrationStorage = isMissingPendingRegistrationStorage;
exports.sanitizeIdNumber = sanitizeIdNumber;
exports.validateRegistrationPayload = validateRegistrationPayload;
exports.passwordMeetsPolicy = passwordMeetsPolicy;
exports.generateOtpCode = generateOtpCode;
exports.hashOtpCode = hashOtpCode;
exports.createRegistrationRequestToken = createRegistrationRequestToken;
exports.verifyRegistrationRequestToken = verifyRegistrationRequestToken;
exports.encryptRegistrationPayload = encryptRegistrationPayload;
exports.decryptRegistrationPayload = decryptRegistrationPayload;
exports.registrationOtpExpiresAt = registrationOtpExpiresAt;
exports.otpExpiryLabel = otpExpiryLabel;
exports.maskEmailAddress = maskEmailAddress;
exports.findExistingRegistrationAccount = findExistingRegistrationAccount;
exports.upsertPendingRegistration = upsertPendingRegistration;
exports.getPendingRegistrationById = getPendingRegistrationById;
exports.deletePendingRegistration = deletePendingRegistration;
exports.deriveLegacyRole = deriveLegacyRole;
exports.toStoredUserRole = toStoredUserRole;
exports.getPublicRegistrationRoles = getPublicRegistrationRoles;
exports.resolveRegistrationRole = resolveRegistrationRole;
exports.getPrimaryOrganizationId = getPrimaryOrganizationId;
exports.generateNextWorkId = generateNextWorkId;
exports.assignUserRole = assignUserRole;
exports.syncUserBranchAssignment = syncUserBranchAssignment;
const crypto_1 = require("crypto");
const auth_roles_1 = require("./auth-roles");
const server_1 = require("./supabase/server");
exports.registrationPasswordPolicy = {
    minLength: 8,
    requireDigit: true,
    requireLowercase: true,
    requireSpecialCharacter: true,
    requireUppercase: true,
};
exports.idNumberPattern = /^[0-9]{6,9}[A-Z][0-9]{2}$/;
const otpExpiryMinutes = 10;
function registrationSecret() {
    return (process.env.REGISTRATION_OTP_SECRET ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.ADMIN_REGISTRATION_KEY ||
        process.env.IMPERSONATE_KEY ||
        'registration-secret');
}
function deriveKey() {
    return (0, crypto_1.createHash)('sha256').update(registrationSecret()).digest();
}
function normalizeRoleName(roleName) {
    return roleName.trim().toLowerCase();
}
function isMissingRelation(error, table) {
    const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message ?? '') : '';
    return message.includes(`Could not find the table 'icecream_erp.${table}'`) || message.toLowerCase().includes(`${table.toLowerCase()} does not exist`);
}
function isMissingPendingRegistrationStorage(error) {
    return isMissingRelation(error, 'registration_otps');
}
async function findAuthUserByEmail(email) {
    const client = (0, server_1.createServiceRoleClient)();
    let page = 1;
    const normalizedEmail = email.trim().toLowerCase();
    while (true) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
        if (error) {
            throw error;
        }
        const users = data?.users ?? [];
        const match = users.find((user) => String(user.email ?? '').trim().toLowerCase() === normalizedEmail);
        if (match) {
            return match;
        }
        if (users.length < 200) {
            return null;
        }
        page += 1;
    }
}
function sanitizeIdNumber(value) {
    return value.toUpperCase().replace(/[^0-9A-Z]/g, '');
}
function validateRegistrationPayload(input) {
    const fieldErrors = {};
    const firstName = String(input.firstName ?? '').trim();
    const lastName = String(input.lastName ?? '').trim();
    const idNumber = sanitizeIdNumber(String(input.idNumber ?? ''));
    const email = String(input.email ?? '').trim().toLowerCase();
    const password = String(input.password ?? '');
    const confirmPassword = String(input.confirmPassword ?? '');
    const role = String(input.role ?? '').trim();
    const branchId = input.branchId ? String(input.branchId).trim() : '';
    const adminKey = String(input.adminKey ?? '').trim();
    if (!/^[A-Za-z]{2,}$/.test(firstName)) {
        fieldErrors.first_name = 'First name must be at least 2 letters.';
    }
    if (!/^[A-Za-z]{2,}$/.test(lastName)) {
        fieldErrors.last_name = 'Surname must be at least 2 letters.';
    }
    if (!exports.idNumberPattern.test(idNumber)) {
        fieldErrors.id_number = 'ID number must follow the format 752027732X27.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        fieldErrors.email = 'Please enter a valid email address.';
    }
    if (!passwordMeetsPolicy(password)) {
        fieldErrors.password = 'Password must be at least 8 characters and include uppercase, lowercase, digit, and special character.';
    }
    if (!confirmPassword || password !== confirmPassword) {
        fieldErrors.confirm_password = 'Passwords do not match.';
    }
    if (!role) {
        fieldErrors.role = 'Please select a role.';
    }
    if (!adminKey) {
        fieldErrors.admin_key = 'Admin registration key is required.';
    }
    return {
        fieldErrors,
        normalized: {
            adminKey,
            branchId,
            email,
            firstName,
            idNumber,
            lastName,
            password,
            role,
        },
    };
}
function passwordMeetsPolicy(password) {
    return (password.length >= exports.registrationPasswordPolicy.minLength &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password));
}
function generateOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
function hashOtpCode(requestId, otp) {
    return (0, crypto_1.createHash)('sha256').update(`${requestId}:${otp}:${registrationSecret()}`).digest('hex');
}
function base64UrlEncode(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
function base64UrlDecode(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
}
function signRegistrationToken(payload) {
    return base64UrlEncode((0, crypto_1.createHmac)('sha256', registrationSecret()).update(payload).digest());
}
function createRegistrationRequestToken(payload) {
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = signRegistrationToken(encodedPayload);
    return `${encodedPayload}.${signature}`;
}
function verifyRegistrationRequestToken(token) {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
        throw new Error('Invalid registration token.');
    }
    const expectedSignature = signRegistrationToken(encodedPayload);
    if (expectedSignature !== signature) {
        throw new Error('Registration token signature is invalid.');
    }
    return JSON.parse(base64UrlDecode(encodedPayload));
}
function encryptRegistrationPayload(payload) {
    const iv = (0, crypto_1.randomBytes)(12);
    const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', deriveKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload), 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}
function decryptRegistrationPayload(value) {
    const [ivBase64, tagBase64, encryptedBase64] = value.split('.');
    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
        throw new Error('Invalid registration payload.');
    }
    const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', deriveKey(), Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedBase64, 'base64')),
        decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8'));
}
function registrationOtpExpiresAt() {
    return new Date(Date.now() + otpExpiryMinutes * 60000).toISOString();
}
function otpExpiryLabel() {
    return `${otpExpiryMinutes} minutes`;
}
function maskEmailAddress(email) {
    const [localPart, domain = ''] = email.split('@');
    if (localPart.length <= 2) {
        return `${localPart[0] ?? ''}***@${domain}`;
    }
    return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
}
async function findExistingRegistrationAccount(service, input) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedIdNumber = input.idNumber ? sanitizeIdNumber(input.idNumber) : '';
    const [{ data: existingUserByEmail }, { data: existingUserById }, userAccountResult, authUser] = await Promise.all([
        service.from('users').select('id').ilike('email', normalizedEmail).maybeSingle(),
        normalizedIdNumber ? service.from('users').select('id').eq('id_number', normalizedIdNumber).maybeSingle() : Promise.resolve({ data: null, error: null }),
        (async () => {
            try {
                const [byEmail, byId] = await Promise.all([
                    service.from('user_accounts').select('id').ilike('email', normalizedEmail).maybeSingle(),
                    normalizedIdNumber ? service.from('user_accounts').select('id').eq('id_number', normalizedIdNumber).maybeSingle() : Promise.resolve({ data: null, error: null }),
                ]);
                return {
                    email: byEmail.data,
                    emailError: byEmail.error,
                    id: byId.data,
                    idError: byId.error,
                };
            }
            catch (error) {
                return { email: null, emailError: error, id: null, idError: null };
            }
        })(),
        findAuthUserByEmail(normalizedEmail),
    ]);
    if (userAccountResult.emailError && !isMissingRelation(userAccountResult.emailError, 'user_accounts')) {
        throw userAccountResult.emailError;
    }
    if (userAccountResult.idError && !isMissingRelation(userAccountResult.idError, 'user_accounts')) {
        throw userAccountResult.idError;
    }
    return {
        authUserId: authUser?.id ? String(authUser.id) : null,
        emailRegistered: Boolean(existingUserByEmail || userAccountResult.email || authUser),
        idNumberRegistered: Boolean(existingUserById || userAccountResult.id),
    };
}
async function upsertPendingRegistration(service, input) {
    const { data, error } = await service
        .from('registration_otps')
        .upsert({
        email: input.email.trim().toLowerCase(),
        expires_at: input.expiresAt,
        id_number: sanitizeIdNumber(input.idNumber),
        otp_hash: input.otpHash,
        payload_encrypted: input.payloadEncrypted,
        role_id: input.roleId,
        updated_at: new Date().toISOString(),
        used_at: null,
    }, { onConflict: 'email' })
        .select('id, email, expires_at, id_number, otp_hash, payload_encrypted, role_id, used_at')
        .single();
    if (error) {
        throw error;
    }
    return {
        email: String(data.email),
        expiresAt: String(data.expires_at),
        id: String(data.id),
        idNumber: String(data.id_number),
        otpHash: String(data.otp_hash),
        payloadEncrypted: String(data.payload_encrypted),
        roleId: String(data.role_id),
        usedAt: data.used_at ? String(data.used_at) : null,
    };
}
async function getPendingRegistrationById(service, id) {
    const { data, error } = await service
        .from('registration_otps')
        .select('id, email, expires_at, id_number, otp_hash, payload_encrypted, role_id, used_at')
        .eq('id', id)
        .maybeSingle();
    if (error) {
        throw error;
    }
    if (!data) {
        return null;
    }
    return {
        email: String(data.email),
        expiresAt: String(data.expires_at),
        id: String(data.id),
        idNumber: String(data.id_number),
        otpHash: String(data.otp_hash),
        payloadEncrypted: String(data.payload_encrypted),
        roleId: String(data.role_id),
        usedAt: data.used_at ? String(data.used_at) : null,
    };
}
async function deletePendingRegistration(service, id) {
    const { error } = await service.from('registration_otps').delete().eq('id', id);
    if (error) {
        throw error;
    }
}
function deriveLegacyRole(roleName, roleId) {
    const normalized = normalizeRoleName(roleName || roleId || '');
    if (normalized.includes('super admin') || normalized.includes('system admin') || normalized === 'super_admin') {
        return 'super_admin';
    }
    if (normalized.includes('branch manager') || normalized === 'branch_manager') {
        return 'branch_manager';
    }
    if (normalized.includes('operations manager') || normalized === 'operations_manager') {
        return 'operations_manager';
    }
    if (normalized.includes('production')) {
        return 'production_manager';
    }
    if (normalized.includes('sales')) {
        return 'sales_lead';
    }
    if (normalized.includes('finance') || normalized.includes('account')) {
        return 'finance_lead';
    }
    if (normalized.includes('procurement') || normalized.includes('purchase')) {
        return 'procurement_lead';
    }
    if (normalized.includes('inventory') || normalized.includes('store')) {
        return 'inventory_lead';
    }
    if (normalized.includes('hr') || normalized.includes('payroll')) {
        return 'hr_lead';
    }
    if (normalized.includes('quality')) {
        return 'quality_lead';
    }
    if (normalized.includes('manager') || normalized === 'manager') {
        return 'manager';
    }
    return 'staff';
}
function toStoredUserRole(role) {
    const normalized = normalizeRoleName(role);
    if (normalized === 'super_admin')
        return 'super_admin';
    if (normalized === 'branch_manager')
        return 'branch_manager';
    if (normalized === 'staff')
        return 'staff';
    return 'manager';
}
async function getPublicRegistrationRoles(service) {
    const { data, error } = await service
        .from('roles')
        .select('id, name, description')
        .order('name', { ascending: true });
    const staticRoles = auth_roles_1.ROLES.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        legacyRole: role.id,
        requiresBranch: role.id !== 'super_admin',
    }));
    if (error || !data?.length) {
        return staticRoles;
    }
    const merged = new Map();
    for (const role of staticRoles) {
        merged.set(normalizeRoleName(role.name), role);
        merged.set(normalizeRoleName(role.id), role);
    }
    for (const role of data) {
        const legacyRole = deriveLegacyRole(String(role.name), String(role.id));
        const entry = {
            id: String(role.id),
            name: String(role.name),
            description: role.description ? String(role.description) : null,
            legacyRole,
            requiresBranch: legacyRole !== 'super_admin',
        };
        merged.set(normalizeRoleName(entry.name), entry);
        merged.set(normalizeRoleName(entry.id), entry);
        if (!merged.has(normalizeRoleName(legacyRole))) {
            merged.set(normalizeRoleName(legacyRole), entry);
        }
    }
    const seen = new Set();
    return Array.from(merged.values()).filter((role) => {
        const key = normalizeRoleName(role.name);
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
async function resolveRegistrationRole(service, selectedRole) {
    const normalizedRole = selectedRole.trim();
    const roles = await getPublicRegistrationRoles(service);
    const match = roles.find((role) => role.id === normalizedRole || role.name.toLowerCase() === normalizedRole.toLowerCase());
    if (!match) {
        return null;
    }
    return match;
}
async function getPrimaryOrganizationId(service) {
    const { data } = await service.from('organizations').select('id').limit(1).maybeSingle();
    return data?.id ? String(data.id) : null;
}
async function generateNextWorkId(service) {
    const year = new Date().getFullYear();
    const { data: lastUser } = await service
        .from('users')
        .select('work_id')
        .like('work_id', `AQI-${year}%`)
        .order('work_id', { ascending: false })
        .limit(1)
        .maybeSingle();
    const lastSeq = lastUser?.work_id ? parseInt(String(lastUser.work_id).slice(-4), 10) : 0;
    return (0, auth_roles_1.generateWorkId)(Number.isFinite(lastSeq) ? lastSeq : 0);
}
async function assignUserRole(input) {
    const { data: roleRecord, error: roleLookupError } = await input.service
        .from('roles')
        .select('id')
        .eq('id', input.roleId)
        .maybeSingle();
    if (roleLookupError && !isMissingRelation(roleLookupError, 'roles')) {
        throw roleLookupError;
    }
    if (!roleRecord?.id) {
        return;
    }
    const { error } = await input.service.from('user_roles').upsert({
        assigned_at: new Date().toISOString(),
        assigned_by: input.assignedBy ?? null,
        role_id: roleRecord.id,
        user_profile_id: input.userProfileId,
    }, { onConflict: 'user_profile_id,role_id' });
    if (error) {
        if (isMissingRelation(error, 'user_roles')) {
            return;
        }
        throw error;
    }
}
async function syncUserBranchAssignment(input) {
    try {
        await input.service
            .from('user_branch_assignments')
            .update({ is_active: false, updated_by: input.assignedBy ?? null })
            .eq('user_profile_id', input.userProfileId)
            .eq('is_active', true);
    }
    catch (error) {
        if (!isMissingRelation(error, 'user_branch_assignments')) {
            throw error;
        }
        return;
    }
    if (!input.branchId) {
        return;
    }
    const { error } = await input.service.from('user_branch_assignments').insert({
        user_profile_id: input.userProfileId,
        branch_id: input.branchId,
        role_name: input.roleName ?? null,
        effective_date: new Date().toISOString().slice(0, 10),
        is_active: true,
        created_by: input.assignedBy ?? null,
        updated_by: input.assignedBy ?? null,
    });
    if (error && !isMissingRelation(error, 'user_branch_assignments')) {
        throw error;
    }
}
