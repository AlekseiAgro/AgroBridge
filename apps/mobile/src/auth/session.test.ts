import { ApiClient } from '../api/client';
import { createMemoryTokenStore } from './token-store';
import { loginSession, logoutSession, restoreSession } from './session';

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

  it('logout deletes the token and does not call the API', async () => {
    const store = createMemoryTokenStore('jwt-1');
    const snapshot = await logoutSession(store);
    expect(snapshot.status).toBe('anonymous');
    expect(await store.get()).toBeNull();
  });
});
