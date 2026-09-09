import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { StorageService } from './storage.service';

function localConfig(
  root: string,
  extra: Record<string, string | undefined> = {},
): ConfigService {
  return {
    get: (key: string) => {
      if (key in extra) return extra[key];
      if (key === 'STORAGE_DRIVER') return 'local';
      if (key === 'STORAGE_LOCAL_DIR') return root;
      if (key === 'API_PUBLIC_URL') return 'http://localhost:3001';
      return undefined;
    },
  } as ConfigService;
}

function s3Config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe('StorageService', () => {
  it('resolves local paths inside the uploads directory', () => {
    const root = join('/tmp', 'agrobridge-uploads-test');
    const service = new StorageService(localConfig(root));

    const absolute = service.resolveLocalPath('products/p1/a.jpg');
    expect(absolute.startsWith(root)).toBe(true);
  });

  it('rejects path traversal keys', () => {
    const root = join('/tmp', 'agrobridge-uploads-test');
    const service = new StorageService(localConfig(root));

    expect(() => service.resolveLocalPath('../secret.txt')).toThrow();
  });

  it('rejects path traversal when opening a read stream', async () => {
    const root = join('/tmp', 'agrobridge-uploads-test');
    const service = new StorageService(localConfig(root));

    await expect(service.openReadStream('farms/../../etc/passwd')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reports a missing local object as not found', async () => {
    const root = join('/tmp', 'agrobridge-uploads-test');
    const service = new StorageService(localConfig(root));

    await expect(
      service.openReadStream('farms/farm1/documents/does-not-exist.bin'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gives public objects a local /api/uploads URL', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agrobridge-uploads-'));
    const service = new StorageService(localConfig(root));
    try {
      const stored = await service.upload({
        buffer: Buffer.from('img'),
        mimeType: 'image/jpeg',
        originalName: 'farm.jpg',
        folder: 'farms/farm1/photos',
        visibility: 'public',
      });
      expect(stored.url).toBe(`/api/uploads/${stored.key}`);
      expect(stored.key).toMatch(/^farms\/farm1\/photos\/.+\.jpg$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not give private objects a public storage URL', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agrobridge-uploads-'));
    const service = new StorageService(localConfig(root));
    try {
      const stored = await service.upload({
        buffer: Buffer.from('%PDF'),
        mimeType: 'application/pdf',
        originalName: 'id-card.pdf',
        folder: 'farms/farm1/documents',
        visibility: 'private',
      });
      expect(stored.url).toBe('');
      expect(stored.url).not.toContain('/api/uploads/');
      expect(stored.key).toMatch(/^farms\/farm1\/documents\/.+\.pdf$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('ignores STORAGE_PUBLIC_BASE_URL and missing S3 credentials in local mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agrobridge-uploads-'));
    const service = new StorageService(
      localConfig(root, {
        STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
        S3_PUBLIC_BUCKET: undefined,
        S3_PRIVATE_BUCKET: undefined,
        S3_BUCKET: undefined,
        S3_ACCESS_KEY_ID: undefined,
        S3_SECRET_ACCESS_KEY: undefined,
      }),
    );
    try {
      const stored = await service.upload({
        buffer: Buffer.from('img'),
        mimeType: 'image/jpeg',
        originalName: 'avatar.jpg',
        folder: 'users/u1',
        visibility: 'public',
      });
      expect(stored.url).toBe(`/api/uploads/${stored.key}`);
      expect(stored.key).toMatch(/^users\/u1\/.+\.jpg$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('preserves public media key prefixes for photos, products, videos, and avatars', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agrobridge-uploads-'));
    const service = new StorageService(localConfig(root));
    try {
      const photo = await service.upload({
        buffer: Buffer.from('img'),
        mimeType: 'image/jpeg',
        originalName: 'farm.jpg',
        folder: 'farms/farm1/photos',
        visibility: 'public',
      });
      const image = await service.upload({
        buffer: Buffer.from('img'),
        mimeType: 'image/jpeg',
        originalName: 'product.jpg',
        folder: 'products/p1',
        visibility: 'public',
      });
      const video = await service.upload({
        buffer: Buffer.from('vid'),
        mimeType: 'video/mp4',
        originalName: 'clip.mp4',
        folder: 'products/p1/videos',
        visibility: 'public',
      });
      const avatar = await service.upload({
        buffer: Buffer.from('img'),
        mimeType: 'image/jpeg',
        originalName: 'me.jpg',
        folder: 'users/u1',
        visibility: 'public',
      });
      expect(photo.key).toMatch(/^farms\/farm1\/photos\/.+\.jpg$/);
      expect(image.key).toMatch(/^products\/p1\/.+\.jpg$/);
      expect(video.key).toMatch(/^products\/p1\/videos\/.+\.bin$/);
      expect(avatar.key).toMatch(/^users\/u1\/.+\.jpg$/);
      for (const stored of [photo, image, video, avatar]) {
        expect(stored.url).toBe(`/api/uploads/${stored.key}`);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not require R2 variables when STORAGE_DRIVER=local', () => {
    const service = new StorageService(localConfig('/tmp/agrobridge-uploads-test'));
    expect(service.getDriver()).toBe('local');
  });

  it('refuses s3 mode without a distinct private bucket or public origin', () => {
    expect(() =>
      new StorageService(
        s3Config({
          STORAGE_DRIVER: 's3',
          S3_PUBLIC_BUCKET: 'public-media',
          STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
        }),
      ),
    ).toThrow(/S3_PRIVATE_BUCKET/);

    expect(() =>
      new StorageService(
        s3Config({
          STORAGE_DRIVER: 's3',
          S3_BUCKET: 'shared',
          S3_PRIVATE_BUCKET: 'shared',
          STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
        }),
      ),
    ).toThrow(/different/);

    expect(() =>
      new StorageService(
        s3Config({
          STORAGE_DRIVER: 's3',
          S3_PUBLIC_BUCKET: 'public-media',
          S3_PRIVATE_BUCKET: 'private-docs',
        }),
      ),
    ).toThrow(/STORAGE_PUBLIC_BASE_URL/);

    expect(() =>
      new StorageService(
        s3Config({
          STORAGE_DRIVER: 's3',
          S3_PUBLIC_BUCKET: 'public-media',
          S3_PRIVATE_BUCKET: 'private-docs',
          STORAGE_PUBLIC_BASE_URL: 'https://agrobridge.ge/api/uploads',
        }),
      ),
    ).toThrow(/\/api\/uploads/);
  });

  it('accepts s3 mode when public and private buckets plus a CDN origin are set', () => {
    const service = new StorageService(
      s3Config({
        STORAGE_DRIVER: 's3',
        S3_PUBLIC_BUCKET: 'public-media',
        S3_PRIVATE_BUCKET: 'private-docs',
        STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
        S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
        S3_ACCESS_KEY_ID: 'id',
        S3_SECRET_ACCESS_KEY: 'secret',
      }),
    );
    expect(service.getDriver()).toBe('s3');
  });

  it('maps application/pdf to a .pdf extension', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agrobridge-uploads-'));
    const service = new StorageService(localConfig(root));
    try {
      const stored = await service.upload({
        buffer: Buffer.from('%PDF'),
        mimeType: 'application/pdf',
        originalName: 'scan',
        folder: 'farms/farm1/documents',
        visibility: 'private',
      });
      expect(stored.key.endsWith('.pdf')).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
