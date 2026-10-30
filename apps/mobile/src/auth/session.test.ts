import { ApiClient } from '../api/client';
import { createMemoryTokenStore } from './token-store';
import {
  confirmEmailSession,
  loginSession,
  logoutSession,
  registerSession,
  restoreSession,
  sendEmailCode,
} from './session';

const BASE = 'https://api.agrobridge.ge/api';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const user = {
  id: 'user-1',
  email: 'ada@example.com',
  displayName: 'Ada',
  emailVerified: true,
  locale: 'en',
  avatarUrl: null,
  role: 'buyer',
};

describe('session', () => {
  it('stores the access token from login and drops the registration role', async () => {
    const store = createMemoryTokenStore();
    const calls: string[] = [];
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: () => store.get(),
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
        return json(200, {
          accessToken: 'jwt-1',
          tokenType: 'Bearer',
          expiresIn: '604800',
          user,
        });
      },
    });

    const snapshot = await loginSession(store, client, 'ada@example.com', 'password1');

    expect(calls).toEqual(['POST https://api.agrobridge.ge/api/auth/login']);
    expect(await store.get()).toBe('jwt-1');
    expect(snapshot.status).toBe('authenticated');
    expect(snapshot.user).toEqual({
      id: 'user-1',
      email: 'ada@example.com',
      displayName: 'Ada',
      emailVerified: true,
      locale: 'en',
      avatarUrl: null,
    });
    expect(snapshot.user && 'role' in snapshot.user).toBe(false);
  });

  it('clears the token when the saved session is rejected', async () => {
    const store = createMemoryTokenStore('expired');
    let clearedByClient = 0;
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: () => store.get(),
      onUnauthorized: async () => {
        clearedByClient += 1;
        await store.clear();
      },
      fetchImpl: async () => json(401, { message: 'Please sign in again.' }),
    });

    const snapshot = await restoreSession(store, client);

    expect(snapshot.status).toBe('anonymous');
    expect(await store.get()).toBeNull();
    expect(clearedByClient).toBe(1);
  });

  it('keeps the token when the profile request fails on the network', async () => {
    const store = createMemoryTokenStore('still-valid');
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: () => store.get(),
      onUnauthorized: () => undefined,
      fetchImpl: async () => {
        throw new TypeError('offline');
      },
    });

    const snapshot = await restoreSession(store, client);

    expect(snapshot).toMatchObject({
      status: 'authenticated',
      profileUnavailable: true,
      user: null,
    });
    expect(await store.get()).toBe('still-valid');
  });

  it('stores the access token returned by registration', async () => {
    const store = createMemoryTokenStore();
    const calls: string[] = [];
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: () => store.get(),
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
        return json(200, {
          accessToken: 'jwt-reg',
          tokenType: 'Bearer',
          expiresIn: '604800',
          verificationEmailSent: false,
          user: { ...user, emailVerified: false },
        });
      },
    });

    const result = await registerSession(store, client, {
      email: 'ada@example.com',
      password: 'password1',
      role: 'farmer',
      locale: 'en',
      acceptTerms: true,
      acceptedTermsVersion: '1.0',
      acceptedTermsLocale: 'en',
    });

    expect(calls).toEqual(['POST https://api.agrobridge.ge/api/auth/register']);
    expect(await store.get()).toBe('jwt-reg');
    expect(result.verificationEmailSent).toBe(false);
    expect(result.snapshot).toMatchObject({
      status: 'authenticated',
      user: { email: 'ada@example.com', emailVerified: false },
    });
  });

  it('logout deletes the token and does not call the API', async () => {
    const store = createMemoryTokenStore('jwt-1');
    const snapshot = await logoutSession(store);
    expect(snapshot.status).toBe('anonymous');
    expect(await store.get()).toBeNull();
  });

  it('sends a verification code with the bearer token and no body', async () => {
    const store = createMemoryTokenStore('jwt-existing');
    let method = '';
    let url = '';
    let authorization = '';
    let body: unknown = 'unset';
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: () => store.get(),
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        method = init?.method ?? 'GET';
        url = String(input);
        const headers = init?.headers as Record<string, string>;
        authorization = headers.Authorization ?? '';
        body = init?.body;
        return json(200, { sent: true, destination: 'ada@example.com' });
      },
    });

    const result = await sendEmailCode(client);

    expect(method).toBe('POST');
    expect(url).toBe('https://api.agrobridge.ge/api/verification/email/send-code');
    expect(authorization).toBe('Bearer jwt-existing');
    expect(body).toBeUndefined();
    expect(result).toEqual({ sent: true, destination: 'ada@example.com' });
    expect(await store.get()).toBe('jwt-existing');
  });

  it('confirms the code, refreshes /auth/me, and keeps the existing token', async () => {
    const store = createMemoryTokenStore('jwt-existing');
    const calls: { method: string; url: string; authorization: string; body?: string }[] = [];
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: () => store.get(),
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        const headers = init?.headers as Record<string, string>;
        calls.push({
          method: init?.method ?? 'GET',
          url: String(input),
          authorization: headers.Authorization ?? '',
          body: typeof init?.body === 'string' ? init.body : undefined,
        });
        if (String(input).endsWith('/verification/email/confirm')) {
          return json(200, { emailVerified: true });
        }
        return json(200, { ...user, emailVerified: true });
      },
    });

    const snapshot = await confirmEmailSession(store, client, '123456');

    expect(calls).toEqual([
      {
        method: 'POST',
        url: 'https://api.agrobridge.ge/api/verification/email/confirm',
        authorization: 'Bearer jwt-existing',
        body: JSON.stringify({ code: '123456' }),
      },
      {
        method: 'GET',
        url: 'https://api.agrobridge.ge/api/auth/me',
        authorization: 'Bearer jwt-existing',
        body: undefined,
      },
    ]);
    expect(snapshot.user?.emailVerified).toBe(true);
    expect(await store.get()).toBe('jwt-existing');
  });

  it('does not refresh the session or replace the token when confirmation fails', async () => {
    const store = createMemoryTokenStore('jwt-existing');
    const urls: string[] = [];
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: () => store.get(),
      onUnauthorized: () => undefined,
      fetchImpl: async (input) => {
        urls.push(String(input));
        return json(400, { message: 'Invalid or expired verification code' });
      },
    });

    await expect(confirmEmailSession(store, client, '000000')).rejects.toMatchObject({
      status: 400,
      message: 'Invalid or expired verification code',
    });
    expect(urls).toEqual(['https://api.agrobridge.ge/api/verification/email/confirm']);
    expect(await store.get()).toBe('jwt-existing');
  });
});
