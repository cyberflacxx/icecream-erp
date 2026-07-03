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
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-[color:var(--app-border-muted)] bg-[color:var(--app-surface)] shadow-[var(--app-shadow-lg)]">
          <div className="flex items-center justify-between border-b border-[color:var(--app-border-muted)] px-5 py-4">
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
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
