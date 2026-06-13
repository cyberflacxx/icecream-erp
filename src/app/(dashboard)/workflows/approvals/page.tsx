'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowNav } from '@/components/workflows/workflow-nav';
import { WorkflowResourceTable } from '@/components/workflows/workflow-resource-table';

export default function WorkflowApprovalsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="My Approvals" description="Review approval requests, approver roles, and current workflow status." status="partial" />
      <WorkflowNav />
      <WorkflowResourceTable
        endpoint="/api/workflows/approvals"
        emptyTitle="No approval requests found"
        emptyDescription="Pending and completed approval requests will appear here."
        columns={[
          { key: 'module_name', header: 'Module' },
          { key: 'document_type', header: 'Document Type' },
          { key: 'document_reference', header: 'Reference' },
          { key: 'requested_by', header: 'Requested By' },
          { key: 'approver_role_name', header: 'Required Role' },
          { key: 'status', header: 'Status' },
        ]}
      />
    </div>
  );
}
