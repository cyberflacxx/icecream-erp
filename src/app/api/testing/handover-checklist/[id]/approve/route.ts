import { NextRequest } from 'next/server';

import { approveHandoverChecklistItem } from '@/lib/testing-server';
import { requireTestingAccess, testingError, testingResponse } from '@/app/api/testing/_helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTestingAccess('approve', request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    return testingResponse(await approveHandoverChecklistItem(auth.ctx, id, await request.json()));
  } catch (error) {
    return testingError(error);
  }
}
