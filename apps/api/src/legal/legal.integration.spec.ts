import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import {
  LegalDocumentLocale,
  LegalDocumentStatus,
  LegalDocumentType,
  UserRole,
  type PrismaClient,
} from '@prisma/client';
import { PrismaRateLimitStore } from '../rate-limit/prisma-rate-limit.store';
import { RateLimitConfig } from '../rate-limit/rate-limit.config';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { createTestPrismaClient, describeWithDatabase } from '../test-support/database';
import { LegalService } from './legal.service';

describeWithDatabase()('legal acceptance (database)', () => {
  let prisma: PrismaClient;
  let legal: LegalService;
  const createdUserIds: string[] = [];
  const extraDocumentIds: string[] = [];

  function buildAuthService() {
    const config = {
      get: (key: string) => {
        if (key === 'JWT_EXPIRES_SECONDS') return '604800';
        return undefined;
      },
    } as unknown as ConfigService;
    const store = new PrismaRateLimitStore(prisma as unknown as PrismaService);
    const rateLimit = new RateLimitService(store, new RateLimitConfig(config), config);
    return new AuthService(
      prisma as unknown as PrismaService,
      new JwtService({ secret: 'legal-integration-secret' }),
      config,
      { notifyWelcome: jest.fn() } as never,
      { sendEmailCode: jest.fn() } as never,
      rateLimit,
      legal,
    );
  }

  async function ensureDocument(options: {
    id: string;
    type: LegalDocumentType;
    locale: LegalDocumentLocale;
    version: string;
    title: string;
  }) {
    await prisma.legalDocument.upsert({
      where: { id: options.id },
      create: {
        ...options,
        status: LegalDocumentStatus.published,
        publishedAt: new Date(),
        effectiveAt: new Date(),
      },
      update: {
        title: options.title,
        status: LegalDocumentStatus.published,
      },
    });
  }

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    legal = new LegalService(prisma as unknown as PrismaService);
    await ensureDocument({
      id: 'legal_terms_1_0_en',
      type: LegalDocumentType.TERMS,
      locale: LegalDocumentLocale.en,
      version: '1.0',
      title: 'Terms of Use',
    });
    await ensureDocument({
      id: 'legal_privacy_1_0_en',
      type: LegalDocumentType.PRIVACY,
      locale: LegalDocumentLocale.en,
      version: '1.0',
      title: 'Privacy Policy',
    });
    await ensureDocument({
      id: 'legal_terms_1_0_ka',
      type: LegalDocumentType.TERMS,
      locale: LegalDocumentLocale.ka,
      version: '1.0',
      title: 'Terms of Use KA',
    });
  });

  afterAll(async () => {
    await prisma.legalAcceptance.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    if (extraDocumentIds.length > 0) {
      await prisma.legalDocument.deleteMany({ where: { id: { in: extraDocumentIds } } });
    }
    await prisma.$disconnect();
  });

  it('rejects registration without Terms acceptance and does not create a user', async () => {
    const auth = buildAuthService();
    const email = `legal-reject-${randomUUID()}@example.test`;

    await expect(
      auth.register(
        {
          email,
          password: 'password1',
          role: 'buyer',
          acceptTerms: false,
          acceptedTermsVersion: '1.0',
          acceptedTermsLocale: 'en',
        },
        `203.0.113.${Math.floor(Math.random() * 200) + 10}`,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('records the exact Terms version during registration and does not accept Privacy', async () => {
    const auth = buildAuthService();
    const email = `legal-ok-${randomUUID()}@example.test`;
    const result = await auth.register(
      {
        email,
        password: 'password1',
        role: 'buyer',
        locale: 'en',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedTermsLocale: 'en',
      },
      `198.51.100.${Math.floor(Math.random() * 200) + 10}`,
    );

    createdUserIds.push(result.user.id);
    const acceptances = await prisma.legalAcceptance.findMany({
      where: { userId: result.user.id },
      include: { document: true },
    });

    expect(acceptances).toHaveLength(1);
    expect(acceptances[0]?.documentVersion).toBe('1.0');
    expect(acceptances[0]?.document.type).toBe(LegalDocumentType.TERMS);
    expect(acceptances[0]?.document.locale).toBe(LegalDocumentLocale.en);
    expect(acceptances.some((row) => row.document.type === LegalDocumentType.PRIVACY)).toBe(false);

    const snapshot = await legal.acceptanceSnapshot(result.user.id, 'en');
    expect(snapshot.terms.accepted).toBe(true);
    expect(snapshot.terms.documentVersion).toBe('1.0');
  });

  it('does not retroactively mark an existing user as having accepted Terms', async () => {
    const user = await prisma.user.create({
      data: {
        email: `legal-existing-${randomUUID()}@example.test`,
        role: UserRole.farmer,
        passwordHash: 'hash',
        locale: 'en',
        displayName: 'Existing',
      },
    });
    createdUserIds.push(user.id);

    const acceptances = await prisma.legalAcceptance.count({ where: { userId: user.id } });
    const snapshot = await legal.acceptanceSnapshot(user.id, 'en');

    expect(acceptances).toBe(0);
    expect(snapshot.terms.accepted).toBe(false);
    expect(snapshot.terms.acceptedAt).toBeNull();
  });

  it('keeps historical acceptance when a later Terms version is published', async () => {
    const auth = buildAuthService();
    const email = `legal-v2-${randomUUID()}@example.test`;
    const result = await auth.register(
      {
        email,
        password: 'password1',
        role: 'farmer',
        locale: 'en',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedTermsLocale: 'en',
      },
      `192.0.2.${Math.floor(Math.random() * 200) + 10}`,
    );
    createdUserIds.push(result.user.id);

    const laterId = `legal_terms_1_1_en_${randomUUID()}`;
    extraDocumentIds.push(laterId);
    await prisma.legalDocument.create({
      data: {
        id: laterId,
        type: LegalDocumentType.TERMS,
        locale: LegalDocumentLocale.en,
        version: '1.1',
        title: 'Terms of Use 1.1',
        status: LegalDocumentStatus.published,
        publishedAt: new Date(Date.now() + 60_000),
        effectiveAt: new Date(Date.now() + 60_000),
      },
    });

    const snapshot = await legal.acceptanceSnapshot(result.user.id, 'en');
    const original = await prisma.legalAcceptance.findFirst({
      where: { userId: result.user.id },
    });

    expect(snapshot.terms.accepted).toBe(true);
    expect(snapshot.terms.documentVersion).toBe('1.0');
    expect(snapshot.currentTerms?.version).toBe('1.1');
    expect(original?.documentId).toBe('legal_terms_1_0_en');
    expect(original?.documentVersion).toBe('1.0');
  });
});
