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
