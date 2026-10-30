export type StoredPushRegistration = {
  token: string;
  userId: string;
};

export type PushRegistrationStore = {
  get: () => Promise<StoredPushRegistration | null>;
  set: (value: StoredPushRegistration) => Promise<void>;
  clear: () => Promise<void>;
};

export function createMemoryPushRegistrationStore(
  initial: StoredPushRegistration | null = null,
): PushRegistrationStore {
  let current = initial;
  return {
    async get() {
      return current;
    },
    async set(value) {
      current = value;
    },
    async clear() {
      current = null;
    },
  };
}
