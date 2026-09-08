import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, overlay: unknown): unknown {
  if (Array.isArray(overlay)) {
    return overlay;
  }
  if (isRecord(base) && isRecord(overlay)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
      result[key] = key in base ? deepMerge(base[key], value) : value;
    }
    return result;
  }
  return overlay;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default as Record<
    string,
    unknown
  >;
  const enLegal = (await import(`../../messages/legal/en.json`)).default;
  let legal: unknown = enLegal;
  if (locale !== 'en') {
    try {
      const localized = (await import(`../../messages/legal/${locale}.json`)).default;
      legal = deepMerge(enLegal, localized);
    } catch {
      legal = enLegal;
    }
  }

  return {
    locale,
    messages: { ...messages, legal },
  };
});
