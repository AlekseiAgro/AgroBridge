export const STORAGE_DRIVER = {
  LOCAL: 'local',
  S3: 's3',
} as const;

export type StorageDriver =
  (typeof STORAGE_DRIVER)[keyof typeof STORAGE_DRIVER];
