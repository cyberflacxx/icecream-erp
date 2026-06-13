import { NextRequest } from 'next/server';

import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';
import { listWorkflowDashboard } from '@/lib/workflow-server';

export async function GET(request: NextRequest) {
  const auth = await requireWorkflowAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    return workflowResponse(await listWorkflowDashboard(auth.ctx.organizationId));
  } catch (error) {
    return workflowError(error);
  }
}
