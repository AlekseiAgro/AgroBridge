import { readFileSync } from 'fs';
import { join } from 'path';

import {
  renderedProductTranslationDiffers,
  translationIndicator,
  visibleTranslationText,
} from '../../../web/src/lib/product-translation';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

const COPY = {
  en: {
    translatedAutomatically: 'Translated automatically · Show original',
    showingOriginal: 'Original · {language} · Show translation',
    translatedMark: 'Translated',
    originalMark: 'Original',
  },
  ka: {
    translatedAutomatically: 'ავტომატურად ითარგმნა · ორიგინალის ჩვენება',
    showingOriginal: 'ორიგინალი · {language} · თარგმანის ჩვენება',
    translatedMark: 'ნათარგმნი',
    originalMark: 'ორიგინალი',
  },
  ru: {
    translatedAutomatically: 'Переведено автоматически · Показать оригинал',
    showingOriginal: 'Оригинал · {language} · Показать перевод',
    translatedMark: 'Переведено',
    originalMark: 'Оригинал',
  },
  de: {
    translatedAutomatically: 'Automatisch übersetzt · Original anzeigen',
    showingOriginal: 'Original · {language} · Übersetzung anzeigen',
    translatedMark: 'Übersetzt',
    originalMark: 'Original',
  },
  fr: {
    translatedAutomatically: 'Traduit automatiquement · Afficher l’original',
    showingOriginal: 'Original · {language} · Afficher la traduction',
    translatedMark: 'Traduit',
    originalMark: 'Original',
  },
  it: {
    translatedAutomatically: 'Tradotto automaticamente · Mostra originale',
    showingOriginal: 'Originale · {language} · Mostra traduzione',
    translatedMark: 'Tradotto',
    originalMark: 'Originale',
  },
  es: {
    translatedAutomatically: 'Traducido automáticamente · Mostrar original',
    showingOriginal: 'Original · {language} · Mostrar traducción',
    translatedMark: 'Traducido',
    originalMark: 'Original',
  },
} as const;

type Nested = Record<string, unknown>;

function messages(locale: string): Nested {
  return JSON.parse(readFileSync(join(WEB, 'messages', `${locale}.json`), 'utf8')) as Nested;
}

function read(obj: Nested, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Nested)[key];
  }, obj);
  if (typeof value !== 'string') {
    throw new Error(`Missing string ${path}`);
  }
  return value;
}

const translatedProduct = {
  titleDisplay: 'Сухое розе Саперави',
  titleSource: 'Dry Saperavi rosé',
  originDisplay: 'Кахетия',
  originSource: 'Kakheti district',
  descriptionDisplay: 'Светлое сухое розе.',
  descriptionSource: 'Pale dry rosé.',
  historyDisplay: 'Семейное хозяйство.',
  historySource: 'A family farm.',
  marketsDisplay: 'Германия',
  marketsSource: 'Germany',
};

describe('product detail translation UX', () => {
  const detail = readFileSync(join(WEB, 'src/app/[locale]/products/[id]/page.tsx'), 'utf8');

  it.each(LOCALES)('%s has the shared translation control and field marks', (locale) => {
    const data = messages(locale);
    expect(read(data, 'catalog.translatedAutomatically')).toBe(COPY[locale].translatedAutomatically);
    expect(read(data, 'catalog.showingOriginal')).toBe(COPY[locale].showingOriginal);
    expect(read(data, 'catalog.translatedMark')).toBe(COPY[locale].translatedMark);
    expect(read(data, 'catalog.originalMark')).toBe(COPY[locale].originalMark);
  });

  it('shows the shared control and marks only for rendered translated fields', () => {
    expect(renderedProductTranslationDiffers(translatedProduct)).toBe(true);
    expect(translationIndicator(false, translatedProduct.titleDisplay, translatedProduct.titleSource)).toBe(
      'translated',
    );
    expect(translationIndicator(false, translatedProduct.originDisplay, translatedProduct.originSource)).toBe(
      'translated',
    );
    expect(
      translationIndicator(false, translatedProduct.descriptionDisplay, translatedProduct.descriptionSource),
    ).toBe('translated');
    expect(translationIndicator(false, translatedProduct.historyDisplay, translatedProduct.historySource)).toBe(
      'translated',
    );
    expect(translationIndicator(false, translatedProduct.marketsDisplay, translatedProduct.marketsSource)).toBe(
      'translated',
    );
    expect(translationIndicator(false, 'Saperavi rosé', 'Saperavi rosé')).toBeNull();
    expect(detail.match(/<TranslationMark/g)).toHaveLength(5);

    const characteristics = detail.slice(
      detail.indexOf("t('sections.attributes')"),
      detail.indexOf("t('description')"),
    );
    expect(characteristics).toContain('<dd>{varietyValue}</dd>');
    expect(characteristics).not.toContain('TranslationMark');
    expect(characteristics).not.toContain('translatedMark');
  });

  it('keeps variety as stored text and outside the translation comparison', () => {
    expect(detail).toContain('const varietyValue = product.source?.variety ?? product.variety;');
    expect(detail).toContain('<dd>{varietyValue}</dd>');
    expect(detail).not.toContain('display={product.display?.variety');
    expect(detail).not.toContain('varietyDisplay');
    expect(detail).not.toContain('farm.source.description');
    expect(detail).not.toContain('farm.display?.description');
  });

  it('does not show the control when only an unrendered farm description would differ', () => {
    expect(
      renderedProductTranslationDiffers({
        titleDisplay: 'ყურძენი',
        titleSource: 'ყურძენი',
        originDisplay: 'ახმეტა',
        originSource: 'ახმეტა',
        descriptionDisplay: null,
        descriptionSource: null,
        historyDisplay: null,
        historySource: null,
        marketsDisplay: '',
        marketsSource: '',
      }),
    ).toBe(false);
  });

  it('switches rendered fields to source and back', () => {
    expect(visibleTranslationText(false, 'Сухое розе Саперави', 'Dry Saperavi rosé')).toBe(
      'Сухое розе Саперави',
    );
    expect(translationIndicator(false, 'Сухое розе Саперави', 'Dry Saperavi rosé')).toBe('translated');
    expect(visibleTranslationText(false, 'ქისი ხიხვი', 'ქისი ხიხვი')).toBe('ქისი ხიხვი');

    expect(visibleTranslationText(true, 'Сухое розе Саперави', 'Dry Saperavi rosé')).toBe('Dry Saperavi rosé');
    expect(translationIndicator(true, 'Кахетия', 'Kakheti district')).toBe('original');
    expect(visibleTranslationText(true, 'ქისი ხიხვი', 'ქისი ხიხვი')).toBe('ქისი ხიხვი');
    expect(translationIndicator(true, 'Киси', 'Киси')).toBeNull();

    expect(visibleTranslationText(false, 'Сухое розе Саперави', 'Dry Saperavi rosé')).toBe(
      'Сухое розе Саперави',
    );
    expect(translationIndicator(false, 'Германия', 'Germany')).toBe('translated');
  });
});
