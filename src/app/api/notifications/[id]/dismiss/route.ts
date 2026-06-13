import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAuth } from '@/app/api/notifications/_helpers';
import { dismissNotification } from '@/lib/notifications-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNotificationAuth(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    return notificationResponse(await dismissNotification({ ctx: auth.ctx, id }));
  } catch (error) {
    return notificationError(error);
  }
}
