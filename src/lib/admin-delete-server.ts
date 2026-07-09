import { NextResponse } from 'next/server';

type AuthContext = {
  organizationId: string;
  userId: string;
};

const ADMIN_DELETE_ENV_KEYS = ['SYSTEM_ADMIN_DELETE_KEY', 'ADMIN_DELETE_KEY', 'ADMIN_KEY'] as const;

type DeleteActionRequestBody = {
  adminKey?: string | null;
  admin_key?: string | null;
};

type AdminActionKeyMessages = {
  invalid?: string;
  notConfigured?: string;
  required?: string;
};

export type AdminActionKeyValidation = {
  configuredKey: string | null;
  error: string | null;
  suppliedKey: string;
};

function getConfiguredAdminDeleteKey() {
  for (const key of ADMIN_DELETE_ENV_KEYS) {
    const value = String(process.env[key] ?? '').trim();
    if (value) return value;
  }

  return null;
}

function extractAdminKey(request: Request, body?: DeleteActionRequestBody | null) {
  const bodyKey = String(body?.adminKey ?? body?.admin_key ?? '').trim();
  if (bodyKey) return bodyKey;

  const headerKey = request.headers.get('x-admin-delete-key') ?? request.headers.get('x-admin-key');
  return String(headerKey ?? '').trim();
}

export function resolveAdminActionKeyValidation(input: {
  body?: DeleteActionRequestBody | null;
  messages?: AdminActionKeyMessages;
  request: Request;
}): AdminActionKeyValidation {
  const configuredKey = getConfiguredAdminDeleteKey();
  const suppliedKey = extractAdminKey(input.request, input.body);
  const notConfiguredMessage = input.messages?.notConfigured ?? 'Admin action key is not configured.';
  const requiredMessage = input.messages?.required ?? 'Admin key is required.';
  const invalidMessage = input.messages?.invalid ?? 'Invalid admin key.';

  if (!configuredKey) {
    return { configuredKey: null, error: notConfiguredMessage, suppliedKey };
  }

  if (!suppliedKey) {
    return { configuredKey, error: requiredMessage, suppliedKey };
  }

  if (suppliedKey !== configuredKey) {
    return { configuredKey, error: invalidMessage, suppliedKey };
  }

  return { configuredKey, error: null, suppliedKey };
}

export async function requireAdminDeleteKey(input: {
  action: string;
  ctx: AuthContext;
  entityId: string;
  entityType: string;
  request: Request;
  body?: DeleteActionRequestBody | null;
  messages?: AdminActionKeyMessages;
}) {
  const validation = resolveAdminActionKeyValidation({
    body: input.body,
    messages: input.messages,
    request: input.request,
  });
  const notConfiguredMessage = input.messages?.notConfigured ?? 'Admin action key is not configured.';
  const requiredMessage = input.messages?.required ?? 'Admin key is required.';
  const invalidMessage = input.messages?.invalid ?? 'Invalid admin key.';

  if (!validation.configuredKey) {
    return NextResponse.json({ error: notConfiguredMessage }, { status: 500 });
  }

  if (!validation.suppliedKey) {
    return NextResponse.json({ error: requiredMessage }, { status: 400 });
  }

  if (validation.error === invalidMessage) {
    const { recordSecurityEvent } = await import('./security-server');
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

    return NextResponse.json({ error: invalidMessage }, { status: 403 });
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
  const { recordAuditLog } = await import('./security-server');
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
