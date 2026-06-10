'use client';

import { createClient, hasSupabaseClientEnv } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

interface AppAuthState {
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
}

export function useAppAuth(): AppAuthState {
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseClientEnv()) {
      setUserId(null);
      setIsLoaded(true);
      return;
    }

    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setIsLoaded(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    getToken: async () => {
      if (!hasSupabaseClientEnv()) {
        return null;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    },
    isLoaded,
    isSignedIn: Boolean(userId),
    userId,
  };
}
