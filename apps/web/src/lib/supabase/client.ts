import { createBrowserClient } from '@supabase/ssr';

const isProduction = process.env.NODE_ENV === 'production';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseClientEnv() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase client environment variables are not configured.');
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      db: { schema: 'icecream_erp' },
      cookieOptions: {
        maxAge: 400 * 24 * 60 * 60,
        sameSite: 'lax',
        secure: isProduction,
      },
    }
  );
}
