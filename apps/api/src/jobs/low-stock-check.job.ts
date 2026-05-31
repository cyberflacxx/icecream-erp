import { prisma } from '@absolute-ice-cream/database';

export async function runLowStockCheckJob() {
  const lowStock = await prisma.stockBalance.findMany({
    where: {
      item: {
        reorderLevel: {
          not: null
        }
      }
    },
    include: {
      item: true,
      warehouse: true
    }
  });
  const critical = lowStock.filter((row) =>
    row.item.reorderLevel?.greaterThanOrEqualTo(row.quantityAvailable),
  );

  if (!critical.length) {
    return {
      notifications: 0
    };
  }

  const procurementUsers = await prisma.userProfile.findMany({
    where: {
      deletedAt: null,
      roleAssignments: {
        some: {
          role: {
            name: {
              contains: 'procurement',
              mode: 'insensitive'
            }
          }
        }
      }
    },
    select: {
      id: true,
      organizationId: true
    }
  });

  if (!procurementUsers.length) {
    return {
      notifications: 0
    };
  }

  const payload = critical
    .slice(0, 12)
    .map((row) => `${row.item.code} (${row.warehouse.code})`)
    .join(', ');

  const notifications = await Promise.all(
    procurementUsers.map((user) =>
      prisma.notification.create({
        data: {
          message: `Low stock alert: ${payload}`,
          organizationId: user.organizationId,
          referenceId: null,
          referenceType: 'LOW_STOCK',
          title: 'Low stock items detected',
          type: 'ACTION_REQUIRED',
          userProfileId: user.id
        }
      }),
    ),
  );

  return {
    notifications: notifications.length
  };
}
