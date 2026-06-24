import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';

import { ROLES, generateWorkId } from '@/lib/auth-roles';
import { createServiceRoleClient } from '@/lib/supabase/server';

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

type SupabaseSchemaClient = ReturnType<ReturnType<typeof createServiceRoleClient>['schema']>;

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

function isMissingRelation(error: unknown, table: string) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return message.includes(`Could not find the table 'icecream_erp.${table}'`) || message.toLowerCase().includes(`${table.toLowerCase()} does not exist`);
}

export function sanitizeIdNumber(value: string) {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '');
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
    .select('id, name, description')
    .order('name', { ascending: true });

  const staticRoles = ROLES.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    legacyRole: role.id,
    requiresBranch: role.id !== 'super_admin',
  })) satisfies RegistrationRoleRecord[];

  if (error || !data?.length) {
    return staticRoles;
  }

  const merged = new Map<string, RegistrationRoleRecord>();

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
    } satisfies RegistrationRoleRecord;
    merged.set(normalizeRoleName(entry.name), entry);
    merged.set(normalizeRoleName(entry.id), entry);
    if (!merged.has(normalizeRoleName(legacyRole))) {
      merged.set(normalizeRoleName(legacyRole), entry);
    }
  }

  const seen = new Set<string>();
  return Array.from(merged.values()).filter((role) => {
    const key = normalizeRoleName(role.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
