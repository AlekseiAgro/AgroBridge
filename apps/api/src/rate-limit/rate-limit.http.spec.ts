import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
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
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PlacesController } from '../places/places.controller';
import { PlacesService } from '../places/places.service';
import { RateLimitExceededFilter } from './rate-limit-exceeded.filter';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
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
          { requirePublishedTerms: jest.fn() } as never,
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

/**
 * The endpoint limits are declarative: a policy name on the route plus `RateLimitGuard`
 * behind authentication. This drives a throttled route through the real HTTP pipeline —
 * guards, filter, headers — because the parts that can silently go wrong (guard ordering,
 * whether the account is on the request yet) only exist there.
 */
describe('endpoint rate limits over HTTP', () => {
  let app: NestExpressApplication;

  afterEach(async () => {
    await app?.close();
  });

  async function buildPlacesApp(
    accountId: string,
    env: Record<string, string>,
  ): Promise<NestExpressApplication> {
    const { service: rateLimit } = createTestRateLimit(env);

    const moduleRef = await Test.createTestingModule({
      controllers: [PlacesController],
      providers: [
        RateLimitGuard,
        { provide: RateLimitService, useValue: rateLimit },
        { provide: PlacesService, useValue: { autocomplete: jest.fn().mockResolvedValue([]) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = { id: accountId, role: 'farmer' };
          return true;
        },
      })
      .overrideGuard(EmailVerifiedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const built = moduleRef.createNestApplication<NestExpressApplication>();
    built.setGlobalPrefix('api');
    built.useGlobalFilters(new RateLimitExceededFilter());
    await built.init();
    return built;
  }

  it('serves normal autocomplete traffic and then answers 429', async () => {
    app = await buildPlacesApp('account-1', {
      RATE_LIMIT_PLACES_MAX: '3',
      RATE_LIMIT_PLACES_WINDOW_SEC: '600',
    });
    const server = app.getHttpServer();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(server).get('/api/places/autocomplete?q=tbi').expect(200);
    }

    const throttled = await request(server).get('/api/places/autocomplete?q=tbi').expect(429);
    expect(throttled.headers['retry-after']).toBeDefined();
    expect(throttled.body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts the authenticated account, not the address', async () => {
    app = await buildPlacesApp('account-1', { RATE_LIMIT_PLACES_MAX: '1' });
    const server = app.getHttpServer();

    await request(server)
      .get('/api/places/autocomplete?q=tbi')
      .set('X-Forwarded-For', '203.0.113.1')
      .expect(200);
    // A fresh address does not buy the same account a fresh budget.
    await request(server)
      .get('/api/places/autocomplete?q=tbi')
      .set('X-Forwarded-For', '203.0.113.2')
      .expect(429);
  });
});
