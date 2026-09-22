export const BACKUP_KINDS = ['daily', 'weekly', 'monthly', 'manual'] as const;
export type BackupKind = (typeof BACKUP_KINDS)[number];

export type BackupEnvironment = string;

export type ManifestEntry = {
  id: string;
  createdAt: string;
  environment: string;
  kinds: BackupKind[];
  dumpKey: string;
  metadataKey: string;
  sizeBytes: number;
  sha256: string;
  locked: boolean;
  retainUntil?: string;
};

export type BackupManifest = {
  version: 1;
  environment: string;
  updatedAt: string;
  backups: ManifestEntry[];
};

export type LatestPointer = {
  createdAt: string;
  environment: string;
  kind: BackupKind;
  dumpKey: string;
  metadataKey: string;
  sizeBytes: number;
  sha256: string;
};

export type BackupMetadata = {
  createdAt: string;
  environment: string;
  kind: BackupKind;
  kinds: BackupKind[];
  sizeBytes: number;
  sha256: string;
  pgDumpVersion: string;
  databaseType: 'postgresql';
  dumpKey: string;
  metadataKey: string;
  retainUntil?: string;
  locked: boolean;
};

export type RetentionPolicy = {
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
};

export type RetentionPlan = {
  keep: ManifestEntry[];
  expire: ManifestEntry[];
};

export type ObjectHead = {
  key: string;
  sizeBytes: number;
};

export interface BackupObjectStore {
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  headObject(key: string): Promise<ObjectHead | null>;
  getObject(key: string): Promise<Buffer | null>;
  deleteObject(key: string): Promise<void>;
}

export type BackupFailureStep =
  | 'config'
  | 'database'
  | 'pg_dump'
  | 'file'
  | 'min_size'
  | 'checksum'
  | 'pg_restore_list'
  | 'upload'
  | 'upload_verify'
  | 'manifest'
  | 'retention'
  | 'timeout'
  | 'alert';

export type BackupFailurePayload = {
  createdAt: string;
  environment: string;
  failedStep: BackupFailureStep;
  message: string;
  sizeBytes?: number;
};

export type LibpqEnv = {
  PGHOST: string;
  PGPORT: string;
  PGUSER: string;
  PGPASSWORD: string;
  PGDATABASE: string;
  PGSSLMODE?: string;
  PGSSLROOTCERT?: string;
  PGSSLCERT?: string;
  PGSSLKEY?: string;
  PGSSLCRL?: string;
};

export class BackupError extends Error {
  readonly step: BackupFailureStep;
  readonly sizeBytes?: number;

  constructor(step: BackupFailureStep, message: string, sizeBytes?: number) {
    super(message);
    this.name = 'BackupError';
    this.step = step;
    this.sizeBytes = sizeBytes;
  }
}
