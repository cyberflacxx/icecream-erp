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
    let active = true;

    const loadAuthState = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'include',
        });

        if (!active) return;

        if (!response.ok) {
          setUserId(null);
          return;
        }

        const payload = (await response.json()) as {
          clerkUserId?: string | null;
          profile?: { clerkUserId?: string | null; id?: string | null } | null;
        };
        setUserId(payload.clerkUserId ?? payload.profile?.clerkUserId ?? payload.profile?.id ?? null);
      } catch {
        if (!active) return;
        setUserId(null);
      } finally {
        if (active) {
          setIsLoaded(true);
        }
      }
    };

    void loadAuthState();

    return () => {
      active = false;
    };
  }, []);

  return {
    getToken: async () => {
      if (!hasSupabaseClientEnv()) {
        return null;
      }

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
      } catch {
        return null;
      }
    },
    isLoaded,
    isSignedIn: Boolean(userId),
    userId,
  };
}
