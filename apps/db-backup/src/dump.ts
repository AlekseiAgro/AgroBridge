import { chmod, mkdtemp, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ChildProcess } from 'child_process';
import { libpqEnvForSpawn, normalizeDatabaseUrl } from './database-url';
import { parsePostgresMajor, runCommand } from './process';
import { BackupError } from './types';
import { redactError } from './redact';

export type DumpResult = {
  dumpPath: string;
  tempDir: string;
  sizeBytes: number;
  pgDumpVersion: string;
};

export async function createTempWorkdir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'agrobridge-backup-'));
  await chmod(dir, 0o700);
  return dir;
}

export async function removeTempWorkdir(dir: string | undefined): Promise<void> {
  if (!dir) {
    return;
  }
  await rm(dir, { recursive: true, force: true });
}

export async function readPgDumpVersion(track?: Set<ChildProcess>): Promise<string> {
  const { stdout } = await runCommand({
    command: 'pg_dump',
    args: ['--version'],
    step: 'pg_dump',
    failureMessage: 'pg_dump is not available',
    track,
  });
  return stdout.trim();
}

export async function assertClientServerCompatible(params: {
  databaseUrl: string;
  pgDumpVersion: string;
  track?: Set<ChildProcess>;
}): Promise<void> {
  const clientMajor = parsePostgresMajor(params.pgDumpVersion);
  if (clientMajor === null) {
    throw new BackupError('pg_dump', 'Could not parse pg_dump version');
  }

  const { libpqEnv } = normalizeDatabaseUrl(params.databaseUrl);
  let serverText: string;
  try {
    const result = await runCommand({
      command: 'psql',
      args: ['-tAc', 'SHOW server_version'],
      env: libpqEnvForSpawn(libpqEnv),
      step: 'database',
      failureMessage: 'Could not read PostgreSQL server version',
      track: params.track,
    });
    serverText = result.stdout.trim();
  } catch (error) {
    throw new BackupError('database', redactError(error));
  }

  const serverMajor = parsePostgresMajor(serverText);
  if (serverMajor === null) {
    throw new BackupError('database', 'Could not parse PostgreSQL server version');
  }
  if (clientMajor < serverMajor) {
    throw new BackupError(
      'pg_dump',
      `pg_dump major ${clientMajor} is older than server major ${serverMajor}. Rebuild the backup image with a matching PG_DUMP_IMAGE_TAG / PG_CLIENT_MAJOR.`,
    );
  }
}

export async function createCustomDump(params: {
  databaseUrl: string;
  destDir: string;
  track?: Set<ChildProcess>;
}): Promise<DumpResult> {
  const dumpPath = join(params.destDir, 'backup.dump');
  const { libpqEnv } = normalizeDatabaseUrl(params.databaseUrl);
  const pgDumpVersion = await readPgDumpVersion(params.track);
  await assertClientServerCompatible({
    databaseUrl: params.databaseUrl,
    pgDumpVersion,
    track: params.track,
  });

  await runCommand({
    command: 'pg_dump',
    args: [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--compress=6',
      '--file',
      dumpPath,
    ],
    env: libpqEnvForSpawn(libpqEnv),
    step: 'pg_dump',
    failureMessage: 'pg_dump failed',
    track: params.track,
  });

  let sizeBytes: number;
  try {
    const info = await stat(dumpPath);
    sizeBytes = info.size;
  } catch (error) {
    throw new BackupError('file', `Dump file was not created: ${redactError(error)}`);
  }

  return { dumpPath, tempDir: params.destDir, sizeBytes, pgDumpVersion };
}

export async function listCustomDump(
  dumpPath: string,
  track?: Set<ChildProcess>,
): Promise<string> {
  const { stdout } = await runCommand({
    command: 'pg_restore',
    args: ['--list', dumpPath],
    step: 'pg_restore_list',
    failureMessage: 'pg_restore --list failed',
    track,
  });
  return stdout;
}

