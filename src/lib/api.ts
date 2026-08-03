interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

export class ApiRequestError extends Error {
  code: string | null;
  requestId: string | null;
  status: number;

  constructor(input: { code?: string | null; message: string; requestId?: string | null; status: number }) {
    super(input.message);
    this.name = 'ApiRequestError';
    this.code = input.code ?? null;
    this.requestId = input.requestId ?? null;
    this.status = input.status;
  }
}

function readResponseRequestId(response: Response) {
  return response.headers.get('x-request-id') ?? response.headers.get('x-vercel-id');
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

    const rawBody = await response.text();
    const headerRequestId = readResponseRequestId(response);
    let parsedMessage: string | undefined;
    let parsedCode: string | undefined;
    let parsedRequestId: string | undefined;

    try {
      const parsed = JSON.parse(rawBody) as {
        code?: string;
        error?: { code?: string; message?: string; requestId?: string } | string;
        errorId?: string;
        errorMessage?: string;
        message?: string;
        requestId?: string;
      };
      const nestedError = typeof parsed.error === 'object' && parsed.error !== null ? parsed.error : null;

      parsedMessage =
        nestedError?.message ??
        parsed.message ??
        parsed.errorMessage ??
        (typeof parsed.error === 'string' ? parsed.error : undefined);
      parsedCode = nestedError?.code ?? parsed.code;
      parsedRequestId = nestedError?.requestId ?? parsed.requestId ?? parsed.errorId ?? headerRequestId ?? undefined;
    } catch {
      parsedMessage = undefined;
      parsedRequestId = headerRequestId ?? undefined;
    }

    if (parsedRequestId) {
      console.error('API request failed', {
        code: parsedCode ?? null,
        path,
        requestId: parsedRequestId,
        status: response.status,
      });
    }

    throw new ApiRequestError({
      code: parsedCode,
      message: parsedMessage || rawBody || `Request failed with status ${response.status}.`,
      requestId: parsedRequestId,
      status: response.status,
    });
  }

  const rawBody = await response.text();
  if (!rawBody.trim()) {
    return null as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new ApiRequestError({
      code: 'INVALID_API_RESPONSE',
      message: 'API returned a non-JSON response.',
      requestId: readResponseRequestId(response),
      status: response.status,
    });
  }
}
