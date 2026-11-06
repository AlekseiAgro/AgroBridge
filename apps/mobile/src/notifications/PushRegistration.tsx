import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { subscribeIosPushTokenChanges, syncInstalledPushRegistration } from './expo-push';
import { shouldSyncPushRegistration } from './push-registration';

/** Registers the iOS Expo token while a verified session is in the foreground. */
export function PushRegistration() {
  const { status, user, api } = useAuth();
  const emailVerified = user?.emailVerified === true;
  const active = shouldSyncPushRegistration({
    authStatus: status === 'loading' ? 'loading' : status,
    emailVerified,
    appState: 'active',
  });

  useEffect(() => {
    if (!active || !user) {
      return;
    }
    const sessionUser = user;
    const run = (devicePushToken?: { type: string; data: string }) => {
      void syncInstalledPushRegistration({
        api,
        user: sessionUser,
        devicePushToken,
      });
    };
    run();
    const appState = AppState.addEventListener('change', (next) => {
      if (
        shouldSyncPushRegistration({
          authStatus: 'authenticated',
          emailVerified: true,
          appState: next,
        })
      ) {
        run();
      }
    });
    const tokenChanges = subscribeIosPushTokenChanges((token) => {
      run(token);
    });
    return () => {
      appState.remove();
      tokenChanges.remove();
    };
  }, [active, api, user]);

  return null;
}
