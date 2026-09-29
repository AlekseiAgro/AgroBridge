import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiClient } from '../api/client';
import { apiBaseUrlFromEnv } from '../api/config';
import {
  loginSession,
  logoutSession,
  restoreSession,
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
  logout: () => Promise<void>;
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

  const logout = async () => {
    applySnapshot(await logoutSession(store), setStatus, setUser, setProfileUnavailable);
  };

  const value = { status, user, profileUnavailable, login, logout, api };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
