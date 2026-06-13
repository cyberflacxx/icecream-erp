'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowNav } from '@/components/workflows/workflow-nav';
import { WorkflowResourceTable } from '@/components/workflows/workflow-resource-table';

export default function WorkflowSettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Workflow Settings" description="Configure workflow definitions, document actions, and approval requirements." status="partial" />
      <WorkflowNav />
      <WorkflowResourceTable
        endpoint="/api/workflows/definitions"
        emptyTitle="No workflow definitions found"
        emptyDescription="Create workflow definitions and approval rules to activate document control."
        columns={[
          { key: 'name', header: 'Workflow Name' },
          { key: 'module_name', header: 'Module' },
          { key: 'document_type', header: 'Document Type' },
          { key: 'action_name', header: 'Action' },
          { key: 'self_approval_allowed', header: 'Self Approval' },
          { key: 'is_active', header: 'Active' },
        ]}
      />
    </div>
  );
}
