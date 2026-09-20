import { BadRequestException, Injectable } from '@nestjs/common';
import {
  emptyTermsAcceptance,
  legalLocaleFor,
  type CurrentLegalDocuments,
  type LegalAcceptanceSnapshot,
  type LegalDocumentType,
  type LegalLocale,
} from '@agrobridge/shared';
import {
  LegalDocumentStatus,
  LegalDocumentType as PrismaLegalDocumentType,
  type LegalDocument,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicLegalDocument } from './legal.mapper';

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  async currentDocuments(locale?: LegalLocale): Promise<CurrentLegalDocuments> {
    const documents = await this.prisma.legalDocument.findMany({
      where: {
        status: LegalDocumentStatus.published,
        ...(locale ? { locale } : {}),
      },
      orderBy: [{ type: 'asc' }, { locale: 'asc' }, { version: 'asc' }],
    });

    return { documents: documents.map(toPublicLegalDocument) };
  }

  async requirePublishedTerms(locale: LegalLocale, version: string): Promise<LegalDocument> {
    const document = await this.prisma.legalDocument.findUnique({
      where: {
        type_locale_version: {
          type: PrismaLegalDocumentType.TERMS,
          locale,
          version,
        },
      },
    });

    if (!document || document.status !== LegalDocumentStatus.published) {
      throw new BadRequestException('Unknown or unpublished Terms of Use version');
    }

    return document;
  }

  async latestPublished(
    type: LegalDocumentType,
    locale: LegalLocale,
  ): Promise<LegalDocument | null> {
    return this.prisma.legalDocument.findFirst({
      where: {
        type,
        locale,
        status: LegalDocumentStatus.published,
      },
      orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async acceptanceSnapshot(userId: string, uiLocale?: string): Promise<LegalAcceptanceSnapshot> {
    const legalLocale = legalLocaleFor(uiLocale);
    const [currentTerms, currentPrivacy, termsAcceptance] = await Promise.all([
      this.latestPublished('TERMS', legalLocale),
      this.latestPublished('PRIVACY', legalLocale),
      this.prisma.legalAcceptance.findFirst({
        where: {
          userId,
          document: { type: PrismaLegalDocumentType.TERMS },
        },
        include: { document: true },
        orderBy: { acceptedAt: 'desc' },
      }),
    ]);

    return {
      terms: termsAcceptance
        ? {
            accepted: true,
            acceptedAt: termsAcceptance.acceptedAt.toISOString(),
            documentVersion: termsAcceptance.documentVersion,
            documentLocale: termsAcceptance.document.locale,
          }
        : emptyTermsAcceptance(),
      currentTerms: currentTerms ? toPublicLegalDocument(currentTerms) : null,
      currentPrivacy: currentPrivacy ? toPublicLegalDocument(currentPrivacy) : null,
    };
  }
}
