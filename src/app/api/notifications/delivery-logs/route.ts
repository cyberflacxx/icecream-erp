import { NextRequest } from 'next/server';

import { hasNotificationAdminAccess, notificationError, notificationResponse, requireNotificationAuth } from '@/app/api/notifications/_helpers';
import { listNotificationDeliveryLogs } from '@/lib/notifications-server';

export async function GET(request: NextRequest) {
  const auth = await requireNotificationAuth(request);
  if ('error' in auth) return auth.error;
  try {
    if (!hasNotificationAdminAccess(auth.ctx)) {
      return notificationResponse([]);
    }
    return notificationResponse(await listNotificationDeliveryLogs(auth.ctx.organizationId));
  } catch (error) {
    return notificationError(error);
  }
}
