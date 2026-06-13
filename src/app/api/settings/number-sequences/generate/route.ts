import { NextRequest } from 'next/server';

import {
  generateDocumentNumberResponse,
  handleSettingsError,
  requireSettingsAccess,
} from '@/app/api/settings/_helpers';

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as { seriesType: string };
    return await generateDocumentNumberResponse({
      organizationId: auth.ctx.organizationId,
      seriesType: body.seriesType,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
