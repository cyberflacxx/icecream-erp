import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

export async function runExpiryAlertJob(daysAhead = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(today.getDate() + daysAhead);

  const expiring = await prisma.inventoryBatch.findMany({
    where: {
      expiryDate: {
        gte: today,
        lte: end
      },
      quantityRemaining: {
        gt: new Decimal(0)
      }
    },
    include: {
      item: true,
      organization: true,
      warehouse: true
    }
  });

  if (!expiring.length) {
    return {
      notifications: 0
    };
  }

  const warehouseManagers = await prisma.userProfile.findMany({
    where: {
      deletedAt: null,
      roleAssignments: {
        some: {
          role: {
            name: {
              in: ['Warehouse Manager', 'Inventory Manager']
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

  const summary = expiring
    .slice(0, 10)
    .map((row) => `${row.item.code} / ${row.batchNumber}`)
    .join(', ');
  const notifications = await Promise.all(
    warehouseManagers.map((user) =>
      prisma.notification.create({
        data: {
          message: `Expiry alert (${daysAhead} days): ${summary}`,
          organizationId: user.organizationId,
          referenceId: null,
          referenceType: 'EXPIRY_ALERT',
          title: 'Batches nearing expiry',
          type: 'WARNING',
          userProfileId: user.id
        }
      }),
    ),
  );

  return {
    notifications: notifications.length
  };
}
