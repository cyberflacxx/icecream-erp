import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAuth } from '@/app/api/notifications/_helpers';
import { listNotifications } from '@/lib/notifications-server';

export async function GET(request: NextRequest) {
  const auth = await requireNotificationAuth(request);
  if ('error' in auth) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    return notificationResponse(
      await listNotifications({
        ctx: auth.ctx,
        filters: {
          limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
          module: searchParams.get('module'),
          page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
          pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 20,
          severity: searchParams.get('severity'),
          unreadOnly: true,
        },
      }),
    );
  } catch (error) {
    return notificationError(error);
  }
}
