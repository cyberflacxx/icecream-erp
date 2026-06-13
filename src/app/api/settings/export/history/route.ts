import { NextRequest } from 'next/server';

import {
  getExportHistoryResponse,
  handleSettingsError,
  recordManualExportResponse,
  requireSettingsAccess,
} from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return await getExportHistoryResponse(auth.ctx.organizationId);
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    return await recordManualExportResponse({
      body: (await request.json()) as {
        dataType: string;
        fileName: string;
        filters?: Record<string, unknown>;
        format?: string;
      },
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
