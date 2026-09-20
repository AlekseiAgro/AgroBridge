import {
  CURRENT_LEGAL_VERSION,
  emptyTermsAcceptance,
  isLegalDocumentType,
  isLegalLocale,
  legalLocaleFor,
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
});
