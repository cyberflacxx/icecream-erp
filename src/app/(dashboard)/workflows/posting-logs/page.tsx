'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowNav } from '@/components/workflows/workflow-nav';
import { WorkflowResourceTable } from '@/components/workflows/workflow-resource-table';

export default function WorkflowPostingLogsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Posting Logs" description="Track posting attempts, results, users, and posting failures." status="partial" />
      <WorkflowNav />
      <WorkflowResourceTable
        endpoint="/api/workflows/posting-logs"
        emptyTitle="No posting logs found"
        emptyDescription="Posting logs will appear here after document posting begins."
        columns={[
          { key: 'module_name', header: 'Module' },
          { key: 'document_type', header: 'Document Type' },
          { key: 'document_reference', header: 'Reference' },
          { key: 'posting_action', header: 'Action' },
          { key: 'posting_status', header: 'Status' },
          { key: 'error_message', header: 'Error' },
        ]}
      />
    </div>
  );
}
