import type { LegalDocument } from '@prisma/client';
import type { PublicLegalDocument } from '@agrobridge/shared';

export function toPublicLegalDocument(document: LegalDocument): PublicLegalDocument {
  return {
    type: document.type,
    version: document.version,
    locale: document.locale,
    title: document.title,
    publishedAt: document.publishedAt?.toISOString() ?? null,
    effectiveAt: document.effectiveAt?.toISOString() ?? null,
  };
}
