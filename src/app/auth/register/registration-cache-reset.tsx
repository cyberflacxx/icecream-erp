'use client';

import { useEffect } from 'react';

const REGISTRATION_REFRESH_VERSION = '20260804b';
const REGISTRATION_REFRESH_FLAG = `icecream-register-refresh:${REGISTRATION_REFRESH_VERSION}`;

export function RegistrationCacheReset() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.sessionStorage.getItem(REGISTRATION_REFRESH_FLAG) === 'done') {
      return;
    }

    void (async () => {
      let didResetClientCaches = false;

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

      window.sessionStorage.setItem(REGISTRATION_REFRESH_FLAG, 'done');

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
