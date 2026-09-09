import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import type { PrismaClient, UserRole } from '@prisma/client';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaRateLimitStore } from '../rate-limit/prisma-rate-limit.store';
import { RateLimitConfig } from '../rate-limit/rate-limit.config';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestPrismaClient, describeWithDatabase } from '../test-support/database';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { hashPasswordResetToken, PasswordResetService } from './password-reset.service';
import { RESET_INVALID_MESSAGE } from './password-reset.constants';
import type { JwtPayload } from './auth.types';

describeWithDatabase()('PasswordResetService (database)', () => {
  let prisma: PrismaClient;
  const createdUserIds: string[] = [];
  const mailed: Array<{ email: string; rawToken: string }> = [];

  const notifications = {
    notifyPasswordReset: jest.fn(async (params: { email: string; rawToken: string }) => {
      mailed.push({ email: params.email, rawToken: params.rawToken });
    }),
  };

  function buildResetService(env: Record<string, string> = {}) {
    const config = { get: (key: string) => env[key] } as unknown as ConfigService;
    const store = new PrismaRateLimitStore(prisma as unknown as PrismaService);
    const rateLimit = new RateLimitService(store, new RateLimitConfig(config), config);
    return {
      reset: new PasswordResetService(
        prisma as unknown as PrismaService,
        rateLimit,
        notifications as unknown as NotificationsService,
        config,
      ),
      rateLimit,
      config,
    };
  }

  function buildAuthService(env: Record<string, string> = {}) {
    const config = {
      get: (key: string) => {
        if (key === 'JWT_EXPIRES_SECONDS') return '604800';
        return env[key];
      },
    } as unknown as ConfigService;
    const store = new PrismaRateLimitStore(prisma as unknown as PrismaService);
    const rateLimit = new RateLimitService(store, new RateLimitConfig(config), config);
    const jwtService = new JwtService({ secret: 'test-reset-secret' });
    return new AuthService(
      prisma as unknown as PrismaService,
      jwtService,
      config,
      { notifyWelcome: jest.fn() } as never,
      { sendEmailCode: jest.fn() } as never,
      rateLimit,
    );
  }

  function strategy() {
    return new JwtStrategy(
      { get: () => 'test-reset-secret' } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  }

  async function createUser(options: {
    role?: UserRole;
    emailVerified?: boolean;
    blocked?: boolean;
    password?: string;
    locale?: 'en' | 'ka' | 'ru';
  } = {}) {
    const password = options.password ?? 'password1';
    const user = await prisma.user.create({
      data: {
        email: `reset-${randomUUID()}@example.test`,
        role: options.role ?? 'farmer',
        passwordHash: await bcrypt.hash(password, 4),
        locale: options.locale ?? 'en',
        displayName: 'Test User',
        emailVerifiedAt: options.emailVerified === false ? null : new Date(),
        blockedAt: options.blocked ? new Date() : null,
        blockedReason: options.blocked ? 'This account has been blocked' : null,
      },
    });
    createdUserIds.push(user.id);
    return { ...user, password };
  }

  async function issuedTokenFor(email: string) {
    const last = [...mailed].reverse().find((item) => item.email === email);
    if (!last) {
      throw new Error(`no reset mail captured for ${email}`);
    }
    return last.rawToken;
  }

  beforeAll(async () => {
    prisma = createTestPrismaClient();
  });

  beforeEach(() => {
    mailed.length = 0;
    notifications.notifyPasswordReset.mockClear();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.rateLimitCounter.deleteMany({
      where: { key: { startsWith: 'auth.password-' } },
    });
    await prisma.$disconnect();
  });

  it('stores only a hash of the raw token', async () => {
    const { reset } = buildResetService();
    const user = await createUser();
    await reset.requestReset({ email: user.email }, '203.0.113.10');
    const raw = await issuedTokenFor(user.email);

    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(stored.tokenHash).toBe(hashPasswordResetToken(raw));
    expect(stored.tokenHash).not.toContain(raw);
    expect(stored.consumedAt).toBeNull();
  });

  it('answers the same body for existing and missing emails', async () => {
    const { reset } = buildResetService();
    const user = await createUser();
    const existing = await reset.requestReset({ email: user.email }, '203.0.113.11');
    const missing = await reset.requestReset({ email: 'missing@example.test' }, '203.0.113.12');
    expect(existing).toEqual({ ok: true });
    expect(missing).toEqual({ ok: true });
    expect(notifications.notifyPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('normalises email case and whitespace before lookup', async () => {
    const { reset } = buildResetService();
    const user = await createUser();
    await reset.requestReset({ email: ` ${user.email.toUpperCase()} ` }, '203.0.113.13');
    expect(await issuedTokenFor(user.email)).toBeDefined();
  });

  it('invalidates the previous token when a new reset is requested', async () => {
    const { reset } = buildResetService({ RATE_LIMIT_PASSWORD_RESET_COOLDOWN_SEC: '1' });
    const user = await createUser();
    await reset.requestReset({ email: user.email }, '203.0.113.14');
    const first = await issuedTokenFor(user.email);
    await wait(1100);
    await reset.requestReset({ email: user.email }, '203.0.113.14');
    const second = await issuedTokenFor(user.email);

    await expect(
      reset.resetPassword({ token: first, password: 'newpass12' }, '203.0.113.14'),
    ).rejects.toMatchObject({ message: RESET_INVALID_MESSAGE });

    await expect(
      reset.resetPassword({ token: second, password: 'newpass12' }, '203.0.113.14'),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects expired, invalid and already consumed tokens', async () => {
    const { reset } = buildResetService();
    const user = await createUser();
    await reset.requestReset({ email: user.email }, '203.0.113.15');
    const raw = await issuedTokenFor(user.email);

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      reset.resetPassword({ token: raw, password: 'newpass12' }, '203.0.113.15'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      reset.resetPassword({ token: 'x'.repeat(32), password: 'newpass12' }, '203.0.113.16'),
    ).rejects.toMatchObject({ message: RESET_INVALID_MESSAGE });

    const freshUser = await createUser();
    await reset.requestReset({ email: freshUser.email }, '203.0.113.17');
    const fresh = await issuedTokenFor(freshUser.email);
    await reset.resetPassword({ token: fresh, password: 'newpass12' }, '203.0.113.17');
    await expect(
      reset.resetPassword({ token: fresh, password: 'another12' }, '203.0.113.17'),
    ).rejects.toMatchObject({ message: RESET_INVALID_MESSAGE });
  });

  it('lets only one concurrent redemption of the same token succeed', async () => {
    const { reset } = buildResetService();
    const user = await createUser();
    await reset.requestReset({ email: user.email }, '203.0.113.18');
    const raw = await issuedTokenFor(user.email);

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        reset.resetPassword({ token: raw, password: `newpass${i}x` }, '203.0.113.18'),
      ),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(7);

    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.consumedAt).not.toBeNull();
  });

  it('increments authVersion, leaves role and verification alone, and kills old JWTs', async () => {
    const auth = buildAuthService();
    const { reset } = buildResetService();
    const user = await createUser({ role: 'buyer', emailVerified: true });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const login = await auth.login({ email: user.email, password: 'password1' }, '203.0.113.19');
    const oldPayload = decodePayload(login.accessToken);

    await reset.requestReset({ email: user.email }, '203.0.113.19');
    const raw = await issuedTokenFor(user.email);
    await reset.resetPassword({ token: raw, password: 'brandnew1' }, '203.0.113.19');

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.authVersion).toBe(before.authVersion + 1);
    expect(after.role).toBe('buyer');
    expect(after.emailVerifiedAt?.toISOString()).toBe(before.emailVerifiedAt?.toISOString());
    expect(after.blockedAt).toBeNull();
    expect(await bcrypt.compare('brandnew1', after.passwordHash ?? '')).toBe(true);

    await expect(strategy().validate(oldPayload)).rejects.toBeInstanceOf(UnauthorizedException);

    const nextLogin = await auth.login(
      { email: user.email, password: 'brandnew1' },
      '203.0.113.19',
    );
    await expect(strategy().validate(decodePayload(nextLogin.accessToken))).resolves.toMatchObject({
      id: user.id,
      role: 'buyer',
    });
  });

  it('works for farmer, admin and unverified accounts without changing those flags', async () => {
    const { reset } = buildResetService();
    for (const role of ['farmer', 'admin'] as UserRole[]) {
      const user = await createUser({ role, emailVerified: false });
      await reset.requestReset({ email: user.email }, '203.0.113.20');
      const raw = await issuedTokenFor(user.email);
      await reset.resetPassword({ token: raw, password: 'brandnew1' }, '203.0.113.20');
      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(after.role).toBe(role);
      expect(after.emailVerifiedAt).toBeNull();
    }
  });

  it('lets a blocked user reset a password but keeps the account blocked', async () => {
    const auth = buildAuthService();
    const { reset } = buildResetService();
    const user = await createUser({ blocked: true });
    await reset.requestReset({ email: user.email }, '203.0.113.21');
    const raw = await issuedTokenFor(user.email);
    await reset.resetPassword({ token: raw, password: 'brandnew1' }, '203.0.113.21');

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.blockedAt).not.toBeNull();
    await expect(
      auth.login({ email: user.email, password: 'brandnew1' }, '203.0.113.21'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      strategy().validate({
        sub: user.id,
        email: user.email,
        role: 'farmer',
        locale: 'en',
        ver: after.authVersion,
      }),
    ).rejects.toMatchObject({ message: 'This account has been blocked' });
  });

  it('invalidates other sessions after an authenticated password change', async () => {
    const auth = buildAuthService();
    const user = await createUser({ role: 'farmer' });
    const login = await auth.login({ email: user.email, password: 'password1' }, '203.0.113.22');
    const oldPayload = decodePayload(login.accessToken);

    const changed = await auth.changePassword(user.id, {
      currentPassword: 'password1',
      newPassword: 'changed99',
    });
    expect(changed.accessToken).toBeDefined();
    expect(JSON.stringify(changed.user)).not.toContain('password');

    await expect(strategy().validate(oldPayload)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(strategy().validate(decodePayload(changed.accessToken))).resolves.toMatchObject({
      id: user.id,
    });

    await expect(
      auth.login({ email: user.email, password: 'password1' }, '203.0.113.23'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.login({ email: user.email, password: 'changed99' }, '203.0.113.23'),
    ).resolves.toMatchObject({ user: expect.objectContaining({ id: user.id }) });
  });

  it('rejects a wrong current password without changing authVersion', async () => {
    const auth = buildAuthService();
    const user = await createUser();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    await expect(
      auth.changePassword(user.id, {
        currentPassword: 'wrongpass',
        newPassword: 'changed99',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.authVersion).toBe(before.authVersion);
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('does not leak hashes or tokens through reset responses', async () => {
    const { reset } = buildResetService();
    const user = await createUser();
    const accepted = await reset.requestReset({ email: user.email }, '203.0.113.25');
    const raw = await issuedTokenFor(user.email);
    const completed = await reset.resetPassword(
      { token: raw, password: 'brandnew1' },
      '203.0.113.25',
    );
    const serialized = JSON.stringify({ accepted, completed });
    expect(serialized).toBe(JSON.stringify({ accepted: { ok: true }, completed: { ok: true } }));
    expect(serialized).not.toContain(raw);
    expect(serialized).not.toContain(hashPasswordResetToken(raw));
  });
});

function decodePayload(token: string): JwtPayload {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as JwtPayload;
  return payload;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
