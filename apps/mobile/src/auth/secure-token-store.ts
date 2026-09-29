import * as SecureStore from 'expo-secure-store';

import type { TokenStore } from './token-store';

const ACCESS_TOKEN_KEY = 'agrobridge.accessToken';

/** Device secure storage. Do not replace this with AsyncStorage. */
export function createSecureTokenStore(): TokenStore {
  return {
    get: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    set: (token) => SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token),
    clear: () => SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
  };
}
