import { prisma } from '@absolute-ice-cream/database';

export async function runDailyReportJob(targetDate?: string) {
  const date = targetDate ? new Date(`${targetDate}T00:00:00.000Z`) : new Date();
  date.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);

  const productionBatches = await prisma.productionBatch.findMany({
    where: {
      deletedAt: null,
      productionDate: {
        gte: date,
        lte: end
      }
    }
  });
  const totalOutput = productionBatches.reduce((sum, batch) => sum + Number(batch.actualOutput ?? 0), 0);
  const totalWastage = productionBatches.reduce(
    (sum, batch) => sum + Number(batch.wastageQuantity ?? 0),
    0,
  );
  const avgEfficiency =
    productionBatches.length === 0
      ? 0
      : productionBatches.reduce((sum, batch) => sum + Number(batch.efficiencyPercentage ?? 0), 0) /
        productionBatches.length;
  const summary = {
    date: date.toISOString().slice(0, 10),
    avgEfficiency,
    batches: productionBatches.length,
    totalOutput,
    totalWastage
  };

  const organizations = await prisma.organization.findMany({
    select: {
      id: true
    }
  });

  const records = await Promise.all(
    organizations.map((organization) =>
      prisma.documentFile.create({
        data: {
          fileName: `daily-production-summary-${summary.date}.json`,
          fileSize: Buffer.byteLength(JSON.stringify(summary), 'utf8'),
          fileType: 'application/json',
          fileUrl: `memory://daily-summary/${summary.date}`,
          organizationId: organization.id,
          referenceId: summary.date,
          referenceType: 'daily_production_summary',
          uploadedBy: null
        }
      }),
    ),
  );

  return {
    records: records.length,
    summary
  };
}
