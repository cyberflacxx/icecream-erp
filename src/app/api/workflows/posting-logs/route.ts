import { NextRequest } from 'next/server';

import { listPostingLogs } from '@/lib/workflow-server';
import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireWorkflowAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    return workflowResponse(await listPostingLogs(auth.ctx.organizationId));
  } catch (error) {
    return workflowError(error);
  }
}
