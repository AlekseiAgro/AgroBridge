import type { ApiClient } from '../api/client';
import { parseMarkedNotification, parseNotificationList, parseUnreadCount, type AppNotification } from './inbox';

export const NOTIFICATION_LIST_LIMIT = 30;

export function listNotifications(api: ApiClient, limit = NOTIFICATION_LIST_LIMIT): Promise<AppNotification[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return api.request<unknown>(`/notifications?${params.toString()}`).then((body) => parseNotificationList(body));
}

export function getUnreadCount(api: ApiClient): Promise<number> {
  return api.request<unknown>('/notifications/unread-count').then((body) => parseUnreadCount(body));
}

export function markNotificationRead(api: ApiClient, id: string): Promise<AppNotification> {
  return api
    .request<unknown>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })
    .then((body) => parseMarkedNotification(body));
}

export function markAllNotificationsRead(api: ApiClient): Promise<{ ok: true }> {
  return api.request<unknown>('/notifications/read-all', { method: 'POST' }).then((body) => {
    if (!body || typeof body !== 'object' || (body as { ok?: unknown }).ok !== true) {
      throw new Error('Notifications were not marked read.');
    }
    return { ok: true };
  });
}
