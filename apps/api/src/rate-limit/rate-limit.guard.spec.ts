import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { RateLimitExceededException } from './rate-limit-exceeded.exception';
import { RateLimitGuard } from './rate-limit.guard';
import { createTestRateLimit } from './rate-limit.test-utils';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function handler() {}
class controller {}

describe('RateLimitGuard', () => {
  const reflector = new Reflector();
  let policy: string | undefined;

  beforeEach(() => {
    policy = undefined;
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation(() => policy as unknown as string);
  });

  function guardWith(env: Record<string, string> = {}) {
    const { service } = createTestRateLimit(env);
    return new RateLimitGuard(reflector, service);
  }

  it('lets an undecorated route through untouched', async () => {
    const guard = guardWith();

    await expect(guard.canActivate(contextFor({ user: { id: 'u1' } }))).resolves.toBe(true);
  });

  it('allows normal use and only then answers 429', async () => {
    policy = 'placesAutocompletePerAccount';
    const guard = guardWith({
      RATE_LIMIT_PLACES_MAX: '3',
      RATE_LIMIT_PLACES_WINDOW_SEC: '60',
    });
    const context = contextFor({ user: { id: 'u1' }, ip: '203.0.113.9' });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(RateLimitExceededException);
  });

  it('counts each account separately, so one abuser cannot lock out an office', async () => {
    policy = 'placesAutocompletePerAccount';
    const guard = guardWith({
      RATE_LIMIT_PLACES_MAX: '1',
      RATE_LIMIT_PLACES_WINDOW_SEC: '60',
    });
    const shared = { ip: '203.0.113.9' };

    await guard.canActivate(contextFor({ ...shared, user: { id: 'noisy' } }));
    await expect(
      guard.canActivate(contextFor({ ...shared, user: { id: 'noisy' } })),
    ).rejects.toBeInstanceOf(RateLimitExceededException);
    // Same address, different account: unaffected.
    await expect(guard.canActivate(contextFor({ ...shared, user: { id: 'quiet' } }))).resolves.toBe(
      true,
    );
  });

  it('keeps separate budgets per policy', async () => {
    const { service } = createTestRateLimit({
      RATE_LIMIT_PLACES_MAX: '1',
      RATE_LIMIT_MEDIA_UPLOAD_MAX: '1',
    });
    const guard = new RateLimitGuard(reflector, service);
    const context = contextFor({ user: { id: 'u1' } });

    policy = 'placesAutocompletePerAccount';
    await expect(guard.canActivate(context)).resolves.toBe(true);
    policy = 'mediaUploadPerAccount';
    await expect(guard.canActivate(context)).resolves.toBe(true);
    policy = 'placesAutocompletePerAccount';
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(RateLimitExceededException);
  });

  it('falls back to the address when no account is attached', async () => {
    policy = 'chatMessagePerAccount';
    const guard = guardWith({ RATE_LIMIT_CHAT_MESSAGE_MAX: '1' });

    await expect(guard.canActivate(contextFor({ ip: '198.51.100.4' }))).resolves.toBe(true);
    await expect(guard.canActivate(contextFor({ ip: '198.51.100.4' }))).rejects.toBeInstanceOf(
      RateLimitExceededException,
    );
    await expect(guard.canActivate(contextFor({ ip: '198.51.100.5' }))).resolves.toBe(true);
  });

  it('tells the caller when to come back', async () => {
    policy = 'mediaUploadPerAccount';
    const guard = guardWith({
      RATE_LIMIT_MEDIA_UPLOAD_MAX: '1',
      RATE_LIMIT_MEDIA_UPLOAD_WINDOW_SEC: '120',
    });
    const context = contextFor({ user: { id: 'u1' } });

    await guard.canActivate(context);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      retryAfterSeconds: expect.any(Number),
    });
  });
});

describe('endpoint rate-limit policies', () => {
  const { limits } = createTestRateLimit();

  // Sized for the busiest plausible human session, not for the average one: a limit that
  // interrupts honest onboarding gets raised in a hurry and stops protecting anything.
  it.each([
    ['mediaUploadPerAccount', 100, 3600],
    ['chatMessagePerAccount', 60, 300],
    ['contentCreatePerAccount', 30, 3600],
    ['tradeActionPerAccount', 60, 3600],
    ['placesAutocompletePerAccount', 120, 600],
  ] as const)('%s allows %i per %i seconds by default', (name, limit, windowSec) => {
    expect(limits.policy(name)).toEqual({ limit, windowMs: windowSec * 1000 });
  });

  it('refuses a limit above the policy ceiling instead of silently widening it', () => {
    expect(() => createTestRateLimit({ RATE_LIMIT_PLACES_MAX: '999999' })).toThrow(
      /RATE_LIMIT_PLACES_MAX/,
    );
  });
});
