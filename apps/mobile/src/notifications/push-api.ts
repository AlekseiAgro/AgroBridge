import type { ApiClient } from '../api/client';

/** Registers this device for the signed-in user. The API rejects a client-supplied user id. */
export function registerDevicePushToken(api: ApiClient, token: string): Promise<unknown> {
  return api.request('/push-tokens', {
    method: 'POST',
    body: { token, platform: 'ios' },
  });
}

/** Removes this device token for the signed-in user only. */
export function unregisterDevicePushToken(api: ApiClient, token: string): Promise<unknown> {
  return api.request('/push-tokens', {
    method: 'DELETE',
    body: { token },
  });
}
