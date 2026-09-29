import { DEFAULT_TIMEOUT_MS, joinApiUrl } from './config';
import { ApiError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  /** When false, no Authorization header is sent and a 401 does not expire the session. */
  auth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  onUnauthorized: () => void | Promise<void>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const FORBIDDEN_HEADERS = new Set(['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']);

function sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const next: Record<string, string> = {};
  if (!headers) {
    return next;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (FORBIDDEN_HEADERS.has(key.toLowerCase())) {
      continue;
    }
    next[key] = value;
  }
  return next;
}

function readMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('message' in body)) {
    return null;
  }
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join('\n');
  }
  return null;
}

function readRetryAfter(response: Response, body: unknown): number | null {
  if (body && typeof body === 'object' && 'retryAfterSeconds' in body) {
    const value = (body as { retryAfterSeconds?: unknown }).retryAfterSeconds;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  const header = response.headers.get('Retry-After');
  if (!header) {
    return null;
  }
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : null;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const headers = sanitizeHeaders(options.headers);
    headers.Accept = headers.Accept ?? 'application/json';

    let sentAuthorization = false;
    if (options.auth !== false) {
      const token = await this.options.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        sentAuthorization = true;
      }
    }

    if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onCallerAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onCallerAbort);

    const fetchImpl = this.options.fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await fetchImpl(joinApiUrl(this.options.baseUrl, path), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        const abortedByCaller = options.signal?.aborted === true;
        throw new ApiError({
          message: abortedByCaller ? 'Request was cancelled.' : 'Request timed out.',
          status: 0,
          kind: abortedByCaller ? 'aborted' : 'timeout',
        });
      }
      throw new ApiError({
        message: 'Network request failed.',
        status: 0,
        kind: 'network',
      });
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onCallerAbort);
    }

    const body = await readBody(response);
    if (response.ok) {
      return body as T;
    }

    const retryAfterSeconds = response.status === 429 ? readRetryAfter(response, body) : null;
    if (response.status === 401 && sentAuthorization) {
      await this.options.onUnauthorized();
    }

    throw new ApiError({
      message: readMessage(body) ?? `Request failed with status ${response.status}.`,
      status: response.status,
      kind: 'http',
      retryAfterSeconds,
      details: readMessage(body),
    });
  }
}
