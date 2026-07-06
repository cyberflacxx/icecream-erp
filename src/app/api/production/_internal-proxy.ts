import { NextResponse } from 'next/server';

export async function forwardJsonToInternalRoute(
  request: Request,
  targetPath: string,
  options?: {
    body?: unknown;
    method?: 'GET' | 'PATCH' | 'POST';
  },
) {
  const url = new URL(request.url);
  const response = await fetch(`${url.origin || 'http://localhost:3000'}${targetPath}`, {
    method: options?.method ?? 'POST',
    headers: {
      cookie: request.headers.get('cookie') ?? '',
      'content-type': 'application/json',
    },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });

  return new NextResponse(await response.text(), {
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
    },
    status: response.status,
  });
}
