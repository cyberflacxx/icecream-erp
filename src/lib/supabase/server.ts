import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { assertServerRuntimeEnv } from '@/lib/runtime-env';

import { createSupabaseFetch } from './fetch';

export async function createClient() {
  const env = assertServerRuntimeEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      db: { schema: 'icecream_erp' },
      global: { fetch: createSupabaseFetch() },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — cookies are read-only, ignore
          }
        },
      },
    }
  );
}

export function createServiceRoleClient() {
  const env = assertServerRuntimeEnv({ requireServiceRole: true });

  return createSupabaseClient(
    env.supabaseUrl,
    env.serviceRoleKey!,
    {
      db: { schema: 'icecream_erp' },
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: createSupabaseFetch() },
    }
  );
}
