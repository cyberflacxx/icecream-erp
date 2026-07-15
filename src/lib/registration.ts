import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';

import { generateWorkId, workIdToEmail } from './auth-roles';
import { createServiceRoleClient } from './supabase/server';

export interface RegistrationPayload {
  branchId?: string | null;
  email: string;
  firstName: string;
  idNumber: string;
  lastName: string;
  password: string;
  role: string;
}

export interface RegistrationRoleRecord {
  description: string | null;
  id: string;
  legacyRole: string;
  name: string;
  requiresBranch: boolean;
}

export interface PendingRegistrationRecord {
  email: string;
  expiresAt: string;
  id: string;
  idNumber: string;
  otpHash: string;
  payloadEncrypted: string;
  roleId: string;
  usedAt: string | null;
}

export interface RegistrationUserAccountRecord {
  email: string;
  first_name: string;
  id: string;
  id_number: string;
  is_active: boolean;
  last_name: string;
  organization_id: string;
  password_hash: string;
  role_id: string;
  updated_at: string;
  work_id: string;
}

export interface SafeRegistrationErrorDetails {
  code: string;
  detail: string | null;
  message: string;
  step: string;
  table: string | null;
}

type SupabaseSchemaClient = ReturnType<ReturnType<typeof createServiceRoleClient>['schema']>;

export const REGISTRATION_ACCOUNT_FAILURE_MESSAGE = 'Account creation failed. Please try again.';
export const REGISTRATION_ROLE_UNAVAILABLE_MESSAGE = 'Selected role is no longer available. Please refresh and try again.';
export const REGISTRATION_BRANCH_UNAVAILABLE_MESSAGE = 'Selected branch is no longer available. Please refresh and try again.';
export const REGISTRATION_WORK_ID_UNAVAILABLE_MESSAGE = 'Work ID is already registered.';

export const registrationPasswordPolicy = {
  minLength: 8,
  requireDigit: true,
  requireLowercase: true,
  requireSpecialCharacter: true,
  requireUppercase: true,
} as const;

export const idNumberPattern = /^[0-9]{6,9}[A-Z][0-9]{2}$/;
const otpExpiryMinutes = 10;

function registrationSecret() {
  return (
    process.env.REGISTRATION_OTP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_REGISTRATION_KEY ||
    process.env.IMPERSONATE_KEY ||
    'registration-secret'
  );
}

function deriveKey() {
  return createHash('sha256').update(registrationSecret()).digest();
}

function normalizeRoleName(roleName: string) {
  return roleName.trim().toLowerCase();
}

function isTruthyBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

function isActiveRoleRecord(row: Record<string, unknown>) {
  if ('is_active' in row) {
    return isTruthyBoolean(row.is_active);
  }

  if ('status' in row) {
    const status = String(row.status ?? '').trim().toUpperCase();
    if (status) {
      return status === 'ACTIVE';
    }
  }

  return true;
}

function isMissingRelation(error: unknown, table: string) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return message.includes(`Could not find the table 'icecream_erp.${table}'`) || message.toLowerCase().includes(`${table.toLowerCase()} does not exist`);
}

function safeErrorString(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 300);
}

function extractErrorField(error: unknown, field: 'code' | 'details' | 'message') {
  if (typeof error !== 'object' || error === null || !(field in error)) {
    return null;
  }

  return safeErrorString((error as Record<string, unknown>)[field], '');
}

export function isMissingPendingRegistrationStorage(error: unknown) {
  return isMissingRelation(error, 'registration_otps');
}

async function findAuthUserByEmail(email: string) {
  const client = createServiceRoleClient();
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

export function sanitizeIdNumber(value: string) {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function getSafeRegistrationErrorDetails(error: unknown, input: { step: string; table?: string | null }) {
  return {
    code: extractErrorField(error, 'code') || 'UNKNOWN',
    detail: extractErrorField(error, 'details') || null,
    message: extractErrorField(error, 'message') || safeErrorString(error instanceof Error ? error.message : '', 'Unknown registration error'),
    step: input.step,
    table: input.table ?? null,
  } satisfies SafeRegistrationErrorDetails;
}

export function getRegistrationClientErrorMessage(error: unknown) {
  const code = extractErrorField(error, 'code') || '';
  const message = `${extractErrorField(error, 'message') || ''} ${extractErrorField(error, 'details') || ''}`.toLowerCase();

  if (code === '23505') {
    if (message.includes('email')) {
      return 'Email is already registered.';
    }
    if (message.includes('work_id') || message.includes('work id')) {
      return REGISTRATION_WORK_ID_UNAVAILABLE_MESSAGE;
    }
    if (message.includes('id_number') || message.includes('id number')) {
      return 'An account with this ID number already exists.';
    }
  }

  if (message.includes('role') && message.includes('available')) {
    return REGISTRATION_ROLE_UNAVAILABLE_MESSAGE;
  }
  if (message.includes('branch') && message.includes('available')) {
    return REGISTRATION_BRANCH_UNAVAILABLE_MESSAGE;
  }

  return REGISTRATION_ACCOUNT_FAILURE_MESSAGE;
}

export function buildRegistrationUserAccountRecord(input: {
  email: string;
  firstName: string;
  idNumber: string;
  lastName: string;
  organizationId: string;
  roleId: string;
  userProfileId: string;
  workId: string;
}) {
  return {
    id: input.userProfileId,
    email: input.email.trim().toLowerCase(),
    first_name: input.firstName,
    id_number: sanitizeIdNumber(input.idNumber),
    is_active: true,
    last_name: input.lastName,
    organization_id: input.organizationId,
    password_hash: 'SUPABASE_AUTH_MANAGED',
    role_id: input.roleId,
    updated_at: new Date().toISOString(),
    work_id: input.workId,
  } satisfies RegistrationUserAccountRecord;
}

export function validateRegistrationPayload(input: {
  adminKey?: string;
  confirmPassword?: string;
  email?: string;
  firstName?: string;
  idNumber?: string;
  lastName?: string;
  password?: string;
  branchId?: string | null;
  role?: string;
}) {
  const fieldErrors: Record<string, string> = {};
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
  if (!idNumberPattern.test(idNumber)) {
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

export function passwordMeetsPolicy(password: string) {
  return (
    password.length >= registrationPasswordPolicy.minLength &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashOtpCode(requestId: string, otp: string) {
  return createHash('sha256').update(`${requestId}:${otp}:${registrationSecret()}`).digest('hex');
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

function signRegistrationToken(payload: string) {
  return base64UrlEncode(createHmac('sha256', registrationSecret()).update(payload).digest());
}

export function createRegistrationRequestToken(payload: {
  email: string;
  expiresAt: string;
  otpHash: string;
  payloadEncrypted: string;
  requestId: string;
  roleId: string;
}) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signRegistrationToken(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyRegistrationRequestToken(token: string) {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid registration token.');
  }

  const expectedSignature = signRegistrationToken(encodedPayload);
  if (expectedSignature !== signature) {
    throw new Error('Registration token signature is invalid.');
  }

  return JSON.parse(base64UrlDecode(encodedPayload)) as {
    email: string;
    expiresAt: string;
    otpHash: string;
    payloadEncrypted: string;
    requestId: string;
    roleId: string;
  };
}

export function encryptRegistrationPayload(payload: RegistrationPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptRegistrationPayload(value: string) {
  const [ivBase64, tagBase64, encryptedBase64] = value.split('.');
  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error('Invalid registration payload.');
  }

  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivBase64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as RegistrationPayload;
}

export function registrationOtpExpiresAt() {
  return new Date(Date.now() + otpExpiryMinutes * 60_000).toISOString();
}

export function otpExpiryLabel() {
  return `${otpExpiryMinutes} minutes`;
}

export function maskEmailAddress(email: string) {
  const [localPart, domain = ''] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0] ?? ''}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
}

export async function findExistingRegistrationAccount(
  service: SupabaseSchemaClient,
  input: { email: string; idNumber?: string },
) {
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
      } catch (error) {
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

export async function upsertPendingRegistration(
  service: SupabaseSchemaClient,
  input: {
    email: string;
    expiresAt: string;
    idNumber: string;
    otpHash: string;
    payloadEncrypted: string;
    roleId: string;
  },
) {
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
  } satisfies PendingRegistrationRecord;
}

export async function getPendingRegistrationById(service: SupabaseSchemaClient, id: string) {
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
  } satisfies PendingRegistrationRecord;
}

export async function deletePendingRegistration(service: SupabaseSchemaClient, id: string) {
  const { error } = await service.from('registration_otps').delete().eq('id', id);
  if (error) {
    throw error;
  }
}

export function deriveLegacyRole(roleName: string, roleId?: string) {
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

export function toStoredUserRole(role: string) {
  const normalized = normalizeRoleName(role);
  if (normalized === 'super_admin') return 'super_admin';
  if (normalized === 'branch_manager') return 'branch_manager';
  if (normalized === 'staff') return 'staff';
  return 'manager';
}

export async function getPublicRegistrationRoles(service: SupabaseSchemaClient) {
  const { data, error } = await service
    .from('roles')
    .select('id, name, description, status, is_active')
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((role) => role as Record<string, unknown>)
    .filter((role) => role.id && role.name)
    .filter(isActiveRoleRecord)
    .map((role) => {
      const id = String(role.id);
      const name = String(role.name);
      const legacyRole = deriveLegacyRole(name, id);

      return {
        id,
        name,
        description: role.description ? String(role.description) : null,
        legacyRole,
        requiresBranch: legacyRole !== 'super_admin',
      } satisfies RegistrationRoleRecord;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function resolveRegistrationRole(service: SupabaseSchemaClient, selectedRole: string) {
  const normalizedRole = selectedRole.trim();
  const roles = await getPublicRegistrationRoles(service);
  const match = roles.find((role) => role.id === normalizedRole || role.name.toLowerCase() === normalizedRole.toLowerCase());

  if (!match) {
    return null;
  }

  return match;
}

export async function getPrimaryOrganizationId(service: SupabaseSchemaClient) {
  const { data } = await service.from('organizations').select('id').limit(1).maybeSingle();
  return data?.id ? String(data.id) : null;
}

export async function generateNextWorkId(service: SupabaseSchemaClient) {
  const year = new Date().getFullYear();
  const { data: lastUser } = await service
    .from('users')
    .select('work_id')
    .like('work_id', `AQI-${year}%`)
    .order('work_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSeq = lastUser?.work_id ? parseInt(String(lastUser.work_id).slice(-4), 10) : 0;
  return generateWorkId(Number.isFinite(lastSeq) ? lastSeq : 0);
}

export async function generateAvailableWorkId(service: SupabaseSchemaClient, maxAttempts = 25) {
  const year = new Date().getFullYear();
  const { data: lastUser } = await service
    .from('users')
    .select('work_id')
    .like('work_id', `AQI-${year}%`)
    .order('work_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSequence = lastUser?.work_id ? parseInt(String(lastUser.work_id).slice(-4), 10) : 0;
  nextSequence = Number.isFinite(nextSequence) ? nextSequence : 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const workId = generateWorkId(nextSequence + attempt);
    const syntheticEmail = workIdToEmail(workId);

    const [{ data: existingUser }, { data: existingAccount }, existingAuthUser] = await Promise.all([
      service.from('users').select('id').eq('work_id', workId).maybeSingle(),
      service.from('user_accounts').select('id').eq('work_id', workId).maybeSingle(),
      findAuthUserByEmail(syntheticEmail),
    ]);

    if (!existingUser && !existingAccount && !existingAuthUser) {
      return workId;
    }
  }

  throw new Error('Unable to generate an available work ID.');
}

export async function assignUserRole(input: {
  assignedBy?: string | null;
  roleId: string;
  service: SupabaseSchemaClient;
  userProfileId: string;
}) {
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

export async function syncUserBranchAssignment(input: {
  assignedBy?: string | null;
  branchId?: string | null;
  roleName?: string | null;
  service: SupabaseSchemaClient;
  userProfileId: string;
}) {
  try {
    await input.service
      .from('user_branch_assignments')
      .update({ is_active: false, updated_by: input.assignedBy ?? null })
      .eq('user_profile_id', input.userProfileId)
      .eq('is_active', true);
  } catch (error) {
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
