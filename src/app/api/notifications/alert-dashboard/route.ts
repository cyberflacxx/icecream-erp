import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAuth } from '@/app/api/notifications/_helpers';
import { getNotificationAlertDashboard } from '@/lib/notifications-server';

export async function GET(request: NextRequest) {
  const auth = await requireNotificationAuth(request);
  if ('error' in auth) return auth.error;
  try {
    return notificationResponse(await getNotificationAlertDashboard(auth.ctx));
  } catch (error) {
    return notificationError(error);
  }
}
