'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { createClient, hasSupabaseClientEnv } from '@/lib/supabase/client';

export async function logoutAndRedirect(router: AppRouterInstance) {
  if (hasSupabaseClientEnv()) {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
    });
  }

  router.replace('/auth/login');
  router.refresh();
}
