'use client';

import { useEffect, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

import { Button } from '@/components/ui/button';

interface ConfirmActionModalProps {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: 'default' | 'destructive' | 'ghost' | 'outline' | 'secondary' | 'success';
  description: string;
  details?: ReactNode;
  errorMessage?: string | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (adminKey: string) => Promise<void> | void;
  open: boolean;
  requireAdminKey?: boolean;
  title: string;
}

export function ConfirmActionModal({
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  description,
  details,
  errorMessage,
  loading = false,
  onCancel,
  onConfirm,
  open,
  requireAdminKey = true,
  title,
}: ConfirmActionModalProps) {
  const [adminKey, setAdminKey] = useState('');

  useEffect(() => {
    if (!open) {
      setAdminKey('');
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.52)] backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-6 shadow-[var(--app-shadow-lg)]">
          <Dialog.Title className="text-lg font-semibold text-[color:var(--app-text)]">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-6 text-[color:var(--app-muted)]">
            {description}
          </Dialog.Description>

          {details ? (
            <div className="mt-4 rounded-xl border border-[color:var(--app-border-muted)] bg-[color:var(--app-bg-subtle)] px-4 py-3 text-sm text-[color:var(--app-text)]">
              {details}
            </div>
          ) : null}

          {requireAdminKey ? (
            <label className="mt-4 block space-y-2 text-sm text-[color:var(--app-muted)]">
              <span>Admin key</span>
              <input
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="Enter the admin key"
                className="surface-input-soft"
              />
            </label>
          ) : null}

          {errorMessage ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={confirmVariant}
              disabled={loading || (requireAdminKey && !adminKey.trim())}
              onClick={() => void onConfirm(adminKey)}
            >
              {loading ? 'Working...' : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
