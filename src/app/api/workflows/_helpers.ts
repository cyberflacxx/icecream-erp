import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';

export async function requireWorkflowAccess(permission: 'read' | 'write', request?: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return { error: unauthorized() } as const;
  if (
    !can(
      ctx,
      permission === 'read' ? 'settings.read' : 'settings.write',
      'settings.manage',
      'finance.read',
      'finance.write',
      'approve_journal',
      'approve_invoice',
      'approve_purchase_order',
    )
  ) {
    return { error: forbidden() } as const;
  }
  return { ctx } as const;
}

export function workflowResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function workflowError(error: unknown) {
  return serverError(error instanceof Error ? error.message : 'Internal server error');
}
