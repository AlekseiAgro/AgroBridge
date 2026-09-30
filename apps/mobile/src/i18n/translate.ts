import { en, type MessageKey } from './en';
import { ru } from './ru';
import { type AppLocale } from './locales';

const showOriginal: Record<Exclude<AppLocale, 'en' | 'ru'>, Pick<Record<MessageKey, string>, 'catalog.showOriginal' | 'catalog.showTranslation' | 'catalog.originalLanguage'>> = {
  ka: {
    'catalog.showOriginal': 'ორიგინალის ჩვენება',
    'catalog.showTranslation': 'თარგმანის ჩვენება',
    'catalog.originalLanguage': 'ორიგინალი · {language}',
  },
  de: {
    'catalog.showOriginal': 'Original anzeigen',
    'catalog.showTranslation': 'Übersetzung anzeigen',
    'catalog.originalLanguage': 'Original · {language}',
  },
  fr: {
    'catalog.showOriginal': 'Afficher l’original',
    'catalog.showTranslation': 'Afficher la traduction',
    'catalog.originalLanguage': 'Original · {language}',
  },
  it: {
    'catalog.showOriginal': 'Mostra originale',
    'catalog.showTranslation': 'Mostra traduzione',
    'catalog.originalLanguage': 'Originale · {language}',
  },
  es: {
    'catalog.showOriginal': 'Mostrar original',
    'catalog.showTranslation': 'Mostrar traducción',
    'catalog.originalLanguage': 'Original · {language}',
  },
};

const dictionaries: Partial<Record<AppLocale, Partial<Record<MessageKey, string>>>> = {
  ru,
  ka: showOriginal.ka,
  de: showOriginal.de,
  fr: showOriginal.fr,
  it: showOriginal.it,
  es: showOriginal.es,
};

export function translate(
  locale: AppLocale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const localized = locale === 'en' ? undefined : dictionaries[locale]?.[key];
  const template = localized ?? en[key];
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
