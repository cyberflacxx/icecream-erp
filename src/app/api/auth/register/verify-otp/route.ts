import { NextRequest, NextResponse } from 'next/server';

import { workIdToEmail } from '@/lib/auth-roles';
import { resolveAdminActionKeyValidation } from '@/lib/admin-delete-server';
import { sendTransactionalEmail } from '@/lib/email';
import {
  assignUserRole,
  buildRegistrationUserAccountRecord,
  deletePendingRegistration,
  decryptRegistrationPayload,
  findExistingRegistrationAccount,
  generateAvailableWorkId,
  getRegistrationClientErrorMessage,
  getSafeRegistrationErrorDetails,
  getPendingRegistrationById,
  getPrimaryOrganizationId,
  hashOtpCode,
  isMissingPendingRegistrationStorage,
  REGISTRATION_ACCOUNT_FAILURE_MESSAGE,
  REGISTRATION_BRANCH_UNAVAILABLE_MESSAGE,
  REGISTRATION_ROLE_UNAVAILABLE_MESSAGE,
  resolveRegistrationRole,
  syncUserBranchAssignment,
  toStoredUserRole,
  verifyRegistrationRequestToken,
} from '@/lib/registration';
import { recordSecurityEvent } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { serializeUserPhoneValue } from '@/lib/user-access-profile';

function logRegistrationStep(step: string, details?: Record<string, unknown>) {
  console.info('Registration verify step.', {
    step,
    ...details,
  });
}

function logRegistrationFailure(step: string, table: string | null, error: unknown) {
  console.error('Registration verify failed.', getSafeRegistrationErrorDetails(error, { step, table }));
}

function throwRegistrationFailure(step: string, table: string | null, error: unknown): never {
  logRegistrationFailure(step, table, error);
  throw error;
}

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
    return NextResponse.json({ error: REGISTRATION_ROLE_UNAVAILABLE_MESSAGE }, { status: 400 });
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const normalizedBranchId = payload.branchId ? String(payload.branchId) : null;
  logRegistrationStep('otp_validation_passed', {
    branchRequired: role.requiresBranch,
    hasBranchId: Boolean(normalizedBranchId),
    normalizedEmail,
    roleId: role.id,
  });

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
      return NextResponse.json({ error: REGISTRATION_BRANCH_UNAVAILABLE_MESSAGE }, { status: 400 });
    }
  }

  logRegistrationStep('prevalidating_registration_dependencies', {
    normalizedEmail,
    roleId: role.id,
  });

  const [workId, organizationId] = await Promise.all([
    generateAvailableWorkId(service),
    getPrimaryOrganizationId(service),
  ]);

  if (!organizationId) {
    logRegistrationFailure('prevalidate_organization', 'organizations', {
      code: 'ORG_NOT_FOUND',
      details: 'No organization row is available for registration.',
      message: 'Organization lookup returned no primary organization.',
    });
    return NextResponse.json({ error: REGISTRATION_ACCOUNT_FAILURE_MESSAGE }, { status: 500 });
  }

  const authEmail = workIdToEmail(workId);
  let authUserId: string | null = null;
  let profileId: string | null = null;

  logRegistrationStep('creating_auth_user', {
    authEmail,
    normalizedEmail,
    workId,
  });
  try {
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: authEmail,
      password: payload.password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      logRegistrationFailure('create_auth_user', 'auth.users', authError ?? new Error('Auth user creation returned no user.'));
      return NextResponse.json({ error: REGISTRATION_ACCOUNT_FAILURE_MESSAGE }, { status: 500 });
    }

    authUserId = authData.user.id;
  } catch (error) {
    logRegistrationFailure('create_auth_user', 'auth.users', error);
    return NextResponse.json({ error: REGISTRATION_ACCOUNT_FAILURE_MESSAGE }, { status: 500 });
  }

  const fullName = `${payload.firstName} ${payload.lastName}`.trim();
  try {
    logRegistrationStep('creating_user_profile', {
      normalizedEmail,
      workId,
    });
    const { data: profile, error: profileError } = await service
      .from('users')
      .insert({
        auth_id: authUserId,
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
      throwRegistrationFailure('create_user_profile', 'users', profileError ?? new Error('User profile insert returned no row.'));
    }

    profileId = String(profile.id);

    logRegistrationStep('creating_user_account', {
      profileId,
      roleId: role.id,
      workId,
    });
    const { error: userAccountError } = await service
      .from('user_accounts')
      .insert(buildRegistrationUserAccountRecord({
        email: normalizedEmail,
        firstName: payload.firstName,
        idNumber: payload.idNumber,
        lastName: payload.lastName,
        organizationId,
        roleId: role.id,
        userProfileId: profileId,
        workId,
      }));

    if (userAccountError) {
      throwRegistrationFailure('create_user_account', 'user_accounts', userAccountError);
    }

    logRegistrationStep('linking_user_account_to_profile', {
      profileId,
    });
    const { error: linkProfileError } = await service
      .from('users')
      .update({ user_account_id: profileId })
      .eq('id', profileId);

    if (linkProfileError) {
      throwRegistrationFailure('link_user_account_to_profile', 'users', linkProfileError);
    }

    logRegistrationStep('assigning_role', {
      profileId,
      roleId: role.id,
    });
    try {
      await assignUserRole({
        assignedBy: null,
        roleId: role.id,
        service,
        userProfileId: profileId,
      });
    } catch (error) {
      throwRegistrationFailure('assign_role', 'user_roles', error);
    }

    logRegistrationStep('assigning_branch', {
      hasBranchId: Boolean(normalizedBranchId),
      profileId,
    });
    try {
      await syncUserBranchAssignment({
        assignedBy: null,
        branchId: normalizedBranchId,
        roleName: role.name,
        service,
        userProfileId: profileId,
      });
    } catch (error) {
      throwRegistrationFailure('assign_branch', 'user_branch_assignments', error);
    }
  } catch (error) {
    const safeMessage = getRegistrationClientErrorMessage(error);

    if (profileId) {
      const userAccountRollback = await service.from('user_accounts').delete().eq('id', profileId);
      if (userAccountRollback.error) {
        logRegistrationFailure('rollback_user_account', 'user_accounts', userAccountRollback.error);
      }

      const userProfileRollback = await service.from('users').delete().eq('id', profileId);
      if (userProfileRollback.error) {
        logRegistrationFailure('rollback_user_profile', 'users', userProfileRollback.error);
      }
    }

    if (authUserId) {
      await client.auth.admin.deleteUser(authUserId).catch((rollbackError) => {
        logRegistrationFailure('rollback_auth_user', 'auth.users', rollbackError);
        return null;
      });
    }

    return NextResponse.json({
      error: safeMessage,
    }, {
      status:
        safeMessage === 'Email is already registered.' ||
        safeMessage === 'An account with this ID number already exists.' ||
        safeMessage === 'Work ID is already registered.'
          ? 409
          : safeMessage === REGISTRATION_ROLE_UNAVAILABLE_MESSAGE || safeMessage === REGISTRATION_BRANCH_UNAVAILABLE_MESSAGE
            ? 400
            : 500,
    });
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
    logRegistrationStep('cleanup_pending_otp', {
      pendingRegistrationId: pendingRegistration.id,
    });
    await deletePendingRegistration(service, pendingRegistration.id).catch((error) => {
      logRegistrationFailure('cleanup_pending_otp', 'registration_otps', error);
      return null;
    });
  }

  await recordSecurityEvent({
    eventType: 'REGISTRATION_COMPLETED',
    organizationId,
    userProfileId: profileId,
    status: 'SUCCESS',
    details: { selectedRole: role.id },
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  try {
    await service.from('audit_logs').insert({
      action: 'ACCOUNT_REGISTERED',
      entity_id: profileId,
      entity_type: 'user',
      user_profile_id: profileId,
    });
  } catch {}

  return NextResponse.json({
    message: 'Account created successfully.',
    redirectTo: '/auth/login',
    work_id: workId,
  }, { status: 201 });
}
