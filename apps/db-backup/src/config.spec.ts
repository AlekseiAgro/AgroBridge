import { loadBackupConfig } from './config';

describe('loadBackupConfig', () => {
  it('reads retention and timeout from the environment', () => {
    const config = loadBackupConfig({
      DATABASE_URL: 'postgresql://agrobridge:agrobridge@127.0.0.1:5432/agrobridge',
      BACKUP_KIND: 'manual',
      BACKUP_KEEP_DAILY: '9',
      BACKUP_TIMEOUT_MS: '120000',
      BACKUP_STORAGE: 'memory',
      BACKUP_ENVIRONMENT: 'local',
    });
    expect(config.kind).toBe('manual');
    expect(config.retention.keepDaily).toBe(9);
    expect(config.timeoutMs).toBe(120000);
    expect(config.storageDriver).toBe('memory');
  });

  it('does not read media S3_* variables', () => {
    const config = loadBackupConfig({
      DATABASE_URL: 'postgresql://agrobridge:agrobridge@127.0.0.1:5432/agrobridge',
      BACKUP_STORAGE: 'memory',
      S3_ACCESS_KEY_ID: 'media-key',
      S3_SECRET_ACCESS_KEY: 'media-secret',
      BACKUP_R2_ACCESS_KEY_ID: 'backup-key',
    });
    expect(config.r2.accessKeyId).toBe('backup-key');
    expect(JSON.stringify(config.r2)).not.toContain('media-key');
  });
});
