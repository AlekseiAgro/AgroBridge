import type { BackupKind, ManifestEntry, RetentionPlan, RetentionPolicy } from './types';

function newestFirst(entries: ManifestEntry[]): ManifestEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function planRetention(
  entries: ManifestEntry[],
  policy: RetentionPolicy,
): RetentionPlan {
  const keepIds = new Set<string>();

  for (const entry of entries) {
    if (entry.locked || entry.kinds.includes('manual')) {
      keepIds.add(entry.id);
    }
  }

  const counts: Record<Exclude<BackupKind, 'manual'>, number> = {
    daily: policy.keepDaily,
    weekly: policy.keepWeekly,
    monthly: policy.keepMonthly,
  };

  for (const kind of ['daily', 'weekly', 'monthly'] as const) {
    const matching = newestFirst(
      entries.filter((entry) => !entry.locked && entry.kinds.includes(kind)),
    );
    for (const entry of matching.slice(0, counts[kind])) {
      keepIds.add(entry.id);
    }
  }

  const keep: ManifestEntry[] = [];
  const expire: ManifestEntry[] = [];
  for (const entry of newestFirst(entries)) {
    if (keepIds.has(entry.id)) {
      keep.push(entry);
    } else {
      expire.push(entry);
    }
  }

  return { keep, expire };
}

export function emptyManifest(environment: string, updatedAt: Date): {
  version: 1;
  environment: string;
  updatedAt: string;
  backups: ManifestEntry[];
} {
  return {
    version: 1,
    environment,
    updatedAt: updatedAt.toISOString(),
    backups: [],
  };
}
