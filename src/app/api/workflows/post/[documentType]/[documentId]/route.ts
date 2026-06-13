import { NextRequest } from 'next/server';

import { postWorkflowDocument } from '@/lib/workflow-server';
import { requireWorkflowAccess, workflowError, workflowResponse } from '@/app/api/workflows/_helpers';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ documentId: string; documentType: string }> },
) {
  const auth = await requireWorkflowAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    const { documentId, documentType } = await context.params;
    return workflowResponse(await postWorkflowDocument({
      ctx: auth.ctx,
      documentId,
      documentType,
      requestMeta: {
        ipAddress: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      },
    }));
  } catch (error) {
    return workflowError(error);
  }
}
