import {
  STORAGE_DRIVER,
  STORAGE_VISIBILITY,
} from './storage.constants';
import {
  resolveObjectVisibility,
  resolveS3Buckets,
  resolveS3PublicBaseUrl,
  s3BucketForVisibility,
  storedObjectUrl,
  visibilityFromStorageKey,
} from './storage-location';

describe('visibilityFromStorageKey', () => {
  it('classifies farm verification documents as private', () => {
    expect(visibilityFromStorageKey('farms/farm1/documents/abc.pdf')).toBe(
      STORAGE_VISIBILITY.PRIVATE,
    );
  });

  it('classifies public marketplace media as public', () => {
    expect(visibilityFromStorageKey('farms/farm1/photos/a.jpg')).toBe(STORAGE_VISIBILITY.PUBLIC);
    expect(visibilityFromStorageKey('products/p1/a.jpg')).toBe(STORAGE_VISIBILITY.PUBLIC);
    expect(visibilityFromStorageKey('products/p1/videos/v.bin')).toBe(STORAGE_VISIBILITY.PUBLIC);
    expect(visibilityFromStorageKey('users/u1/avatar.jpg')).toBe(STORAGE_VISIBILITY.PUBLIC);
  });

  it('does not treat product certificates as farm verification documents', () => {
    expect(visibilityFromStorageKey('products/p1/certificates/c.pdf')).toBe(
      STORAGE_VISIBILITY.PUBLIC,
    );
  });
});

describe('resolveObjectVisibility', () => {
  it('forces farm verification keys to private even if a caller asks for public', () => {
    expect(
      resolveObjectVisibility('farms/farm1/documents/abc.pdf', STORAGE_VISIBILITY.PUBLIC),
    ).toBe(STORAGE_VISIBILITY.PRIVATE);
    expect(resolveObjectVisibility('farms/farm1/documents/abc.pdf')).toBe(
      STORAGE_VISIBILITY.PRIVATE,
    );
  });

  it('keeps public media on the public side', () => {
    expect(resolveObjectVisibility('farms/farm1/photos/a.jpg', STORAGE_VISIBILITY.PUBLIC)).toBe(
      STORAGE_VISIBILITY.PUBLIC,
    );
    expect(resolveObjectVisibility('products/p1/a.jpg')).toBe(STORAGE_VISIBILITY.PUBLIC);
  });
});

describe('storedObjectUrl', () => {
  it('never emits a public URL for private objects, including when a CDN base is set', () => {
    expect(
      storedObjectUrl({
        key: 'farms/farm1/documents/abc.pdf',
        visibility: STORAGE_VISIBILITY.PRIVATE,
        driver: STORAGE_DRIVER.LOCAL,
        publicBaseUrl: 'https://cdn.example.com',
      }),
    ).toBe('');
    expect(
      storedObjectUrl({
        key: 'farms/farm1/documents/abc.pdf',
        visibility: STORAGE_VISIBILITY.PRIVATE,
        driver: STORAGE_DRIVER.S3,
        publicBaseUrl: 'https://media.agrobridge.ge',
      }),
    ).toBe('');
  });

  it('keeps local public media on /api/uploads even if STORAGE_PUBLIC_BASE_URL is set', () => {
    expect(
      storedObjectUrl({
        key: 'farms/farm1/photos/a.jpg',
        visibility: STORAGE_VISIBILITY.PUBLIC,
        driver: STORAGE_DRIVER.LOCAL,
        publicBaseUrl: 'https://cdn.example.com',
      }),
    ).toBe('/api/uploads/farms/farm1/photos/a.jpg');
  });

  it('builds s3 public media as STORAGE_PUBLIC_BASE_URL/{key}', () => {
    expect(
      storedObjectUrl({
        key: 'products/p1/a.jpg',
        visibility: STORAGE_VISIBILITY.PUBLIC,
        driver: STORAGE_DRIVER.S3,
        publicBaseUrl: 'https://cdn.example.com',
      }),
    ).toBe('https://cdn.example.com/products/p1/a.jpg');
  });

  it('preserves existing object key structure in the public URL', () => {
    const keys = [
      'farms/farm1/photos/uuid.jpg',
      'products/product1/uuid.jpg',
      'products/product1/videos/uuid.bin',
      'users/user1/uuid.jpg',
    ];
    for (const key of keys) {
      const url = storedObjectUrl({
        key,
        visibility: STORAGE_VISIBILITY.PUBLIC,
        driver: STORAGE_DRIVER.S3,
        publicBaseUrl: 'https://cdn.example.com/',
      });
      expect(url).toBe(`https://cdn.example.com/${key}`);
      expect(url).not.toContain('/api/uploads/');
    }
  });
});

describe('resolveS3PublicBaseUrl', () => {
  it('requires a CDN origin and rejects /api/uploads', () => {
    expect(() => resolveS3PublicBaseUrl(undefined)).toThrow(/STORAGE_PUBLIC_BASE_URL/);
    expect(() => resolveS3PublicBaseUrl('https://api.example/api/uploads')).toThrow(
      /\/api\/uploads/,
    );
    expect(resolveS3PublicBaseUrl('https://cdn.example.com/')).toBe('https://cdn.example.com');
  });
});

describe('resolveS3Buckets', () => {
  it('uses S3_PUBLIC_BUCKET or legacy S3_BUCKET for public media', () => {
    expect(
      resolveS3Buckets({
        publicBucket: 'agrobridge-public',
        privateBucket: 'agrobridge-private',
      }),
    ).toEqual({
      publicBucket: 'agrobridge-public',
      privateBucket: 'agrobridge-private',
    });
    expect(
      resolveS3Buckets({
        legacyBucket: 'agrobridge-public',
        privateBucket: 'agrobridge-private',
      }).publicBucket,
    ).toBe('agrobridge-public');
  });

  it('requires a distinct private bucket', () => {
    expect(() => resolveS3Buckets({ publicBucket: 'one' })).toThrow(/S3_PRIVATE_BUCKET/);
    expect(() =>
      resolveS3Buckets({ publicBucket: 'shared', privateBucket: 'shared' }),
    ).toThrow(/different/);
  });

  it('selects agrobridge-public vs agrobridge-private from visibility', () => {
    const buckets = resolveS3Buckets({
      publicBucket: 'agrobridge-public',
      privateBucket: 'agrobridge-private',
    });
    expect(s3BucketForVisibility(STORAGE_VISIBILITY.PUBLIC, buckets)).toBe('agrobridge-public');
    expect(s3BucketForVisibility(STORAGE_VISIBILITY.PRIVATE, buckets)).toBe(
      'agrobridge-private',
    );
  });
});
