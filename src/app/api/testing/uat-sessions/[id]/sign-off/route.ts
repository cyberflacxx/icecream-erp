import { NextRequest } from 'next/server';

import { requireTestingAccess, testingError, testingResponse } from '@/app/api/testing/_helpers';
import { signOffUatSession } from '@/lib/testing-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTestingAccess('approve', request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    return testingResponse(await signOffUatSession(auth.ctx, id, await request.json()));
  } catch (error) {
    return testingError(error);
  }
}
