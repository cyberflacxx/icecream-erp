import { NextRequest } from 'next/server';

import { getTestingDashboard } from '@/lib/testing-server';
import { requireTestingAccess, testingError, testingResponse } from '@/app/api/testing/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireTestingAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    return testingResponse(await getTestingDashboard(auth.ctx));
  } catch (error) {
    return testingError(error);
  }
}
