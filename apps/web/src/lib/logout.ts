'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { createClient } from '@/lib/supabase/client';

export async function logoutAndRedirect(router: AppRouterInstance) {
  const supabase = createClient();
  await supabase.auth.signOut();
  router.replace('/auth/login');
  router.refresh();
}
