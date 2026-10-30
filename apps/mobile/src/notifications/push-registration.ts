import type { ApiClient } from '../api/client';
import { unregisterDevicePushToken } from './push-api';
import type { PushRegistrationStore } from './push-registration-store';

export type PushPermission = 'undetermined' | 'granted' | 'denied';

export type PushSyncResult = 'skipped' | 'registered' | 'unchanged' | 'failed';

type PushUser = {
  id: string;
  emailVerified: boolean;
};

/** Remote iOS registration only. Android can be added later without changing this gate's shape. */
export function deviceCanRegisterIosPush(platform: string, isPhysicalDevice: boolean): boolean {
  return platform === 'ios' && isPhysicalDevice;
}

export function shouldSyncPushRegistration(input: {
  authStatus: 'loading' | 'anonymous' | 'authenticated';
  emailVerified: boolean;
  appState: 'active' | 'background' | 'inactive' | string;
}): boolean {
  return input.authStatus === 'authenticated' && input.emailVerified && input.appState === 'active';
}

export function permissionFromStatus(status: string): PushPermission {
  if (status === 'granted' || status === 'denied' || status === 'undetermined') {
    return status;
  }
  return 'denied';
}

export function expoProjectId(
  constants: {
    easConfig?: { projectId?: string } | null;
    expoConfig?: { extra?: { eas?: { projectId?: string } } } | null;
  } | null,
): string | null {
  const projectId = constants?.easConfig?.projectId ?? constants?.expoConfig?.extra?.eas?.projectId;
  const trimmed = projectId?.trim();
  return trimmed ? trimmed : null;
}

/** Does not call Expo when the project id is missing. That failure must not throw. */
export async function readExpoPushToken(
  notifications: {
    getExpoPushTokenAsync: (options: {
      projectId: string;
      devicePushToken?: { type: string; data: string };
    }) => Promise<{ data?: string }>;
  },
  projectId: string | null,
  devicePushToken?: { type: string; data: string },
): Promise<string | null> {
  if (!projectId) {
    return null;
  }
  try {
    const result = await notifications.getExpoPushTokenAsync({
      projectId,
      ...(devicePushToken ? { devicePushToken } : {}),
    });
    const token = result.data?.trim();
    return token ? token : null;
  } catch {
    return null;
  }
}

export async function syncPushRegistration(options: {
  user: PushUser | null;
  platform: string;
  isPhysicalDevice: boolean;
  permission: PushPermission;
  requestPermission: () => Promise<PushPermission>;
  getToken: () => Promise<string | null>;
  store: PushRegistrationStore;
  register: (token: string) => Promise<void>;
}): Promise<PushSyncResult> {
  if (!options.user?.emailVerified || !deviceCanRegisterIosPush(options.platform, options.isPhysicalDevice)) {
    return 'skipped';
  }
  if (options.permission === 'denied') {
    return 'skipped';
  }

  let permission: PushPermission = options.permission;
  if (permission === 'undetermined') {
    try {
      permission = await options.requestPermission();
    } catch {
      return 'failed';
    }
  }
  if (permission !== 'granted') {
    return 'skipped';
  }

  let token: string | null;
  try {
    token = await options.getToken();
  } catch {
    return 'failed';
  }
  if (!token) {
    return 'failed';
  }

  const stored = await options.store.get();
  if (stored?.token === token && stored.userId === options.user.id) {
    return 'unchanged';
  }

  try {
    await options.register(token);
  } catch {
    return 'failed';
  }
  await options.store.set({ token, userId: options.user.id });
  return 'registered';
}

/** DELETE the locally known token, then forget it. Logout continues if the request fails. */
export async function releaseKnownPushToken(options: {
  api: ApiClient;
  store: PushRegistrationStore;
  unregister?: (api: ApiClient, token: string) => Promise<unknown>;
}): Promise<void> {
  const current = await options.store.get();
  if (current?.token) {
    try {
      await (options.unregister ?? unregisterDevicePushToken)(options.api, current.token);
    } catch {
      // The next signed-in user re-registers this device. Logout must still finish.
    }
  }
  await options.store.clear();
}

export function createPushSyncGate() {
  let current: Promise<unknown> | null = null;
  return function enqueue<T>(run: () => Promise<T>): Promise<T> {
    if (current) {
      return current as Promise<T>;
    }
    const promise = run().finally(() => {
      if (current === promise) {
        current = null;
      }
    });
    current = promise;
    return promise;
  };
}

export const enqueuePushSync = createPushSyncGate();
