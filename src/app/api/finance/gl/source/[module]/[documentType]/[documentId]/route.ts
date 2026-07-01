import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { findJournalBySource, loadLedgerLines } from '@/lib/finance-server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string; documentType: string; module: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.gl.view', 'finance.read', 'reports.read')) return forbidden();

  const { documentId, documentType, module } = await params;

  try {
    const journal = await findJournalBySource(ctx.organizationId, module, documentType, documentId);
    if (!journal) return notFound('No finance journal found for this source transaction.');

    const lines = (await loadLedgerLines(ctx.organizationId)).filter((line) => line.journalId === journal.id);

    return NextResponse.json({
      journal,
      lines,
      source: {
        documentId,
        documentType,
        module,
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load finance trace.');
  }
}
