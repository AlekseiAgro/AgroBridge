import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiClient } from '../api/client';
import { apiBaseUrlFromEnv } from '../api/config';
import { releaseKnownPushToken } from '../notifications/push-registration';
import { pushRegistrationStore } from '../notifications/secure-push-registration-store';
import {
  changePasswordSession,
  confirmEmailSession,
  loginSession,
  logoutSession,
  refreshAuthenticatedUser,
  registerSession,
  restoreSession,
  sendEmailCode,
  type EmailCodeSent,
  type RegisterRequest,
  type SessionSnapshot,
  type SessionUser,
} from './session';
import { createSecureTokenStore } from './secure-token-store';
import type { TokenStore } from './token-store';

type AuthStatus = 'loading' | SessionSnapshot['status'];

type AuthContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  profileUnavailable: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (
    body: RegisterRequest,
  ) => Promise<{ user: SessionUser; verificationEmailSent: boolean }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Reloads GET /auth/me into the current session. Keeps the existing access token. */
  refreshUser: () => Promise<SessionUser | null>;
  /** Confirms the email code, then refreshes the session user. Does not log in again. */
  confirmEmail: (code: string) => Promise<SessionUser>;
  /** Asks the API to email a new 6-digit code. No request body. */
  sendEmailCode: () => Promise<EmailCodeSent>;
  api: ApiClient;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultStore = createSecureTokenStore();

function applySnapshot(
  snapshot: SessionSnapshot,
  setStatus: (status: AuthStatus) => void,
  setUser: (user: SessionUser | null) => void,
  setProfileUnavailable: (value: boolean) => void,
) {
  setStatus(snapshot.status);
  setUser(snapshot.user);
  setProfileUnavailable(snapshot.profileUnavailable);
}

export function AuthProvider({
  children,
  store = defaultStore,
}: {
  children: ReactNode;
  store?: TokenStore;
}) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profileUnavailable, setProfileUnavailable] = useState(false);

  const api = useMemo(
    () =>
      new ApiClient({
        baseUrl: apiBaseUrlFromEnv(),
        getAccessToken: () => store.get(),
        onUnauthorized: async () => {
          await store.clear();
          await pushRegistrationStore.clear();
          setStatus('anonymous');
          setUser(null);
          setProfileUnavailable(false);
        },
      }),
    [store],
  );

  useEffect(() => {
    let cancelled = false;
    restoreSession(store, api)
      .then((snapshot) => {
        if (!cancelled) {
          applySnapshot(snapshot, setStatus, setUser, setProfileUnavailable);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('anonymous');
          setUser(null);
          setProfileUnavailable(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, store]);

  const login = async (email: string, password: string) => {
    const snapshot = await loginSession(store, api, email, password);
    applySnapshot(snapshot, setStatus, setUser, setProfileUnavailable);
    if (!snapshot.user) {
      throw new Error('Login did not return a user.');
    }
    return snapshot.user;
  };

  const register = async (body: RegisterRequest) => {
    const result = await registerSession(store, api, body);
    applySnapshot(result.snapshot, setStatus, setUser, setProfileUnavailable);
    if (!result.snapshot.user) {
      throw new Error('Registration did not return a user.');
    }
    return { user: result.snapshot.user, verificationEmailSent: result.verificationEmailSent };
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    applySnapshot(
      await changePasswordSession(store, api, { currentPassword, newPassword }),
      setStatus,
      setUser,
      setProfileUnavailable,
    );
  };

  const logout = async () => {
    await releaseKnownPushToken({ api, store: pushRegistrationStore });
    applySnapshot(await logoutSession(store), setStatus, setUser, setProfileUnavailable);
  };

  const refreshUser = async () => {
    const snapshot = await refreshAuthenticatedUser(store, api);
    if (snapshot.status !== 'authenticated' || !snapshot.user) {
      return null;
    }
    applySnapshot(snapshot, setStatus, setUser, setProfileUnavailable);
    return snapshot.user;
  };

  const confirmEmail = async (code: string) => {
    const snapshot = await confirmEmailSession(store, api, code);
    applySnapshot(snapshot, setStatus, setUser, setProfileUnavailable);
    if (!snapshot.user) {
      throw new Error('Email confirmation did not return a user.');
    }
    return snapshot.user;
  };

  const requestEmailCode = () => sendEmailCode(api);

  const value = {
    status,
    user,
    profileUnavailable,
    login,
    register,
    logout,
    changePassword,
    refreshUser,
    confirmEmail,
    sendEmailCode: requestEmailCode,
    api,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
