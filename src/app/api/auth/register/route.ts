import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { resolveAdminActionKeyValidation } from '@/lib/admin-delete-server';
import { sendTransactionalEmail } from '@/lib/email';
import {
  createRegistrationRequestToken,
  encryptRegistrationPayload,
  generateOtpCode,
  getPrimaryOrganizationId,
  hashOtpCode,
  maskEmailAddress,
  otpExpiryLabel,
  registrationOtpExpiresAt,
  resolveRegistrationRole,
  validateRegistrationPayload,
} from '@/lib/registration';
import { recordSecurityEvent } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    adminKey?: string;
    admin_key?: string;
    branch_id?: string | null;
    confirm_password?: string;
    email?: string;
    first_name?: string;
    id_number?: string;
    last_name?: string;
    password?: string;
    role?: string;
  };

  const adminKeyInput = String(body.adminKey ?? body.admin_key ?? '').trim();
  const { fieldErrors, normalized } = validateRegistrationPayload({
    adminKey: adminKeyInput,
    branchId: body.branch_id,
    confirmPassword: body.confirm_password,
    email: body.email,
    firstName: body.first_name,
    idNumber: body.id_number,
    lastName: body.last_name,
    password: body.password,
    role: body.role,
  });

  const adminKeyValidation = resolveAdminActionKeyValidation({
    body: { adminKey: adminKeyInput },
    messages: {
      invalid: 'Invalid admin key.',
      notConfigured: 'Admin action key is not configured.',
      required: 'Admin key is required.',
    },
    request,
  });

  if (adminKeyValidation.error === 'Admin key is required.') {
    fieldErrors.admin_key = adminKeyValidation.error;
  }
  if (adminKeyValidation.error === 'Invalid admin key.') {
    fieldErrors.admin_key = adminKeyValidation.error;
  }
  if (adminKeyValidation.error === 'Admin action key is not configured.') {
    return NextResponse.json({ error: adminKeyValidation.error, fieldErrors: { admin_key: adminKeyValidation.error } }, { status: 500 });
  }
  if (adminKeyValidation.error === 'Invalid admin key.') {
    return NextResponse.json({ error: adminKeyValidation.error, fieldErrors: { admin_key: adminKeyValidation.error } }, { status: 403 });
  }
  if (adminKeyValidation.error === 'Admin key is required.') {
    return NextResponse.json({ error: adminKeyValidation.error, fieldErrors: { admin_key: adminKeyValidation.error } }, { status: 400 });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'Validation failed.', fieldErrors }, { status: 400 });
  }

  const service = createServiceRoleClient().schema('icecream_erp');
  const role = await resolveRegistrationRole(service, normalized.role);
  if (!role) {
    return NextResponse.json({ error: 'Selected role is not available.', fieldErrors: { role: 'Selected role is not available.' } }, { status: 400 });
  }

  const normalizedBranchId = normalized.branchId || null;
  if (role.requiresBranch && !normalizedBranchId) {
    return NextResponse.json({ error: 'Branch selection is required for this role.', fieldErrors: { branch_id: 'Please select a branch.' } }, { status: 400 });
  }

  if (normalizedBranchId) {
    const { data: branch } = await service
      .from('branches')
      .select('id, status')
      .eq('id', normalizedBranchId)
      .maybeSingle();
    if (!branch || String(branch.status ?? '').toUpperCase() !== 'ACTIVE') {
      return NextResponse.json({ error: 'Selected branch is not available.', fieldErrors: { branch_id: 'Selected branch is not available.' } }, { status: 400 });
    }
  }

  const [{ data: existingUser }, { data: existingIdUser }, organizationId] = await Promise.all([
    service.from('users').select('id').ilike('email', normalized.email).maybeSingle(),
    service.from('users').select('id').eq('id_number', normalized.idNumber).maybeSingle(),
    getPrimaryOrganizationId(service),
  ]);

  if (existingUser) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }
  if (existingIdUser) {
    return NextResponse.json({ error: 'An account with this ID number already exists.' }, { status: 409 });
  }

  const otp = generateOtpCode();
  const expiresAt = registrationOtpExpiresAt();
  const requestId = randomUUID();
  const payload = encryptRegistrationPayload({
    branchId: normalizedBranchId,
    email: normalized.email,
    firstName: normalized.firstName,
    idNumber: normalized.idNumber,
    lastName: normalized.lastName,
    password: normalized.password,
    role: role.id,
  });
  const otpHash = hashOtpCode(requestId, otp);
  const requestToken = createRegistrationRequestToken({
    email: normalized.email,
    expiresAt,
    otpHash,
    payloadEncrypted: payload,
    requestId,
    roleId: role.id,
  });

  try {
    await sendTransactionalEmail({
      html: `
        <p>Hello ${normalized.firstName},</p>
        <p>Your OTP for Absolute Ice Cream ERP registration is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
        <p>This code expires in ${otpExpiryLabel()}.</p>
        <p>Requested role: <strong>${role.name}</strong></p>
      `,
      subject: 'Your Absolute Ice Cream ERP OTP',
      text: `Your OTP for Absolute Ice Cream ERP registration is ${otp}. It expires in ${otpExpiryLabel()}.`,
      to: normalized.email,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send OTP email.' }, { status: 500 });
  }

  await recordSecurityEvent({
    eventType: 'REGISTRATION_OTP_SENT',
    organizationId,
    status: 'SUCCESS',
    details: {
      email: normalized.email,
      requestId,
      role: role.name,
    },
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({
    email: maskEmailAddress(normalized.email),
    expiresIn: otpExpiryLabel(),
    message: 'OTP sent successfully.',
    requestId: requestToken,
  });
}
