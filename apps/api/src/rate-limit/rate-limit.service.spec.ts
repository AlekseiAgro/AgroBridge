import type { ConfigService } from '@nestjs/config';
import { MemoryRateLimitStore } from './memory-rate-limit.store';
import { RateLimitConfig } from './rate-limit.config';
import { RateLimitExceededException } from './rate-limit-exceeded.exception';
import { RateLimitService } from './rate-limit.service';
import { createTestRateLimit } from './rate-limit.test-utils';

const POLICY = { limit: 2, windowMs: 60_000 };

describe('RateLimitService', () => {
  it('allows exactly the configured number of hits', async () => {
    const { service } = createTestRateLimit();
    const rule = { action: 'test', scope: { ip: '1.2.3.4' }, ...POLICY };

    await expect(service.consume([rule])).resolves.toBeUndefined();
    await expect(service.consume([rule])).resolves.toBeUndefined();
    await expect(service.consume([rule])).rejects.toBeInstanceOf(RateLimitExceededException);
  });

  it('reports a positive Retry-After', async () => {
    const { service } = createTestRateLimit();
    const rule = { action: 'test', scope: { ip: '1.2.3.4' }, limit: 1, windowMs: 60_000 };

    await service.consume([rule]);
    const error = (await service
      .consume([rule])
      .catch((e: unknown) => e)) as RateLimitExceededException;

    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(error.getStatus()).toBe(429);
  });

  it('keeps different actions, addresses and accounts apart', async () => {
    const { service } = createTestRateLimit();
    const spend = (rule: Parameters<RateLimitService['consume']>[0][number]) =>
      service.consume([rule]);

    await spend({ action: 'a', scope: { ip: '1.1.1.1' }, ...POLICY });
    await spend({ action: 'a', scope: { ip: '1.1.1.1' }, ...POLICY });

    await expect(spend({ action: 'a', scope: { ip: '1.1.1.1' }, ...POLICY })).rejects.toThrow();
    await expect(spend({ action: 'b', scope: { ip: '1.1.1.1' }, ...POLICY })).resolves.toBeUndefined();
    await expect(spend({ action: 'a', scope: { ip: '2.2.2.2' }, ...POLICY })).resolves.toBeUndefined();
    await expect(
      spend({ action: 'a', scope: { account: 'u1' }, ...POLICY }),
    ).resolves.toBeUndefined();
  });

  it('treats one account on two channels as two budgets', async () => {
    const { service } = createTestRateLimit();
    const rule = (channel: string) => ({
      action: 'send',
      scope: { account: 'u1', channel },
      limit: 1,
      windowMs: 60_000,
    });

    await service.consume([rule('email')]);
    await expect(service.consume([rule('email')])).rejects.toThrow();
    await expect(service.consume([rule('sms')])).resolves.toBeUndefined();
  });

  it('normalises email case, padding and IPv4-mapped addresses', async () => {
    const { service } = createTestRateLimit();
    const rule = (email: string, ip: string) => ({
      action: 'login',
      scope: { email, ip },
      limit: 1,
      windowMs: 60_000,
    });

    await service.consume([rule('User@Example.com', '::ffff:203.0.113.7')]);
    await expect(service.consume([rule(' user@example.com ', '203.0.113.7')])).rejects.toThrow();
  });

  it('survives absurd email input without widening the bucket', async () => {
    const { service } = createTestRateLimit();
    const long = `${'a'.repeat(5000)}@example.com`;
    const rule = { action: 'login', scope: { email: long, ip: '1.1.1.1' }, limit: 1, windowMs: 60_000 };

    await service.consume([rule]);
    await expect(service.consume([rule])).rejects.toBeInstanceOf(RateLimitExceededException);
  });

  it('never writes an email address or IP into the stored key', async () => {
    const { service, store } = createTestRateLimit({ JWT_SECRET: 'test-secret' });
    const hit = jest.spyOn(store, 'hit');

    await service.consume([
      { action: 'login', scope: { email: 'secret@example.com', ip: '203.0.113.7' }, ...POLICY },
    ]);

    const key = hit.mock.calls[0][0];
    expect(key).toContain('login:');
    expect(key).not.toContain('secret@example.com');
    expect(key).not.toContain('203.0.113.7');
  });

  it('derives different keys under different secrets', async () => {
    const scope = { action: 'login', scope: { email: 'a@example.com' }, ...POLICY };
    const keys = await Promise.all(
      ['secret-one', 'secret-two'].map(async (secret) => {
        const store = new MemoryRateLimitStore();
        const config = { get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined) } as unknown as ConfigService;
        const service = new RateLimitService(store, new RateLimitConfig(config), config);
        const hit = jest.spyOn(store, 'hit');
        await service.consume([scope]);
        return hit.mock.calls[0][0];
      }),
    );

    expect(keys[0]).not.toBe(keys[1]);
  });

  it('gives the budget back after a reset', async () => {
    const { service } = createTestRateLimit();
    const rule = { action: 'test', scope: { ip: '1.2.3.4' }, limit: 1, windowMs: 60_000 };

    await service.consume([rule]);
    await service.reset([rule]);
    await expect(service.consume([rule])).resolves.toBeUndefined();
  });
});

describe('RateLimitConfig', () => {
  const build = (env: Record<string, string>) =>
    new RateLimitConfig({ get: (key: string) => env[key] } as unknown as ConfigService);

  it('ships safe defaults', () => {
    const config = build({});
    expect(config.policy('loginPerAccount')).toEqual({ limit: 5, windowMs: 900_000 });
    expect(config.policy('codeSendPerAccount')).toEqual({ limit: 3, windowMs: 3_600_000 });
    expect(config.codeSendCooldown).toEqual({ limit: 1, windowMs: 60_000 });
    expect(config.codeMaxAttempts).toBe(5);
  });

  it('accepts deliberate overrides', () => {
    const config = build({ RATE_LIMIT_LOGIN_MAX: '8', RATE_LIMIT_LOGIN_WINDOW_SEC: '300' });
    expect(config.policy('loginPerAccount')).toEqual({ limit: 8, windowMs: 300_000 });
  });

  it('refuses a configuration that would disable the protection', () => {
    expect(() => build({ RATE_LIMIT_LOGIN_MAX: '0' })).toThrow(/RATE_LIMIT_LOGIN_MAX/);
    expect(() => build({ RATE_LIMIT_LOGIN_MAX: '-1' })).toThrow(/RATE_LIMIT_LOGIN_MAX/);
    expect(() => build({ RATE_LIMIT_LOGIN_MAX: '100000' })).toThrow(/RATE_LIMIT_LOGIN_MAX/);
    expect(() => build({ RATE_LIMIT_LOGIN_MAX: 'lots' })).toThrow(/RATE_LIMIT_LOGIN_MAX/);
    expect(() => build({ RATE_LIMIT_CODE_MAX_ATTEMPTS: '1000' })).toThrow(
      /RATE_LIMIT_CODE_MAX_ATTEMPTS/,
    );
  });

  it('summarises the effective limits without leaking secrets', () => {
    const summary = build({}).describe();
    expect(summary).toContain('loginPerAccount=5/900s');
    expect(summary).toContain('codeMaxAttempts=5');
  });
});
