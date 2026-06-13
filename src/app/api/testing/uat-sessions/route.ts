import { NextRequest } from 'next/server';

import { createUatSession, listUatSessions } from '@/lib/testing-server';
import { requireTestingAccess, testingError, testingResponse } from '@/app/api/testing/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireTestingAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    return testingResponse(await listUatSessions(auth.ctx));
  } catch (error) {
    return testingError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTestingAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    return testingResponse(await createUatSession(auth.ctx, await request.json()), 201);
  } catch (error) {
    return testingError(error);
  }
}
