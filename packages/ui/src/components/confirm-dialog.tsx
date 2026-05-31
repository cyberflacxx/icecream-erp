'use client';

import * as Dialog from '@radix-ui/react-dialog';

interface ConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  open: boolean;
  loading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  open,
  loading = false,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel'
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-brown/40 backdrop-blur-sm dark:bg-darkBg/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-white p-6 shadow-2xl dark:border-darkBorder dark:bg-darkCard">
          <Dialog.Title className="text-lg font-semibold text-brown dark:text-darkText">{title}</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-6 text-muted dark:text-darkMuted">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-brown dark:border-darkBorder dark:text-darkText"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? 'Working...' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
