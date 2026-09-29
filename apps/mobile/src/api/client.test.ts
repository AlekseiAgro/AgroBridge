import { ApiClient } from './client';
import { ApiError } from './errors';

const BASE = 'https://api.agrobridge.ge/api';

type Captured = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
};

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function createHarness(options?: {
  token?: string | null;
  response?: Response | (() => Promise<Response> | Response);
  fetchImpl?: typeof fetch;
}) {
  const calls: Captured[] = [];
  let unauthorized = 0;
  const fetchImpl: typeof fetch =
    options?.fetchImpl ??
    (async (input, init) => {
      const headers = new Headers(init?.headers);
      const record: Record<string, string> = {};
      headers.forEach((value, key) => {
        record[key] = value;
      });
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        headers: record,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      const response = options?.response ?? jsonResponse(200, { ok: true });
      return typeof response === 'function' ? response() : response;
    });

  const client = new ApiClient({
    baseUrl: BASE,
    getAccessToken: async () => options?.token ?? null,
    onUnauthorized: () => {
      unauthorized += 1;
    },
    fetchImpl,
    timeoutMs: 50,
  });

  return {
    client,
    calls,
    unauthorized: () => unauthorized,
  };
}

describe('ApiClient', () => {
  it('sends a bearer token and does not send X-Forwarded-For', async () => {
    const harness = createHarness({ token: 'access-token' });
    await harness.client.request('/auth/me', {
      headers: { 'X-Forwarded-For': '203.0.113.5' },
    });

    expect(harness.calls[0]?.url).toBe('https://api.agrobridge.ge/api/auth/me');
    expect(harness.calls[0]?.headers.authorization).toBe('Bearer access-token');
    expect(harness.calls[0]?.headers['x-forwarded-for']).toBeUndefined();
  });

  it('posts login without a session and does not expire the session on 401', async () => {
    const harness = createHarness({
      token: 'stale-token',
      response: jsonResponse(401, { message: 'Invalid email or password' }),
    });

    await expect(
      harness.client.request('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: 'buyer@example.com', password: 'password1' },
      }),
    ).rejects.toMatchObject({ status: 401, kind: 'http' });

    expect(harness.calls[0]?.url).toBe('https://api.agrobridge.ge/api/auth/login');
    expect(harness.calls[0]?.headers.authorization).toBeUndefined();
    expect(JSON.parse(harness.calls[0]?.body ?? '{}')).toEqual({
      email: 'buyer@example.com',
      password: 'password1',
    });
    expect(harness.unauthorized()).toBe(0);
  });

  it('expires the session when an authenticated request returns 401', async () => {
    const harness = createHarness({
      token: 'expired',
      response: jsonResponse(401, { message: 'Please sign in again.' }),
    });

    await expect(harness.client.request('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(harness.unauthorized()).toBe(1);
  });

  it('surfaces 429 retry information', async () => {
    const harness = createHarness({
      token: 'access-token',
      response: jsonResponse(
        429,
        { message: 'Too many requests', retryAfterSeconds: 12 },
        { 'Retry-After': '12' },
      ),
    });

    await expect(harness.client.request('/auth/me')).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 12,
      kind: 'http',
    });
  });

  it('maps network failures', async () => {
    const harness = createHarness({
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    await expect(harness.client.request('/health', { auth: false })).rejects.toMatchObject({
      kind: 'network',
      status: 0,
    });
  });

  it('aborts when the timeout elapses', async () => {
    const harness = createHarness({
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    });

    await expect(
      harness.client.request('/health', { auth: false, timeoutMs: 5 }),
    ).rejects.toMatchObject({
      kind: 'timeout',
    });
  });
});
