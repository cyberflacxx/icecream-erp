'use client';

import { useEffect } from 'react';
import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function PrintOnLoad({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [enabled]);

  return null;
}

export function PrintReceiptButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" />
      Print Receipt
    </Button>
  );
}
