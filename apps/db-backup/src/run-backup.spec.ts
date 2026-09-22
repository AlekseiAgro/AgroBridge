import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { BackupConfig } from './config';
import { runBackup } from './run-backup';
import { MemoryBackupStore } from './storage';
import type { BackupManifest } from './types';

function config(overrides: Partial<BackupConfig> = {}): BackupConfig {
  return {
    databaseUrl: 'postgresql://agrobridge:agrobridge@127.0.0.1:5432/agrobridge_backup_test',
    environment: 'production',
    kind: 'daily',
    dryRun: false,
    minBytes: 4,
    timeoutMs: 60_000,
    retention: { keepDaily: 2, keepWeekly: 1, keepMonthly: 1 },
    storageDriver: 'memory',
    r2: { region: 'auto' },
    alert: {},
    ...overrides,
  };
}

async function fakeDump(destDir: string, label: string) {
  await mkdir(destDir, { recursive: true });
  const dumpPath = join(destDir, 'backup.dump');
  await writeFile(dumpPath, Buffer.from(`DUMP-${label}`));
  return {
    dumpPath,
    tempDir: destDir,
    sizeBytes: `DUMP-${label}`.length,
    pgDumpVersion: 'pg_dump (PostgreSQL) 16.8',
  };
}

describe('runBackup', () => {
  it('uploads dump + metadata, writes manifest/latest, and verifies size', async () => {
    const store = new MemoryBackupStore();
    const now = new Date('2026-09-22T02:01:13.000Z');
    const result = await runBackup({
      config: config(),
      now,
      store,
      createDump: async ({ destDir }) => fakeDump(destDir, 'A'),
      verifyDump: async ({ dumpPath }) => {
        const body = await readFile(dumpPath);
        return { sizeBytes: body.length, sha256: 'aaa', restoreList: 'TOC' };
      },
    });

    expect(result.uploaded).toBe(true);
    expect(result.dumpKey).toBe('production/daily/agrobridge-production-20260922T020113Z.dump');
    expect(store.objects.has(result.dumpKey)).toBe(true);
    expect(store.objects.has(result.metadataKey)).toBe(true);
    const latest = JSON.parse(store.objects.get('production/latest.json')!.toString());
    expect(latest.dumpKey).toBe(result.dumpKey);
    const manifest = JSON.parse(store.objects.get('production/manifest.json')!.toString()) as BackupManifest;
    expect(manifest.backups).toHaveLength(1);
    expect(JSON.stringify(manifest)).not.toMatch(/postgresql:\/\//);
  });

  it('does not mutate remote objects in dry-run', async () => {
    const store = new MemoryBackupStore();
    await store.putObject('keep-me', Buffer.from('x'), 'text/plain');
    const result = await runBackup({
      config: config({ dryRun: true }),
      now: new Date('2026-09-22T03:00:00.000Z'),
      store,
      createDump: async ({ destDir }) => fakeDump(destDir, 'dry'),
      verifyDump: async ({ dumpPath }) => {
        const body = await readFile(dumpPath);
        return { sizeBytes: body.length, sha256: 'bbb', restoreList: 'TOC' };
      },
    });
    expect(result.dryRun).toBe(true);
    expect(result.uploaded).toBe(false);
    expect(result.plannedPuts?.length).toBeGreaterThan(0);
    expect(store.objects.get('keep-me')?.toString()).toBe('x');
    expect(store.objects.has(result.dumpKey)).toBe(false);
    expect(store.operations.filter((item) => item.startsWith('delete:'))).toEqual([]);
  });

  it('retains locked manual backups while expiring extra dailies', async () => {
    const store = new MemoryBackupStore();
    const existing: BackupManifest = {
      version: 1,
      environment: 'production',
      updatedAt: '2026-09-20T00:00:00.000Z',
      backups: [
        {
          id: 'old-daily',
          createdAt: '2026-09-20T02:00:00.000Z',
          environment: 'production',
          kinds: ['daily'],
          dumpKey: 'production/daily/old.dump',
          metadataKey: 'production/daily/old.json',
          sizeBytes: 8,
          sha256: 'old',
          locked: false,
        },
        {
          id: 'manual-keep',
          createdAt: '2026-01-01T00:00:00.000Z',
          environment: 'production',
          kinds: ['manual'],
          dumpKey: 'production/manual/keep.dump',
          metadataKey: 'production/manual/keep.json',
          sizeBytes: 8,
          sha256: 'man',
          locked: true,
        },
      ],
    };
    await store.putObject(
      'production/manifest.json',
      Buffer.from(JSON.stringify(existing)),
      'application/json',
    );
    await store.putObject('production/daily/old.dump', Buffer.from('olddump'), 'application/octet-stream');
    await store.putObject('production/daily/old.json', Buffer.from('{}'), 'application/json');
    await store.putObject('production/manual/keep.dump', Buffer.from('manual'), 'application/octet-stream');

    await runBackup({
      config: config({ kind: 'daily', retention: { keepDaily: 1, keepWeekly: 1, keepMonthly: 1 } }),
      now: new Date('2026-09-22T04:00:00.000Z'),
      store,
      createDump: async ({ destDir }) => fakeDump(destDir, 'NEW'),
      verifyDump: async ({ dumpPath }) => {
        const body = await readFile(dumpPath);
        return { sizeBytes: body.length, sha256: 'new', restoreList: 'TOC' };
      },
    });

    const manifest = JSON.parse(store.objects.get('production/manifest.json')!.toString()) as BackupManifest;
    expect(manifest.backups.map((item) => item.dumpKey)).toEqual(
      expect.arrayContaining([
        'production/manual/keep.dump',
        'production/daily/agrobridge-production-20260922T040000Z.dump',
      ]),
    );
    expect(manifest.backups.map((item) => item.dumpKey)).not.toContain('production/daily/old.dump');
    expect(store.objects.has('production/manual/keep.dump')).toBe(true);
    expect(store.objects.has('production/daily/old.dump')).toBe(false);
  });

  it('does not upload when verification fails', async () => {
    const store = new MemoryBackupStore();
    await expect(
      runBackup({
        config: config(),
        store,
        createDump: async ({ destDir }) => fakeDump(destDir, 'bad'),
        verifyDump: async () => {
          throw new Error('pg_restore --list failed');
        },
      }),
    ).rejects.toThrow(/pg_restore --list failed/);
    expect([...store.objects.keys()]).toEqual([]);
  });
});
