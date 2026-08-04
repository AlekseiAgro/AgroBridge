/**
 * UI languages in product priority order.
 * ka → en → ru → de → fr → it → es
 */
export const LOCALES = ['ka', 'en', 'ru', 'de', 'fr', 'it', 'es'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  ka: 'ქართული',
  en: 'English',
  ru: 'Русский',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Infer the writing language of a chat message from its script.
 * Latin-script languages (en/de/fr/it/es) cannot be separated reliably here,
 * so they fall back to the declared UI locale of the sender.
 */
export function detectMessageLocale(text: string, fallback: Locale): Locale {
  const sample = text.normalize('NFC');
  if (/[\u10A0-\u10FF]/.test(sample)) {
    return 'ka';
  }
  if (/[\u0400-\u04FF]/.test(sample)) {
    return 'ru';
  }
  return isLocale(fallback) ? fallback : DEFAULT_LOCALE;
}
