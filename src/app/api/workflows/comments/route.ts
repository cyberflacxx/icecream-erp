import { NextRequest } from 'next/server';

import { addWorkflowComment } from '@/lib/workflow-server';
import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';

export async function POST(request: NextRequest) {
  const auth = await requireWorkflowAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    return workflowResponse(await addWorkflowComment({ body: await request.json(), ctx: auth.ctx }), 201);
  } catch (error) {
    return workflowError(error);
  }
}
