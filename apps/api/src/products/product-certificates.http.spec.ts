import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Readable } from 'stream';
import request from 'supertest';
import type { UserRole } from '@agrobridge/shared';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from '../ratings/ratings.service';
import { StorageService } from '../storage/storage.service';
import { UploadsController } from '../storage/uploads.controller';
import { CategoriesService } from '../categories/categories.service';
import { NotificationsService } from '../mail/notifications.service';
import { MarketInsightService } from './market-insight.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

const JWT_SECRET = 'test-secret';
const PRODUCT_ID = 'prod1';
const CERT_ID = 'cert1';
const CERT_KEY = 'products/prod1/certificates/9f0e.pdf';

type TestUser = {
  id: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
};

const USERS: Record<string, TestUser> = {
  owner: { id: 'owner1', role: 'farmer', emailVerifiedAt: new Date() },
  otherFarmer: { id: 'farmer2', role: 'farmer', emailVerifiedAt: new Date() },
  buyer: { id: 'buyer1', role: 'buyer', emailVerifiedAt: new Date() },
  admin: { id: 'admin1', role: 'admin', emailVerifiedAt: new Date() },
  unverified: { id: 'owner1', role: 'farmer', emailVerifiedAt: null },
};

describe('Product certificate file HTTP authorization', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const prisma = {
    user: { findUnique: jest.fn() },
    productCertificate: { findFirst: jest.fn() },
    harvestWatch: { findUnique: jest.fn() },
  };

  const storage = {
    openReadStream: jest.fn(),
    getDriver: jest.fn().mockReturnValue('local'),
    resolveLocalPath: jest.fn(),
  };

  function userRow(user: TestUser, key: string) {
    return {
      id: user.id,
      email: `${key}@example.com`,
      role: user.role,
      sellerType: null,
      buyerType: null,
      locale: 'en',
      displayName: key,
      avatarUrl: null,
      emailVerifiedAt: user.emailVerifiedAt,
      blockedAt: null,
      blockedReason: null,
      authVersion: 0,
    };
  }

  function tokenFor(key: keyof typeof USERS): string {
    const user = USERS[key];
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === user.id ? userRow(user, key) : null,
    );
    return jwt.sign({
      sub: user.id,
      email: `${key}@example.com`,
      role: user.role,
      locale: 'en',
      ver: 0,
    });
  }

  function pendingRow() {
    return {
      key: CERT_KEY,
      fileName: 'organic.pdf',
      mimeType: 'application/pdf',
      reviewStatus: 'pending',
      product: {
        ownerUserId: USERS.owner.id,
        isPublished: true,
        moderationStatus: 'approved',
      },
    };
  }

  function approvedRow() {
    return { ...pendingRow(), reviewStatus: 'approved' };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [ProductsController, UploadsController],
      providers: [
        JwtStrategy,
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: RatingsService, useValue: {} },
        { provide: CategoriesService, useValue: { enabledIds: jest.fn() } },
        { provide: NotificationsService, useValue: {} },
        { provide: MarketInsightService, useValue: { forProduct: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : undefined) },
        },
      ],
    }).compile();

    app = moduleRef.get(ProductsController) && moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = new JwtService({ secret: JWT_SECRET });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    storage.openReadStream.mockImplementation(() => Readable.from([Buffer.from('pdf-bytes')]));
    storage.getDriver.mockReturnValue('local');
  });

  it('returns 401 for an unauthenticated pending certificate', async () => {
    prisma.productCertificate.findFirst.mockResolvedValue(pendingRow());
    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}/file`)
      .expect(401);
    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('lets the owner download a pending certificate from private storage', async () => {
    prisma.productCertificate.findFirst.mockResolvedValue(pendingRow());
    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
      .expect(200);

    expect(storage.openReadStream).toHaveBeenCalledWith(CERT_KEY, 'private');
  });

  it('lets an admin download a pending certificate', async () => {
    prisma.productCertificate.findFirst.mockResolvedValue(pendingRow());
    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .expect(200);
  });

  it('does not let an unrelated farmer download a pending certificate', async () => {
    prisma.productCertificate.findFirst.mockResolvedValue(pendingRow());
    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('otherFarmer')}`)
      .expect(404);
    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('does not let a buyer download a pending certificate', async () => {
    prisma.productCertificate.findFirst.mockResolvedValue(pendingRow());
    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('buyer')}`)
      .expect(404);
  });

  it('lets an unauthenticated caller download an approved public certificate', async () => {
    prisma.productCertificate.findFirst.mockResolvedValue(approvedRow());
    const response = await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}/file`)
      .expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
    expect(storage.openReadStream).toHaveBeenCalledWith(CERT_KEY, 'private');
  });

  it('returns 404 for a guessed certificate id', async () => {
    prisma.productCertificate.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/guessed/file`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
      .expect(404);
    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('returns 404 for a certificate id on another product', async () => {
    prisma.productCertificate.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(`/api/products/other-product/certificates/${CERT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
      .expect(404);
  });

  it('rejects path-like certificate ids', async () => {
    await request(app.getHttpServer())
      .get('/api/products/prod1/certificates/..%2F..%2Fetc%2Fpasswd/file')
      .expect(404);
    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('does not expose certificates through the public uploads route', async () => {
    await request(app.getHttpServer())
      .get('/api/uploads/products/prod1/certificates/9f0e.pdf')
      .expect(404);
    expect(storage.openReadStream).not.toHaveBeenCalled();
    expect(storage.resolveLocalPath).not.toHaveBeenCalled();
  });

  it('does not let an unverified owner download a pending certificate', async () => {
    prisma.productCertificate.findFirst.mockResolvedValue(pendingRow());
    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('unverified')}`)
      .expect(403);
    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('treats a rejected certificate as private over HTTP', async () => {
    prisma.productCertificate.findFirst.mockResolvedValue({
      ...pendingRow(),
      reviewStatus: 'rejected',
    });
    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}/file`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('buyer')}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
      .expect(200);
  });

  it('rejects unauthenticated certificate mutations', async () => {
    await request(app.getHttpServer())
      .post(`/api/products/${PRODUCT_ID}/certificates`)
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/api/products/${PRODUCT_ID}/certificates/${CERT_ID}`)
      .expect(401);
  });
});
