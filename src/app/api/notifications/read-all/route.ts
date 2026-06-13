import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAuth } from '@/app/api/notifications/_helpers';
import { markAllNotificationsRead } from '@/lib/notifications-server';

async function handle(request: NextRequest) {
  const auth = await requireNotificationAuth(request);
  if ('error' in auth) return auth.error;
  try {
    return notificationResponse(await markAllNotificationsRead(auth.ctx));
  } catch (error) {
    return notificationError(error);
  }
}

export async function PATCH(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
