import { isLegalDocSlug, LEGAL_DOC_SLUGS } from '@agrobridge/shared';

describe('legal document slugs', () => {
  it('accepts the four public documents', () => {
    expect(LEGAL_DOC_SLUGS).toEqual(['privacy', 'terms', 'cookies', 'rules']);
    expect(isLegalDocSlug('privacy')).toBe(true);
    expect(isLegalDocSlug('terms')).toBe(true);
    expect(isLegalDocSlug('cookies')).toBe(true);
    expect(isLegalDocSlug('rules')).toBe(true);
  });

  it('rejects unknown paths', () => {
    expect(isLegalDocSlug('admin')).toBe(false);
    expect(isLegalDocSlug('')).toBe(false);
  });
});
