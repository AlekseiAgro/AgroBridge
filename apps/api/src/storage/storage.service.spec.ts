import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  it('resolves local paths inside the uploads directory', () => {
    const root = join('/tmp', 'agrobridge-uploads-test');
    const service = new StorageService(
      {
        get: (key: string) => {
          if (key === 'STORAGE_DRIVER') return 'local';
          if (key === 'STORAGE_LOCAL_DIR') return root;
          if (key === 'API_PUBLIC_URL') return 'http://localhost:3001';
          return undefined;
        },
      } as ConfigService,
    );

    const absolute = service.resolveLocalPath('products/p1/a.jpg');
    expect(absolute.startsWith(root)).toBe(true);
  });

  it('rejects path traversal keys', () => {
    const root = join('/tmp', 'agrobridge-uploads-test');
    const service = new StorageService(
      {
        get: (key: string) => {
          if (key === 'STORAGE_DRIVER') return 'local';
          if (key === 'STORAGE_LOCAL_DIR') return root;
          return undefined;
        },
      } as ConfigService,
    );

    expect(() => service.resolveLocalPath('../secret.txt')).toThrow();
  });
});
