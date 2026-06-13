import { NextRequest } from 'next/server';

import { requireTestingAccess, testingError, testingResponse } from '@/app/api/testing/_helpers';
import { updateTrainingSession } from '@/lib/testing-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTestingAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    return testingResponse(await updateTrainingSession(auth.ctx, id, await request.json()));
  } catch (error) {
    return testingError(error);
  }
}
