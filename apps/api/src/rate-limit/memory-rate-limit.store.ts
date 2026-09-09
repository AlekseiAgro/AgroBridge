import type { RateLimitHit, RateLimitStore } from './rate-limit.types';

/**
 * In-process counters. Used by tests only — it is deliberately not registered in any module,
 * because per-replica counters would let an attacker multiply every limit by the number of
 * API instances. Production uses {@link PrismaRateLimitStore}.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, { count: number; expiresAt: number }>();

  hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = Date.now();
    const existing = this.entries.get(key);
    const entry =
      existing && existing.expiresAt > now
        ? { count: existing.count + 1, expiresAt: existing.expiresAt }
        : { count: 1, expiresAt: now + windowMs };
    this.entries.set(key, entry);
    return Promise.resolve({ count: entry.count, expiresAt: new Date(entry.expiresAt) });
  }

  reset(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }

  clear(): void {
    this.entries.clear();
  }
}
