import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { NotFoundException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { UserRole } from '@agrobridge/shared';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

const JWT_SECRET = 'test-secret';
const PRODUCT_ID = 'prod1';

type TestUser = {
  id: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
};

const USERS: Record<string, TestUser> = {
  admin: { id: 'admin1', role: 'admin', emailVerifiedAt: new Date() },
  buyer: { id: 'buyer1', role: 'buyer', emailVerifiedAt: new Date() },
  farmer: { id: 'farmer1', role: 'farmer', emailVerifiedAt: new Date() },
  unverifiedAdmin: { id: 'admin2', role: 'admin', emailVerifiedAt: null },
};

const pendingDetail = {
  id: PRODUCT_ID,
  title: 'Kakheti hazelnuts',
  description: 'Export grade',
  category: 'nuts',
  variety: 'Anakliuri',
  country: 'Georgia',
  originPlace: 'Gurjaani',
  unit: 'kg',
  minQuantity: 100,
  maxQuantity: 5000,
  currentStock: 800,
  monthlyProduction: 200,
  maxAnnualProduction: 4000,
  seasonMonths: [8, 9],
  harvestStartAt: null,
  harvestEndAt: null,
  forecastQuantity: null,
  harvestStatus: null,
  preorderEnabled: false,
  attributes: { organic: true, caliber: '13-15' },
  packagingTypes: ['bag'],
  packagingWeights: ['25 kg'],
  palletSize: null,
  incoterms: ['EXW'],
  carriers: [],
  customDelivery: null,
  nearestPort: 'Poti',
  deliveryAvailable: true,
  leadTimeDays: 7,
  priceFrom: 4.2,
  priceCurrency: 'USD',
  priceNegotiable: true,
  priceDependsOnVolume: true,
  isPublished: false,
  moderationStatus: 'pending',
  moderationNote: null,
  images: [
    {
      id: 'img1',
      url: '/api/uploads/products/prod1/photo.jpg',
      sortOrder: 0,
      isPrimary: true,
      kind: 'photo',
    },
  ],
  videoCount: 0,
  certificateBadges: [],
  qualityScore: { score: 40, tier: 'basic', missing: [] },
  opportunity: { kind: 'none' },
  ownerUserId: 'farmer1',
  owner: { id: 'farmer1', displayName: 'Nino' },
  sellerRating: { average: null, count: 0 },
  farm: {
    id: 'farm1',
    name: 'Kakheti Farm',
    region: 'kakheti',
    verificationStatus: 'approved',
    verified: true,
    foundedYear: 2012,
    farmSizeHectares: 12,
    ownershipType: 'family',
    exportMarkets: ['DE'],
    history: 'Family orchard',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  videos: [],
  certificates: [],
};

const approvedListItem = {
  id: PRODUCT_ID,
  title: 'Kakheti hazelnuts',
  description: 'Export grade',
  category: 'nuts',
  unit: 'kg',
  isPublished: true,
  moderationStatus: 'approved',
  moderationNote: null,
  moderatedAt: '2026-01-03T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-03T00:00:00.000Z',
  owner: { id: 'farmer1', displayName: 'Nino', email: 'farmer@example.com' },
  farm: { id: 'farm1', name: 'Kakheti Farm', region: 'kakheti' },
};

describe('Admin product moderation HTTP authorization', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const prisma = {
    user: { findUnique: jest.fn() },
  };

  const adminService = {
    getProduct: jest.fn(),
    listProducts: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    stats: jest.fn(),
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AdminController],
      providers: [
        JwtStrategy,
        { provide: AdminService, useValue: adminService },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : undefined) },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = new JwtService({ secret: JWT_SECRET });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    adminService.getProduct.mockResolvedValue(pendingDetail);
    adminService.approve.mockResolvedValue(approvedListItem);
    adminService.reject.mockResolvedValue({
      ...approvedListItem,
      isPublished: false,
      moderationStatus: 'rejected',
      moderationNote: 'Unclear photos',
    });
  });

  it('returns 401 for an anonymous pending product preview', async () => {
    await request(app.getHttpServer()).get(`/api/admin/products/${PRODUCT_ID}`).expect(401);
    expect(adminService.getProduct).not.toHaveBeenCalled();
  });

  it('returns 403 when a buyer asks for a pending product preview', async () => {
    await request(app.getHttpServer())
      .get(`/api/admin/products/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${tokenFor('buyer')}`)
      .expect(403);
    expect(adminService.getProduct).not.toHaveBeenCalled();
  });

  it('returns 403 when a farmer asks for a pending product preview', async () => {
    await request(app.getHttpServer())
      .get(`/api/admin/products/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${tokenFor('farmer')}`)
      .expect(403);
    expect(adminService.getProduct).not.toHaveBeenCalled();
  });

  it('returns 403 when an unverified admin asks for a pending product preview', async () => {
    await request(app.getHttpServer())
      .get(`/api/admin/products/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${tokenFor('unverifiedAdmin')}`)
      .expect(403);
    expect(adminService.getProduct).not.toHaveBeenCalled();
  });

  it('lets an authorized admin load the complete pending product', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/admin/products/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .expect(200);

    expect(adminService.getProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin1', role: 'admin' }),
      PRODUCT_ID,
    );
    expect(response.body).toMatchObject({
      id: PRODUCT_ID,
      title: 'Kakheti hazelnuts',
      description: 'Export grade',
      category: 'nuts',
      priceFrom: 4.2,
      priceCurrency: 'USD',
      unit: 'kg',
      minQuantity: 100,
      attributes: { organic: true, caliber: '13-15' },
      farm: expect.objectContaining({ name: 'Kakheti Farm', region: 'kakheti' }),
      images: [expect.objectContaining({ url: '/api/uploads/products/prod1/photo.jpg' })],
    });
  });

  it('does not treat a farm document id as a product', async () => {
    adminService.getProduct.mockRejectedValue(new NotFoundException('Product not found'));

    await request(app.getHttpServer())
      .get('/api/admin/products/doc1')
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .expect(404);
    expect(adminService.getProduct).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' }),
      'doc1',
    );
  });

  it('keeps approve available only to an authorized admin', async () => {
    await request(app.getHttpServer()).post(`/api/admin/products/${PRODUCT_ID}/approve`).expect(401);

    await request(app.getHttpServer())
      .post(`/api/admin/products/${PRODUCT_ID}/approve`)
      .set('Authorization', `Bearer ${tokenFor('buyer')}`)
      .expect(403);

    const response = await request(app.getHttpServer())
      .post(`/api/admin/products/${PRODUCT_ID}/approve`)
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .expect(200);

    expect(adminService.approve).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin1', role: 'admin' }),
      PRODUCT_ID,
    );
    expect(response.body.moderationStatus).toBe('approved');
  });

  it('keeps reject with a note available only to an authorized admin', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/products/${PRODUCT_ID}/reject`)
      .send({ note: 'Unclear photos' })
      .expect(401);

    const response = await request(app.getHttpServer())
      .post(`/api/admin/products/${PRODUCT_ID}/reject`)
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send({ note: 'Unclear photos' })
      .expect(200);

    expect(adminService.reject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin1', role: 'admin' }),
      PRODUCT_ID,
      expect.objectContaining({ note: 'Unclear photos' }),
    );
    expect(response.body.moderationStatus).toBe('rejected');
  });
});
