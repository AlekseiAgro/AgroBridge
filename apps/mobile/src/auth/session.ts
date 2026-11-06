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
  /** Present on registration. False when the account exists but the confirmation email was not sent. */
  verificationEmailSent?: boolean;
};

export type RegisterRequest = {
  email: string;
  password: string;
  role: 'farmer' | 'buyer';
  displayName?: string;
  locale: string;
  acceptTerms: true;
  acceptedTermsVersion: string;
  acceptedTermsLocale: 'ka' | 'en';
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

export type EmailCodeSent = {
  sent: true;
  destination: string;
};

/** Authenticated resend. The API accepts no body. */
export function sendEmailCode(client: ApiClient): Promise<EmailCodeSent> {
  return client.request<EmailCodeSent>('/verification/email/send-code', {
    method: 'POST',
  });
}

/** Authenticated confirm. The existing access token stays valid. */
export function confirmEmailCode(client: ApiClient, code: string): Promise<unknown> {
  return client.request('/verification/email/confirm', {
    method: 'POST',
    body: { code },
  });
}

/**
 * Reloads the signed-in user from GET /auth/me.
 * Does not write or replace the access token.
 */
export async function refreshAuthenticatedUser(
  store: TokenStore,
  client: ApiClient,
): Promise<SessionSnapshot> {
  const token = await store.get();
  if (!token) {
    return anonymous;
  }
  const me = await fetchCurrentUser(client);
  return {
    status: 'authenticated',
    user: toSessionUser(me),
    profileUnavailable: false,
  };
}

/**
 * Confirms the email code, then reloads the user so emailVerified matches the database.
 * The stored access token is left unchanged.
 */
export async function confirmEmailSession(
  store: TokenStore,
  client: ApiClient,
  code: string,
): Promise<SessionSnapshot> {
  await confirmEmailCode(client, code);
  const token = await store.get();
  if (!token) {
    throw new Error('Email confirmation lost the saved session.');
  }
  return refreshAuthenticatedUser(store, client);
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

export function registerAccount(
  client: ApiClient,
  body: RegisterRequest,
): Promise<AuthTokenResponse> {
  return client.request<AuthTokenResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body,
  });
}

export async function registerSession(
  store: TokenStore,
  client: ApiClient,
  body: RegisterRequest,
): Promise<{ snapshot: SessionSnapshot; verificationEmailSent: boolean }> {
  const response = await registerAccount(client, body);
  await store.set(response.accessToken);
  return {
    snapshot: {
      status: 'authenticated',
      user: toSessionUser(response.user),
      profileUnavailable: false,
    },
    verificationEmailSent: response.verificationEmailSent !== false,
  };
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

export async function changePasswordSession(
  store: TokenStore,
  client: ApiClient,
  body: { currentPassword: string; newPassword: string },
): Promise<SessionSnapshot> {
  const response = await client.request<AuthTokenResponse>('/auth/change-password', {
    method: 'POST',
    body,
    preserveSessionOn401: true,
  });
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
