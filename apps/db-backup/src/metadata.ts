import { createHash } from 'crypto';
import type { BackupKind, BackupMetadata, LatestPointer, ManifestEntry } from './types';

export function sha256Buffer(contents: Buffer): string {
  return createHash('sha256').update(contents).digest('hex');
}

export function buildMetadata(params: {
  createdAt: Date;
  environment: string;
  kind: BackupKind;
  kinds: BackupKind[];
  sizeBytes: number;
  sha256: string;
  pgDumpVersion: string;
  dumpKey: string;
  metadataKey: string;
  locked: boolean;
  retainUntil?: string;
}): BackupMetadata {
  return {
    createdAt: params.createdAt.toISOString(),
    environment: params.environment,
    kind: params.kind,
    kinds: params.kinds,
    sizeBytes: params.sizeBytes,
    sha256: params.sha256,
    pgDumpVersion: params.pgDumpVersion,
    databaseType: 'postgresql',
    dumpKey: params.dumpKey,
    metadataKey: params.metadataKey,
    locked: params.locked,
    ...(params.retainUntil ? { retainUntil: params.retainUntil } : {}),
  };
}

export function metadataToEntry(metadata: BackupMetadata): ManifestEntry {
  return {
    id: metadata.dumpKey,
    createdAt: metadata.createdAt,
    environment: metadata.environment,
    kinds: metadata.kinds,
    dumpKey: metadata.dumpKey,
    metadataKey: metadata.metadataKey,
    sizeBytes: metadata.sizeBytes,
    sha256: metadata.sha256,
    locked: metadata.locked,
    ...(metadata.retainUntil ? { retainUntil: metadata.retainUntil } : {}),
  };
}

export function metadataToLatest(metadata: BackupMetadata): LatestPointer {
  return {
    createdAt: metadata.createdAt,
    environment: metadata.environment,
    kind: metadata.kind,
    dumpKey: metadata.dumpKey,
    metadataKey: metadata.metadataKey,
    sizeBytes: metadata.sizeBytes,
    sha256: metadata.sha256,
  };
}
