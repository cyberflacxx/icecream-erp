'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowNav } from '@/components/workflows/workflow-nav';
import { WorkflowResourceTable } from '@/components/workflows/workflow-resource-table';

export default function WorkflowCorrectionsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Correction Requests" description="Review requested changes, reasons, approval status, and applied corrections." status="partial" />
      <WorkflowNav />
      <WorkflowResourceTable
        endpoint="/api/workflows/corrections"
        emptyTitle="No correction requests found"
        emptyDescription="Correction requests for posted documents will appear here."
        columns={[
          { key: 'module_name', header: 'Module' },
          { key: 'document_type', header: 'Document Type' },
          { key: 'document_reference', header: 'Reference' },
          { key: 'requested_by', header: 'Requested By' },
          { key: 'correction_reason', header: 'Reason' },
          { key: 'status', header: 'Status' },
        ]}
      />
    </div>
  );
}
