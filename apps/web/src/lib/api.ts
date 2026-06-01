export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}) {
  const { headers, token, ...rest } = options;
  const authToken =
    token ??
    (typeof window !== 'undefined' ? window.localStorage.getItem('aqiAuthToken') : null);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.localStorage.removeItem('aqiAuthToken');
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          credentials: 'omit',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
        });
      } catch {
        // Best-effort cleanup before redirecting.
      }

      window.location.replace('/auth/login');
    }

    const message = await response.text();
    let parsedMessage: string | undefined;

    try {
      const parsed = JSON.parse(message) as { error?: string; message?: string };
      parsedMessage = parsed.message ?? parsed.error;
    } catch {
      parsedMessage = undefined;
    }

    throw new Error(parsedMessage || message || `Request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}
