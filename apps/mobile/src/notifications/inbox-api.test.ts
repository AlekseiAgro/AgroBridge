import { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from './inbox-api';

const BASE = 'https://api.agrobridge.ge/api';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const notification = {
  id: 'n1',
  type: 'harvestAvailable',
  productId: 'p1',
  title: 'Harvest is available',
  body: 'Green tea is ready.',
  href: '/products/p1',
  readAt: null,
  createdAt: '2026-10-02T10:00:00.000Z',
};

function client(fetchImpl: typeof fetch) {
  return new ApiClient({
    baseUrl: BASE,
    getAccessToken: async () => 'jwt-1',
    onUnauthorized: () => undefined,
    fetchImpl,
  });
}

describe('notification API', () => {
  it('loads the notification list with the bearer token', async () => {
    let method = '';
    let url = '';
    let authorization = '';
    const api = client(async (input, init) => {
      method = init?.method ?? 'GET';
      url = String(input);
      const headers = init?.headers as Record<string, string>;
      authorization = headers.Authorization ?? '';
      return json(200, [notification]);
    });

    const items = await listNotifications(api);

    expect(method).toBe('GET');
    expect(url).toBe('https://api.agrobridge.ge/api/notifications?limit=30');
    expect(authorization).toBe('Bearer jwt-1');
    expect(items[0]).toMatchObject({ id: 'n1', productId: 'p1', href: '/products/p1' });
    expect(JSON.stringify(items[0])).not.toContain('userId');
  });

  it('loads the unread count', async () => {
    let url = '';
    const api = client(async (input) => {
      url = String(input);
      return json(200, { count: 2, totalUnread: 2 });
    });

    await expect(getUnreadCount(api)).resolves.toBe(2);
    expect(url).toBe('https://api.agrobridge.ge/api/notifications/unread-count');
  });

  it('marks one notification read without sending a user id', async () => {
    let method = '';
    let url = '';
    let body = '';
    const api = client(async (input, init) => {
      method = init?.method ?? 'GET';
      url = String(input);
      body = typeof init?.body === 'string' ? init.body : '';
      return json(200, { ...notification, readAt: '2026-10-02T12:00:00.000Z' });
    });

    const updated = await markNotificationRead(api, 'n1');

    expect(method).toBe('POST');
    expect(url).toBe('https://api.agrobridge.ge/api/notifications/n1/read');
    expect(body).toBe('');
    expect(updated.readAt).toBe('2026-10-02T12:00:00.000Z');
  });

  it('marks every notification read', async () => {
    let url = '';
    const api = client(async (input, init) => {
      url = String(input);
      expect(init?.method).toBe('POST');
      return json(200, { ok: true });
    });

    await expect(markAllNotificationsRead(api)).resolves.toEqual({ ok: true });
    expect(url).toBe('https://api.agrobridge.ge/api/notifications/read-all');
  });

  it('surfaces an API error instead of an empty inbox', async () => {
    const api = client(async () => json(500, { message: 'Unavailable' }));

    await expect(listNotifications(api)).rejects.toBeInstanceOf(ApiError);
    await expect(getUnreadCount(api)).rejects.toBeInstanceOf(ApiError);
    await expect(markNotificationRead(api, 'n1')).rejects.toBeInstanceOf(ApiError);
    await expect(markAllNotificationsRead(api)).rejects.toBeInstanceOf(ApiError);
  });

  it('treats a failed mark-read response as unread', async () => {
    const api = client(async () => json(200, { ok: false }));

    await expect(markNotificationRead(api, 'missing')).rejects.toThrow('Notification was not marked read.');
  });
});
