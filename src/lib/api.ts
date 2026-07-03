interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}) {
  const { headers, token, body, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const response = await fetch(path, {
    ...rest,
    body,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
