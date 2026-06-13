import { NextRequest } from 'next/server';

import { rejectCorrectionRequest } from '@/lib/workflow-server';
import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkflowAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { comment?: string };
    return workflowResponse(await rejectCorrectionRequest({ ctx: auth.ctx, id, comment: body.comment }));
  } catch (error) {
    return workflowError(error);
  }
}
