'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { API_ROUTES } from '@absolute-ice-cream/shared';

import { API_BASE_URL } from '@/lib/api';

function getLogoutUrls() {
  const urls = new Set<string>([`${API_BASE_URL}${API_ROUTES.AUTH.LOGOUT}`]);

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    urls.add(`http://localhost:4001${API_ROUTES.AUTH.LOGOUT}`);
  }

  return Array.from(urls);
}

export async function logoutAndRedirect(router: AppRouterInstance) {
  const urls = getLogoutUrls();
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('aqiAuthToken') : null;

  for (const url of urls) {
    try {
      await fetch(url, {
        method: 'POST',
        credentials: 'omit',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      break;
    } catch {
      // Try next URL fallback.
    }
  }

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('aqiAuthToken');
  }

  router.replace('/auth/login');
  router.refresh();
}
