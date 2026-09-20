export const LEGAL_LOCALES = ['ka', 'en'] as const;
export type LegalLocale = (typeof LEGAL_LOCALES)[number];

export const DEFAULT_LEGAL_LOCALE: LegalLocale = 'en';

export const LEGAL_DOCUMENT_TYPES = ['TERMS', 'PRIVACY'] as const;
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const CURRENT_LEGAL_VERSION = '1.0';

export function isLegalLocale(value: string): value is LegalLocale {
  return (LEGAL_LOCALES as readonly string[]).includes(value);
}

export function isLegalDocumentType(value: string): value is LegalDocumentType {
  return (LEGAL_DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** Georgian UI reads the Georgian legal text; every other UI locale uses English. */
export function legalLocaleFor(uiLocale: string | null | undefined): LegalLocale {
  return uiLocale === 'ka' ? 'ka' : DEFAULT_LEGAL_LOCALE;
}

export type PublicLegalDocument = {
  type: LegalDocumentType;
  version: string;
  locale: LegalLocale;
  title: string;
  publishedAt: string | null;
  effectiveAt: string | null;
};

export type CurrentLegalDocuments = {
  documents: PublicLegalDocument[];
};

export type TermsAcceptanceState = {
  accepted: boolean;
  acceptedAt: string | null;
  documentVersion: string | null;
  documentLocale: LegalLocale | null;
};

export type LegalAcceptanceSnapshot = {
  terms: TermsAcceptanceState;
  currentTerms: PublicLegalDocument | null;
  currentPrivacy: PublicLegalDocument | null;
};

export function emptyTermsAcceptance(): TermsAcceptanceState {
  return {
    accepted: false,
    acceptedAt: null,
    documentVersion: null,
    documentLocale: null,
  };
}

/**
 * Pick the current document of one type from GET /legal/documents/current.
 * The API returns at most one current published row per type+locale, so a
 * unique type match is identity — not a version guess from array order.
 */
export function currentDocumentOfType(
  documents: readonly PublicLegalDocument[],
  type: LegalDocumentType,
): PublicLegalDocument | null {
  const matches = documents.filter((document) => document.type === type);
  return matches.length === 1 ? (matches[0] ?? null) : null;
}
