import { localizeProductTitle, PRODUCT_TITLE_I18N } from '@agrobridge/shared';

describe('localizeProductTitle', () => {
  it('returns Russian title for a known product', () => {
    expect(localizeProductTitle('Fresh Kakheti peaches', 'ru')).toBe(
      'Свежие персики из Кахетии',
    );
  });

  it('keeps English title for en locale', () => {
    expect(localizeProductTitle('Guria mandarins', 'en')).toBe('Guria mandarins');
  });

  it('falls back to the stored title when translation is missing', () => {
    expect(localizeProductTitle('Custom farm crop', 'ru')).toBe('Custom farm crop');
  });

  it('covers every catalog seed title for all non-English locales', () => {
    const locales = ['ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
    for (const [title, translations] of Object.entries(PRODUCT_TITLE_I18N)) {
      for (const locale of locales) {
        expect(translations[locale]).toBeTruthy();
        expect(localizeProductTitle(title, locale)).toBe(translations[locale]);
      }
    }
  });
});
