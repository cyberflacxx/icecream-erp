'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

function isStandaloneLaunch() {
  if (typeof window === 'undefined') {
    return false;
  }

  const iosStandalone =
    typeof navigator !== 'undefined' &&
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

export function PwaLaunchSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isStandaloneLaunch()) {
      return;
    }

    setShow(true);
    const timer = window.setTimeout(() => setShow(false), 1200);

    return () => window.clearTimeout(timer);
  }, []);

  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[color:var(--app-bg-canvas)]">
      <div className="relative h-36 w-36 overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-[var(--app-shadow-lg)] backdrop-blur-sm">
        <Image
          src="/branding/logo.png"
          alt="Absolute Ice Cream ERP"
          fill
          sizes="160px"
          className="scale-110 object-cover"
          priority
        />
      </div>
    </div>
  );
}
