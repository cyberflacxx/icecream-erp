import { createBrowserClient } from '@supabase/ssr';

const isProduction = process.env.NODE_ENV === 'production';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
