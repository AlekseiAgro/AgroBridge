import type { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import type { TokenStore } from './token-store';

/**
 * Session user kept by the app. Registration `role` is intentionally omitted:
 * one account can buy and sell, and the mobile UI must not present a permanent mode.
 */
export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  locale: string;
  avatarUrl: string | null;
};

export type AuthTokenResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: SessionUser & Record<string, unknown>;
};

export type SessionSnapshot = {
  status: 'anonymous' | 'authenticated';
  user: SessionUser | null;
  profileUnavailable: boolean;
};

const anonymous: SessionSnapshot = {
  status: 'anonymous',
  user: null,
  profileUnavailable: false,
};

export function toSessionUser(user: AuthTokenResponse['user']): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
    emailVerified: user.emailVerified,
    locale: user.locale,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export function loginWithPassword(
  client: ApiClient,
  email: string,
  password: string,
): Promise<AuthTokenResponse> {
  return client.request<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
}

export function fetchCurrentUser(client: ApiClient): Promise<AuthTokenResponse['user']> {
  return client.request<AuthTokenResponse['user']>('/auth/me');
}

export async function restoreSession(
  store: TokenStore,
  client: ApiClient,
): Promise<SessionSnapshot> {
  const token = await store.get();
  if (!token) {
    return anonymous;
  }
  try {
    const me = await fetchCurrentUser(client);
    return {
      status: 'authenticated',
      user: toSessionUser(me),
      profileUnavailable: false,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await store.clear();
      return anonymous;
    }
    return {
      status: 'authenticated',
      user: null,
      profileUnavailable: true,
    };
  }
}

export async function loginSession(
  store: TokenStore,
  client: ApiClient,
  email: string,
  password: string,
): Promise<SessionSnapshot> {
  const response = await loginWithPassword(client, email, password);
  await store.set(response.accessToken);
  return {
    status: 'authenticated',
    user: toSessionUser(response.user),
    profileUnavailable: false,
  };
}

export async function logoutSession(store: TokenStore): Promise<SessionSnapshot> {
  await store.clear();
  return anonymous;
}
