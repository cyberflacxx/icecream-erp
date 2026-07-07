'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface FormDrawerProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function FormDrawer({ title, open, onClose, children }: FormDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.45)] backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 top-auto z-50 flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-[color:var(--app-border-muted)] bg-[color:var(--app-surface)] shadow-[var(--app-shadow-lg)] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-full sm:max-w-2xl sm:rounded-none sm:border-y-0 sm:border-r-0 sm:border-l">
          <div className="flex items-center justify-between border-b border-[color:var(--app-border-muted)] px-4 py-4 sm:px-5">
            <Dialog.Title className="text-base font-semibold tracking-[-0.02em] text-[color:var(--app-text)]">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close drawer"
                className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] p-2 text-[color:var(--app-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
            <div className="min-w-0">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
