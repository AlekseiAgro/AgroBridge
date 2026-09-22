import { createHash } from 'crypto';
import { buildMetadata, metadataToEntry, sha256Buffer } from './metadata';

describe('backup metadata', () => {
  it('hashes contents with SHA-256', () => {
    expect(sha256Buffer(Buffer.from('agrobridge'))).toBe(
      createHash('sha256').update('agrobridge').digest('hex'),
    );
  });

  it('omits secrets and application data', () => {
    const metadata = buildMetadata({
      createdAt: new Date('2026-09-22T02:00:00Z'),
      environment: 'production',
      kind: 'daily',
      kinds: ['daily'],
      sizeBytes: 2048,
      sha256: 'abc',
      pgDumpVersion: 'pg_dump (PostgreSQL) 16.8',
      dumpKey: 'production/daily/x.dump',
      metadataKey: 'production/daily/x.json',
      locked: false,
    });
    const serialized = JSON.stringify(metadata);
    expect(serialized).not.toMatch(/DATABASE_URL|password|ACCESS_KEY|@/);
    expect(metadata.databaseType).toBe('postgresql');
    expect(metadataToEntry(metadata).id).toBe(metadata.dumpKey);
  });
});
