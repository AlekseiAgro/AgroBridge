import type { ConfigService } from '@nestjs/config';
import { MemoryRateLimitStore } from './memory-rate-limit.store';
import { RateLimitConfig } from './rate-limit.config';
import { RateLimitService } from './rate-limit.service';

/**
 * Builds a real {@link RateLimitService} on in-process counters, so unit tests exercise the
 * production policy code (key derivation, limits, 429 mapping) instead of a stub that could
 * drift away from it. Only the storage layer is swapped; that part is covered separately by
 * the Postgres integration tests.
 */
export function createTestRateLimit(env: Record<string, string> = {}) {
  const config = {
    get: (key: string) => env[key],
  } as unknown as ConfigService;

  const store = new MemoryRateLimitStore();
  const limits = new RateLimitConfig(config);
  const service = new RateLimitService(store, limits, config);

  return { service, store, limits };
}
