import { NextRequest } from 'next/server';

import { postVoidRequest } from '@/lib/workflow-server';
import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkflowAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    return workflowResponse(await postVoidRequest({ ctx: auth.ctx, id }));
  } catch (error) {
    return workflowError(error);
  }
}
