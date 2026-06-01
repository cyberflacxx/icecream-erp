'use client';

import { useEffect, useState } from 'react';

interface AppAuthState {
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
}

export function useAppAuth(): AppAuthState {
  const [isLoaded, setIsLoaded] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setToken(window.localStorage.getItem('aqiAuthToken'));
    setIsLoaded(true);
  }, []);

  return {
    getToken: async () => {
      if (typeof window === 'undefined') {
        return null;
      }

      return window.localStorage.getItem('aqiAuthToken');
    },
    isLoaded,
    isSignedIn: Boolean(token),
    userId: token ? 'session-user' : null
  };
}
