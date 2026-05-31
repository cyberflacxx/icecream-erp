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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-brown/40 backdrop-blur-sm dark:bg-darkBg/70" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-darkCard">
          <div className="flex items-center justify-between border-b border-border px-6 py-5 dark:border-darkBorder">
            <Dialog.Title className="text-lg font-semibold text-brown dark:text-darkText">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close drawer"
                className="rounded-full bg-cream p-2 text-muted dark:bg-darkBg dark:text-darkMuted"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
