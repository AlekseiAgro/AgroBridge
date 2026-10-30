import { ApiClient } from '../api/client';
import { registerDevicePushToken, unregisterDevicePushToken } from './push-api';

const BASE = 'https://api.agrobridge.ge/api';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('push token API', () => {
  it('registers an iOS Expo token without a user id', async () => {
    let method = '';
    let url = '';
    let authorization = '';
    let body = '';
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: async () => 'jwt-1',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        method = init?.method ?? 'GET';
        url = String(input);
        const headers = init?.headers as Record<string, string>;
        authorization = headers.Authorization ?? '';
        body = String(init?.body ?? '');
        return json(201, { id: 'row-1', platform: 'ios' });
      },
    });

    await registerDevicePushToken(client, 'ExponentPushToken[abc]');

    expect(method).toBe('POST');
    expect(url).toBe('https://api.agrobridge.ge/api/push-tokens');
    expect(authorization).toBe('Bearer jwt-1');
    expect(JSON.parse(body)).toEqual({
      token: 'ExponentPushToken[abc]',
      platform: 'ios',
    });
    expect(JSON.parse(body)).not.toHaveProperty('userId');
  });

  it('unregisters only the supplied token', async () => {
    let method = '';
    let body = '';
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: async () => 'jwt-1',
      onUnauthorized: () => undefined,
      fetchImpl: async (_input, init) => {
        method = init?.method ?? 'GET';
        body = String(init?.body ?? '');
        return json(200, { ok: true });
      },
    });

    await unregisterDevicePushToken(client, 'ExponentPushToken[abc]');

    expect(method).toBe('DELETE');
    expect(JSON.parse(body)).toEqual({ token: 'ExponentPushToken[abc]' });
  });
});
