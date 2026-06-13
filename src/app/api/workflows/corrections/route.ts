import { NextRequest } from 'next/server';

import { createCorrectionRequest, listCorrections } from '@/lib/workflow-server';
import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireWorkflowAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    return workflowResponse(await listCorrections(auth.ctx.organizationId));
  } catch (error) {
    return workflowError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireWorkflowAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    return workflowResponse(await createCorrectionRequest({ body: await request.json(), ctx: auth.ctx }), 201);
  } catch (error) {
    return workflowError(error);
  }
}
