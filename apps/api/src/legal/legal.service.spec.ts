import { BadRequestException } from '@nestjs/common';
import { LegalDocumentStatus } from '@prisma/client';
import { toPublicLegalDocument } from './legal.mapper';
import { LegalService } from './legal.service';

describe('LegalService', () => {
  const prisma = {
    legalDocument: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    legalAcceptance: {
      findFirst: jest.fn(),
    },
  };

  const publishedTerms = {
    id: 'legal_terms_1_0_en',
    type: 'TERMS' as const,
    version: '1.0',
    locale: 'en' as const,
    title: 'Terms of Use',
    status: LegalDocumentStatus.published,
    publishedAt: new Date('2026-09-20T00:00:00.000Z'),
    effectiveAt: new Date('2026-09-20T00:00:00.000Z'),
    createdAt: new Date('2026-09-20T00:00:00.000Z'),
    updatedAt: new Date('2026-09-20T00:00:00.000Z'),
  };

  const publishedPrivacy = {
    ...publishedTerms,
    id: 'legal_privacy_1_0_en',
    type: 'PRIVACY' as const,
    title: 'Privacy Policy',
  };

  let service: LegalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LegalService(prisma as never);
  });

  it('omits internal document ids from the public DTO', () => {
    const publicDocument = toPublicLegalDocument(publishedTerms);
    expect(publicDocument).toEqual({
      type: 'TERMS',
      version: '1.0',
      locale: 'en',
      title: 'Terms of Use',
      publishedAt: '2026-09-20T00:00:00.000Z',
      effectiveAt: '2026-09-20T00:00:00.000Z',
    });
    expect(publicDocument).not.toHaveProperty('id');
  });

  it('rejects an unpublished Terms version', async () => {
    prisma.legalDocument.findUnique.mockResolvedValue({
      ...publishedTerms,
      status: LegalDocumentStatus.draft,
    });

    await expect(service.requirePublishedTerms('en', '1.0')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not invent a Terms acceptance for an existing user', async () => {
    prisma.legalDocument.findFirst.mockImplementation(
      ({ where }: { where: { type: string } }) =>
        Promise.resolve(where.type === 'TERMS' ? publishedTerms : publishedPrivacy),
    );
    prisma.legalAcceptance.findFirst.mockResolvedValue(null);

    const snapshot = await service.acceptanceSnapshot('existing-user', 'en');

    expect(snapshot.terms.accepted).toBe(false);
    expect(snapshot.terms.acceptedAt).toBeNull();
    expect(snapshot.terms.documentVersion).toBeNull();
    expect(snapshot.currentTerms?.version).toBe('1.0');
    expect(snapshot.currentPrivacy?.type).toBe('PRIVACY');
    expect(snapshot).not.toHaveProperty('privacy');
  });

  it('returns the exact accepted Terms version without marking Privacy as accepted', async () => {
    prisma.legalDocument.findFirst.mockImplementation(
      ({ where }: { where: { type: string } }) =>
        Promise.resolve(where.type === 'TERMS' ? publishedTerms : publishedPrivacy),
    );
    prisma.legalAcceptance.findFirst.mockResolvedValue({
      documentVersion: '1.0',
      acceptedAt: new Date('2026-09-20T12:00:00.000Z'),
      document: publishedTerms,
    });

    const snapshot = await service.acceptanceSnapshot('user_1', 'ru');

    expect(snapshot.terms).toEqual({
      accepted: true,
      acceptedAt: '2026-09-20T12:00:00.000Z',
      documentVersion: '1.0',
      documentLocale: 'en',
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/privacy[^}]*accepted":true/i);
  });
});
