import { BadRequestException, Injectable } from '@nestjs/common';
import {
  emptyTermsAcceptance,
  LEGAL_DOCUMENT_TYPES,
  LEGAL_LOCALES,
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

/** Newest published document wins; version is the last deterministic tie-breaker. */
const CURRENT_PUBLISHED_ORDER = [
  { effectiveAt: 'desc' as const },
  { publishedAt: 'desc' as const },
  { createdAt: 'desc' as const },
  { version: 'desc' as const },
];

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  async currentDocuments(locale?: LegalLocale): Promise<CurrentLegalDocuments> {
    const locales = locale ? [locale] : [...LEGAL_LOCALES];
    const documents: LegalDocument[] = [];

    for (const legalLocale of locales) {
      for (const type of LEGAL_DOCUMENT_TYPES) {
        const current = await this.latestPublished(type, legalLocale);
        if (current) {
          documents.push(current);
        }
      }
    }

    return { documents: documents.map(toPublicLegalDocument) };
  }

  /**
   * Resolves the current published TERMS for `locale`. The client version is a
   * confirmation only — it cannot select an older published document.
   */
  async requirePublishedTerms(locale: LegalLocale, version: string): Promise<LegalDocument> {
    const current = await this.latestPublished('TERMS', locale);
    if (!current || current.version !== version) {
      throw new BadRequestException(
        'acceptedTermsVersion must match the current published Terms of Use version',
      );
    }

    return current;
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
      orderBy: CURRENT_PUBLISHED_ORDER,
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
