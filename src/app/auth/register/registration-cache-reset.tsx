'use client';

import { useEffect } from 'react';

import {
  REGISTRATION_REFRESH_VERSION,
  resolveRegistrationRefreshKey,
} from '@/lib/registration-refresh';

export function RegistrationCacheReset() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const refreshKey = resolveRegistrationRefreshKey(document);
    const refreshFlag = `icecream-register-refresh:${refreshKey}`;

    try {
      if (window.sessionStorage.getItem(refreshFlag) === 'done') {
        return;
      }
    } catch {
      return;
    }

    void (async () => {
      let didResetClientCaches = false;

      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
          if (registrations.length > 0) {
            await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
            didResetClientCaches = true;
          }
        }

        if ('caches' in window) {
          const cacheNames = await caches.keys().catch(() => []);
          if (cacheNames.length > 0) {
            await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName).catch(() => false)));
            didResetClientCaches = true;
          }
        }

        window.sessionStorage.setItem(refreshFlag, 'done');
      } catch {
        return;
      }

      if (!didResetClientCaches) {
        return;
      }

      const url = new URL(window.location.href);
      url.searchParams.set('rv', REGISTRATION_REFRESH_VERSION);
      window.location.replace(url.toString());
    })();
  }, []);

  return null;
}
