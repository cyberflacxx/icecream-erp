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
} from '@/lib/registration';
import { recordSecurityEvent } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function decodeRegistrationState(fileUrl: string) {
  if (!fileUrl.startsWith('json://')) {
    throw new Error('Registration request data is invalid.');
  }

  return JSON.parse(decodeURIComponent(fileUrl.replace('json://', ''))) as {
    email: string;
    otp_attempts: number;
    otp_expires_at: string;
    otp_hash: string;
    payload_encrypted: string;
    role_id: string;
    verified_at: string | null;
  };
}

function encodeRegistrationState(payload: Record<string, unknown>) {
  return `json://${encodeURIComponent(JSON.stringify(payload))}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { otp?: string; requestId?: string };
  const requestId = String(body.requestId ?? '').trim();
  const otp = String(body.otp ?? '').trim();

  if (!requestId || !otp) {
    return NextResponse.json({ error: 'Request ID and OTP are required.' }, { status: 400 });
  }

  const service = createServiceRoleClient().schema('icecream_erp');
  const { data: pending, error: pendingError } = await service
    .from('system_settings')
    .select('id, setting_value')
    .eq('id', requestId)
    .maybeSingle();

  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }
  if (!pending) {
    return NextResponse.json({ error: 'Registration request was not found.' }, { status: 404 });
  }
  const pendingValue = (pending as { setting_value?: { state?: string } | null }).setting_value;
  const state = decodeRegistrationState(String(pendingValue?.state ?? ''));
  if (state.verified_at) {
    return NextResponse.json({ error: 'This OTP has already been used.' }, { status: 409 });
  }
  if (new Date(state.otp_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: `OTP expired. Request a new code and try again. Codes remain valid for ${otpExpiryLabel()}.` }, { status: 410 });
  }

  const expectedHash = hashOtpCode(requestId, otp);
  if (expectedHash !== state.otp_hash) {
    const attempts = Number(state.otp_attempts ?? 0) + 1;
    const retryState = encodeRegistrationState({ ...state, otp_attempts: attempts });
    await service.from('system_settings').update({
      setting_value: {
        requestId,
        state: retryState,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', requestId);
    return NextResponse.json({ error: attempts >= 5 ? 'Too many invalid OTP attempts. Request a new code.' : 'Invalid OTP code.' }, { status: attempts >= 5 ? 429 : 400 });
  }

  const payload = decryptRegistrationPayload(state.payload_encrypted);
  const role = await resolveRegistrationRole(service, String(state.role_id ?? payload.role));
  if (!role) {
    return NextResponse.json({ error: 'Selected role is no longer available.' }, { status: 400 });
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
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
      organization_id: organizationId,
      role: role.legacyRole,
      status: 'active',
      work_id: workId,
    })
    .select('id, organization_id')
    .single();

  if (profileError || !profile) {
    await createServiceRoleClient().auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError?.message ?? 'Failed to create user profile.' }, { status: 500 });
  }

  try {
    await assignUserRole({
      assignedBy: null,
      roleId: role.id,
      service,
      userProfileId: String(profile.id),
    });
  } catch (roleError) {
    await service.from('users').delete().eq('id', profile.id);
    await createServiceRoleClient().auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: roleError instanceof Error ? roleError.message : 'Failed to assign role.' }, { status: 500 });
  }

  await service
    .from('system_settings')
    .update({
      setting_value: {
        requestId,
        state: encodeRegistrationState({ ...state, verified_at: new Date().toISOString() }),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

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
    organizationId: profile.organization_id ? String(profile.organization_id) : null,
    userProfileId: String(profile.id),
    status: 'SUCCESS',
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({
    message: 'Account created successfully.',
    redirectTo: '/auth/login',
    work_id: workId,
  }, { status: 201 });
}
