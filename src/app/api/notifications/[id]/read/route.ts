import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAuth } from '@/app/api/notifications/_helpers';
import { markNotificationRead } from '@/lib/notifications-server';

async function handle(request: NextRequest, params: Promise<{ id: string }>) {
  const auth = await requireNotificationAuth(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    return notificationResponse(await markNotificationRead({ ctx: auth.ctx, id }));
  } catch (error) {
    return notificationError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, params);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, params);
}
