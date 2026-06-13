import { NextRequest } from 'next/server';

import { getWorkflowComments } from '@/lib/workflow-server';
import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentId: string; documentType: string }> },
) {
  const auth = await requireWorkflowAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    const { documentId, documentType } = await context.params;
    return workflowResponse(await getWorkflowComments(auth.ctx.organizationId, documentType, documentId));
  } catch (error) {
    return workflowError(error);
  }
}
