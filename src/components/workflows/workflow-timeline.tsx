'use client';

import { WorkflowStatusBadge } from '@/components/workflows/workflow-status-badge';

export function WorkflowTimeline({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-sm">
      <h3 className="text-base font-semibold tracking-[-0.02em] text-[color:var(--app-text)]">
        Workflow Timeline
      </h3>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-[color:var(--app-muted)]">No workflow history recorded.</p>
        ) : (
          items.map((item, index) => (
            <div
              key={String(item.id ?? index)}
              className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-[color:var(--app-text)]">
                  {String(item.action ?? 'Workflow Action')}
                </div>
                <WorkflowStatusBadge status={String(item.to_status ?? item.action ?? '')} />
              </div>
              <div className="mt-1 text-[color:var(--app-muted)]">
                {String(item.document_reference ?? item.document_id ?? '')}
                {' • '}
                {String(item.action_at ?? item.created_at ?? '')}
              </div>
              {item.action_comment ? (
                <div className="mt-2 text-[color:var(--app-text)]">
                  {String(item.action_comment)}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
