import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createTestPrismaClient, describeWithDatabase } from '../test-support/database';
import { PrismaRateLimitStore } from './prisma-rate-limit.store';
import type { PrismaService } from '../prisma/prisma.service';

describeWithDatabase()('PrismaRateLimitStore', () => {
  let prisma: PrismaClient;
  let store: PrismaRateLimitStore;
  const keys: string[] = [];

  function freshKey(): string {
    const key = `test:${randomUUID()}`;
    keys.push(key);
    return key;
  }

  beforeAll(() => {
    prisma = createTestPrismaClient();
    store = new PrismaRateLimitStore(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    await prisma.rateLimitCounter.deleteMany({ where: { key: { in: keys } } });
    await prisma.$disconnect();
  });

  it('counts sequential hits inside one window', async () => {
    const key = freshKey();
    expect((await store.hit(key, 60_000)).count).toBe(1);
    expect((await store.hit(key, 60_000)).count).toBe(2);
    expect((await store.hit(key, 60_000)).count).toBe(3);
  });

  it('keeps the original deadline while the window is open', async () => {
    const key = freshKey();
    const first = await store.hit(key, 60_000);
    const second = await store.hit(key, 60_000);
    expect(second.expiresAt.getTime()).toBe(first.expiresAt.getTime());
  });

  it('starts a new window once the old one has passed', async () => {
    const key = freshKey();
    await store.hit(key, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const afterExpiry = await store.hit(key, 60_000);
    expect(afterExpiry.count).toBe(1);
  });

  it('loses no increments when requests arrive at the same time', async () => {
    const key = freshKey();
    const concurrency = 25;

    const results = await Promise.all(
      Array.from({ length: concurrency }, () => store.hit(key, 60_000)),
    );

    // Every racer must get its own number; a read-then-write implementation would hand out
    // duplicates here and let an attacker exceed the limit by firing requests in parallel.
    const counts = results.map((result) => result.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: concurrency }, (_, index) => index + 1));

    const stored = await prisma.rateLimitCounter.findUnique({ where: { key } });
    expect(stored?.count).toBe(concurrency);
  });

  it('keeps separate keys independent', async () => {
    const a = freshKey();
    const b = freshKey();
    await store.hit(a, 60_000);
    await store.hit(a, 60_000);
    expect((await store.hit(b, 60_000)).count).toBe(1);
  });

  it('forgets a counter that was reset', async () => {
    const key = freshKey();
    await store.hit(key, 60_000);
    await store.hit(key, 60_000);
    await store.reset(key);
    expect((await store.hit(key, 60_000)).count).toBe(1);
  });

  it('survives a process restart because the state is in the database', async () => {
    const key = freshKey();
    await store.hit(key, 60_000);
    await store.hit(key, 60_000);

    const replica = new PrismaRateLimitStore(prisma as unknown as PrismaService);
    expect((await replica.hit(key, 60_000)).count).toBe(3);
  });
});
