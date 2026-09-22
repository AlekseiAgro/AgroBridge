import { BackupError, type BackupKind } from './types';

const ENV_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function assertBackupEnvironment(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!ENV_RE.test(normalized)) {
    throw new BackupError(
      'config',
      'BACKUP_ENVIRONMENT must be a lowercase hostname-safe label',
    );
  }
  return normalized;
}

export function objectPrefix(environment: string): string {
  return `${assertBackupEnvironment(environment)}`;
}

export function dumpObjectKey(params: {
  environment: string;
  kind: BackupKind;
  createdAt: Date;
}): string {
  const environment = assertBackupEnvironment(params.environment);
  const stamp = utcStamp(params.createdAt);
  return `${environment}/${params.kind}/agrobridge-${environment}-${stamp}.dump`;
}

export function metadataObjectKey(dumpKey: string): string {
  if (!dumpKey.endsWith('.dump') || dumpKey.includes('..') || dumpKey.startsWith('/')) {
    throw new BackupError('config', 'Invalid dump object key');
  }
  return dumpKey.replace(/\.dump$/, '.json');
}

export function manifestKey(environment: string): string {
  return `${objectPrefix(environment)}/manifest.json`;
}

export function latestKey(environment: string): string {
  return `${objectPrefix(environment)}/latest.json`;
}

export function resolveKinds(params: {
  kind: BackupKind;
  createdAt: Date;
}): BackupKind[] {
  if (params.kind === 'manual') {
    return ['manual'];
  }
  if (params.kind === 'weekly' || params.kind === 'monthly') {
    return [params.kind];
  }

  const kinds: BackupKind[] = ['daily'];
  const utcDay = params.createdAt.getUTCDay();
  const utcDate = params.createdAt.getUTCDate();
  if (utcDay === 0) {
    kinds.push('weekly');
  }
  if (utcDate === 1) {
    kinds.push('monthly');
  }
  return kinds;
}
