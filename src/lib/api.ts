interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}) {
  const { headers, token, ...rest } = options;

  const response = await fetch(path, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
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
