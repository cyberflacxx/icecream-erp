import { NextRequest } from 'next/server';

import { rejectWorkflowRequest } from '@/lib/workflow-server';
import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkflowAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    const body = (await request.json().catch(() => ({}))) as { comment?: string };
    const { id } = await context.params;
    return workflowResponse(await rejectWorkflowRequest({
      comment: body.comment,
      ctx: auth.ctx,
      id,
      requestMeta: {
        ipAddress: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      },
    }));
  } catch (error) {
    return workflowError(error);
  }
}
