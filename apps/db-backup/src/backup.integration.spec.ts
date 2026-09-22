/**
 * Optional Docker-backed check. Skipped unless BACKUP_INTEGRATION=1 and
 * pg_dump / pg_restore / docker are on PATH. Never uses production DATABASE_URL.
 */
import { execFileSync } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadBackupConfig } from './config';
import { runBackup } from './run-backup';
import { FilesystemBackupStore } from './storage';
import type { BackupManifest } from './types';

const enabled = process.env.BACKUP_INTEGRATION === '1';
const describeIntegration = enabled ? describe : describe.skip;

function commandExists(command: string): boolean {
  try {
    execFileSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describeIntegration('local postgres integration', () => {
  const container = `agrobridge-backup-itest-${process.pid}`;
  const port = String(26543 + (process.pid % 100));
  let databaseUrl: string;

  beforeAll(async () => {
    if (!commandExists('docker') || !commandExists('pg_dump') || !commandExists('pg_restore')) {
      throw new Error('docker, pg_dump, and pg_restore are required for BACKUP_INTEGRATION=1');
    }
    execFileSync('docker', [
      'run',
      '-d',
      '--rm',
      '--name',
      container,
      '-e',
      'POSTGRES_USER=agrobridge',
      '-e',
      'POSTGRES_PASSWORD=agrobridge',
      '-e',
      'POSTGRES_DB=agrobridge_backup_test',
      '-p',
      `${port}:5432`,
      'postgres:16-alpine',
    ]);
    databaseUrl = `postgresql://agrobridge:agrobridge@127.0.0.1:${port}/agrobridge_backup_test`;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        execFileSync(
          'docker',
          ['exec', container, 'pg_isready', '-U', 'agrobridge', '-d', 'agrobridge_backup_test'],
          { stdio: 'ignore' },
        );
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    execFileSync('docker', [
      'exec',
      container,
      'psql',
      '-U',
      'agrobridge',
      '-d',
      'agrobridge_backup_test',
      '-c',
      `CREATE TABLE farms(id text primary key, name text);
       INSERT INTO farms VALUES ('farm_1', 'Kartli Orchard');
       CREATE TABLE products(id text primary key, farm_id text, title text);
       INSERT INTO products VALUES ('p1', 'farm_1', 'Apple');`,
    ]);
  }, 60_000);

  afterAll(() => {
    try {
      execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
    } catch {
      // already removed
    }
  });

  it('creates a real custom dump, verifies it, and writes a local filesystem store', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agrobridge-backup-itest-'));
    try {
      const store = new FilesystemBackupStore(root);
      const result = await runBackup({
        config: loadBackupConfig({
          DATABASE_URL: databaseUrl,
          BACKUP_ENVIRONMENT: 'local',
          BACKUP_KIND: 'manual',
          BACKUP_STORAGE: 'fs',
          BACKUP_FS_ROOT: root,
          BACKUP_MIN_BYTES: '32',
        }),
        now: new Date('2026-09-22T12:00:00.000Z'),
        store,
      });
      expect(result.uploaded).toBe(true);
      expect(result.kinds).toEqual(['manual']);
      const dump = await readFile(join(root, result.dumpKey));
      expect(dump.length).toBe(result.sizeBytes);
      execFileSync('pg_restore', ['--list', join(root, result.dumpKey)], { stdio: 'pipe' });
      const manifest = JSON.parse(
        (await readFile(join(root, 'local/manifest.json'))).toString(),
      ) as BackupManifest;
      expect(manifest.backups[0]?.locked).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
