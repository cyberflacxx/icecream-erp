import { NextRequest } from 'next/server';

import { listWorkflowHistory } from '@/lib/workflow-server';
import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireWorkflowAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    return workflowResponse(await listWorkflowHistory(auth.ctx.organizationId));
  } catch (error) {
    return workflowError(error);
  }
}
