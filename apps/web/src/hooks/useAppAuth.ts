'use client';

interface AppAuthState {
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
}

export function useAppAuth(): AppAuthState {
  return {
    getToken: async () => null,
    isLoaded: true,
    isSignedIn: true,
    userId: 'session-user'
  };
}
