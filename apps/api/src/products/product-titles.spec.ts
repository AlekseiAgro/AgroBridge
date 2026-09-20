import { readFileSync } from 'fs';
import { join } from 'path';
import {
  INTERNAL_DRAFT_PRODUCT_TITLES,
  isInternalDraftProductTitle,
  isPubliclyListedProduct,
  localizeProductDescription,
  localizeProductTitle,
  PRODUCT_DESCRIPTION_I18N,
  PRODUCT_TITLE_I18N,
} from '@agrobridge/shared';

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

describe('public product titles', () => {
  it('treats empty and locale draft placeholders as internal', () => {
    expect(isInternalDraftProductTitle('Новый товар')).toBe(true);
    expect(isInternalDraftProductTitle('Untitled product')).toBe(true);
    expect(isInternalDraftProductTitle('  ')).toBe(true);
    expect(isInternalDraftProductTitle('')).toBe(true);
    expect(isInternalDraftProductTitle(null)).toBe(true);
    expect(isInternalDraftProductTitle('Fresh Kakheti peaches')).toBe(false);
  });

  it('stays in sync with product.draftTitle in every UI locale', () => {
    const locales = ['en', 'ru', 'ka', 'de', 'fr', 'it', 'es'] as const;
    const draftTitles = locales.map((locale) => {
      const messages = JSON.parse(
        readFileSync(join(__dirname, '../../../web/messages', `${locale}.json`), 'utf8'),
      ) as { product: { draftTitle: string } };
      return messages.product.draftTitle;
    });
    expect(new Set(draftTitles)).toEqual(new Set(INTERNAL_DRAFT_PRODUCT_TITLES));
  });

  it('keeps published approved products public only when the title is real', () => {
    expect(
      isPubliclyListedProduct({
        isPublished: true,
        moderationStatus: 'approved',
        title: 'Fresh Kakheti peaches',
      }),
    ).toBe(true);
    expect(
      isPubliclyListedProduct({
        isPublished: true,
        moderationStatus: 'approved',
        title: 'Новый товар',
      }),
    ).toBe(false);
    expect(
      isPubliclyListedProduct({
        isPublished: true,
        moderationStatus: 'approved',
        title: '',
      }),
    ).toBe(false);
    expect(
      isPubliclyListedProduct({
        isPublished: false,
        moderationStatus: 'approved',
        title: 'Fresh Kakheti peaches',
      }),
    ).toBe(false);
  });
});

describe('localizeProductDescription', () => {
  it('returns Russian description for a known product', () => {
    expect(
      localizeProductDescription(
        'Seasonal freestone peaches, hand-picked for export.',
        'ru',
      ),
    ).toBe('Сезонные персики свободной косточки, собранные вручную на экспорт.');
  });

  it('falls back to the stored description when translation is missing', () => {
    expect(localizeProductDescription('Custom farm description.', 'de')).toBe(
      'Custom farm description.',
    );
  });

  it('covers every catalog seed description for all non-English locales', () => {
    const locales = ['ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
    for (const [description, translations] of Object.entries(PRODUCT_DESCRIPTION_I18N)) {
      for (const locale of locales) {
        expect(translations[locale]).toBeTruthy();
        expect(localizeProductDescription(description, locale)).toBe(translations[locale]);
      }
    }
  });
});
