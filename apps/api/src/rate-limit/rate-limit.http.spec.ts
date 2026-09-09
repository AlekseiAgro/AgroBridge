import { ValidationPipe } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { PasswordResetService } from '../auth/password-reset.service';
import type { MailService } from '../mail/mail.service';
import { SupportController } from '../support/support.controller';
import { SupportService } from '../support/support.service';
import { RateLimitExceededFilter } from './rate-limit-exceeded.filter';
import { createTestRateLimit } from './rate-limit.test-utils';

const CREDENTIALS = { email: 'victim@example.com', password: 'password1' };

const SUPPORT_REQUEST = {
  name: 'Nino',
  email: 'nino@example.com',
  subject: 'Catalog question',
  message: 'How do I publish a product?',
};

/**
 * Exercises the real HTTP pipeline: validation, the throttling services and the 429 filter.
 * `trustProxy` mirrors the production `trust proxy` setting, which decides whether an
 * `X-Forwarded-For` header is believed at all.
 */
async function buildApp(options: {
  trustProxy: number | string[];
  env?: Record<string, string>;
}): Promise<NestExpressApplication> {
  const { service: rateLimit } = createTestRateLimit(options.env ?? {});

  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };

  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController, SupportController],
    providers: [
      {
        provide: AuthService,
        useValue: new AuthService(
          prisma as never,
          { sign: () => 'token' } as unknown as JwtService,
          { get: () => undefined } as unknown as ConfigService,
          { notifyWelcome: jest.fn() } as never,
          { sendEmailCode: jest.fn() } as never,
          rateLimit,
        ),
      },
      {
        provide: PasswordResetService,
        useValue: {
          requestReset: jest.fn().mockResolvedValue({ ok: true }),
          resetPassword: jest.fn().mockResolvedValue({ ok: true }),
        },
      },
      {
        provide: SupportService,
        useValue: new SupportService(
          { send: jest.fn().mockResolvedValue(undefined) } as unknown as MailService,
          { get: () => undefined } as unknown as ConfigService,
          rateLimit,
        ),
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.set('trust proxy', options.trustProxy);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new RateLimitExceededFilter());
  await app.init();
  return app;
}

describe('rate limiting over HTTP', () => {
  let app: NestExpressApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('answers 429 with Retry-After once login attempts run out', async () => {
    app = await buildApp({ trustProxy: 0, env: { RATE_LIMIT_LOGIN_MAX: '2' } });
    const server = app.getHttpServer();

    await request(server).post('/api/auth/login').send(CREDENTIALS).expect(401);
    await request(server).post('/api/auth/login').send(CREDENTIALS).expect(401);

    const blocked = await request(server).post('/api/auth/login').send(CREDENTIALS).expect(429);

    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: 'Too many attempts. Try again later.',
    });
    // A 429 must not become an oracle for whether the account exists.
    expect(JSON.stringify(blocked.body)).not.toContain(CREDENTIALS.email);
  });

  it('answers 429 for a flood of support submissions', async () => {
    app = await buildApp({ trustProxy: 0, env: { RATE_LIMIT_SUPPORT_IP_MAX: '2' } });
    const server = app.getHttpServer();

    await request(server).post('/api/support').send(SUPPORT_REQUEST).expect(201);
    await request(server).post('/api/support').send(SUPPORT_REQUEST).expect(201);
    const blocked = await request(server).post('/api/support').send(SUPPORT_REQUEST).expect(429);

    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('separates clients by forwarded address when a proxy is trusted', async () => {
    app = await buildApp({ trustProxy: 1, env: { RATE_LIMIT_LOGIN_MAX: '1' } });
    const server = app.getHttpServer();

    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.1')
      .send(CREDENTIALS)
      .expect(401);
    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.1')
      .send(CREDENTIALS)
      .expect(429);

    // A genuinely different client behind the same proxy keeps its own budget.
    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.2')
      .send(CREDENTIALS)
      .expect(401);
  });

  it('resolves the visitor behind the BFF relay with the production trust list', async () => {
    // What a BFF request looks like once the web tier reaches us over the private network:
    // the peer is an address only our own infrastructure holds, and it relays exactly one
    // entry — the visitor it resolved.
    app = await buildApp({
      trustProxy: ['loopback', 'linklocal', 'uniquelocal'],
      env: { RATE_LIMIT_LOGIN_MAX: '1' },
    });
    const server = app.getHttpServer();

    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.1')
      .send(CREDENTIALS)
      .expect(401);
    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.1')
      .send(CREDENTIALS)
      .expect(429);

    // Another visitor relayed by the same web tier is counted separately.
    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.2')
      .send(CREDENTIALS)
      .expect(401);
  });

  it('reads past infrastructure hops when a relay adds its own address', async () => {
    // Compose puts Caddy in front, so the chain can still end in a private address.
    app = await buildApp({
      trustProxy: ['loopback', 'linklocal', 'uniquelocal'],
      env: { RATE_LIMIT_LOGIN_MAX: '1' },
    });
    const server = app.getHttpServer();

    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.1, 10.1.2.3')
      .send(CREDENTIALS)
      .expect(401);
    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.2, 10.1.2.3')
      .send(CREDENTIALS)
      .expect(401);
  });

  it('ignores entries a client prepended to the relayed address', async () => {
    app = await buildApp({
      trustProxy: ['loopback', 'linklocal', 'uniquelocal'],
      env: { RATE_LIMIT_LOGIN_MAX: '1' },
    });
    const server = app.getHttpServer();

    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.1')
      .send(CREDENTIALS)
      .expect(401);

    // Claiming to be someone else in front of the relayed entry buys nothing: the address
    // appended last still wins, so the attacker only ever spends its own budget.
    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '198.51.100.9, 203.0.113.1')
      .send(CREDENTIALS)
      .expect(429);
  });

  it('ignores a forged X-Forwarded-For when no proxy is trusted', async () => {
    app = await buildApp({ trustProxy: 0, env: { RATE_LIMIT_LOGIN_MAX: '2' } });
    const server = app.getHttpServer();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(server)
        .post('/api/auth/login')
        .set('X-Forwarded-For', `10.0.0.${attempt}`)
        .send(CREDENTIALS)
        .expect(401);
    }

    // Rotating the header must not hand the attacker a fresh budget.
    await request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.99')
      .send(CREDENTIALS)
      .expect(429);
  });

  it('rejects malformed payloads before spending any budget', async () => {
    app = await buildApp({ trustProxy: 0, env: { RATE_LIMIT_LOGIN_MAX: '1' } });
    const server = app.getHttpServer();

    await request(server)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'password1' })
      .expect(400);

    await request(server).post('/api/auth/login').send(CREDENTIALS).expect(401);
  });
});
