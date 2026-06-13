'use client';

import { WorkflowStatusBadge } from '@/components/workflows/workflow-status-badge';

export function WorkflowTimeline({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <h3 className="text-lg font-semibold text-brown dark:text-darkText">Workflow Timeline</h3>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted dark:text-darkMuted">No workflow history recorded.</p>
        ) : (
          items.map((item, index) => (
            <div key={String(item.id ?? index)} className="rounded-xl border border-border bg-cream px-4 py-3 text-sm dark:border-darkBorder dark:bg-darkBg">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-brown dark:text-darkText">{String(item.action ?? 'Workflow Action')}</div>
                <WorkflowStatusBadge status={String(item.to_status ?? item.action ?? '')} />
              </div>
              <div className="mt-1 text-muted dark:text-darkMuted">
                {String(item.document_reference ?? item.document_id ?? '')} • {String(item.action_at ?? item.created_at ?? '')}
              </div>
              {item.action_comment ? <div className="mt-2 text-brown dark:text-darkText">{String(item.action_comment)}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
