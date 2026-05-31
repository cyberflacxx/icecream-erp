'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { API_BASE_URL } from '@/lib/api';

function getLogoutUrls() {
  const urls = new Set<string>([`${API_BASE_URL}/api/auth/logout`]);

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    urls.add('http://localhost:4001/api/auth/logout');
  }

  return Array.from(urls);
}

export async function logoutAndRedirect(router: AppRouterInstance) {
  const urls = getLogoutUrls();

  for (const url of urls) {
    try {
      await fetch(url, {
        method: 'POST',
        credentials: 'include'
      });
      break;
    } catch {
      // Try next URL fallback.
    }
  }

  router.replace('/auth/login');
  router.refresh();
}
