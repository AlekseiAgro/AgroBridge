import { en, type MessageKey } from './en';
import { ru } from './ru';
import { type AppLocale } from './locales';

const dictionaries: Partial<Record<AppLocale, Partial<Record<MessageKey, string>>>> = {
  ru,
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
