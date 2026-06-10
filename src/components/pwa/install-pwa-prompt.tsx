'use client';

import { Download, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isIosMobile() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(display-mode: standalone)').matches;
}

export function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(max-width: 1024px)');
    const apply = () => {
      setIsMobile(media.matches);
      setIsStandalone(isInStandaloneMode());
    };

    apply();
    media.addEventListener('change', apply);
    window.addEventListener('appinstalled', apply);

    return () => {
      media.removeEventListener('change', apply);
      window.removeEventListener('appinstalled', apply);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore registration errors silently.
    });
  }, []);

  const showBanner = useMemo(() => {
    if (dismissed || !isMobile || isStandalone) {
      return false;
    }

    return Boolean(deferredPrompt) || isIosMobile();
  }, [deferredPrompt, dismissed, isMobile, isStandalone]);

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-orange/30 bg-[rgba(255,247,232,0.96)] p-4 shadow-[0_18px_50px_rgba(124,63,34,0.25)] backdrop-blur-xl">
      <button
        type="button"
        aria-label="Close install prompt"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-orange/20 bg-white text-brown"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-8">
        <p className="text-sm font-semibold text-brown">Install ERP App</p>
        <p className="mt-1 text-xs text-muted">
          {deferredPrompt
            ? 'Add this ERP to your home screen for faster access.'
            : 'On iPhone/iPad, tap Share then "Add to Home Screen".'}
        </p>
      </div>

      {deferredPrompt ? (
        <button
          type="button"
          onClick={async () => {
            await deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            setDeferredPrompt(null);
            setDismissed(true);
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-deepOrange"
        >
          <Download className="h-4 w-4" />
          Install App
        </button>
      ) : null}
    </div>
  );
}
