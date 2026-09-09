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
import { attachmentHeader, FarmDocumentsController } from './farm-documents.controller';
import { FarmsService } from './farms.service';

const JWT_SECRET = 'test-secret';
const DOCUMENT_ID = 'doc1';
const DOCUMENT_KEY = 'farms/farm1/documents/9f0e.bin';

type TestUser = {
  id: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
  blockedAt?: Date | null;
};

const USERS: Record<string, TestUser> = {
  owner: { id: 'owner1', role: 'farmer', emailVerifiedAt: new Date() },
  otherFarmer: { id: 'farmer2', role: 'farmer', emailVerifiedAt: new Date() },
  buyer: { id: 'buyer1', role: 'buyer', emailVerifiedAt: new Date() },
  admin: { id: 'admin1', role: 'admin', emailVerifiedAt: new Date() },
  unverified: { id: 'owner1', role: 'farmer', emailVerifiedAt: null },
  blocked: {
    id: 'blocked1',
    role: 'farmer',
    emailVerifiedAt: new Date(),
    blockedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
};

describe('FarmDocumentsController (server-side authorization)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const prisma = {
    user: { findUnique: jest.fn() },
    farmDocument: { findUnique: jest.fn() },
  };

  const storage = {
    openReadStream: jest.fn(),
    getDriver: jest.fn(),
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
      blockedAt: user.blockedAt ?? null,
      blockedReason: user.blockedAt ? 'This account has been blocked' : null,
      authVersion: 0,
    };
  }

  /** Signs a token for one of the fixture users and stubs the JwtStrategy lookup. */
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
      controllers: [FarmDocumentsController, UploadsController],
      providers: [
        JwtStrategy,
        FarmsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: RatingsService, useValue: {} },
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
    storage.openReadStream.mockImplementation(() => Readable.from([Buffer.from('pdf-bytes')]));
    prisma.farmDocument.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === DOCUMENT_ID
        ? {
            key: DOCUMENT_KEY,
            fileName: 'passport scan.pdf',
            mimeType: 'application/pdf',
            farm: { ownerId: USERS.owner.id },
          }
        : null,
    );
  });

  it('denies unauthenticated requests', async () => {
    await request(app.getHttpServer()).get(`/api/farms/documents/${DOCUMENT_ID}/file`).expect(401);

    expect(storage.openReadStream).not.toHaveBeenCalled();
    expect(prisma.farmDocument.findUnique).not.toHaveBeenCalled();
  });

  it('serves the document to the farm owner', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/farms/documents/${DOCUMENT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
      .expect(200);

    expect(storage.openReadStream).toHaveBeenCalledWith(DOCUMENT_KEY);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="passport scan.pdf"; filename*=UTF-8\'\'passport%20scan.pdf',
    );
    expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.text).toBe('pdf-bytes');
  });

  it('serves the document to an admin', async () => {
    await request(app.getHttpServer())
      .get(`/api/farms/documents/${DOCUMENT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .expect(200);

    expect(storage.openReadStream).toHaveBeenCalledWith(DOCUMENT_KEY);
  });

  it('denies a farmer who does not own the farm (IDOR)', async () => {
    await request(app.getHttpServer())
      .get(`/api/farms/documents/${DOCUMENT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('otherFarmer')}`)
      .expect(404);

    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('denies a buyer with the same 404 as a missing document', async () => {
    await request(app.getHttpServer())
      .get(`/api/farms/documents/${DOCUMENT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('buyer')}`)
      .expect(404);

    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('denies users who have not confirmed their email', async () => {
    await request(app.getHttpServer())
      .get(`/api/farms/documents/${DOCUMENT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('unverified')}`)
      .expect(403);

    expect(storage.openReadStream).not.toHaveBeenCalled();
    expect(prisma.farmDocument.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a blocked user with the existing JWT blocked-user response', async () => {
    await request(app.getHttpServer())
      .get(`/api/farms/documents/${DOCUMENT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('blocked')}`)
      .expect(401);

    expect(storage.openReadStream).not.toHaveBeenCalled();
    expect(prisma.farmDocument.findUnique).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown document without revealing existence', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/farms/documents/missing/file')
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
      .expect(404);

    expect(response.body.message).toBe('Document not found');
    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('rejects path traversal in the document id before storage access', async () => {
    await request(app.getHttpServer())
      .get('/api/farms/documents/..%2F..%2F..%2Fetc%2Fpasswd/file')
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
      .expect(404);

    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('does not derive the storage key from the URL farmId or filename', async () => {
    await request(app.getHttpServer())
      .get(`/api/farms/documents/${DOCUMENT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
      .expect(200);

    expect(storage.openReadStream).toHaveBeenCalledTimes(1);
    expect(storage.openReadStream).toHaveBeenCalledWith(DOCUMENT_KEY);
  });

  it('falls back to application/octet-stream for a non-allowlisted MIME type', async () => {
    prisma.farmDocument.findUnique.mockResolvedValue({
      key: DOCUMENT_KEY,
      fileName: 'id-card.pdf',
      mimeType: 'text/html',
      farm: { ownerId: USERS.owner.id },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/farms/documents/${DOCUMENT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
      .expect(200);

    expect(response.headers['content-type']).toBe('application/octet-stream');
  });

  it('sanitizes user-controlled filenames in Content-Disposition', async () => {
    prisma.farmDocument.findUnique.mockResolvedValue({
      key: DOCUMENT_KEY,
      fileName: 'id\r\nSet-Cookie: x=1 "card".pdf',
      mimeType: 'application/pdf',
      farm: { ownerId: USERS.owner.id },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/farms/documents/${DOCUMENT_ID}/file`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
      .expect(200);

    expect(response.headers['content-disposition']).not.toMatch(/Set-Cookie/i);
    expect(response.headers['content-disposition']).not.toMatch(/\r|\n/);
    expect(response.headers['content-disposition']).toContain('attachment;');
  });

  it('no longer exposes farm documents through the public uploads route', async () => {
    await request(app.getHttpServer())
      .get('/api/uploads/farms/farm1/documents/9f0e.bin')
      .expect(404);

    expect(storage.openReadStream).not.toHaveBeenCalled();
    expect(storage.resolveLocalPath).not.toHaveBeenCalled();
  });
});

describe('attachmentHeader', () => {
  it('quotes an ASCII filename and emits an RFC 5987 fallback', () => {
    expect(attachmentHeader('passport scan.pdf')).toBe(
      'attachment; filename="passport scan.pdf"; filename*=UTF-8\'\'passport%20scan.pdf',
    );
  });

  it('strips characters that could inject a response header', () => {
    const header = attachmentHeader('x"\r\nContent-Type: text/html.pdf');
    expect(header).not.toMatch(/\r|\n/);
    expect(header).not.toContain('Content-Type:');
    expect(header.startsWith('attachment; filename="')).toBe(true);
  });
});
