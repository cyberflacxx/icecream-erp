import { NextRequest } from 'next/server';

import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';
import { listApprovalRequests, submitWorkflowApproval } from '@/lib/workflow-server';

export async function GET(request: NextRequest) {
  const auth = await requireWorkflowAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    return workflowResponse(await listApprovalRequests(auth.ctx.organizationId));
  } catch (error) {
    return workflowError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireWorkflowAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    return workflowResponse(await submitWorkflowApproval({
      body: await request.json(),
      ctx: auth.ctx,
      requestMeta: {
        ipAddress: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      },
    }), 201);
  } catch (error) {
    return workflowError(error);
  }
}
