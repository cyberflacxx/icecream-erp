import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingColumnError, isMissingTableError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { recordAuditLog, recordSecurityEvent } from '@/lib/security-server';

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => JSON.stringify(row[header] ?? '')).join(','));
  }
  return lines.join('\n');
}

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'export', 'view_audit_logs', 'settings.manage')) return forbidden();

  try {
    const service = createServiceRoleClient().schema('icecream_erp');
    const primary = await service
      .from('audit_logs')
      .select('created_at, action, entity_type, entity_id, user_profile_id, ip_address, organization_id')
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })
      .limit(1000);
    let data = (primary.data ?? null) as Record<string, unknown>[] | null;
    let error = primary.error;

    if (error && isMissingColumnError(error, 'audit_logs', 'organization_id')) {
      const fallback = await service
        .from('audit_logs')
        .select('created_at, action, entity_type, entity_id, user_profile_id, ip_address')
        .order('created_at', { ascending: false })
        .limit(1000);
      data = (fallback.data ?? null) as Record<string, unknown>[] | null;
      error = fallback.error;
    }

    if (error) {
      if (isMissingTableError(error, 'audit_logs')) {
        return new NextResponse('', {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename=\"audit-logs.csv\"',
          },
        });
      }
      throw error;
    }

    await Promise.all([
      recordAuditLog({
        organizationId: ctx.organizationId,
        userProfileId: ctx.userId,
        action: 'AUDIT_LOGS_EXPORTED',
        entityType: 'audit_log',
        entityId: 'export',
        ipAddress: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      }),
      recordSecurityEvent({
        organizationId: ctx.organizationId,
        userProfileId: ctx.userId,
        eventType: 'DATA_EXPORT',
        status: 'SUCCESS',
        details: { target: 'audit-logs' },
        ipAddress: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      }),
    ]);

    return new NextResponse(toCsv((data ?? []) as Record<string, unknown>[]), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="audit-logs.csv"',
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}
