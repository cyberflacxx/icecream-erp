import { NextRequest, NextResponse } from 'next/server';

import { workIdToEmail } from '@/lib/auth-roles';
import { resolveAdminActionKeyValidation } from '@/lib/admin-delete-server';
import { sendTransactionalEmail } from '@/lib/email';
import {
  assignUserRole,
  deletePendingRegistration,
  decryptRegistrationPayload,
  findExistingRegistrationAccount,
  generateNextWorkId,
  getPendingRegistrationById,
  getPrimaryOrganizationId,
  hashOtpCode,
  isMissingPendingRegistrationStorage,
  resolveRegistrationRole,
  syncUserBranchAssignment,
  toStoredUserRole,
  verifyRegistrationRequestToken,
} from '@/lib/registration';
import { recordSecurityEvent } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { serializeUserPhoneValue } from '@/lib/user-access-profile';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { adminKey?: string; admin_key?: string; email?: string; otp?: string; requestId?: string };
  const requestId = String(body.requestId ?? '').trim();
  const otp = String(body.otp ?? '').trim();
  const emailInput = String(body.email ?? '').trim().toLowerCase();
  const adminKeyInput = String(body.adminKey ?? body.admin_key ?? '').trim();

  if (!requestId || !otp) {
    return NextResponse.json({ error: 'Request ID and OTP are required.' }, { status: 400 });
  }

  const adminKeyValidation = resolveAdminActionKeyValidation({
    body: { adminKey: adminKeyInput },
    messages: {
      invalid: 'Invalid admin key.',
      notConfigured: 'Admin action key is not configured.',
      required: 'Admin key is required.',
    },
    request,
  });

  if (adminKeyValidation.error === 'Admin action key is not configured.') {
    return NextResponse.json({ error: adminKeyValidation.error }, { status: 500 });
  }
  if (adminKeyValidation.error === 'Admin key is required.') {
    return NextResponse.json({ error: adminKeyValidation.error }, { status: 400 });
  }
  if (adminKeyValidation.error === 'Invalid admin key.') {
    return NextResponse.json({ error: adminKeyValidation.error }, { status: 403 });
  }

  const client = createServiceRoleClient();
  const service = client.schema('icecream_erp');
  let pendingRegistration: Awaited<ReturnType<typeof getPendingRegistrationById>> = null;
  let fallbackTokenData: ReturnType<typeof verifyRegistrationRequestToken> | null = null;

  if (requestId.includes('.')) {
    try {
      fallbackTokenData = verifyRegistrationRequestToken(requestId);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 400 });
    }
  } else {
    try {
      pendingRegistration = await getPendingRegistrationById(service, requestId);
    } catch (error) {
      if (!isMissingPendingRegistrationStorage(error)) {
        throw error;
      }

      return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 400 });
    }
  }

  if (pendingRegistration && pendingRegistration.usedAt) {
    return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 400 });
  }

  const expiresAt = pendingRegistration?.expiresAt ?? fallbackTokenData?.expiresAt ?? null;
  const pendingEmail = pendingRegistration?.email ?? fallbackTokenData?.email ?? '';
  const pendingOtpHash = pendingRegistration?.otpHash ?? fallbackTokenData?.otpHash ?? '';
  const pendingPayload = pendingRegistration?.payloadEncrypted ?? fallbackTokenData?.payloadEncrypted ?? '';
  const pendingRoleId = pendingRegistration?.roleId ?? fallbackTokenData?.roleId ?? '';

  if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 400 });
  }

  const expectedHash = hashOtpCode(pendingEmail, otp);
  if (expectedHash !== pendingOtpHash) {
    return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 400 });
  }

  const payload = decryptRegistrationPayload(pendingPayload);
  if (emailInput && emailInput !== String(payload.email ?? '').trim().toLowerCase()) {
    return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 400 });
  }

  const role = await resolveRegistrationRole(service, String(pendingRoleId || payload.role));
  if (!role) {
    return NextResponse.json({ error: 'Selected role is no longer available.' }, { status: 400 });
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const normalizedBranchId = payload.branchId ? String(payload.branchId) : null;
  const existingAccount = await findExistingRegistrationAccount(service, {
    email: normalizedEmail,
    idNumber: payload.idNumber,
  });

  if (existingAccount.emailRegistered) {
    return NextResponse.json({ error: 'Email is already registered.' }, { status: 409 });
  }
  if (existingAccount.idNumberRegistered) {
    return NextResponse.json({ error: 'An account with this ID number already exists.' }, { status: 409 });
  }

  if (role.requiresBranch && !normalizedBranchId) {
    return NextResponse.json({ error: 'Branch selection is required for this role.' }, { status: 400 });
  }

  if (normalizedBranchId) {
    const { data: branch } = await service
      .from('branches')
      .select('id, status')
      .eq('id', normalizedBranchId)
      .maybeSingle();
    if (!branch || String(branch.status ?? '').toUpperCase() !== 'ACTIVE') {
      return NextResponse.json({ error: 'Selected branch is not available.' }, { status: 400 });
    }
  }

  const [workId, organizationId] = await Promise.all([
    generateNextWorkId(service),
    getPrimaryOrganizationId(service),
  ]);

  const authEmail = workIdToEmail(workId);
  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email: authEmail,
    password: payload.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Account creation failed. Please try again.' }, { status: 500 });
  }

  const fullName = `${payload.firstName} ${payload.lastName}`.trim();
  const { data: profile, error: profileError } = await service
    .from('users')
    .insert({
      auth_id: authData.user.id,
      email: normalizedEmail,
      first_name: payload.firstName,
      full_name: fullName,
      id_number: payload.idNumber,
      last_name: payload.lastName,
      phone: serializeUserPhoneValue({ accessProfile: role.legacyRole }),
      branch_id: normalizedBranchId,
      organization_id: organizationId,
      role: toStoredUserRole(role.legacyRole),
      status: 'active',
      work_id: workId,
    })
    .select('id')
    .single();

  if (profileError || !profile) {
    await client.auth.admin.deleteUser(authData.user.id).catch(() => null);
    return NextResponse.json({ error: 'Account creation failed. Please try again.' }, { status: 500 });
  }

  try {
    const { error: userAccountError } = await service.from('user_accounts').insert({
      id: String(profile.id),
      email: normalizedEmail,
      first_name: payload.firstName,
      id_number: payload.idNumber,
      is_active: true,
      last_name: payload.lastName,
      organization_id: organizationId,
      password_hash: 'SUPABASE_AUTH_MANAGED',
      role_id: role.id,
      updated_at: new Date().toISOString(),
      user_profile_id: String(profile.id),
      work_id: workId,
    });

    if (userAccountError) {
      throw userAccountError;
    }

    await service
      .from('users')
      .update({ user_account_id: String(profile.id) })
      .eq('id', String(profile.id));

    await assignUserRole({
      assignedBy: null,
      roleId: role.id,
      service,
      userProfileId: String(profile.id),
    });
    await syncUserBranchAssignment({
      assignedBy: null,
      branchId: normalizedBranchId,
      roleName: role.name,
      service,
      userProfileId: String(profile.id),
    });
  } catch {
    await service.from('user_accounts').delete().eq('id', String(profile.id)).catch(() => null);
    await service.from('users').delete().eq('id', String(profile.id)).catch(() => null);
    await client.auth.admin.deleteUser(authData.user.id).catch(() => null);
    return NextResponse.json({ error: 'Account creation failed. Please try again.' }, { status: 500 });
  }

  try {
    await sendTransactionalEmail({
      html: `
        <p>Hello ${payload.firstName},</p>
        <p>Your account has been created successfully.</p>
        <p><strong>Work ID:</strong> ${workId}</p>
        <p><strong>Role:</strong> ${role.name}</p>
        <p>Use your Work ID and chosen password to sign in.</p>
      `,
      subject: 'Your Absolute Ice Cream ERP work ID',
      text: `Hello ${payload.firstName}, your account is ready. Work ID: ${workId}. Role: ${role.name}. Use your Work ID and password to sign in.`,
      to: normalizedEmail,
    });
  } catch {}

  if (pendingRegistration?.id) {
    await deletePendingRegistration(service, pendingRegistration.id).catch(() => null);
  }

  await recordSecurityEvent({
    eventType: 'REGISTRATION_COMPLETED',
    organizationId,
    userProfileId: String(profile.id),
    status: 'SUCCESS',
    details: { selectedRole: role.id },
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  try {
    await service.from('audit_logs').insert({
      action: 'ACCOUNT_REGISTERED',
      entity_id: String(profile.id),
      entity_type: 'user',
      user_profile_id: String(profile.id),
    });
  } catch {}

  return NextResponse.json({
    message: 'Account created successfully.',
    redirectTo: '/auth/login',
    work_id: workId,
  }, { status: 201 });
}
