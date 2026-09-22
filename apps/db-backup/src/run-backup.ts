import { readFile } from 'fs/promises';
import type { ChildProcess } from 'child_process';
import type { BackupConfig } from './config';
import { createCustomDump, createTempWorkdir, removeTempWorkdir, type DumpResult } from './dump';
import { dumpObjectKey, latestKey, manifestKey, metadataObjectKey, resolveKinds } from './keys';
import {
  buildMetadata,
  metadataToEntry,
  metadataToLatest,
} from './metadata';
import { emptyManifest, planRetention } from './retention';
import { DryRunStore, FilesystemBackupStore, MemoryBackupStore } from './storage';
import { createS3BackupClient, requireS3Options, S3BackupStore } from './storage-s3';
import { verifyDumpFile, type VerifiedDump } from './verify';
import {
  BackupError,
  type BackupManifest,
  type BackupMetadata,
  type BackupObjectStore,
  type LatestPointer,
  type ManifestEntry,
} from './types';
import { logInfo } from './logger';

export type BackupRunResult = {
  dryRun: boolean;
  dumpKey: string;
  metadataKey: string;
  sizeBytes: number;
  sha256: string;
  kinds: BackupMetadata['kinds'];
  uploaded: boolean;
  expiredKeys: string[];
  plannedPuts?: string[];
  plannedDeletes?: string[];
};

function createLiveStore(config: BackupConfig): BackupObjectStore {
  if (config.storageDriver === 'memory') {
    return new MemoryBackupStore();
  }
  if (config.storageDriver === 'fs') {
    return new FilesystemBackupStore(config.fsRoot as string);
  }
  const options = requireS3Options(config.r2);
  return new S3BackupStore(createS3BackupClient(options), options.bucket);
}

export function createBackupStore(
  config: BackupConfig,
  inner?: BackupObjectStore,
): { store: BackupObjectStore; dryRunStore?: DryRunStore } {
  if (config.dryRun) {
    const dryRunStore = new DryRunStore(inner);
    return { store: dryRunStore, dryRunStore };
  }
  return { store: inner ?? createLiveStore(config) };
}

async function readJson<T>(store: BackupObjectStore, key: string): Promise<T | null> {
  const body = await store.getObject(key);
  if (!body) {
    return null;
  }
  return JSON.parse(body.toString('utf8')) as T;
}

async function writeJson(
  store: BackupObjectStore,
  key: string,
  value: unknown,
): Promise<void> {
  await store.putObject(key, Buffer.from(JSON.stringify(value, null, 2)), 'application/json');
}

async function verifyUploadedDump(
  store: BackupObjectStore,
  dumpKey: string,
  sizeBytes: number,
): Promise<void> {
  const head = await store.headObject(dumpKey);
  if (!head) {
    throw new BackupError('upload_verify', 'Uploaded dump object was not found', sizeBytes);
  }
  if (head.sizeBytes !== sizeBytes) {
    throw new BackupError(
      'upload_verify',
      `Uploaded dump size ${head.sizeBytes} does not match local size ${sizeBytes}`,
      sizeBytes,
    );
  }
}

export async function runBackup(params: {
  config: BackupConfig;
  now?: Date;
  store?: BackupObjectStore;
  track?: Set<ChildProcess>;
  createDump?: (input: {
    databaseUrl: string;
    destDir: string;
    track?: Set<ChildProcess>;
  }) => Promise<DumpResult>;
  verifyDump?: (input: {
    dumpPath: string;
    minBytes: number;
    track?: Set<ChildProcess>;
  }) => Promise<VerifiedDump>;
}): Promise<BackupRunResult> {
  const now = params.now ?? new Date();
  const created = createBackupStore(params.config, params.store);
  const store = created.store;
  const createDump = params.createDump ?? createCustomDump;
  const verifyDump = params.verifyDump ?? verifyDumpFile;
  const kinds = resolveKinds({ kind: params.config.kind, createdAt: now });
  const locked = params.config.kind === 'manual' || kinds.includes('manual');
  const dumpKey = dumpObjectKey({
    environment: params.config.environment,
    kind: params.config.kind,
    createdAt: now,
  });
  const metaKey = metadataObjectKey(dumpKey);

  let tempDir: string | undefined;
  try {
    tempDir = await createTempWorkdir();
    const dump = await createDump({
      databaseUrl: params.config.databaseUrl,
      destDir: tempDir,
      track: params.track,
    });
    const verified = await verifyDump({
      dumpPath: dump.dumpPath,
      minBytes: params.config.minBytes,
      track: params.track,
    });

    const metadata = buildMetadata({
      createdAt: now,
      environment: params.config.environment,
      kind: params.config.kind,
      kinds,
      sizeBytes: verified.sizeBytes,
      sha256: verified.sha256,
      pgDumpVersion: dump.pgDumpVersion,
      dumpKey,
      metadataKey: metaKey,
      locked,
    });

    const existing =
      (await readJson<BackupManifest>(store, manifestKey(params.config.environment))) ??
      emptyManifest(params.config.environment, now);
    const nextBackups: ManifestEntry[] = [
      ...existing.backups.filter((entry) => entry.dumpKey !== dumpKey),
      metadataToEntry(metadata),
    ];
    const plan = planRetention(nextBackups, params.config.retention);
    const expiredKeys = plan.expire.flatMap((entry) => [entry.dumpKey, entry.metadataKey]);

    if (params.config.dryRun) {
      const dumpBytes = await readFile(dump.dumpPath);
      await store.putObject(dumpKey, dumpBytes, 'application/octet-stream');
      await writeJson(store, metaKey, metadata);
      const latest = metadataToLatest(metadata);
      await writeJson(store, latestKey(params.config.environment), latest);
      const nextManifest: BackupManifest = {
        version: 1,
        environment: params.config.environment,
        updatedAt: now.toISOString(),
        backups: plan.keep,
      };
      await writeJson(store, manifestKey(params.config.environment), nextManifest);
      for (const key of expiredKeys) {
        await store.deleteObject(key);
      }

      logInfo(
        `dry-run: dump verified size=${verified.sizeBytes} sha256=${verified.sha256.slice(0, 12)}… key=${dumpKey}`,
      );
      logInfo(`dry-run: would upload ${dumpKey} and ${metaKey}`);
      if (expiredKeys.length) {
        logInfo(`dry-run: would delete ${expiredKeys.length} expired objects`);
      } else {
        logInfo('dry-run: no expired backups to delete');
      }

      return {
        dryRun: true,
        dumpKey,
        metadataKey: metaKey,
        sizeBytes: verified.sizeBytes,
        sha256: verified.sha256,
        kinds,
        uploaded: false,
        expiredKeys,
        plannedPuts: created.dryRunStore?.plannedPuts,
        plannedDeletes: created.dryRunStore?.plannedDeletes,
      };
    }

    const dumpBytes = await readFile(dump.dumpPath);
    await store.putObject(dumpKey, dumpBytes, 'application/octet-stream');
    await verifyUploadedDump(store, dumpKey, verified.sizeBytes);
    await writeJson(store, metaKey, metadata);

    for (const key of expiredKeys) {
      await store.deleteObject(key);
    }

    const nextManifest: BackupManifest = {
      version: 1,
      environment: params.config.environment,
      updatedAt: now.toISOString(),
      backups: plan.keep,
    };
    await writeJson(store, manifestKey(params.config.environment), nextManifest);
    await writeJson(
      store,
      latestKey(params.config.environment),
      metadataToLatest(metadata) satisfies LatestPointer,
    );

    logInfo(
      `backup uploaded size=${verified.sizeBytes} sha256=${verified.sha256.slice(0, 12)}… key=${dumpKey}`,
    );
    if (expiredKeys.length) {
      logInfo(`retention deleted ${expiredKeys.length} expired objects`);
    }

    return {
      dryRun: false,
      dumpKey,
      metadataKey: metaKey,
      sizeBytes: verified.sizeBytes,
      sha256: verified.sha256,
      kinds,
      uploaded: true,
      expiredKeys,
    };
  } finally {
    await removeTempWorkdir(tempDir);
  }
}
