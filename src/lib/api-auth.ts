import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { hasPermissionAccess } from '@/lib/permission-access';
import {
  buildSecurityContextProfile,
  canAccessBranch,
  ensureActiveSession,
  findSecurityUserProfileByAuthId,
  recordSecurityEvent,
  touchSessionActivity,
} from '@/lib/security-server';

export interface AuthContext {
  userAccountId: string | null;
  userId: string;
  workId: string;
  role: string;
  permissions: string[];
  branchId: string | null;
  branchAssignments: string[];
  warehouseAssignments: string[];
  isBranchScoped: boolean;
  organizationId: string;
  sessionTimeoutMinutes: number;
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
    isSystemRole: boolean;
  }>;
}

export async function getAuthContext(request?: Request | NextRequest): Promise<AuthContext | null> {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    {
      data: { session },
    },
  ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

  if (!user) return null;

  const profile = await findSecurityUserProfileByAuthId(user.id);
  if (!profile) return null;

  const resolved = await buildSecurityContextProfile(profile);
  const sessionCheck = await ensureActiveSession(resolved, session?.access_token);

  if (!sessionCheck.active) {
    await recordSecurityEvent({
      organizationId: resolved.organizationId,
      userProfileId: resolved.id,
      eventType: 'SESSION_TIMEOUT',
      status: 'EXPIRED',
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
    });
    await supabase.auth.signOut();
    return null;
  }

  if (session?.access_token) {
    await touchSessionActivity({
      userAccountId: resolved.userAccountId,
      userProfileId: resolved.id,
      accessToken: session.access_token,
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
      timeoutMinutes: resolved.sessionTimeoutMinutes,
    });
  }

  const branchScoped = !resolved.permissions.includes('view_all_branches') && resolved.branchAssignments.length > 0;

  return {
    userAccountId: resolved.userAccountId,
    userId: resolved.id,
    workId: resolved.workId,
    role: resolved.role,
    permissions: resolved.permissions,
    branchId: resolved.branchId,
    branchAssignments: resolved.branchAssignments,
    warehouseAssignments: resolved.warehouseAssignments,
    isBranchScoped: branchScoped,
    organizationId: resolved.organizationId,
    sessionTimeoutMinutes: resolved.sessionTimeoutMinutes,
    roles: resolved.roles,
  };
}

export function can(ctx: AuthContext, ...perms: string[]): boolean {
  if (hasPermissionAccess(ctx.permissions, 'manage_roles', 'settings.manage')) {
    return true;
  }

  return hasPermissionAccess(ctx.permissions, ...perms);
}

export function canAccessBranchScope(ctx: AuthContext, branchId: string) {
  return canAccessBranch(
    {
      branchId: ctx.branchId,
      branchAssignments: ctx.branchAssignments,
      permissions: ctx.permissions,
    },
    branchId,
  );
}

type ApiServerErrorInput = {
  branchId?: string | null;
  code?: string | null;
  ctx?: AuthContext | null;
  error: unknown;
  message: string;
  module: string;
  page?: string | null;
  path?: string | null;
  severity?: 'CRITICAL' | 'HIGH' | 'LOW' | 'MEDIUM';
  status?: number;
  transactionReference?: string | null;
};

function apiErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

function apiErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return code == null ? null : String(code);
  }
  return null;
}

function sanitizeErrorValue(value: string | null) {
  if (!value) return value;
  return value
    .replace(/eyJ[A-Za-z0-9._-]+/g, '[redacted-jwt]')
    .replace(/\b(?:sb|service_role|anon)_[A-Za-z0-9_-]+\b/g, '[redacted-key]')
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgres://[redacted]@');
}

function buildApiErrorId() {
  return `ERR-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeApiErrorCode(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  return normalized || fallback;
}

function buildApiErrorResponse(input: {
  code: string;
  message: string;
  requestId?: string;
  status: number;
}) {
  const requestId = input.requestId ?? buildApiErrorId();
  const code = normalizeApiErrorCode(input.code, 'API_ERROR');

  return NextResponse.json({
    success: false,
    error: {
      code,
      message: input.message,
      requestId,
    },
    code,
    message: input.message,
    requestId,
    errorMessage: input.message,
    errorId: requestId,
  }, { status: input.status });
}

export function unauthorized(message = 'Unauthorized') {
  return buildApiErrorResponse({ code: 'UNAUTHORIZED', message, status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return buildApiErrorResponse({ code: 'FORBIDDEN', message, status: 403 });
}

export function notFound(message = 'Not found') {
  return buildApiErrorResponse({ code: 'NOT_FOUND', message, status: 404 });
}

export function badRequest(message: string, code = 'BAD_REQUEST') {
  return buildApiErrorResponse({ code, message, status: 400 });
}

export function serverError(message: string, code = 'INTERNAL_SERVER_ERROR') {
  return buildApiErrorResponse({ code, message, status: 500 });
}

export async function apiServerError(input: ApiServerErrorInput) {
  const requestId = buildApiErrorId();
  const details = {
    branchId: input.branchId ?? input.ctx?.branchId ?? null,
    databaseCode: apiErrorCode(input.error),
    errorId: requestId,
    errorMessage: sanitizeErrorValue(apiErrorMessage(input.error)),
    module: input.module,
    organizationId: input.ctx?.organizationId ?? null,
    page: input.page ?? null,
    path: input.path ?? null,
    stack: sanitizeErrorValue(input.error instanceof Error ? input.error.stack ?? null : null),
    timestamp: new Date().toISOString(),
    transactionReference: input.transactionReference ?? null,
    userId: input.ctx?.userId ?? null,
  };

  try {
    await createServiceRoleClient()
      .schema('icecream_erp')
      .from('error_logs')
      .insert({
        details,
        error_type: apiErrorCode(input.error) ?? (input.error instanceof Error ? input.error.name : 'API_ERROR'),
        message_summary: `${input.message} (${requestId})`,
        module_name: input.module,
        organization_id: input.ctx?.organizationId ?? null,
        severity: input.severity ?? 'MEDIUM',
      });
  } catch (loggingError) {
    console.error('Failed to persist API error log', {
      errorId: requestId,
      loggingError: apiErrorMessage(loggingError),
      module: input.module,
    });
  }

  return buildApiErrorResponse({
    code: input.code ?? apiErrorCode(input.error) ?? 'INTERNAL_SERVER_ERROR',
    message: input.message,
    requestId,
    status: input.status ?? 500,
  });
}
