import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAuth } from '@/app/api/notifications/_helpers';
import { countUnreadNotifications } from '@/lib/notifications-server';

export async function GET(request: NextRequest) {
  const auth = await requireNotificationAuth(request);
  if ('error' in auth) return auth.error;
  try {
    return notificationResponse({ count: await countUnreadNotifications(auth.ctx) });
  } catch (error) {
    return notificationError(error);
  }
}
