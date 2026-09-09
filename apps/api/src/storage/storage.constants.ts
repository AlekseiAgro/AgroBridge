export const STORAGE_DRIVER = {
  LOCAL: 'local',
  S3: 's3',
} as const;

export type StorageDriver =
  (typeof STORAGE_DRIVER)[keyof typeof STORAGE_DRIVER];

/** Whether an object may be addressed by a public `/api/uploads` or CDN URL. */
export const STORAGE_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
} as const;

export type StorageVisibility =
  (typeof STORAGE_VISIBILITY)[keyof typeof STORAGE_VISIBILITY];
