'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowNav } from '@/components/workflows/workflow-nav';
import { WorkflowResourceTable } from '@/components/workflows/workflow-resource-table';

export default function WorkflowHistoryPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Approval History" description="Inspect workflow decisions, comments, and document transitions." status="partial" />
      <WorkflowNav />
      <WorkflowResourceTable
        endpoint="/api/workflows/history"
        emptyTitle="No workflow history found"
        emptyDescription="Approval, rejection, posting, reversal, and correction actions will appear here."
        columns={[
          { key: 'module_name', header: 'Module' },
          { key: 'document_type', header: 'Document Type' },
          { key: 'document_reference', header: 'Reference' },
          { key: 'action', header: 'Action' },
          { key: 'from_status', header: 'From' },
          { key: 'to_status', header: 'To' },
          { key: 'action_at', header: 'Date' },
        ]}
      />
    </div>
  );
}
