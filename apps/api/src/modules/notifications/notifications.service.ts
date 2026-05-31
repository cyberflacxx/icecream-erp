import { prisma } from '@absolute-ice-cream/database';

interface NotificationsContext {
  branchId: string | null;
  organizationId: string;
  userProfileId: string;
}

interface NotificationsQuery {
  limit?: number;
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
}

const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

function createPaginationResult<T>(data: T[], page: number, pageSize: number) {
  const total = data.length;
  const start = (page - 1) * pageSize;

  return {
    data: data.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total
    }
  };
}

function resolveNotificationLink(notification: {
  referenceId: string | null;
  referenceType: string | null;
  type: string;
}) {
  const normalized = (notification.referenceType ?? '').toUpperCase();

  if (normalized === 'LOW_STOCK') {
    return '/inventory/stock-balances';
  }

  if (normalized === 'EXPIRY_ALERT') {
    return '/inventory/expiring';
  }

  if (normalized === 'SHIFT_CLOSE_SUBMITTED') {
    return notification.referenceId ? `/branches/${notification.referenceId}` : '/branches';
  }

  if (normalized === 'PRODUCTION_BATCH_READY') {
    return notification.referenceId
      ? `/production/batches/${notification.referenceId}`
      : '/dashboard';
  }

  if (normalized === 'PURCHASE_ORDER_APPROVED') {
    return notification.referenceId
      ? `/procurement/purchase-orders/${notification.referenceId}`
      : '/procurement/purchase-orders';
  }

  if (normalized === 'PAYMENT_RECEIVED') {
    return notification.referenceId
      ? `/sales/invoices/${notification.referenceId}`
      : '/sales/invoices';
  }

  return '/dashboard';
}

export class NotificationsService {
  static async listNotifications(context: NotificationsContext, query: NotificationsQuery) {
    if (!isDatabaseConfigured) {
      return createPaginationResult([], query.page, query.pageSize);
    }

    const rows = await prisma.notification.findMany({
      where: {
        isRead: query.unreadOnly ? false : undefined,
        organizationId: context.organizationId,
        userProfileId: context.userProfileId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: query.limit
    });

    const mapped = rows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      isRead: row.isRead,
      link: resolveNotificationLink({
        referenceId: row.referenceId,
        referenceType: row.referenceType,
        type: row.type
      }),
      message: row.message,
      referenceId: row.referenceId,
      referenceType: row.referenceType,
      title: row.title,
      type: row.type
    }));

    return createPaginationResult(mapped, query.page, query.pageSize);
  }

  static async markAsRead(context: NotificationsContext, notificationId: string) {
    if (!isDatabaseConfigured) {
      return {
        id: notificationId,
        isRead: true
      };
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        organizationId: context.organizationId,
        userProfileId: context.userProfileId
      }
    });

    if (!notification) {
      throw new Error('Notification not found.');
    }

    return prisma.notification.update({
      where: {
        id: notificationId
      },
      data: {
        isRead: true
      }
    });
  }

  static async markAllAsRead(context: NotificationsContext) {
    if (!isDatabaseConfigured) {
      return {
        updated: 0
      };
    }

    const result = await prisma.notification.updateMany({
      where: {
        isRead: false,
        organizationId: context.organizationId,
        userProfileId: context.userProfileId
      },
      data: {
        isRead: true
      }
    });

    return {
      updated: result.count
    };
  }
}
