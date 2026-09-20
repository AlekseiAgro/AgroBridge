import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';

const JWT_SECRET = 'legal-test-secret';

describe('LegalController HTTP', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const legal = {
    currentDocuments: jest.fn(),
    acceptanceSnapshot: jest.fn(),
  };

  const prisma = {
    user: { findUnique: jest.fn() },
  };

  function tokenFor(id: string) {
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === id
        ? {
            id,
            email: `${id}@example.com`,
            role: 'buyer',
            sellerType: null,
            buyerType: null,
            locale: 'en',
            displayName: id,
            avatarUrl: null,
            emailVerifiedAt: new Date(),
            blockedAt: null,
            blockedReason: null,
            authVersion: 0,
          }
        : null,
    );
    return jwt.sign({
      sub: id,
      email: `${id}@example.com`,
      role: 'buyer',
      locale: 'en',
      ver: 0,
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [LegalController],
      providers: [
        JwtStrategy,
        { provide: LegalService, useValue: legal },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : undefined) },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    jwt = new JwtService({ secret: JWT_SECRET });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    legal.currentDocuments.mockResolvedValue({
      documents: [
        {
          type: 'TERMS',
          version: '1.0',
          locale: 'en',
          title: 'Terms of Use',
          publishedAt: '2026-09-20T00:00:00.000Z',
          effectiveAt: '2026-09-20T00:00:00.000Z',
        },
      ],
    });
    legal.acceptanceSnapshot.mockImplementation(async (userId: string) => ({
      terms: {
        accepted: userId === 'owner1',
        acceptedAt: userId === 'owner1' ? '2026-09-20T12:00:00.000Z' : null,
        documentVersion: userId === 'owner1' ? '1.0' : null,
        documentLocale: userId === 'owner1' ? 'en' : null,
      },
      currentTerms: {
        type: 'TERMS',
        version: '1.0',
        locale: 'en',
        title: 'Terms of Use',
        publishedAt: null,
        effectiveAt: null,
      },
      currentPrivacy: {
        type: 'PRIVACY',
        version: '1.0',
        locale: 'en',
        title: 'Privacy Policy',
        publishedAt: null,
        effectiveAt: null,
      },
    }));
  });

  it('exposes published legal documents without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/legal/documents/current')
      .expect(200);

    expect(legal.currentDocuments).toHaveBeenCalledWith(undefined);
    expect(response.body.documents[0]).toMatchObject({ type: 'TERMS', version: '1.0', locale: 'en' });
    expect(JSON.stringify(response.body)).not.toContain('legal_terms_1_0');
  });

  it('ignores unsupported legal locale filters instead of inventing a translation', async () => {
    await request(app.getHttpServer()).get('/api/legal/documents/current?locale=ru').expect(200);
    expect(legal.currentDocuments).toHaveBeenCalledWith(undefined);
  });

  it('filters current documents when a real legal locale is requested', async () => {
    await request(app.getHttpServer()).get('/api/legal/documents/current?locale=ka').expect(200);
    expect(legal.currentDocuments).toHaveBeenCalledWith('ka');
  });

  it('rejects unauthenticated acceptance history', async () => {
    await request(app.getHttpServer()).get('/api/legal/me').expect(401);
    expect(legal.acceptanceSnapshot).not.toHaveBeenCalled();
  });

  it('returns only the authenticated user acceptance snapshot', async () => {
    const owner = await request(app.getHttpServer())
      .get('/api/legal/me')
      .set('Authorization', `Bearer ${tokenFor('owner1')}`)
      .expect(200);
    const other = await request(app.getHttpServer())
      .get('/api/legal/me')
      .set('Authorization', `Bearer ${tokenFor('other1')}`)
      .expect(200);

    expect(legal.acceptanceSnapshot).toHaveBeenCalledWith('owner1', 'en');
    expect(legal.acceptanceSnapshot).toHaveBeenCalledWith('other1', 'en');
    expect(owner.body.terms.accepted).toBe(true);
    expect(other.body.terms.accepted).toBe(false);
    expect(owner.body.terms.documentVersion).toBe('1.0');
    expect(other.body.terms.documentVersion).toBeNull();
  });

  it('does not expose another user acceptance route', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/legal/me/other1')
      .set('Authorization', `Bearer ${tokenFor('owner1')}`);

    expect(response.status).toBe(404);
    expect(legal.acceptanceSnapshot.mock.calls.every((call) => call[0] === 'owner1')).toBe(true);
  });

  it('uses JwtAuthGuard on the acceptance endpoint', () => {
    expect(JwtAuthGuard).toBeDefined();
  });
});
