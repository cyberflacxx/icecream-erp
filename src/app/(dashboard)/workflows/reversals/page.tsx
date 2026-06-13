'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowNav } from '@/components/workflows/workflow-nav';
import { WorkflowResourceTable } from '@/components/workflows/workflow-resource-table';

export default function WorkflowReversalsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Reversal Requests" description="Review reversal reasons, approval status, and posting outcome." status="partial" />
      <WorkflowNav />
      <WorkflowResourceTable
        endpoint="/api/workflows/reversals"
        emptyTitle="No reversal requests found"
        emptyDescription="Reversal requests will appear here once posted documents require reversal."
        columns={[
          { key: 'module_name', header: 'Module' },
          { key: 'document_type', header: 'Document Type' },
          { key: 'document_reference', header: 'Reference' },
          { key: 'requested_by', header: 'Requested By' },
          { key: 'reversal_reason', header: 'Reason' },
          { key: 'status', header: 'Status' },
        ]}
      />
    </div>
  );
}
