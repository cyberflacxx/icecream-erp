import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAdmin } from '@/app/api/notifications/_helpers';
import { listNotificationDeliveryLogs } from '@/lib/notifications-server';

export async function GET(request: NextRequest) {
  const auth = await requireNotificationAdmin(request);
  if ('error' in auth) return auth.error;
  try {
    return notificationResponse(await listNotificationDeliveryLogs(auth.ctx.organizationId));
  } catch (error) {
    return notificationError(error);
  }
}
