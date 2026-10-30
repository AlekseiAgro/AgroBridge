import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { ApiClient } from '../api/client';
import { registerDevicePushToken } from './push-api';
import {
  deviceCanRegisterIosPush,
  enqueuePushSync,
  expoProjectId,
  permissionFromStatus,
  readExpoPushToken,
  syncPushRegistration,
} from './push-registration';
import { pushRegistrationStore } from './secure-push-registration-store';

type DevicePushToken = {
  type: string;
  data: string;
};

/**
 * Refreshes the Expo token after the native token changes.
 * The listener token is passed through so Expo does not ask for the device token again.
 */
export function subscribeIosPushTokenChanges(
  onChange: (devicePushToken: DevicePushToken) => void,
): { remove: () => void } {
  if (Platform.OS !== 'ios') {
    return { remove() {} };
  }
  return Notifications.addPushTokenListener((token) => {
    if (typeof token.data === 'string' && token.data) {
      onChange({ type: token.type, data: token.data });
    }
  });
}

/** Best-effort. Never throws, so login and startup stay usable when push setup fails. */
export async function syncInstalledPushRegistration(input: {
  api: ApiClient;
  user: { id: string; emailVerified: boolean } | null;
  devicePushToken?: DevicePushToken;
}): Promise<void> {
  if (!input.user?.emailVerified || !deviceCanRegisterIosPush(Platform.OS, Device.isDevice)) {
    return;
  }
  await enqueuePushSync(async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      await syncPushRegistration({
        user: input.user,
        platform: Platform.OS,
        isPhysicalDevice: Device.isDevice,
        permission: permissionFromStatus(current.status),
        requestPermission: async () => {
          const next = await Notifications.requestPermissionsAsync();
          return permissionFromStatus(next.status);
        },
        getToken: () =>
          readExpoPushToken(
            Notifications,
            expoProjectId(Constants),
            input.devicePushToken,
          ),
        store: pushRegistrationStore,
        register: async (token) => {
          await registerDevicePushToken(input.api, token);
        },
      });
    } catch {
      // Push registration is optional.
    }
  });
}
