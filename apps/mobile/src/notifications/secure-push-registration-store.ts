import * as SecureStore from 'expo-secure-store';

import type { PushRegistrationStore, StoredPushRegistration } from './push-registration-store';

const PUSH_REGISTRATION_KEY = 'agrobridge.devicePushToken';

function parseStored(raw: string | null): StoredPushRegistration | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { token?: unknown; userId?: unknown };
    if (typeof parsed.token === 'string' && parsed.token && typeof parsed.userId === 'string' && parsed.userId) {
      return { token: parsed.token, userId: parsed.userId };
    }
  } catch {
    return null;
  }
  return null;
}

/** Separate from the access-token key. The backend remains the source of truth. */
export function createSecurePushRegistrationStore(): PushRegistrationStore {
  return {
    async get() {
      return parseStored(await SecureStore.getItemAsync(PUSH_REGISTRATION_KEY));
    },
    set(value) {
      return SecureStore.setItemAsync(PUSH_REGISTRATION_KEY, JSON.stringify(value));
    },
    clear() {
      return SecureStore.deleteItemAsync(PUSH_REGISTRATION_KEY);
    },
  };
}

export const pushRegistrationStore = createSecurePushRegistrationStore();
