import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAuth } from '@/app/api/notifications/_helpers';
import { listNotificationPreferences, upsertNotificationPreferences } from '@/lib/notifications-server';

export async function GET(request: NextRequest) {
  const auth = await requireNotificationAuth(request);
  if ('error' in auth) return auth.error;
  try {
    return notificationResponse(await listNotificationPreferences(auth.ctx));
  } catch (error) {
    return notificationError(error, {
      fallbackData: [],
      routeName: '/api/notifications/preferences',
    });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireNotificationAuth(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json() as { preferences?: Array<Record<string, unknown>> };
    return notificationResponse(await upsertNotificationPreferences({ body: body.preferences ?? [], ctx: auth.ctx }));
  } catch (error) {
    return notificationError(error, {
      routeName: '/api/notifications/preferences',
    });
  }
}
