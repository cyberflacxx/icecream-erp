import { createServiceRoleClient } from '@/lib/supabase/server';

import type { AuthContext } from '@/lib/api-auth';
import type { AbsoluteAiAuditRow } from './types';

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z\-_]{16,}/g,
  /\b(?:sb|service_role|anon)_[A-Za-z0-9_-]+\b/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /eyJ[A-Za-z0-9._-]+/g,
];

function sanitizeString(value: string) {
  return SECRET_PATTERNS.reduce(
    (next, pattern) => next.replace(pattern, '[redacted]'),
    value,
  ).slice(0, 2_000);
}

export function sanitizeAbsoluteAiAuditValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeAbsoluteAiAuditValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/key|secret|token|password|authorization/i.test(key))
        .slice(0, 30)
        .map(([key, entry]) => [key, sanitizeAbsoluteAiAuditValue(entry)]),
    );
  }

  return value;
}

export async function writeAbsoluteAiAuditLog(
  auth: AuthContext,
  row: AbsoluteAiAuditRow,
) {
  try {
    const service = createServiceRoleClient().schema('icecream_erp');
    await service.from('ai_audit_logs').insert({
      conversation_id: row.conversationId ?? null,
      model: row.model ?? null,
      organization_id: auth.organizationId,
      provider: row.provider ?? 'gemini',
      request_id: row.requestId,
      response_summary: row.responseSummary ? sanitizeString(row.responseSummary) : null,
      sanitized_tool_arguments: row.sanitizedToolArguments
        ? sanitizeAbsoluteAiAuditValue(row.sanitizedToolArguments)
        : null,
      session_id: row.sessionId ?? null,
      tool_name: row.toolName ?? null,
      tool_result_status: row.toolResultStatus,
      usage_metadata: row.usageMetadata ? sanitizeAbsoluteAiAuditValue(row.usageMetadata) : null,
      user_account_id: auth.userAccountId,
      user_profile_id: auth.userId,
      user_prompt: sanitizeString(row.userPrompt),
    });
  } catch (error) {
    console.error('Absolute AI audit logging failed', {
      message: error instanceof Error ? error.message : 'Unknown audit logging error.',
      requestId: row.requestId,
    });
  }
}
