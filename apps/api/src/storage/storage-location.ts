import {
  STORAGE_DRIVER,
  STORAGE_VISIBILITY,
  type StorageDriver,
  type StorageVisibility,
} from './storage.constants';

/** Farm verification objects live under this key prefix. All other keys are public media. */
const PRIVATE_DOCUMENT_KEY_RE = /(?:^|\/)farms\/[^/]+\/documents\//;

export function isPrivateFarmDocumentKey(key: string): boolean {
  return PRIVATE_DOCUMENT_KEY_RE.test(key);
}

export function visibilityFromStorageKey(key: string): StorageVisibility {
  return isPrivateFarmDocumentKey(key)
    ? STORAGE_VISIBILITY.PRIVATE
    : STORAGE_VISIBILITY.PUBLIC;
}

/**
 * Effective visibility for an object. Farm verification keys are always private so
 * they cannot be written to or read from the public media bucket.
 */
export function resolveObjectVisibility(
  key: string,
  requested?: StorageVisibility,
): StorageVisibility {
  if (isPrivateFarmDocumentKey(key)) {
    return STORAGE_VISIBILITY.PRIVATE;
  }
  return requested ?? STORAGE_VISIBILITY.PUBLIC;
}

/**
 * Public-media origin for `STORAGE_DRIVER=s3` (production: media.agrobridge.ge).
 * Must not include `/api/uploads` — that path is the local/legacy Web rewrite.
 * Private farm documents never use this origin.
 */
export function resolveS3PublicBaseUrl(raw?: string): string {
  const value = (raw ?? '').trim().replace(/\/$/, '');
  if (!value) {
    throw new Error('STORAGE_PUBLIC_BASE_URL is required when STORAGE_DRIVER=s3');
  }
  if (value.includes('/api/uploads')) {
    throw new Error(
      'STORAGE_PUBLIC_BASE_URL must be the public media origin (CDN/R2), not an /api/uploads path',
    );
  }
  return value;
}

export function storedObjectUrl(params: {
  key: string;
  visibility: StorageVisibility;
  driver: StorageDriver;
  publicBaseUrl: string;
}): string {
  if (params.visibility === STORAGE_VISIBILITY.PRIVATE) {
    return '';
  }
  if (params.driver === STORAGE_DRIVER.LOCAL) {
    return `/api/uploads/${params.key}`;
  }
  const base = params.publicBaseUrl.replace(/\/$/, '');
  if (!base) {
    throw new Error('STORAGE_PUBLIC_BASE_URL is required when STORAGE_DRIVER=s3');
  }
  return `${base}/${params.key}`;
}

export type S3BucketPair = {
  publicBucket: string;
  privateBucket: string;
};

/**
 * Public and private objects must never share a bucket. `S3_BUCKET` remains the
 * public-bucket fallback. Farm verification documents always use `S3_PRIVATE_BUCKET`.
 */
export function resolveS3Buckets(params: {
  publicBucket?: string;
  legacyBucket?: string;
  privateBucket?: string;
}): S3BucketPair {
  const publicBucket = (params.publicBucket ?? params.legacyBucket ?? '').trim();
  const privateBucket = (params.privateBucket ?? '').trim();

  if (!publicBucket) {
    throw new Error('S3_PUBLIC_BUCKET or S3_BUCKET is required when STORAGE_DRIVER=s3');
  }
  if (!privateBucket) {
    throw new Error('S3_PRIVATE_BUCKET is required when STORAGE_DRIVER=s3');
  }
  if (publicBucket === privateBucket) {
    throw new Error('S3_PRIVATE_BUCKET must be different from the public media bucket');
  }

  return { publicBucket, privateBucket };
}

export function s3BucketForVisibility(
  visibility: StorageVisibility,
  buckets: S3BucketPair,
): string {
  return visibility === STORAGE_VISIBILITY.PRIVATE
    ? buckets.privateBucket
    : buckets.publicBucket;
}
