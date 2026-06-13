'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowNav } from '@/components/workflows/workflow-nav';
import { WorkflowResourceTable } from '@/components/workflows/workflow-resource-table';

export default function WorkflowVoidsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Void Requests" description="Review void reasons, approval progress, and posted void actions." status="partial" />
      <WorkflowNav />
      <WorkflowResourceTable
        endpoint="/api/workflows/voids"
        emptyTitle="No void requests found"
        emptyDescription="Void requests will appear here after users request document voiding."
        columns={[
          { key: 'module_name', header: 'Module' },
          { key: 'document_type', header: 'Document Type' },
          { key: 'document_reference', header: 'Reference' },
          { key: 'requested_by', header: 'Requested By' },
          { key: 'void_reason', header: 'Reason' },
          { key: 'status', header: 'Status' },
        ]}
      />
    </div>
  );
}
