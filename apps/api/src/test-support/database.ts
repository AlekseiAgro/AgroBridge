import { PrismaClient } from '@prisma/client';

/**
 * Integration tests need a real Postgres because the security-critical guarantees here —
 * atomic counter increments and the per-challenge attempt cap — are enforced by SQL, not by
 * application code. Point `TEST_DATABASE_URL` at a throwaway database; `DATABASE_URL` is
 * used as a fallback for local runs.
 */
export function testDatabaseUrl(): string | undefined {
  return process.env.TEST_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
}

/** Set by the Jest global setup once it has confirmed the database answers. */
export const hasTestDatabase = () => process.env.AGROBRIDGE_TEST_DB === '1';

/** Runs the suite only when a database is reachable, instead of failing the whole run. */
export const describeWithDatabase = () => (hasTestDatabase() ? describe : describe.skip);

export function createTestPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: testDatabaseUrl() } },
    log: [],
  });
}
