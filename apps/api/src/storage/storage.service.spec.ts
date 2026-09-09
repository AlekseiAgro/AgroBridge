import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { StorageService } from './storage.service';

function localConfig(root: string): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'STORAGE_DRIVER') return 'local';
      if (key === 'STORAGE_LOCAL_DIR') return root;
      if (key === 'API_PUBLIC_URL') return 'http://localhost:3001';
      return undefined;
    },
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
