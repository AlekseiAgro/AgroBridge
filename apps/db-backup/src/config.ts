import { assertBackupEnvironment } from './keys';
import { BackupError, BACKUP_KINDS, type BackupKind, type RetentionPolicy } from './types';

export type BackupStorageDriver = 's3' | 'fs' | 'memory';

export type BackupConfig = {
  databaseUrl: string;
  environment: string;
  kind: BackupKind;
  dryRun: boolean;
  minBytes: number;
  timeoutMs: number;
  retention: RetentionPolicy;
  storageDriver: BackupStorageDriver;
  fsRoot?: string;
  r2: {
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
    region: string;
  };
  alert: {
    resendApiKey?: string;
    email?: string;
    mailFrom?: string;
  };
};

function readInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new BackupError('config', `${key} must be a non-negative integer`);
  }
  return value;
}

function readKind(env: NodeJS.ProcessEnv): BackupKind {
  const raw = (env.BACKUP_KIND ?? 'daily').trim().toLowerCase();
  if (!BACKUP_KINDS.includes(raw as BackupKind)) {
    throw new BackupError('config', 'BACKUP_KIND must be daily, weekly, monthly, or manual');
  }
  return raw as BackupKind;
}

function readStorageDriver(env: NodeJS.ProcessEnv): BackupStorageDriver {
  const raw = (env.BACKUP_STORAGE ?? 's3').trim().toLowerCase();
  if (raw !== 's3' && raw !== 'fs' && raw !== 'memory') {
    throw new BackupError('config', 'BACKUP_STORAGE must be s3, fs, or memory');
  }
  return raw;
}

export function loadBackupConfig(env: NodeJS.ProcessEnv = process.env): BackupConfig {
  const databaseUrl = env.DATABASE_URL ?? '';
  if (!databaseUrl.trim()) {
    throw new BackupError('config', 'DATABASE_URL is required');
  }

  const storageDriver = readStorageDriver(env);
  const fsRoot = env.BACKUP_FS_ROOT?.trim();
  if (storageDriver === 'fs' && !fsRoot) {
    throw new BackupError('config', 'BACKUP_FS_ROOT is required when BACKUP_STORAGE=fs');
  }

  return {
    databaseUrl,
    environment: assertBackupEnvironment(env.BACKUP_ENVIRONMENT ?? 'production'),
    kind: readKind(env),
    dryRun: env.BACKUP_DRY_RUN === 'true',
    minBytes: readInt(env, 'BACKUP_MIN_BYTES', 1024),
    timeoutMs: readInt(env, 'BACKUP_TIMEOUT_MS', 10 * 60 * 1000),
    retention: {
      keepDaily: readInt(env, 'BACKUP_KEEP_DAILY', 7),
      keepWeekly: readInt(env, 'BACKUP_KEEP_WEEKLY', 4),
      keepMonthly: readInt(env, 'BACKUP_KEEP_MONTHLY', 3),
    },
    storageDriver,
    fsRoot,
    r2: {
      endpoint: env.BACKUP_R2_ENDPOINT?.trim() || undefined,
      accessKeyId: env.BACKUP_R2_ACCESS_KEY_ID?.trim() || undefined,
      secretAccessKey: env.BACKUP_R2_SECRET_ACCESS_KEY?.trim() || undefined,
      bucket: env.BACKUP_R2_BUCKET?.trim() || undefined,
      region: env.BACKUP_R2_REGION?.trim() || 'auto',
    },
    alert: {
      resendApiKey: env.RESEND_API_KEY?.trim() || undefined,
      email: env.BACKUP_ALERT_EMAIL?.trim() || undefined,
      mailFrom: env.MAIL_FROM?.trim() || undefined,
    },
  };
}
