import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RateLimitHit, RateLimitStore } from './rate-limit.types';

/** Expired counters are pruned in the background at most this often, per process. */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
/** Keep expired rows around briefly so a prune never races an in-flight window. */
const CLEANUP_GRACE_MS = 60 * 60 * 1000;

/**
 * Counters live in Postgres rather than in process memory so that limits survive restarts
 * and are shared by every API replica. Postgres is already a hard dependency of every
 * protected endpoint (login, registration and verification all read or write user rows),
 * so this adds no new failure mode: if the database is down the request fails anyway and
 * the protection cannot be bypassed by taking the store offline.
 */
@Injectable()
export class PrismaRateLimitStore implements RateLimitStore {
  private readonly logger = new Logger(PrismaRateLimitStore.name);
  private lastCleanupAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Increments the counter for `key` and returns the new state. The whole read-modify-write
   * happens inside a single `INSERT ... ON CONFLICT DO UPDATE`, which Postgres serialises on
   * the conflicting row, so concurrent requests can never observe the same count twice.
   */
  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const window = `${Math.max(1, Math.ceil(windowMs))} milliseconds`;

    const rows = await this.prisma.$queryRaw<{ count: number; expiresAt: Date }[]>`
      INSERT INTO "rate_limit_counters" ("key", "count", "expiresAt", "createdAt", "updatedAt")
      VALUES (${key}, 1, NOW() + ${window}::interval, NOW(), NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "rate_limit_counters"."expiresAt" > NOW() THEN "rate_limit_counters"."count" + 1
          ELSE 1
        END,
        "expiresAt" = CASE
          WHEN "rate_limit_counters"."expiresAt" > NOW() THEN "rate_limit_counters"."expiresAt"
          ELSE NOW() + ${window}::interval
        END,
        "updatedAt" = NOW()
      RETURNING "count", "expiresAt"
    `;

    this.scheduleCleanup();

    const row = rows[0];
    return { count: Number(row.count), expiresAt: row.expiresAt };
  }

  async reset(key: string): Promise<void> {
    await this.prisma.rateLimitCounter.deleteMany({ where: { key } });
  }

  private scheduleCleanup() {
    const now = Date.now();
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) {
      return;
    }
    this.lastCleanupAt = now;
    void this.prisma.rateLimitCounter
      .deleteMany({ where: { expiresAt: { lt: new Date(now - CLEANUP_GRACE_MS) } } })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to prune expired rate-limit counters: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }
}
