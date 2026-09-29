/** Mirrors packages/shared/src/locales.ts. Keep this list in the same order. */
export const APP_LOCALES = ['ka', 'en', 'ru', 'de', 'fr', 'it', 'es'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

export const LOCALE_LABELS: Record<AppLocale, string> = {
  ka: 'ქართული',
  en: 'English',
  ru: 'Русский',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
};

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

export function localeFromLanguageCode(code: string | null | undefined): AppLocale {
  const normalized = (code ?? '').toLowerCase().split('-')[0] ?? '';
  return isAppLocale(normalized) ? normalized : DEFAULT_LOCALE;
}
