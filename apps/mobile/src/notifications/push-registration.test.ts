import { createMemoryPushRegistrationStore } from './push-registration-store';
import {
  createPushSyncGate,
  deviceCanRegisterIosPush,
  expoProjectId,
  permissionFromStatus,
  readExpoPushToken,
  releaseKnownPushToken,
  shouldSyncPushRegistration,
  syncPushRegistration,
} from './push-registration';

const user = { id: 'user-1', emailVerified: true };

function harness(overrides: Partial<Parameters<typeof syncPushRegistration>[0]> = {}) {
  const store = overrides.store ?? createMemoryPushRegistrationStore();
  const requestPermission = jest.fn(async () => 'granted' as const);
  const getToken = jest.fn(async () => 'ExponentPushToken[abc]');
  const register = jest.fn(async () => undefined);
  const options = {
    user,
    platform: 'ios',
    isPhysicalDevice: true,
    permission: 'granted' as const,
    requestPermission,
    getToken,
    store,
    register,
    ...overrides,
  };
  return { options, store, requestPermission, getToken, register };
}

describe('push registration service', () => {
  it('exists and skips a signed-out or unverified user', async () => {
    const signedOut = harness({ user: null });
    await expect(syncPushRegistration(signedOut.options)).resolves.toBe('skipped');
    expect(signedOut.requestPermission).not.toHaveBeenCalled();
    expect(signedOut.register).not.toHaveBeenCalled();

    const unverified = harness({ user: { id: 'user-1', emailVerified: false } });
    await expect(syncPushRegistration(unverified.options)).resolves.toBe('skipped');
    expect(unverified.register).not.toHaveBeenCalled();
  });

  it('does not register a non-iOS device or a simulator', async () => {
    expect(deviceCanRegisterIosPush('android', true)).toBe(false);
    expect(deviceCanRegisterIosPush('ios', false)).toBe(false);
    const android = harness({ platform: 'android' });
    await expect(syncPushRegistration(android.options)).resolves.toBe('skipped');
    expect(android.requestPermission).not.toHaveBeenCalled();
    expect(android.register).not.toHaveBeenCalled();
  });

  it('does not call the backend when permission is denied', async () => {
    const denied = harness({ permission: 'denied' });
    await expect(syncPushRegistration(denied.options)).resolves.toBe('skipped');
    expect(denied.requestPermission).not.toHaveBeenCalled();
    expect(denied.register).not.toHaveBeenCalled();
  });

  it('asks only when permission is undetermined, then registers the iOS token', async () => {
    const pending = harness({ permission: 'undetermined' });
    await expect(syncPushRegistration(pending.options)).resolves.toBe('registered');
    expect(pending.requestPermission).toHaveBeenCalledTimes(1);
    expect(pending.register).toHaveBeenCalledWith('ExponentPushToken[abc]');
    await expect(pending.store.get()).resolves.toEqual({
      token: 'ExponentPushToken[abc]',
      userId: 'user-1',
    });
  });

  it('does not ask again when permission is already granted', async () => {
    const granted = harness();
    await expect(syncPushRegistration(granted.options)).resolves.toBe('registered');
    expect(granted.requestPermission).not.toHaveBeenCalled();
    expect(granted.register).toHaveBeenCalledTimes(1);
  });

  it('skips a repeated registration of the same token for the same user', async () => {
    const store = createMemoryPushRegistrationStore({
      token: 'ExponentPushToken[abc]',
      userId: 'user-1',
    });
    const again = harness({ store });
    await expect(syncPushRegistration(again.options)).resolves.toBe('unchanged');
    expect(again.register).not.toHaveBeenCalled();
  });

  it('registers the same device token again for a different signed-in user', async () => {
    const store = createMemoryPushRegistrationStore({
      token: 'ExponentPushToken[abc]',
      userId: 'user-1',
    });
    const next = harness({ store, user: { id: 'user-2', emailVerified: true } });
    await expect(syncPushRegistration(next.options)).resolves.toBe('registered');
    expect(next.register).toHaveBeenCalledWith('ExponentPushToken[abc]');
    await expect(store.get()).resolves.toEqual({
      token: 'ExponentPushToken[abc]',
      userId: 'user-2',
    });
  });

  it('keeps the app usable when registration fails', async () => {
    const failed = harness({
      register: jest.fn(async () => {
        throw new Error('offline');
      }),
    });
    await expect(syncPushRegistration(failed.options)).resolves.toBe('failed');
    await expect(failed.store.get()).resolves.toBeNull();
  });

  it('unregisters the locally known token and then clears it', async () => {
    const store = createMemoryPushRegistrationStore({
      token: 'ExponentPushToken[abc]',
      userId: 'user-1',
    });
    const unregister = jest.fn(async () => undefined);
    const api = { request: jest.fn() };
    await releaseKnownPushToken({ api: api as never, store, unregister });
    expect(unregister).toHaveBeenCalledWith(api, 'ExponentPushToken[abc]');
    await expect(store.get()).resolves.toBeNull();
  });

  it('clears the local token even when unregister fails', async () => {
    const store = createMemoryPushRegistrationStore({
      token: 'ExponentPushToken[abc]',
      userId: 'user-1',
    });
    await expect(
      releaseKnownPushToken({
        api: { request: jest.fn() } as never,
        store,
        unregister: async () => {
          throw new Error('offline');
        },
      }),
    ).resolves.toBeUndefined();
    await expect(store.get()).resolves.toBeNull();
  });

  it('starts registration for a verified session in the foreground', () => {
    expect(
      shouldSyncPushRegistration({
        authStatus: 'authenticated',
        emailVerified: true,
        appState: 'active',
      }),
    ).toBe(true);
    expect(
      shouldSyncPushRegistration({
        authStatus: 'loading',
        emailVerified: true,
        appState: 'active',
      }),
    ).toBe(false);
    expect(
      shouldSyncPushRegistration({
        authStatus: 'anonymous',
        emailVerified: false,
        appState: 'active',
      }),
    ).toBe(false);
    expect(
      shouldSyncPushRegistration({
        authStatus: 'authenticated',
        emailVerified: false,
        appState: 'active',
      }),
    ).toBe(false);
    expect(
      shouldSyncPushRegistration({
        authStatus: 'authenticated',
        emailVerified: true,
        appState: 'background',
      }),
    ).toBe(false);
  });

  it('collapses overlapping registration attempts', async () => {
    const gate = createPushSyncGate();
    let release: () => void = () => undefined;
    const run = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve('done');
        }),
    );
    const first = gate(run);
    const second = gate(run);
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await expect(first).resolves.toBe('done');
    await expect(second).resolves.toBe('done');
  });
});

describe('Expo push token lookup', () => {
  it('maps permission status and reads a project id without inventing one', () => {
    expect(permissionFromStatus('granted')).toBe('granted');
    expect(permissionFromStatus('something-else')).toBe('denied');
    expect(expoProjectId(null)).toBeNull();
    expect(expoProjectId({ easConfig: { projectId: '  eas-project  ' } })).toBe('eas-project');
  });

  it('does not call Expo when the project id is missing and returns the token data otherwise', async () => {
    const notifications = {
      getExpoPushTokenAsync: jest.fn(async () => ({ data: ' ExponentPushToken[abc] ' })),
    };
    await expect(readExpoPushToken(notifications, null)).resolves.toBeNull();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();

    await expect(readExpoPushToken(notifications, 'eas-project', { type: 'ios', data: 'apns' })).resolves.toBe(
      'ExponentPushToken[abc]',
    );
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'eas-project',
      devicePushToken: { type: 'ios', data: 'apns' },
    });
  });

  it('returns null when Expo cannot provide a token', async () => {
    const notifications = {
      getExpoPushTokenAsync: jest.fn(async () => {
        throw new Error('no experience id');
      }),
    };
    await expect(readExpoPushToken(notifications, 'eas-project')).resolves.toBeNull();
  });
});
