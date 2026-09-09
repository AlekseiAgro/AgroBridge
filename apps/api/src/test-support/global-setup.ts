import { PrismaClient } from '@prisma/client';
import { testDatabaseUrl } from './database';

/**
 * Probes the test database once so suites can decide synchronously whether to run.
 * Without this the integration tests would fail on machines that have no Postgres, and a
 * red suite that everyone learns to ignore is worse than an honest skip.
 */
export default async function globalSetup(): Promise<void> {
  const url = testDatabaseUrl();
  if (!url) {
    console.warn(
      '[jest] TEST_DATABASE_URL/DATABASE_URL not set — skipping database integration tests.',
    );
    return;
  }

  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    await client.$queryRaw`SELECT 1`;
    process.env.AGROBRIDGE_TEST_DB = '1';
  } catch (error) {
    console.warn(
      `[jest] Database at TEST_DATABASE_URL is unreachable (${
        error instanceof Error ? error.message.split('\n')[0] : String(error)
      }) — skipping database integration tests.`,
    );
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}
