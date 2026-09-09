export const STORAGE_DRIVER = {
  LOCAL: 'local',
  S3: 's3',
} as const;

export type StorageDriver =
  (typeof STORAGE_DRIVER)[keyof typeof STORAGE_DRIVER];

/**
 * Whether an object may be addressed by a public URL.
 * Local public media uses `/api/uploads/{key}`.
 * S3/R2 public media uses `STORAGE_PUBLIC_BASE_URL/{key}` in a public bucket.
 * Private farm documents never receive a public URL.
 */
export const STORAGE_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
} as const;

export type StorageVisibility =
  (typeof STORAGE_VISIBILITY)[keyof typeof STORAGE_VISIBILITY];
