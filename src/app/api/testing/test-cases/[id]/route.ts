import { NextRequest } from 'next/server';

import { updateTestCase } from '@/lib/testing-server';
import { requireTestingAccess, testingError, testingResponse } from '@/app/api/testing/_helpers';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTestingAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    return testingResponse(await updateTestCase(auth.ctx, id, await request.json()));
  } catch (error) {
    return testingError(error);
  }
}
