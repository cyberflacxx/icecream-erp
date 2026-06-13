import { NextRequest } from 'next/server';

import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';
import { updateWorkflowDefinition } from '@/lib/workflow-server';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkflowAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    return workflowResponse(await updateWorkflowDefinition({
      body: await request.json(),
      ctx: auth.ctx,
      id,
    }));
  } catch (error) {
    return workflowError(error);
  }
}
