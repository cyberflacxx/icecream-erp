import { NextResponse } from 'next/server';

import type { AuthContext } from '@/lib/api-auth';
import { recordAuditLog, recordSecurityEvent } from '@/lib/security-server';

const ADMIN_DELETE_ENV_KEYS = ['SYSTEM_ADMIN_DELETE_KEY', 'ADMIN_DELETE_KEY', 'ADMIN_KEY'] as const;

type DeleteActionRequestBody = {
  adminKey?: string | null;
};

function getConfiguredAdminDeleteKey() {
  for (const key of ADMIN_DELETE_ENV_KEYS) {
    const value = String(process.env[key] ?? '').trim();
    if (value) return value;
  }

  return null;
}

function extractAdminKey(request: Request, body?: DeleteActionRequestBody | null) {
  const bodyKey = String(body?.adminKey ?? '').trim();
  if (bodyKey) return bodyKey;

  const headerKey = request.headers.get('x-admin-delete-key') ?? request.headers.get('x-admin-key');
  return String(headerKey ?? '').trim();
}

export async function requireAdminDeleteKey(input: {
  action: string;
  ctx: AuthContext;
  entityId: string;
  entityType: string;
  request: Request;
  body?: DeleteActionRequestBody | null;
}) {
  const configuredKey = getConfiguredAdminDeleteKey();
  if (!configuredKey) {
    return NextResponse.json(
      { error: 'Admin delete key is not configured on the server.' },
      { status: 500 },
    );
  }

  const suppliedKey = extractAdminKey(input.request, input.body);
  if (!suppliedKey) {
    return NextResponse.json(
      { error: 'Admin key is required to delete this record.' },
      { status: 400 },
    );
  }

  if (suppliedKey !== configuredKey) {
    await recordSecurityEvent({
      organizationId: input.ctx.organizationId,
      userProfileId: input.ctx.userId,
      eventType: 'ADMIN_DELETE_KEY_FAILED',
      status: 'FAILED',
      details: {
        action: input.action,
        entityId: input.entityId,
        entityType: input.entityType,
      },
      ipAddress: input.request.headers.get('x-forwarded-for'),
      userAgent: input.request.headers.get('user-agent'),
    });

    return NextResponse.json(
      { error: 'The admin key provided is incorrect.' },
      { status: 403 },
    );
  }

  return null;
}

export async function recordProtectedActionAudit(input: {
  action: string;
  ctx: AuthContext;
  entityId: string;
  entityType: string;
  newValues?: Record<string, unknown> | null;
  oldValues?: Record<string, unknown> | null;
  request: Request;
}) {
  await recordAuditLog({
    action: input.action,
    entityId: input.entityId,
    entityType: input.entityType,
    newValues: input.newValues ?? null,
    oldValues: input.oldValues ?? null,
    organizationId: input.ctx.organizationId,
    userProfileId: input.ctx.userId,
    ipAddress: input.request.headers.get('x-forwarded-for'),
    userAgent: input.request.headers.get('user-agent'),
  });
}

export { ADMIN_DELETE_ENV_KEYS };
