import { serverApiUrl } from './api-base-url';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Visitor address to relay; see `visitorAddressOf` in `lib/client-address`. */
  forwardedFor?: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: HeadersInit = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options.forwardedFor) {
    headers['X-Forwarded-For'] = options.forwardedFor;
  }

  const response = await fetch(`${serverApiUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      throw new ApiError(
        response.ok
          ? 'Unexpected response from API'
          : `Request failed (${response.status})`,
        response.status || 502,
        text.slice(0, 200),
      );
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data &&
      'message' in data &&
      (typeof (data as { message: unknown }).message === 'string' ||
        Array.isArray((data as { message: unknown }).message))
        ? Array.isArray((data as { message: unknown }).message)
          ? ((data as { message: string[] }).message[0] ?? 'Request failed')
          : ((data as { message: string }).message)
        : 'Request failed';

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}
