'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { createClient, hasSupabaseClientEnv } from '@/lib/supabase/client';

export async function logoutAndRedirect(router: AppRouterInstance) {
  if (!hasSupabaseClientEnv()) {
    router.replace('/auth/login');
    router.refresh();
    return;
  }

  const supabase = createClient();
  await supabase.auth.signOut();
  router.replace('/auth/login');
  router.refresh();
}
