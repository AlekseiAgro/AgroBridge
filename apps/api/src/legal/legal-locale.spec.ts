import {
  CURRENT_LEGAL_VERSION,
  currentDocumentOfType,
  emptyTermsAcceptance,
  isLegalDocumentType,
  isLegalLocale,
  legalLocaleFor,
  type PublicLegalDocument,
} from '@agrobridge/shared';

describe('legal locale helpers', () => {
  it('treats Georgian UI as the Georgian legal locale and every other UI locale as English', () => {
    expect(legalLocaleFor('ka')).toBe('ka');
    expect(legalLocaleFor('en')).toBe('en');
    expect(legalLocaleFor('ru')).toBe('en');
    expect(legalLocaleFor('de')).toBe('en');
    expect(legalLocaleFor('fr')).toBe('en');
    expect(legalLocaleFor('it')).toBe('en');
    expect(legalLocaleFor('es')).toBe('en');
    expect(legalLocaleFor(undefined)).toBe('en');
  });

  it('does not treat unsupported UI locales as legal document locales', () => {
    expect(isLegalLocale('ka')).toBe(true);
    expect(isLegalLocale('en')).toBe(true);
    expect(isLegalLocale('ru')).toBe(false);
    expect(isLegalLocale('de')).toBe(false);
    expect(isLegalLocale('fr')).toBe(false);
    expect(isLegalLocale('it')).toBe(false);
    expect(isLegalLocale('es')).toBe(false);
  });

  it('keeps the document-type list open for later additions without treating Privacy as Terms', () => {
    expect(isLegalDocumentType('TERMS')).toBe(true);
    expect(isLegalDocumentType('PRIVACY')).toBe(true);
    expect(isLegalDocumentType('COOKIE')).toBe(false);
    expect(CURRENT_LEGAL_VERSION).toBe('1.0');
    expect(emptyTermsAcceptance()).toEqual({
      accepted: false,
      acceptedAt: null,
      documentVersion: null,
      documentLocale: null,
    });
  });

  it('does not guess a Terms version from document array order', () => {
    const older: PublicLegalDocument = {
      type: 'TERMS',
      version: '0.9',
      locale: 'en',
      title: 'Old Terms',
      publishedAt: null,
      effectiveAt: null,
    };
    const current: PublicLegalDocument = {
      type: 'TERMS',
      version: '1.0',
      locale: 'en',
      title: 'Terms of Use',
      publishedAt: null,
      effectiveAt: null,
    };
    const privacy: PublicLegalDocument = {
      type: 'PRIVACY',
      version: '1.0',
      locale: 'en',
      title: 'Privacy Policy',
      publishedAt: null,
      effectiveAt: null,
    };

    expect(currentDocumentOfType([privacy], 'TERMS')).toBeNull();
    expect(currentDocumentOfType([older, current, privacy], 'TERMS')).toBeNull();
    expect(currentDocumentOfType([privacy, current], 'TERMS')).toEqual(current);
  });
});
