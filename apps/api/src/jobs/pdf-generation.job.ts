import {
  Queue,
  type RedisOptions,
  Worker
} from 'bullmq';

import { prisma } from '@absolute-ice-cream/database';

import { env } from '../config/env';
import { ReportsService } from '../modules/reports/reports.service';
import type { ReportQuery } from '../modules/reports/reports.schemas';

interface PdfGenerationPayload {
  context: {
    branchId: string | null;
    isBranchScoped: boolean;
    organizationId: string;
    roles?: Array<{ name: string }>;
    userProfileId: string;
  };
  reportQuery: ReportQuery;
}

const redisConnection: RedisOptions | null = env.REDIS_URL
  ? {
      maxRetriesPerRequest: null,
      url: env.REDIS_URL
    }
  : null;

const queueName = 'pdf-generation';
export const pdfGenerationQueue = redisConnection
  ? new Queue<PdfGenerationPayload, unknown, string>(queueName, {
      connection: redisConnection
    })
  : null;

async function processPayload(payload: PdfGenerationPayload) {
  const result = await ReportsService.exportPdf(payload.context, payload.reportQuery);

  if (!result.document) {
    return `local-dev-${Date.now()}`;
  }

  await prisma.documentFile.update({
    where: {
      id: result.document.id
    },
    data: {
      referenceType: 'report_pdf_ready'
    }
  });
  await prisma.notification.create({
    data: {
      message: `Your ${payload.reportQuery.reportType} PDF export is ready.`,
      organizationId: payload.context.organizationId,
      referenceId: result.document.id,
      referenceType: 'document_file',
      title: 'Report PDF ready',
      type: 'INFO',
      userProfileId: payload.context.userProfileId
    }
  });

  return result.document.id;
}

export async function enqueuePdfGenerationJob(payload: PdfGenerationPayload) {
  if (!pdfGenerationQueue) {
    const documentId = await processPayload(payload);

    return {
      mode: 'inline',
      queued: false,
      jobId: `inline-${documentId}`
    };
  }

  const job = await pdfGenerationQueue.add('generate-report-pdf', payload, {
    removeOnComplete: true,
    removeOnFail: 100
  });

  return {
    mode: 'queue',
    queued: true,
    jobId: String(job.id)
  };
}

export const pdfGenerationWorker = redisConnection
  ? new Worker<PdfGenerationPayload, unknown, string>(
      queueName,
      async (job) => processPayload(job.data),
      {
        connection: redisConnection
      },
    )
  : null;
