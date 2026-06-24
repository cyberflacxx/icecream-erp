import { NextRequest, NextResponse } from 'next/server';

import { workIdToEmail } from '@/lib/auth-roles';
import { sendTransactionalEmail } from '@/lib/email';
import {
  assignUserRole,
  decryptRegistrationPayload,
  generateNextWorkId,
  getPrimaryOrganizationId,
  hashOtpCode,
  otpExpiryLabel,
  resolveRegistrationRole,
  syncUserBranchAssignment,
  toStoredUserRole,
  verifyRegistrationRequestToken,
} from '@/lib/registration';
import { recordSecurityEvent } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { serializeUserPhoneValue } from '@/lib/user-access-profile';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { otp?: string; requestId?: string };
  const requestId = String(body.requestId ?? '').trim();
  const otp = String(body.otp ?? '').trim();

  if (!requestId || !otp) {
    return NextResponse.json({ error: 'Request ID and OTP are required.' }, { status: 400 });
  }

  let registrationRequest: ReturnType<typeof verifyRegistrationRequestToken>;
  try {
    registrationRequest = verifyRegistrationRequestToken(requestId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Registration token is invalid.' }, { status: 400 });
  }

  if (new Date(registrationRequest.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: `OTP expired. Request a new code and try again. Codes remain valid for ${otpExpiryLabel()}.` }, { status: 410 });
  }

  const service = createServiceRoleClient().schema('icecream_erp');
  const expectedHash = hashOtpCode(registrationRequest.requestId, otp);
  if (expectedHash !== registrationRequest.otpHash) {
    return NextResponse.json({ error: 'Invalid OTP code.' }, { status: 400 });
  }

  const payload = decryptRegistrationPayload(registrationRequest.payloadEncrypted);
  const role = await resolveRegistrationRole(service, String(registrationRequest.roleId ?? payload.role));
  if (!role) {
    return NextResponse.json({ error: 'Selected role is no longer available.' }, { status: 400 });
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const normalizedBranchId = payload.branchId ? String(payload.branchId) : null;
  const [{ data: emailUser }, { data: idUser }] = await Promise.all([
    service.from('users').select('id').ilike('email', normalizedEmail).maybeSingle(),
    service.from('users').select('id').eq('id_number', payload.idNumber).maybeSingle(),
  ]);

  if (emailUser) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }
  if (idUser) {
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
  const { data: authData, error: authError } = await createServiceRoleClient().auth.admin.createUser({
    email: authEmail,
    password: payload.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Failed to create authentication account.' }, { status: 500 });
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
      role: toStoredUserRole(role.legacyRole),
      status: 'active',
      work_id: workId,
    })
    .select('id')
    .single();

  if (profileError || !profile) {
    await createServiceRoleClient().auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError?.message ?? 'Failed to create user profile.' }, { status: 500 });
  }

  let roleAssignmentWarning: string | null = null;
  try {
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
  } catch (roleError) {
    roleAssignmentWarning = roleError instanceof Error ? roleError.message : 'Failed to assign role.';
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

  await recordSecurityEvent({
    eventType: 'REGISTRATION_COMPLETED',
    organizationId,
    userProfileId: String(profile.id),
    status: roleAssignmentWarning ? 'WARNING' : 'SUCCESS',
    details: roleAssignmentWarning ? { roleAssignmentWarning, selectedRole: role.id } : { selectedRole: role.id },
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({
    message: 'Account created successfully.',
    redirectTo: '/auth/login',
    warning: roleAssignmentWarning,
    work_id: workId,
  }, { status: 201 });
}
