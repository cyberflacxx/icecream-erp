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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-cream">
      <div className="relative h-36 w-36 overflow-hidden rounded-3xl border border-orange/20 bg-white/70 shadow-[0_25px_80px_rgba(249,115,22,0.26)] backdrop-blur-sm">
        <Image
          src="/branding/logo.png"
          alt="Absolute Ice Cream ERP"
          fill
          sizes="144px"
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
}
